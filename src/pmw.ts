import {
  type State,
  type Property,
  type Walkthrough,
  type Finding,
  type PropertyType,
  type Request,
  type Task,
  uid,
  log,
  classify,
  ASSESSMENT_LINK_DAYS,
  accessToken,
  mayApprove,
  accountName,
  norm,
} from "./model";
import { workStatus } from "./work";

/** Ontario HST. Stored on each walkthrough, never read live: a rate that moved
    would make an assessment stop matching the total it was approved at. */
export const HST = 0.13;
/** Quotes are whole dollars; tax is not, so it gets its own formatter. */
export const money2 = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Two requests belong to the same property when the same customer gave the same
 * address. Used only to rebuild links for states saved before properties
 * existed — once a request carries a propertyId, the key is never consulted
 * again, so editing an address later cannot silently re-home a request.
 */
export const propertyKey = (p: {
  address: string;
  city: string;
  accountId: string;
}) => [norm(p.address), norm(p.city), p.accountId].join("|");

/**
 * Backfills the PMW record arrays and gives every pre-existing request a
 * property. Additive and idempotent, in the shape of migrateDispatch: a request
 * that already has a propertyId is left exactly as it was, which is why seeded
 * state passes through unchanged.
 *
 * A draft is skipped: it has no address yet, and this runs on every commit, so
 * a new request used to be given a property with an empty address the moment
 * it was created, which typing the address never updated (ADR 064). It is
 * linked here on the first commit after it is submitted, by the address it
 * was submitted with — or already carries the saved address it was booked at.
 */
export function migratePmw(s: State) {
  s.properties ??= [];
  s.walkthroughs ??= [];
  s.findings ??= [];
  for (const r of s.requests) {
    if (r.propertyId || r.status === "Draft") continue;
    const key = propertyKey(r);
    let property = s.properties.find((p) => propertyKey(p) === key);
    if (!property) {
      property = {
        id: uid(),
        accountId: r.accountId,
        address: r.address,
        city: r.city,
        ...(r.unit ? { unit: r.unit } : {}),
        ...(r.postalCode ? { postalCode: r.postalCode } : {}),
      } satisfies Property;
      s.properties.push(property);
    }
    r.propertyId = property.id;
  }
  return s;
}

/* ── Capture ─────────────────────────────────────────────────────────────── */

/** Next free assessment number. Read from the records, never a stored counter. */
export const nextAssessmentId = (s: State) =>
  "PMW-" +
  String(
    s.walkthroughs.reduce(
      (n, w) => Math.max(n, Number(w.assessmentId.replace(/\D/g, "")) || 0),
      0,
    ) + 1,
  ).padStart(4, "0");

export function createWalkthrough(
  s: State,
  propertyId: string,
  operatorId = "Operator",
) {
  const w: Walkthrough = {
    id: uid(),
    assessmentId: nextAssessmentId(s),
    propertyId,
    operatorId,
    date: new Date(s.clock).toISOString(),
    status: "Draft",
    taxRate: HST,
  };
  s.walkthroughs.push(w);
  return w;
}

export const findingsFor = (s: State, walkthroughId: string) =>
  s.findings
    .filter((f) => f.walkthroughId === walkthroughId)
    .sort((a, b) => a.number - b.number);

/**
 * Finding numbers count up from the highest already issued, so deleting the
 * middle of a walkthrough leaves 01, 03 rather than renumbering — the number
 * printed on a PDF has to keep meaning the same thing afterwards.
 */
export function addFinding(
  s: State,
  walkthroughId: string,
  values: Partial<Finding> = {},
) {
  const f: Finding = {
    id: uid(),
    walkthroughId,
    number:
      findingsFor(s, walkthroughId).reduce((n, f) => Math.max(n, f.number), 0) +
      1,
    area: "",
    title: "",
    observed: "",
    proposed: "",
    photos: [],
    internalNotes: "",
    customerNotes: "",
    pricing: "Quoted",
    decision: "Pending",
    ...values,
  };
  s.findings.push(f);
  return f;
}

/** A finding the customer may act on: scoped by the operator and carrying a price. */
export const quotable = (f: Finding) =>
  f.pricing === "Quoted" && typeof f.price === "number" && f.price > 0;

/** A finding the customer can tell apart from the others. */
export const named = (f: Finding) => f.title.trim().length > 0;

export type SendBlocker = { finding: Finding; reason: "title" | "price" };

/**
 * Why this assessment cannot go to the customer yet, finding by finding.
 *
 * The rule lives here rather than in the screen that sends. It used to be a
 * check inside the button's onClick, which meant it only bound the one caller
 * that happened to run it: an assessment could be sent carrying a $450 line
 * with no title at all, and the customer was asked to approve and pay for
 * "Untitled finding". ADR 019 already made "you cannot approve unscoped work"
 * a property of the data instead of a property of the UI; this is the same
 * argument applied to sending.
 */
export function sendBlockers(s: State, walkthroughId: string): SendBlocker[] {
  return findingsFor(s, walkthroughId).flatMap((f) => {
    const out: SendBlocker[] = [];
    if (!named(f)) out.push({ finding: f, reason: "title" });
    if (f.pricing === "Quoted" && !quotable(f))
      out.push({ finding: f, reason: "price" });
    return out;
  });
}

/**
 * The findings the pricing step still has to visit, in the order they were
 * captured. Derived from sendBlockers(), so "priced" in that step and
 * "sendable" here are one rule rather than two that could disagree.
 */
export function needsPricing(s: State, walkthroughId: string) {
  const blocked = new Set(
    sendBlockers(s, walkthroughId).map((b) => b.finding.id),
  );
  return findingsFor(s, walkthroughId).filter((f) => blocked.has(f.id));
}

/**
 * The rooms the on-site capture offers, by property type. A tap instead of
 * typing, and one spelling per room, so a property's findings group by where
 * they are rather than by however each was typed. "Other" belongs to the
 * screen, not to the list.
 */
export const ROOMS: Record<PropertyType, string[]> = {
  House: [
    "Entry",
    "Kitchen",
    "Living room",
    "Dining room",
    "Bedroom",
    "Bathroom",
    "Laundry",
    "Basement",
    "Attic",
    "Garage",
    "Exterior",
    "Roof & gutters",
    "Yard",
  ],
  Townhouse: [
    "Entry",
    "Kitchen",
    "Living room",
    "Bedroom",
    "Bathroom",
    "Laundry",
    "Basement",
    "Garage",
    "Exterior",
    "Patio / balcony",
  ],
  Condo: [
    "Entry",
    "Kitchen",
    "Living room",
    "Bedroom",
    "Bathroom",
    "Laundry",
    "Balcony",
  ],
  Commercial: [
    "Entrance / lobby",
    "Corridor",
    "Stairwell",
    "Office",
    "Washroom",
    "Kitchenette",
    "Mechanical room",
    "Parking",
    "Exterior",
    "Roof",
  ],
};

/**
 * The type's rooms, then every area already recorded at this property that the
 * list does not have, so "Second-floor corridor" is one tap away on the next
 * visit. Compared without case, so "kitchen" typed once does not sit beside
 * "Kitchen". A property with no type offers its own history only.
 */
export function roomsFor(s: State, propertyId: string) {
  const property = s.properties.find((p) => p.id === propertyId);
  const rooms = property?.type ? [...ROOMS[property.type]] : [];
  const seen = new Set(rooms.map((r) => r.toLowerCase()));
  const visits = new Set(
    s.walkthroughs.filter((w) => w.propertyId === propertyId).map((w) => w.id),
  );
  for (const f of s.findings) {
    const area = f.area.trim();
    if (!visits.has(f.walkthroughId) || !area) continue;
    if (seen.has(area.toLowerCase())) continue;
    seen.add(area.toLowerCase());
    rooms.push(area);
  }
  return rooms;
}

/**
 * A starting title from what the operator said on site: the first clause,
 * sentence-cased, cut at a word boundary near 60 characters. Only a
 * suggestion — the pricing step shows it in an editable box. A full stop
 * ends a clause only before a space or the end, so "1.5 m" survives.
 *
 * Too long, it ends before the last joining word that leaves a real title
 * ("Replace electrical wiring", not "…and check a breaker that keeps"), and
 * only otherwise at the last whole word (ADR 063).
 */
export function suggestTitle(note: string) {
  const first = note
    .trim()
    .split(/[.!?;](?=\s|$)|\n|,\s/)[0]
    .trim();
  if (!first) return "";
  const head = first.slice(0, 60);
  const joins = [...head.matchAll(/\s(?:and|but|that|which|with|so|while)\s/gi)]
    .map((m) => m.index!)
    .filter((i) => i >= 15);
  const cut =
    first.length <= 60
      ? first
      : joins.length
        ? head.slice(0, joins[joins.length - 1])
        : head.replace(/\s+\S*$/, "");
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

export function sendWalkthrough(s: State, walkthroughId: string) {
  const w = s.walkthroughs.find((w) => w.id === walkthroughId);
  if (!w || w.status !== "Draft") return false;
  if (!findingsFor(s, walkthroughId).length) return false;
  if (sendBlockers(s, walkthroughId).length) return false;
  w.status = "Sent";
  w.sentAt = new Date(s.clock).toISOString();
  // Issued here because this is the moment the assessment becomes something
  // somebody outside the business can open.
  issueAccess(s, walkthroughId);
  log(s, `Assessment ${w.assessmentId} sent to the customer`);
  return true;
}

/* ── The guest link ───────────────────────────────────────────────────────
 *
 * NOT SECURITY. Every token below sits in the same `localStorage` as the rest
 * of the state, so anyone who can open the app can read all of them. Two
 * things the model does buy, and they are the reason it exists:
 *
 *   - `PMW-0001` stops being the thing in the URL, so an assessment is no
 *     longer reachable by counting upwards from one.
 *   - A backend inherits the fields it will need — token, expiry, revocation,
 *     access log — rather than having them invented later from screens.
 *
 * Nothing here keeps anyone out, and nothing client-side could.
 */

/** Mint a link. Re-issuing rotates the token, which is what makes revoking mean something. */
export function issueAccess(s: State, walkthroughId: string) {
  const w = s.walkthroughs.find((x) => x.id === walkthroughId);
  if (!w) return null;
  w.access = {
    token: accessToken(),
    expiresAt: s.clock + ASSESSMENT_LINK_DAYS * 86400000,
    // Opens survive a re-issue: how often it was looked at is a record about
    // the assessment, not about the current link.
    opens: w.access?.opens ?? [],
  };
  return w.access;
}

export function revokeAccess(s: State, walkthroughId: string) {
  const w = s.walkthroughs.find((x) => x.id === walkthroughId);
  if (!w?.access || w.access.revokedAt) return false;
  w.access.revokedAt = new Date(s.clock).toISOString();
  log(s, `Assessment ${w.assessmentId} link revoked`, {
    actor: "Operator",
    entity: "walkthrough",
    entityId: w.id,
    field: "access",
    from: "live",
    to: "revoked",
  });
  return true;
}

export type LinkState = "live" | "expired" | "revoked" | "none";
export const linkState = (s: State, w: Walkthrough): LinkState =>
  !w.access
    ? "none"
    : w.access.revokedAt
      ? "revoked"
      : w.access.expiresAt <= s.clock
        ? "expired"
        : "live";

export type LinkLookup =
  | { ok: true; walkthrough: Walkthrough }
  | { ok: false; reason: Exclude<LinkState, "live"> | "unknown" };

/**
 * Resolve a token to its assessment.
 *
 * A refusal says *why* — expired, revoked, or not a token we issued — because
 * "ask for a fresh link" and "this was withdrawn" are different messages to
 * the person holding it, and a blank page is neither.
 */
export function byToken(s: State, token: string): LinkLookup {
  const w = s.walkthroughs.find((x) => x.access?.token === token);
  if (!w) return { ok: false, reason: "unknown" };
  const state = linkState(s, w);
  return state === "live"
    ? { ok: true, walkthrough: w }
    : { ok: false, reason: state as Exclude<LinkState, "live"> };
}

/** One row per open. The question the operator could not ask before. */
export function recordOpen(s: State, walkthroughId: string) {
  const w = s.walkthroughs.find((x) => x.id === walkthroughId);
  if (!w?.access) return false;
  w.access.opens.push(new Date(s.clock).toISOString());
  return true;
}

/* ── Decisions ───────────────────────────────────────────────────────────── */

/**
 * Refusing to approve an unpriced or further-assessment finding is enforced
 * here rather than by hiding a button, so no surface can record an approval the
 * operator never priced.
 */
export function decide(
  s: State,
  findingId: string,
  decision: "Approved" | "Not Now",
  contactId?: string,
) {
  const f = s.findings.find((f) => f.id === findingId);
  if (!f || f.taskId) return false;
  if (decision === "Approved" && !quotable(f)) return false;
  /* Only approving is gated. Deferring commits the account to nothing, and
     making someone prove authority to say "not now" would turn a shrug into a
     permissions problem. Checked here rather than in the screen, per ADR 036. */
  if (decision === "Approved") {
    const w = s.walkthroughs.find((x) => x.id === f.walkthroughId);
    const property = s.properties.find((p) => p.id === w?.propertyId);
    if (!property || !mayApprove(s, property.accountId, contactId)) return false;
  }
  f.decision = decision;
  f.decidedAt = new Date(s.clock).toISOString();
  return true;
}

export function requestAssessment(s: State, findingId: string) {
  const f = s.findings.find((f) => f.id === findingId);
  if (!f || f.pricing !== "Further Assessment Required") return false;
  f.followUpRequestedAt = new Date(s.clock).toISOString();
  return true;
}

/** Carry an undecided or deferred finding into a later walkthrough, intact. */
export function carryForward(
  s: State,
  findingId: string,
  walkthroughId: string,
) {
  const original = s.findings.find((f) => f.id === findingId);
  if (!original) return null;
  const copy = addFinding(s, walkthroughId, {
    area: original.area,
    title: original.title,
    observed: original.observed,
    proposed: original.proposed,
    photos: [...original.photos],
    internalNotes: original.internalNotes,
    customerNotes: original.customerNotes,
    pricing: original.pricing,
    price: original.price,
    carriedFrom: original.id,
  });
  original.resolvedBy = copy.id;
  return copy;
}

/* ── Conversion into ordinary Fieldwork work ─────────────────────────────── */

export function assessmentTotals(s: State, walkthroughId: string) {
  const w = s.walkthroughs.find((w) => w.id === walkthroughId);
  const findings = findingsFor(s, walkthroughId);
  const approved = findings.filter(
    (f) => f.decision === "Approved" && quotable(f),
  );
  const subtotal = approved.reduce((n, f) => n + (f.price || 0), 0);
  const tax = round2(subtotal * (w?.taxRate ?? HST));
  return {
    findings,
    approved,
    deferred: findings.filter((f) => f.decision === "Not Now"),
    pending: findings.filter((f) => f.decision === "Pending" && quotable(f)),
    furtherAssessment: findings.filter(
      (f) => f.pricing === "Further Assessment Required",
    ),
    subtotal,
    tax,
    total: round2(subtotal + tax),
  };
}

/**
 * Approved findings become ordinary tasks on one ordinary request, so every
 * existing operator and contractor screen handles them without knowing PMW
 * exists. One request per approval event, not per walkthrough: approving a
 * finding that was deferred months ago must not reopen a completed job.
 */
export function convertApproved(s: State, walkthroughId: string) {
  const w = s.walkthroughs.find((w) => w.id === walkthroughId);
  const property = s.properties.find((p) => p.id === w?.propertyId);
  if (!w || !property) return null;
  const approved = findingsFor(s, walkthroughId).filter(
    (f) => f.decision === "Approved" && quotable(f) && !f.taskId,
  );
  if (!approved.length) return null;
  const request: Request = {
    id: uid(),
    accountId: property.accountId,
    name: accountName(property.accountId),
    address: property.address,
    city: property.city,
    ...(property.unit ? { unit: property.unit } : {}),
    ...(property.postalCode ? { postalCode: property.postalCode } : {}),
    status: "Submitted",
    mode: "Walkthrough Approval",
    timing: "Weekdays · 9 AM–5 PM · Flexible",
    notes: `Approved from assessment ${w.assessmentId}`,
    preferredSlots: [],
    timingConstraints: "",
    operatorNote: null,
    customerReply: null,
    propertyId: property.id,
    walkthroughId: w.id,
  };
  s.requests.push(request);
  for (const f of approved) {
    const description = f.proposed.trim() || f.title;
    const task: Task = {
      id: uid(),
      requestId: request.id,
      description,
      ...classify(description),
      answers: {},
      photos: [...f.photos],
      /* An operator scoped this in person, so it skips intake triage. Left
         unreviewed, reconcile() would park the whole request in Needs Review. */
      reviewed: true,
      confidence: 1,
      reason: `PMW · ${w.assessmentId} · finding ${String(f.number).padStart(2, "0")}`,
      findingId: f.id,
    };
    s.tasks.push(task);
    f.taskId = task.id;
  }
  const subtotal = approved.reduce((n, f) => n + (f.price || 0), 0);
  s.quotes.push({
    id: uid(),
    requestId: request.id,
    type: "Fixed price",
    amount: subtotal,
    high: subtotal,
    status: "Approved",
    notes: `Approved from assessment ${w.assessmentId}`,
    /* Approved but unpaid is exactly the state reconcile() reads as Awaiting
       Payment, which is the brief's "no scheduling until payment is settled". */
    payOnCompletion: false,
  });
  w.status = "Converted";
  log(
    s,
    `${approved.length} approved finding${approved.length === 1 ? "" : "s"} from ${w.assessmentId} became work`,
  );
  return request;
}

/* ── Derived state ───────────────────────────────────────────────────────── */

/**
 * Where a finding stands. Never stored: completion is a fact about the task,
 * and storing it here would give one truth two writers.
 */
export function findingState(s: State, f: Finding) {
  if (f.pricing === "Further Assessment Required")
    return f.resolvedBy ? "Superseded" : "Further assessment required";
  if (f.decision === "Not Now") return "Deferred";
  if (f.decision !== "Approved") return "Pending decision";
  const task = s.tasks.find((t) => t.id === f.taskId);
  if (!task) return "Approved";
  if (task.status === "Completed") return "Completed";
  const visit = s.visits.find(
    (v) => v.status !== "Cancelled" && v.taskIds.includes(task.id),
  );
  if (!visit) return "Approved";
  /* Borrow the contractor's vocabulary rather than growing a second one. */
  const work = workStatus(visit);
  return work === "Confirmed"
    ? "Scheduled"
    : work === "Proposed"
      ? "Approved"
      : work;
}

/** Before/after photos and the contractor's note, for the property record. */
export function findingEvidence(s: State, f: Finding) {
  const visit = s.visits.find(
    (v) => f.taskId && v.execution?.outcomes[f.taskId],
  );
  const outcome = f.taskId ? visit?.execution?.outcomes[f.taskId] : undefined;
  return {
    before: outcome?.before || [],
    after: outcome?.after || [],
    note: outcome?.note || "",
    finishedAt: visit?.execution?.finishedAt,
  };
}

/**
 * The property's maintenance history, assembled on read from the records that
 * already exist. Nothing here is stored, so it cannot drift from the work.
 */
export function propertyRecord(s: State, propertyId: string) {
  const walkthroughs = s.walkthroughs
    .filter((w) => w.propertyId === propertyId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const ids = new Set(walkthroughs.map((w) => w.id));
  const findings = s.findings.filter((f) => ids.has(f.walkthroughId));
  const requests = s.requests.filter((r) => r.propertyId === propertyId);
  const quoteIds = new Set(
    s.quotes
      .filter((q) => requests.some((r) => r.id === q.requestId))
      .map((q) => q.id),
  );
  const at = (state: string) =>
    findings.filter((f) => findingState(s, f) === state);
  return {
    walkthroughs,
    findings,
    requests,
    lastWalkthrough: walkthroughs[0],
    deferred: at("Deferred"),
    furtherAssessment: at("Further assessment required"),
    pending: at("Pending decision"),
    inFlight: findings.filter((f) =>
      ["Approved", "Scheduled", "On the Way", "In Progress", "Issue"].includes(
        findingState(s, f),
      ),
    ),
    completed: at("Completed"),
    payments: s.payments.filter((p) => quoteIds.has(p.quoteId)),
  };
}

/* ── Demo content ────────────────────────────────────────────────────────── */

/**
 * Two walkthroughs in the seed, because the feature opened on an empty state.
 *
 * "No walkthroughs yet" is the correct message and the wrong first impression:
 * a reviewer clicking Walkthroughs had to do a property's worth of data entry
 * before seeing anything the feature does. One sent assessment makes the guest
 * link, the totals, the tax line and the three finding states real on arrival;
 * one draft makes the capture surface real without pre-deciding it.
 *
 * Built with the same functions the UI calls, so seeded content cannot drift
 * into a shape the app would never produce.
 */
export function seedWalkthroughs(s: State) {
  const sent = createWalkthrough(s, "p1");
  addFinding(s, sent.id, {
    area: "Main floor hallway",
    title: "Door rubbing against the frame",
    observed:
      "The hallway door catches on the frame at the latch side and has worn a line into the paint.",
    proposed: "Adjust the door and reset the hinges.",
    price: 180,
    customerNotes: "About an hour on site. No parts needed.",
  });
  addFinding(s, sent.id, {
    area: "Office",
    title: "Shelving pulling away from the wall",
    observed:
      "Two shelf brackets are lifting; the fixings are into drywall rather than studs.",
    proposed: "Refit both shelves into studs with appropriate fixings.",
    price: 220,
    internalNotes: "Check stud spacing before quoting a third shelf.",
  });
  addFinding(s, sent.id, {
    area: "Living room",
    title: "Damp patch below the window",
    observed:
      "Staining on the wall below the sill. The source is not visible from inside.",
    proposed:
      "Investigate the source before any repair is scoped. Likely an exterior seal.",
    pricing: "Further Assessment Required",
    customerNotes:
      "We would rather look properly than guess at a price for this one.",
  });
  sendWalkthrough(s, sent.id);

  // The commercial case. Northline's property, so the assessment is approved by
  // a named contact in a named role — the branch decision 2 exists for, and one
  // that no individual-account walkthrough ever reaches.
  const commercial = createWalkthrough(s, "p6");
  addFinding(s, commercial.id, {
    area: "Second-floor corridor",
    title: "Damaged ceiling tiles",
    observed:
      "Four tiles are stained and sagging near the riser. Replacements are already on site.",
    proposed: "Replace the four affected tiles and check the riser for ongoing ingress.",
    price: 260,
    customerNotes: "Tiles supplied by Northline; labour only.",
  });
  addFinding(s, commercial.id, {
    area: "Rear stairwell",
    title: "Handrail bracket loose at the mid-landing",
    observed: "The lower bracket moves under load and the fixings are pulling out.",
    proposed: "Refit the bracket into solid backing and check the full run.",
    price: 175,
    internalNotes: "Ask whether this run was part of the 2024 retrofit.",
  });
  sendWalkthrough(s, commercial.id);

  const draft = createWalkthrough(s, "p3");
  addFinding(s, draft.id, {
    area: "Garage",
    title: "Side door will not latch",
    observed: "The latch no longer engages; the door swings open in wind.",
    proposed: "Realign the strike plate and replace the latch if worn.",
    price: 140,
  });
  return { sent, commercial, draft };
}

/**
 * Findings still waiting on a decision. On a sent assessment that is simply
 * the customer's turn; once the assessment has been converted it means the
 * work went ahead without them, and the customer page has locked them.
 */
export const undecided = (s: State, walkthroughId: string) =>
  findingsFor(s, walkthroughId).filter(
    (f) => findingState(s, f) === "Pending decision",
  );

/**
 * The customer's submit closes their decision round. Anything they left
 * undecided becomes "Not now" through the ordinary decide() path — the page
 * says so before they press submit, so this is their decision, not one taken
 * for them. It then lives where every deferral lives: on the property record,
 * carryable onto the next walkthrough.
 *
 * Deliberately NOT called from the operator's early "Convert" button: an
 * operator must never record a customer's decision. Leftovers from that path
 * stay undecided and are rescued by carryCandidates() instead.
 */
export function closeOutUndecided(s: State, walkthroughId: string) {
  const left = undecided(s, walkthroughId);
  for (const f of left) decide(s, f.id, "Not Now");
  return left.length;
}

/** Why an approval could not be written. */
export type ApproveRefusal =
  "closed" | "nothing approved" | "approver" | "name" | "payment";

/**
 * The customer's submit, as one write. It used to live in the page's click
 * handler, where the checks that guard it — something approved, someone with
 * authority, a way to pay — were screen logic that no test could reach. Here
 * they are rules about the data, in the order a person would hit them.
 *
 * Writes the approval snapshot (ADR 036), keeps anything left undecided as
 * "Not now" (ADR 054), converts the approved findings, and records the
 * simulated payment against the account's saved card.
 */
export function approveAssessment(
  s: State,
  walkthroughId: string,
  by: { name: string; role?: string; contactId?: string },
): { ok: true } | { ok: false; reason: ApproveRefusal } {
  const w = s.walkthroughs.find((x) => x.id === walkthroughId);
  const property = s.properties.find((p) => p.id === w?.propertyId);
  if (
    !w ||
    !property ||
    w.status !== "Sent" ||
    s.requests.some((r) => r.walkthroughId === w.id)
  )
    return { ok: false, reason: "closed" };
  if (!assessmentTotals(s, w.id).approved.length)
    return { ok: false, reason: "nothing approved" };
  if (!mayApprove(s, property.accountId, by.contactId))
    return { ok: false, reason: "approver" };
  if (!by.name.trim()) return { ok: false, reason: "name" };
  const method = (s.paymentMethods ?? []).find(
    (m) => m.accountId === property.accountId,
  );
  if (!method) return { ok: false, reason: "payment" };
  w.authorization = {
    name: by.name.trim(),
    ...(by.role?.trim() ? { role: by.role.trim() } : {}),
    ...(by.contactId ? { contactId: by.contactId } : {}),
    agreedAt: new Date(s.clock).toISOString(),
  };
  closeOutUndecided(s, w.id);
  const created = convertApproved(s, w.id);
  const q = s.quotes.find((q) => q.requestId === created?.id);
  if (q)
    s.payments.push({
      id: uid(),
      quoteId: q.id,
      status: "Paid",
      amount: q.amount,
      reference: "demo_" + uid(),
      methodId: method.id,
    });
  return { ok: true };
}

/**
 * What an in-progress walkthrough could usefully restate from earlier visits
 * to the same property: items the customer deferred, and items nobody could
 * price without a closer look. Both are the reason to walk a property twice.
 * Also anything left undecided on an assessment whose work has gone ahead.
 *
 * Anything already carried into this walkthrough drops out, so the list is
 * what is left to do rather than a growing pile.
 */
export function carryCandidates(s: State, walkthroughId: string) {
  const w = s.walkthroughs.find((x) => x.id === walkthroughId);
  if (!w || w.status !== "Draft") return [];
  const record = propertyRecord(s, w.propertyId);
  const already = new Set(
    findingsFor(s, walkthroughId)
      .map((f) => f.carriedFrom)
      .filter(Boolean),
  );
  /* Undecided findings on a converted assessment are stranded: the customer
     page has locked them and no count shows them. Offering them here is what
     rescues them, however they got there. */
  const converted = new Set(
    record.walkthroughs
      .filter((x) => x.status === "Converted")
      .map((x) => x.id),
  );
  const stranded = record.pending.filter((f) => converted.has(f.walkthroughId));
  return [...record.deferred, ...record.furtherAssessment, ...stranded].filter(
    (f) =>
      f.walkthroughId !== walkthroughId && !already.has(f.id) && !f.resolvedBy,
  );
}

/**
 * The addresses an account has booked before, most recently booked first, for
 * picking one on a new request (ADR 064). Read from properties, so a saved
 * address is the same record its maintenance history hangs off.
 */
export function savedAddresses(s: State, accountId: string) {
  const last = (id: string) =>
    Math.max(
      -1,
      ...s.requests
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.propertyId === id && r.status !== "Draft")
        .map(({ i }) => i),
    );
  return s.properties
    .filter((p) => p.accountId === accountId && p.address.trim())
    .map((p) => ({ p, at: last(p.id) }))
    .sort((a, b) => b.at - a.at)
    .map(({ p }) => p);
}
