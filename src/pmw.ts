import {
  type State,
  type Property,
  type Walkthrough,
  type Finding,
  type Request,
  type Task,
  uid,
  log,
  classify,
  customerName,
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

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
/**
 * Two requests belong to the same property when the same customer gave the same
 * address. Used only to rebuild links for states saved before properties
 * existed — once a request carries a propertyId, the key is never consulted
 * again, so editing an address later cannot silently re-home a request.
 */
export const propertyKey = (p: {
  address: string;
  city: string;
  customerId: string;
}) => [norm(p.address), norm(p.city), p.customerId].join("|");

/**
 * Backfills the PMW record arrays and gives every pre-existing request a
 * property. Additive and idempotent, in the shape of migrateDispatch: a request
 * that already has a propertyId is left exactly as it was, which is why seeded
 * state passes through unchanged.
 */
export function migratePmw(s: State) {
  s.properties ??= [];
  s.walkthroughs ??= [];
  s.findings ??= [];
  for (const r of s.requests) {
    if (r.propertyId) continue;
    const key = propertyKey(r);
    let property = s.properties.find((p) => propertyKey(p) === key);
    if (!property) {
      property = {
        id: uid(),
        customerId: r.customerId,
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

export function sendWalkthrough(s: State, walkthroughId: string) {
  const w = s.walkthroughs.find((w) => w.id === walkthroughId);
  if (!w || w.status !== "Draft") return false;
  if (!findingsFor(s, walkthroughId).length) return false;
  w.status = "Sent";
  w.sentAt = new Date(s.clock).toISOString();
  log(s, `Assessment ${w.assessmentId} sent to the customer`);
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
) {
  const f = s.findings.find((f) => f.id === findingId);
  if (!f || f.taskId) return false;
  if (decision === "Approved" && !quotable(f)) return false;
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
export function carryForward(s: State, findingId: string, walkthroughId: string) {
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
  const approved = findings.filter((f) => f.decision === "Approved" && quotable(f));
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
    customerId: property.customerId,
    name: customerName(property.customerId),
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
  const at = (state: string) => findings.filter((f) => findingState(s, f) === state);
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
