import { getIssue, needsClarificationReview } from "./clarification";
export type Task = {
  entryStage?: "description" | "details" | "done";
  issueId?: string;
  id: string;
  requestId: string;
  description: string;
  summary: string;
  category: string;
  duration: number;
  confidence: number;
  reason: string;
  restricted: boolean;
  reviewed: boolean;
  photos: string[];
  answers: Record<string, string>;
  mergedInto?: string;
  status?: string;
  /** Set when this task was converted from an approved walkthrough finding. */
  findingId?: string;
  /**
   * Who brings the materials. Without it "Materials required" is an outcome
   * that stalls a visit without saying whose problem it is. Defaults to
   * "To be confirmed" rather than to a policy, because guessing here is how a
   * contractor ends up buying a faucet nobody agreed to.
   */
  materials?: MaterialsResponsibility;
  /**
   * Rework lineage. The original task stays Completed: reopening it would
   * destroy the record of what was finished and when, so rework is new work
   * pointing back at old work.
   */
  originTaskId?: string;
  reworkReason?: string;
  /**
   * Whether this rework is chargeable. Deliberately not a boolean set at
   * creation — warranty is adjudicated, sometimes days later, and a default
   * would be wrong on the day it was written. Absent means undecided.
   */
  warranty?: { billable: boolean; decidedBy: string; decidedAt: string };
};
/**
 * Materials policy is per task, not per job: a customer-supplied TV and a
 * provider-supplied box of anchors can sit in the same visit.
 *
 * "Provider standard supplies" means ordinary consumables the contractor
 * carries — and because contractor pay is fixed on acceptance (decision 8),
 * that pay is understood to include them. A job-specific purchase is
 * "Operator supplied" and appears as its own line on the quote.
 */
export const materialsResponsibilities = [
  "Customer supplied",
  "Provider standard supplies",
  "Operator supplied",
  "To be confirmed",
] as const;
export type MaterialsResponsibility = (typeof materialsResponsibilities)[number];
export type Request = {
  intakeScreen?: "address" | "tasks" | "booking";
  editingTaskId?: string | null;
  /** A slot the customer actually selected. A commitment, unlike preferredSlots. */
  preferredSlot?: {
    start: string;
    providerId: string;
    duration: number;
    signature: string;
  };
  /**
   * Scheduling preference stated at intake — days the customer would like, and
   * which parts of those days. Deliberately independent of preferredSlot: this
   * is a wish, not a booking, and is never rendered as one.
   */
  preferredSlots?: { date: string; times: string[] }[];
  /** Free text from the same intake step, e.g. "baby naps 3–4pm". */
  timingConstraints?: string;
  /**
   * The operator's single outstanding question and the customer's single reply.
   * One slot, not a thread: asking again overwrites the pair. If real
   * back-and-forth is ever needed that is a decision to adopt chat, not to grow
   * this into a message list.
   */
  operatorNote?: string | null;
  customerReply?: string | null;
  id: string;
  /** The account the work is billed to. An individual or an organization. */
  accountId: string;
  /**
   * The person who raised it. Always present: an individual account has exactly
   * one contact, so this never has to branch on account type.
   */
  contactId?: string;
  name: string;
  address: string;
  city: string;
  status: string;
  mode: string;
  timing: string;
  notes: string;
  postalCode?: string;
  unit?: string;
  deadline?: string;
  /** The property this request is against. Maintenance history hangs off it. */
  propertyId?: string;
  /** Set when the request was created by approving walkthrough findings. */
  walkthroughId?: string;
  /**
   * The customer asked to change a visit too close to it to pick a new time
   * themselves (ADR 064): someone calls them about `visitId` by `by`. `done`
   * once the visit was moved or the call was made.
   */
  callBack?: { visitId: string; by: string; done?: boolean };
  /**
   * The customer cancelled within 24 hours of a visit (ADR 064). Their money
   * is held, not refunded, until the operator settles it: `fee` is what was
   * kept (0 when waived), absent while undecided.
   */
  lateCancel?: { at: string; fee?: number };
};
/**
 * A slot a customer is in the middle of taking. Without it, two people at the
 * same checkout both see the slot free right up to the moment they book, and
 * the second one's booking is refused after they have already agreed to it.
 *
 * Holds expire rather than being cleaned up by whoever abandoned the checkout,
 * because the common way to abandon a checkout is to close the tab.
 */
export type Hold = {
  id: string;
  requestId: string;
  providerId: string;
  start: string;
  duration: number;
  expiresAt: number;
};
/** How long a slot is held while someone finishes booking it. */
export const HOLD_MS = 10 * 60 * 1000;
/**
 * What the operator did about a task the contractor could not finish
 * (ADR 065). Absent while it is still the operator's to decide.
 *
 * A return visit is recorded the moment it is asked for — booked, or sent to
 * the customer as an extra charge (`chargeId`) — so the follow-up leaves the
 * operator's list; it is removed again if the charge is declined or its time
 * has gone. A closed task records what was refunded for it, possibly 0.
 */
export type Resolution =
  | { kind: "Return visit"; at: string; visitId?: string; chargeId?: string }
  | { kind: "Closed"; at: string; refund: number };
export type Visit = {
  execution?: {
    onWayAt?: string;
    eta?: string;
    startedAt?: string;
    finishedAt?: string;
    /** The customer was told about a late arrival (ADR 065). */
    lateToldAt?: string;
    outcomes: Record<
      string,
      {
        outcome: string;
        note: string;
        before: string[];
        after: string[];
        resolution?: Resolution;
      }
    >;
  };
  messages?: { id: string; sender: string; text: string; at: string }[];
  id: string;
  requestId: string;
  taskIds: string[];
  providerId: string;
  start: string;
  duration: number;
  status: string;
  travel: number;
  /**
   * The booking action that created this visit. A second submit carrying the
   * same key returns this visit instead of creating another, so a double tap,
   * a retry and a re-applied `commit()` all produce one appointment.
   */
  opKey?: string;
};
export type Assignment = {
  declineReason?: string;
  id: string;
  visitId: string;
  providerId: string;
  status: string;
  pay: number;
  expiresAt: number;
};
export type Quote = {
  id: string;
  requestId: string;
  type: string;
  amount: number;
  high: number;
  status: string;
  notes: string;
  payOnCompletion: boolean;
  /**
   * What was agreed, frozen at the moment of agreement. Written once by
   * `approveQuote()` and never rewritten.
   *
   * The amounts are copied rather than read back off the quote on purpose. A
   * quote is `Superseded`, not edited, so today they would still agree — but
   * "what did they approve" must not depend on that staying true, and it must
   * survive the account's contact list changing underneath it. `taskIds` is the
   * scope as it stood: a task added afterwards is outside what was approved.
   */
  approval?: {
    contactId?: string;
    /** Denormalised: the contact may leave the account, and the record has to keep reading true. */
    name: string;
    role?: string;
    approvedAt: string;
    amount: number;
    high: number;
    taskIds: string[];
  };
  /** Why the customer said no, if they said (ADR 062). Shown to the operator
   *  revising the price. */
  declineReason?: string;
};
export type Payment = {
  id: string;
  quoteId: string;
  status: string;
  amount: number;
  reference: string;
  /** The stored method this was taken against. */
  methodId?: string;
  authorizedAt?: string;
  capturedAt?: string;
  /** How much has gone back, for the partial case. */
  refunded?: number;
  /** A late-cancellation fee charged on its own (ADR 064), not the work. */
  fee?: boolean;
  /** The additional charge this pays (ADR 065), not the original quote. */
  chargeId?: string;
};
/** The return visit an additional charge pays for, booked on approval. */
export type ReturnPlan = {
  providerId: string;
  start: string;
  travel: number;
  duration: number;
  pay: number;
};
/**
 * An additional charge for a return visit whose scope changed (ADR 065): the
 * customer approves and pays it before the return visit is offered. A
 * separate record rather than a second live quote, because "the live quote"
 * is looked up as the one quote not superseded all through the app.
 */
export type Charge = {
  id: string;
  requestId: string;
  amount: number;
  reason: string;
  taskIds: string[];
  status: string;
  plan: ReturnPlan;
  sentAt: string;
  /** The return visit booked once it was paid, if one was. */
  visitId?: string;
};
/**
 * A stored payment method.
 *
 * `token` is all a real integration would ever hold — the card itself never
 * reaches this application, and the simulated token is shaped to make that
 * obvious rather than to look like a card number.
 */
export type PaymentMethod = {
  id: string;
  accountId: string;
  token: string;
  brand: string;
  last4: string;
  addedAt: string;
};
/**
 * How close to service an authorization is placed.
 *
 * A hold expires on a timescale of days, so a job booked three weeks out
 * cannot be covered by one placed at approval. Within this window the
 * authorization goes on at confirmation; beyond it the method is stored and
 * the authorization is scheduled for later.
 *
 * Config rather than a constant, because the real expiry varies by network and
 * merchant category and has to be checked against the provider's own rules at
 * integration rather than asserted from here.
 */
export const AUTHORIZE_WITHIN_DAYS = 7;
/**
 * How long a guest assessment link stays openable.
 *
 * Config rather than a constant, for the same reason as the authorization
 * window: thirty days covers a commercial approval cycle, and the right number
 * is a policy question rather than something to bake in here.
 */
export const ASSESSMENT_LINK_DAYS = 30;
/**
 * A location, not a job. Requests come and go; the property persists, which is
 * the only thing a maintenance history can hang off. Linked by foreign key and
 * never by address string — addresses are editable free text.
 */
export type Property = {
  id: string;
  accountId: string;
  address: string;
  city: string;
  unit?: string;
  postalCode?: string;
  notes?: string;
  nextWalkthrough?: string;
  /** Decides which rooms the on-site capture offers. Optional because saved
   *  data predates it: a property without one is asked once, at its next
   *  walkthrough, and remembers the answer. */
  type?: PropertyType;
};
export const PROPERTY_TYPES = [
  "House",
  "Townhouse",
  "Condo",
  "Commercial",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
/** One dated assessment of one property. */
export type Walkthrough = {
  id: string;
  /** The customer-facing identifier, e.g. PMW-0001. Written once, never rewritten. */
  assessmentId: string;
  propertyId: string;
  operatorId: string;
  date: string;
  status: "Draft" | "Sent" | "Converted";
  sentAt?: string;
  /** Snapshotted when sent: a live rate would make an old assessment stop matching its own total. */
  taxRate: number;
  /**
   * The guest link's credentials.
   *
   * **This is not security.** Every token lives in the same `localStorage` as
   * everything else, so anyone who can open the app can read all of them. What
   * the model buys is narrower and real: `PMW-0001` stops being guessable by
   * counting, and a backend inherits the fields — token, expiry, revocation,
   * access log — rather than having them invented later from screens.
   */
  access?: {
    token: string;
    expiresAt: number;
    revokedAt?: string;
    /** Every time the link was opened. Answers "did they ever look at it?" */
    opens: string[];
  };
  /** Who agreed, and as what. The role is stored because a name alone does not
   *  identify an approver once an account has several people on it. */
  authorization?: {
    name: string;
    role?: string;
    contactId?: string;
    agreedAt: string;
  };
};
/**
 * One observed maintenance issue.
 *
 * `pricing` is the operator's classification and `decision` is the customer's —
 * two fields, deliberately, so "further assessment required" can never be
 * approved as though it were a priced repair. One enum would make that a UI
 * rule; two make it a data rule.
 */
export type Finding = {
  id: string;
  walkthroughId: string;
  /** Stable per walkthrough. Never re-derived from array position. */
  number: number;
  area: string;
  title: string;
  observed: string;
  proposed: string;
  photos: string[];
  priority?: string;
  internalNotes: string;
  customerNotes: string;
  pricing: "Quoted" | "Further Assessment Required";
  price?: number;
  decision: "Pending" | "Approved" | "Not Now";
  decidedAt?: string;
  /** Set by conversion only. The finding's half of the link to executable work. */
  taskId?: string;
  /** This finding restates an earlier one carried into a later walkthrough. */
  carriedFrom?: string;
  /** An unpriced finding later superseded by a scoped one. */
  resolvedBy?: string;
  followUpRequestedAt?: string;
};
export type State = {
  settings?: { autoReofferDeclined: boolean };
  notifications?: {
    recipient?: string;
    id: string;
    /** An additional charge this is about (ADR 066): it opens that, not
     *  the quote its kind would otherwise mean. */
    chargeId?: string;
    assignmentId: string;
    visitId: string;
    requestId: string;
    kind: string;
    text: string;
    at: string;
    read: boolean;
    /**
     * One row per channel this went out on. In-app is genuinely delivered —
     * it is in the inbox. SMS and email stop at `sent`, because nothing
     * reports back without a provider, and that is the gap rather than an
     * oversight.
     */
    deliveries?: {
      channel: Channel;
      state: "sent" | "delivered" | "read" | "bounced";
      at: string;
      /** Why it bounced. Today only ever a missing address. */
      reason?: string;
    }[];
  }[];
  requests: Request[];
  tasks: Task[];
  visits: Visit[];
  assignments: Assignment[];
  quotes: Quote[];
  payments: Payment[];
  /* Typed as present rather than optional: a state saved before PMW existed
     lacks them on disk, and migratePmw() backfills them on the way in. */
  properties: Property[];
  walkthroughs: Walkthrough[];
  findings: Finding[];
  events: AuditEntry[];
  clock: number;
  /** Slots being taken right now. Backfilled by `migrateDispatch()`. */
  holds?: Hold[];
  /** Additional charges (ADR 065). Backfilled by `migrateDispatch()`. */
  charges?: Charge[];
  /** Tokenized payment methods. Backfilled by `migrateDispatch()`. */
  paymentMethods?: PaymentMethod[];
  /**
   * Approval authority the operator has granted or withdrawn, by contact id.
   *
   * It lives here rather than on the contact because `contacts` is a static
   * roster with no creation path, so the flag it ships with cannot be changed
   * at runtime. Without this the decision would be half-built: the rule
   * enforced, but nobody able to set it. When contacts become records this
   * overlay folds into them.
   */
  approvers?: Record<string, boolean>;
  /**
   * Where a merged-away record went: old id → surviving id. Consulted only
   * where an id arrives from outside the app, so no list has to filter.
   */
  mergedFrom?: Record<string, string>;
  /**
   * Bumped by every `commit()`. Two tabs that both write from the same `rev`
   * would lose one another's work, so the second one is made to start again.
   *
   * Optional on the type and backfilled by `migrateDispatch()`: requiring it
   * in `checkShape()` would send every state saved before this existed to the
   * recovery screen.
   */
  rev?: number;
};
/**
 * Who the work is billed to. One record for both a homeowner and a property
 * management company, told apart by `type` rather than by two parallel tables:
 * a Property belongs to an Account either way, so nothing downstream branches.
 *
 * The alternative considered was an Organization record with an invisible one
 * manufactured for every homeowner. That stores a fiction. See ADR 035.
 */
export type Account = {
  id: string;
  type: "individual" | "organization";
  name: string;
};
/**
 * A person who acts for an account. An individual account has exactly one,
 * which is that person; an organization has several with distinct roles.
 *
 * Contacts exist for individuals too, deliberately. If they did not, "who
 * raised this request" and "who approved this work" would be a contact
 * sometimes and an account other times, and every reader would branch.
 */
export type Contact = {
  id: string;
  accountId: string;
  name: string;
  /** Empty for an individual. "Property Manager", "Operations Manager" for an organization. */
  role?: string;
  /**
   * Where a channel would reach them. Absent is a real state, not a gap in the
   * seed: a contact with no mobile cannot be sent an SMS, and the delivery
   * bounces rather than silently going nowhere.
   */
  email?: string;
  phone?: string;
  /**
   * Whether this person may approve work for the account.
   *
   * On for an individual's sole contact — there is nobody else it could be.
   * Off for additional organization contacts until an operator grants it,
   * because "Sarah raises, Ahmed approves" is the case this exists for.
   */
  canApprove?: boolean;
  /**
   * Set when the person stops acting for the account. Never deleted: approvals
   * and requests keep pointing at them, and the history has to stay true after
   * someone leaves.
   */
  inactiveAt?: string;
};
/**
 * The account roster. An explicit list, not a set derived from existing
 * requests: identity is a real foreign key, so an account exists whether or not
 * it currently has a request, and no request can belong to nobody.
 */
export const accounts: Account[] = [
  { id: "c1", type: "individual", name: "Sarah Lin" },
  { id: "c2", type: "individual", name: "Daniel Brooks" },
  { id: "c3", type: "individual", name: "Priya Nair" },
  { id: "c4", type: "individual", name: "James Carter" },
  { id: "c5", type: "individual", name: "Amir Hassan" },
  { id: "a1", type: "organization", name: "Northline Property Management" },
];
export const contacts: Contact[] = [
  {
    id: "ct1",
    accountId: "c1",
    name: "Sarah Lin",
    canApprove: true,
    email: "sarah.lin@example.com",
    phone: "+1-905-555-0141",
  },
  {
    id: "ct2",
    accountId: "c2",
    name: "Daniel Brooks",
    canApprove: true,
    email: "d.brooks@example.com",
    phone: "+1-905-555-0162",
  },
  {
    id: "ct3",
    accountId: "c3",
    name: "Priya Nair",
    canApprove: true,
    email: "priya.nair@example.com",
    phone: "+1-905-555-0173",
  },
  {
    id: "ct4",
    accountId: "c4",
    name: "James Carter",
    canApprove: true,
    // No mobile on file. The SMS channel bounces for this account, which is
    // what makes "bounced" a state the demo can actually reach.
    email: "j.carter@example.com",
  },
  {
    id: "ct5",
    accountId: "c5",
    name: "Amir Hassan",
    canApprove: true,
    email: "amir.hassan@example.com",
    phone: "+1-905-555-0195",
  },
  {
    id: "ct6",
    accountId: "a1",
    name: "Maya Okonkwo",
    role: "Property Manager",
    canApprove: true,
    email: "m.okonkwo@northline.example.com",
    phone: "+1-416-555-0108",
  },
  {
    id: "ct7",
    accountId: "a1",
    name: "Tomas Reyes",
    role: "Operations Manager",
    email: "t.reyes@northline.example.com",
    phone: "+1-416-555-0119",
  },
];
export const accountName = (id: string) =>
  accounts.find((a) => a.id === id)?.name || "Unknown account";
export const contactsFor = (accountId: string) =>
  contacts.filter((c) => c.accountId === accountId);
/** The contact to attribute a new request to when nobody picked one. */
export const primaryContact = (accountId: string) =>
  contactsFor(accountId).find((c) => !c.inactiveAt);
export const contactName = (id?: string) =>
  contacts.find((c) => c.id === id)?.name || "";
/**
 * How a contact signs an approval: "Maya Okonkwo, Property Manager" for an
 * organization, the bare name for an individual. The role is part of the record
 * because "who agreed to this" is not answerable by a name alone once the
 * account has more than one person in it.
 */
/**
 * Saved states predate accounts: they carry `customerId` on requests and
 * properties, and no contact at all.
 *
 * The rename is done here rather than by leaving a `customerId` alias on the
 * type, so there is exactly one name for the field in the source and the old
 * one cannot quietly survive in new code. Runs before `migratePmw()`, which
 * builds properties out of requests and so needs their accounts already
 * rewritten.
 */
/**
 * Approve a quote, and freeze what was approved in the same write.
 *
 * A quote has no task list of its own — it is priced against its request, and
 * that request's tasks can change afterwards. So "what did they agree to" is
 * only unambiguous at this instant, and it is captured here rather than left
 * to each screen. Putting it in the one function that sets the status is what
 * stops `Approved` and `what was approved` from becoming two facts that can
 * disagree; the same reasoning that moved `sendBlockers()` out of the UI.
 *
 * Returns false rather than throwing when the quote is not approvable, so a
 * double-submit is a no-op instead of a second, later snapshot.
 */
export function approveQuote(s: State, quoteId: string, contactId?: string) {
  const q = s.quotes.find((x) => x.id === quoteId);
  if (!q || q.status !== "Sent") return false;
  const r = s.requests.find((x) => x.id === q.requestId);
  const who = contacts.find((c) => c.id === (contactId ?? r?.contactId));
  // Checked here rather than in the screen, for the reason in ADR 036: an
  // approval that can be recorded from one place and authorised from another
  // gives two facts that can disagree.
  if (!r || !mayApprove(s, r.accountId, who?.id)) return false;
  q.status = "Approved";
  q.approval = {
    ...(who ? { contactId: who.id } : {}),
    name: who?.name || accountName(r?.accountId || ""),
    ...(who?.role ? { role: who.role } : {}),
    approvedAt: new Date(s.clock).toISOString(),
    amount: q.amount,
    high: q.high,
    // The scope as it stood. A task added after this point is outside what was
    // approved, which is the question the PMW audit actually asked.
    taskIds: s.tasks
      .filter((t) => t.requestId === q.requestId && !t.mergedInto)
      .map((t) => t.id),
  };
  log(s, `${q.approval.name} approved the quote · ${money(q.amount)}`, {
    actor: who ? contactLabel(who.id) : q.approval.name,
    requestId: q.requestId,
    entity: "quote",
    entityId: q.id,
    field: "status",
    from: "Sent",
    to: "Approved",
  });
  return true;
}
/**
 * The customer turns a quote down, with a reason if they gave one (ADR 062).
 * Only a quote still awaiting them can be declined.
 */
export function declineQuote(s: State, quoteId: string, reason?: string) {
  const q = s.quotes.find((x) => x.id === quoteId);
  if (!q || q.status !== "Sent") return false;
  q.status = "Declined";
  if (reason) q.declineReason = reason;
  log(s, `Customer declined the quote${reason ? ` · ${reason}` : ""}`, {
    actor: "Customer",
    requestId: q.requestId,
    entity: "quote",
    entityId: q.id,
    field: "status",
    from: "Sent",
    to: "Declined",
  });
  return true;
}
/**
 * The customer answers the operator's one question (ADR 062). One reply per
 * question: a blank one, or a second one, is refused.
 */
export function answerQuestion(s: State, requestId: string, reply: string) {
  const r = s.requests.find((x) => x.id === requestId);
  const text = reply.trim();
  if (!r || !r.operatorNote || r.customerReply || !text) return false;
  r.customerReply = text;
  log(s, "Customer replied: " + text);
  return true;
}
/**
 * Raise rework against a completed task.
 *
 * The original task is not touched. It stays `Completed`, because it was: on
 * the day it finished, the work was done. Reopening it would rewrite that into
 * a lie and lose the date the customer actually got their door fixed.
 *
 * The rework goes on a **new request**, not the original one. Adding a task to
 * a finished request would make `reconcile()` derive it back out of
 * `Completed` — the same destruction by a different route, since request status
 * is computed from its tasks rather than stored.
 *
 * `warranty` is deliberately left unset. Whether rework is chargeable is a
 * judgement someone makes, sometimes days later and sometimes after looking at
 * the property; a default written now would be wrong for half the cases.
 */
export function createRework(s: State, originTaskId: string, reason: string) {
  const origin = s.tasks.find((t) => t.id === originTaskId);
  if (!origin || origin.status !== "Completed") return null;
  const from = s.requests.find((r) => r.id === origin.requestId);
  if (!from) return null;
  const request: Request = {
    id: uid(),
    accountId: from.accountId,
    ...(from.contactId ? { contactId: from.contactId } : {}),
    name: from.name,
    address: from.address,
    city: from.city,
    ...(from.unit ? { unit: from.unit } : {}),
    ...(from.postalCode ? { postalCode: from.postalCode } : {}),
    ...(from.propertyId ? { propertyId: from.propertyId } : {}),
    status: "Needs Review",
    mode: "Request to Book",
    timing: from.timing,
    notes: "",
    preferredSlots: [],
    timingConstraints: "",
    operatorNote: null,
    customerReply: null,
  };
  const task: Task = {
    id: uid(),
    requestId: request.id,
    description: origin.description,
    summary: origin.summary,
    category: origin.category,
    duration: origin.duration,
    confidence: origin.confidence,
    reason: origin.reason,
    restricted: origin.restricted,
    // Not carried over. The same description does not mean the same scope the
    // second time, and the operator deciding warranty is the same person who
    // should be re-reading it.
    reviewed: false,
    photos: [],
    answers: {},
    status: "unassigned",
    materials: "To be confirmed",
    originTaskId: origin.id,
    reworkReason: reason,
  };
  s.requests.push(request);
  s.tasks.push(task);
  return { request, task };
}
/** Record whether rework is chargeable, and who said so. */
export function adjudicateWarranty(
  s: State,
  taskId: string,
  billable: boolean,
  decidedBy: string,
) {
  const t = s.tasks.find((x) => x.id === taskId);
  if (!t?.originTaskId) return false;
  t.warranty = {
    billable,
    decidedBy,
    decidedAt: new Date(s.clock).toISOString(),
  };
  return true;
}
/** Case- and whitespace-insensitive comparison key for free text. */
export const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
/**
 * What makes two records look like the same place.
 *
 * Deliberately **not** `propertyKey()` (`pmw.ts`), which includes the account.
 * That one is strict on purpose: re-homing a request across accounts because
 * two addresses read alike would be a serious bug, and ADR 018 exists to stop
 * it. This key leaves the account out, because one address reached by two
 * accounts is exactly the thing worth putting in front of a person.
 */
export const addressKey = (p: { address: string; city: string }) =>
  [norm(p.address), norm(p.city)].join("|");
export type DuplicateGroup = {
  key: string;
  properties: Property[];
  /** True when the match spans accounts, which is a flag rather than a merge. */
  crossAccount: boolean;
};
/**
 * Properties that look like one place.
 *
 * Duplicates are real here: `migratePmw()` builds a property per distinct
 * request address, and an operator can type a fresh address in Walkthroughs
 * that already exists. Both produce two records for one building.
 *
 * Nothing is merged automatically. Address text alone cannot tell "two records
 * for one house" from "two genuinely different units", and a wrong merge joins
 * two maintenance histories that then cannot be separated again.
 */
export function duplicateProperties(s: State): DuplicateGroup[] {
  const groups = new Map<string, Property[]>();
  for (const p of s.properties ?? []) {
    const key = addressKey(p);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups]
    .filter(([, list]) => list.length > 1)
    .map(([key, properties]) => ({
      key,
      properties,
      crossAccount: new Set(properties.map((p) => p.accountId)).size > 1,
    }));
}
export type MergeResult = { ok: true } | { ok: false; reason: string };
/**
 * Fold one property into another: move what points at it, then remove it.
 *
 * A tombstone was the other option, following `Task.mergedInto`. That field is
 * filtered at eleven separate read sites, and properties are read in about
 * seven files — copying the pattern means a filter in each, every one of which
 * can be forgotten, and a forgotten one renders a merged-away record as live.
 * Repointing leaves nothing to filter, so no read site changes at all.
 *
 * What is kept instead is `mergedFrom`, consulted only where an id arrives from
 * outside the app, so an old link still lands somewhere true.
 */
export function mergeProperties(
  s: State,
  keepId: string,
  loseId: string,
): MergeResult {
  if (keepId === loseId) return { ok: false, reason: "Same property." };
  const keep = s.properties.find((p) => p.id === keepId);
  const lose = s.properties.find((p) => p.id === loseId);
  if (!keep || !lose) return { ok: false, reason: "Property not found." };
  /* Refused rather than resolved. Moving one account's maintenance history
     under another account is not a tidy-up, and no rule here can know which
     account is the right one. Fixing the account comes first. */
  if (keep.accountId !== lose.accountId)
    return {
      ok: false,
      reason:
        "These belong to different accounts. Correct the account before merging, or they are two different places.",
    };
  /* Both carrying different notes means a merge picks a winner and silently
     drops the other. Better to say so than to choose. */
  const notes = [keep.notes, lose.notes].map((n) => (n ?? "").trim());
  if (notes[0] && notes[1] && notes[0] !== notes[1])
    return {
      ok: false,
      reason: "Both carry notes, and merging would discard one. Reconcile them first.",
    };
  for (const r of s.requests) if (r.propertyId === loseId) r.propertyId = keepId;
  for (const w of s.walkthroughs ?? [])
    if (w.propertyId === loseId) w.propertyId = keepId;
  // Detail the survivor was missing is worth keeping; detail it already has wins.
  if (!notes[0] && notes[1]) keep.notes = lose.notes;
  keep.nextWalkthrough ??= lose.nextWalkthrough;
  keep.unit ??= lose.unit;
  keep.postalCode ??= lose.postalCode;
  s.properties = s.properties.filter((p) => p.id !== loseId);
  s.mergedFrom = { ...(s.mergedFrom ?? {}), [loseId]: keepId };
  log(s, `Operator merged duplicate property records for ${keep.address}`, {
    actor: "Operator",
    entity: "property",
    entityId: keep.id,
    field: "mergedFrom",
    from: loseId,
    to: keepId,
  });
  return { ok: true };
}
/**
 * Follow a merge to where the record went. Used only where an id arrives from
 * outside — a bookmarked link, an id held in component state across a merge —
 * so that nothing inside the app has to remember to check.
 */
export function resolveProperty(s: State, id: string): string {
  const seen = new Set<string>();
  let at = id;
  while (s.mergedFrom?.[at] && !seen.has(at)) {
    seen.add(at);
    at = s.mergedFrom[at];
  }
  return at;
}
/**
 * Whether a contact may approve work for an account.
 *
 * An individual account's sole contact may: there is nobody else it could be,
 * and making a homeowner grant themselves authority would be theatre. An
 * organization's contacts may only where an operator has said so, which is the
 * "Sarah raises, Ahmed approves" case this exists for.
 *
 * This enforces a **rule**, not an identity. Nothing authenticates the person
 * choosing a contact from a list, and `docs/permissions.md` says so.
 */
export function mayApprove(s: State, accountId: string, contactId?: string) {
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return false;
  const own = contactsFor(accountId).filter((c) => !c.inactiveAt);
  if (account.type === "individual")
    return own.length === 1 && (contactId ?? own[0]?.id) === own[0]?.id;
  const who = own.find((c) => c.id === contactId);
  if (!who) return false;
  return s.approvers?.[who.id] ?? !!who.canApprove;
}
/** Grant or withdraw a contact's authority to approve. */
export function setApprover(s: State, contactId: string, may: boolean) {
  const who = contacts.find((c) => c.id === contactId);
  if (!who) return false;
  const was = s.approvers?.[contactId] ?? !!who.canApprove;
  s.approvers = { ...(s.approvers ?? {}), [contactId]: may };
  if (was !== may)
    log(s, `${who.name} ${may ? "granted" : "no longer has"} approval authority`, {
      actor: "Operator",
      entity: "contact",
      entityId: contactId,
      field: "canApprove",
      from: was ? "yes" : "no",
      to: may ? "yes" : "no",
    });
  return true;
}
export function migrateAccounts(s: State) {
  type Legacy = { customerId?: string; accountId?: string };
  const rename = (row: Legacy) => {
    row.accountId ??= row.customerId;
    delete row.customerId;
  };
  for (const r of s.requests) {
    rename(r as Legacy);
    // An individual account has exactly one contact, so this is unambiguous for
    // every pre-existing request. Organizations only exist from here forward.
    r.contactId ??= primaryContact(r.accountId)?.id;
  }
  for (const p of s.properties ?? []) rename(p as Legacy);
  // Absent is a real answer — "nobody has said" — but only on a task created
  // before the field existed did it mean nothing at all. Both read the same.
  for (const t of s.tasks) t.materials ??= "To be confirmed";
  return s;
}
export const contactLabel = (id?: string) => {
  const c = contacts.find((x) => x.id === id);
  if (!c) return "";
  return c.role ? `${c.name}, ${c.role}` : c.name;
};
export const providers = [
  {
    id: "yousef",
    name: "Yousef Haddad",
    initials: "YH",
    role: "Owner · Lead handyman",
    city: "Oakville",
    rate: 65,
    skills: "Doors, walls, installation, assembly",
    eligible: false,
    phone: "+1-905-555-0100",
    email: "yousef@fieldwork.example.com",
  },
  {
    id: "marcus",
    name: "Marcus Chen",
    initials: "MC",
    role: "Trusted contractor",
    city: "Burlington",
    rate: 55,
    skills: "Assembly, installation, doors",
    eligible: false,
    phone: "+1-905-555-0122",
    email: "marcus@fieldwork.example.com",
  },
  {
    id: "nina",
    name: "Nina Patel",
    initials: "NP",
    role: "Trusted contractor",
    city: "Oakville",
    rate: 60,
    skills: "Assembly, walls, installation, doors",
    eligible: false,
    phone: "+1-905-555-0133",
    email: "nina@fieldwork.example.com",
  },
  {
    id: "eli",
    name: "Elias Williams",
    initials: "EW",
    role: "Specialist · operator marked eligible",
    city: "Milton",
    rate: 95,
    skills: "Electrical, restricted work",
    eligible: true,
    phone: "+1-905-555-0144",
    email: "eli@fieldwork.example.com",
  },
];
export const uid = () => Math.random().toString(36).slice(2, 10);
/**
 * A guest-link token.
 *
 * `crypto.getRandomValues` where it exists, because `Math.random()` is not a
 * source anyone should reach for when the word "token" is involved, even in a
 * simulation — someone will copy this shape into the backend. The fallback
 * exists only so tests and non-browser contexts do not throw, and it is
 * deliberately marked as unfit rather than quietly substituted.
 */
export function accessToken() {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(24));
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "insecure-" + uid() + uid() + uid() + uid() + uid() + uid();
}
export const money = (n: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
export const dateLabel = (s: string) =>
  new Date(s).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
/** End a sentence once: a time already ends in "a.m." or "p.m.". */
export const sentence = (text: string) =>
  text.endsWith(".") ? text : text + ".";
/** The time of day alone, "6:15 p.m.", for something due within hours. */
export const timeLabel = (s: string) =>
  new Date(s).toLocaleTimeString("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
  });
/**
 * What the classifier calls work it cannot name: no rule matched, or a
 * restricted phrase overrode the match. Fine as a reason to review, wrong as
 * the name of a job — a reviewed task never keeps one (ADR 063).
 */
export const UNCLASSIFIED_TITLE = "Tell us a little more";
export const RESTRICTED_TITLE = "Electrical / restricted work review";
export const genericTitle = (t: { summary: string }) =>
  t.summary === UNCLASSIFIED_TITLE || t.summary === RESTRICTED_TITLE;
export function classify(description: string) {
  const t = description.toLowerCase().replace(/[’]/g, "'");
  const restricted =
    /\b(electrical|wiring|breaker|circuit|outlet|light fixture|ceiling fan|rough.in|load.bearing|structural)\b/.test(
      t,
    ) ||
    (/\bswitch\b/.test(t) && !t.includes("switch out furniture"));
  const rules: [RegExp, string, string, number, string][] = [
    [
      /\bdoor\b.*(rub|stick|close|latch)|(rub|stick).*\bdoor\b/,
      "Handyman / Doors / Adjustment",
      "Door adjustment",
      60,
      "DOOR-01 · door + rubbing / sticking / latch",
    ],
    [
      /drywall|hole in (the )?wall/,
      "Handyman / Walls / Drywall",
      "Drywall patch",
      75,
      "WALL-01 · drywall / hole in wall",
    ],
    [
      /shel(f|ves|ving)/,
      "Installation / Shelving",
      "Shelf installation",
      75,
      "INSTALL-01 · shelf / shelves",
    ],
    [
      /towel (bar|rack)/,
      "Handyman / Fixtures / Minor repair",
      "Towel-bar repair",
      30,
      "FIX-01 · towel bar",
    ],
    [
      /\btv\b|television/,
      "Installation / TV mount",
      "TV mounting",
      90,
      "INSTALL-02 · TV / television",
    ],
    [
      /assembl|ikea|wardrobe|furniture/,
      "Assembly / Furniture",
      "Furniture assembly",
      120,
      "ASSEMBLY-01 · assembly / furniture",
    ],
    [
      /faucet|leak under sink|sink leaking/,
      "Plumbing / Fixture",
      "Fixture leak investigation",
      90,
      "PLUMB-01 · faucet / leak under sink",
    ],
    [
      /deck|fence|gate/,
      "Exterior / Deck and fence",
      "Exterior repair",
      120,
      "EXT-01 · deck / fence / gate",
    ],
  ];
  if (restricted)
    return {
      summary: RESTRICTED_TITLE,
      category: "Electrical / Restricted work",
      duration: 90,
      confidence: 1,
      reason: "SAFE-01 · restricted phrase overrides ordinary matches",
      restricted: true,
      reviewed: false,
    };
  const intakeIssue = getIssue(description);
  if (intakeIssue.id !== "unknown" && intakeIssue.review)
    return {
      issueId: intakeIssue.id,
      summary: intakeIssue.title,
      category: `${intakeIssue.category || "Specialist"} / ${intakeIssue.title}`,
      duration: 90,
      confidence: 0.9,
      reason: `INTAKE · ${intakeIssue.title} · operator scope review required`,
      restricted: intakeIssue.category === "Electrical",
      reviewed: false,
    };
  const candidates = rules
    .map((rule, index) => {
      const match = t.match(rule[0]);
      const topic = rule[2].split(" ")[0].toLowerCase();
      const excluded = new RegExp(
        `(?:no|not|without)\\s+(?:a\\s+)?${topic}\\s+(?:problem|issue|repair|work)`,
      ).test(t);
      const combination =
        /\b(install|repair|patch|fix|assemble|mount|rubbing|sticking|leak|broken|loose)\b/.test(
          t,
        );
      const weight =
        match && !excluded
          ? 0.82 +
            (combination ? 0.12 : 0) +
            (match[0].includes(" ") ? 0.03 : 0)
          : 0;
      return { rule, weight, index, excluded };
    })
    .filter((x) => x.weight >= 0.8)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  const best = candidates[0];
  return best
    ? {
        summary: best.rule[2],
        category: best.rule[1],
        duration: best.rule[3],
        confidence: Math.min(0.99, best.weight),
        reason:
          best.rule[4] +
          ` · weighted score ${Math.round(best.weight * 100)} / 100`,
        restricted: false,
        reviewed: true,
      }
    : intakeIssue.id !== "unknown"
      ? {
          summary: intakeIssue.title,
          category: `${intakeIssue.category || "Handyman"} / ${intakeIssue.title}`,
          duration: 90,
          confidence: 0.85,
          reason: `CATALOGUE · ${intakeIssue.id} · scope and duration require review`,
          restricted: intakeIssue.category === "Electrical",
          reviewed: false,
          issueId: intakeIssue.id,
        }
      : {
          summary: UNCLASSIFIED_TITLE,
          category: "Needs Review",
          duration: 60,
          confidence: 0.25,
          reason: "No phrase combination cleared confidence threshold (0.80)",
          restricted: false,
          reviewed: false,
        };
}
export function seed(): State {
  const clock = Date.now();
  const requests: Request[] = [
    [
      "r1",
      "c1",
      "Sarah Lin",
      "124 Maple Grove Drive",
      "Oakville",
      "Draft",
      "Instant Book",
      "ct1",
      "L6J 4V1",
    ],
    [
      "r2",
      "c2",
      "Daniel Brooks",
      "38 Lakeshore Road West",
      "Oakville",
      "Submitted",
      "Request to Book",
      "ct2",
      "L6K 1E2",
    ],
    [
      "r3",
      "c3",
      "Priya Nair",
      "215 New Street",
      "Burlington",
      "Submitted",
      "Request to Book",
      "ct3",
      "L7R 1C3",
    ],
    [
      "r4",
      "c4",
      "James Carter",
      "62 Thompson Road",
      "Milton",
      "Needs Review",
      "Request to Book",
      "ct4",
      "L9T 2X5",
    ],
    [
      "r5",
      "c5",
      "Amir Hassan",
      "90 Rebecca Street",
      "Oakville",
      "Awaiting Provider Acceptance",
      "Request to Book",
      "ct5",
      "L6K 1J2",
    ],
    // The commercial case. Raised by one contact at an organization; a second
    // contact can approve it. Without a seeded organization, Account.type has a
    // branch nothing ever takes.
    [
      "r6",
      "a1",
      "Northline Property Management",
      "14 Iroquois Shore Road",
      "Oakville",
      "Submitted",
      "Request to Book",
      "ct6",
      "L6H 1M3",
    ],
  ].map((a) => ({
    id: a[0],
    accountId: a[1],
    contactId: a[7],
    name: a[2],
    address: a[3],
    city: a[4],
    postalCode: a[8],
    status: a[5],
    mode: a[6],
    timing: "Weekdays · 9 AM–5 PM · Flexible",
    notes: "",
    preferredSlots: [],
    timingConstraints: "",
    operatorNote: null,
    customerReply: null,
  }));
  // Every seeded request is at its own address, so each becomes one property and
  // the demo starts with a maintenance record already attached to each job.
  const properties: Property[] = requests.map((r, i) => ({
    id: "p" + (i + 1),
    accountId: r.accountId,
    address: r.address,
    city: r.city,
    postalCode: r.postalCode,
    type:
      accounts.find((a) => a.id === r.accountId)?.type === "organization"
        ? "Commercial"
        : "House",
  }));
  requests.forEach((r, i) => (r.propertyId = properties[i].id));
  // One seeded request carries a stated preference so the operator queue and the
  // customer's own view both exercise it without needing a fresh intake run.
  const withPreference = requests.find((r) => r.id === "r3");
  if (withPreference) {
    const day = torontoParts(new Date(clock + 3 * 86400000));
    withPreference.preferredSlots = [
      {
        date: `${day.year}-${day.month}-${day.day}`,
        times: ["Morning", "Afternoon"],
      },
    ];
    withPreference.timingConstraints =
      "Baby is napping from 3–4pm. Please do not arrive during those times.";
  }
  const ds = [
    [
      "r1",
      "My bedroom door is rubbing against the frame and won’t close properly.",
    ],
    ["r2", "Bedroom door sticking against the frame"],
    ["r2", "Patch a small drywall hole"],
    ["r2", "Install two shelves in the office"],
    ["r2", "Fix a loose towel bar"],
    ["r3", "Assemble an IKEA wardrobe and chest of drawers"],
    ["r4", "Replace electrical wiring and check a breaker that keeps tripping"],
    ["r5", "Mount a 55-inch TV on the living room wall", "Customer supplied"],
    [
      "r6",
      "Replace four damaged ceiling tiles in the second-floor corridor",
      "Customer supplied",
    ],
  ];
  const tasks = ds.map((a, i) => ({
    id: "t" + i,
    requestId: a[0],
    description: a[1],
    ...classify(a[1]),
    photos: [],
    answers: {},
    // Absent means nobody has said yet, which is a real state and the default.
    // The two seeded exceptions are jobs where the customer already owns the
    // item — the TV and the replacement tiles.
    materials: (a[2] as MaterialsResponsibility) ?? "To be confirmed",
  }));
  const start = new Date(clock + 3 * 86400000);
  start.setHours(10, 0, 0, 0);
  return {
    requests,
    tasks,
    properties,
    walkthroughs: [],
    findings: [],
    visits: [
      {
        id: "v5",
        requestId: "r5",
        taskIds: ["t7"],
        providerId: "marcus",
        start: start.toISOString(),
        duration: 90,
        status: "Proposed",
        travel: 12,
      },
    ],
    assignments: [
      {
        id: "a5",
        visitId: "v5",
        providerId: "marcus",
        status: "Offered",
        pay: 110,
        expiresAt: clock + 7200000,
      },
    ],
    quotes: [],
    payments: [],
    events: [
      {
        id: uid(),
        text: "Demo ready · five sample requests loaded",
        at: new Date(clock).toISOString(),
      },
    ],
    clock,
  };
}
/**
 * Derived customer-facing state. Computed, never stored.
 *
 * A decline reverts `coordinated` to false, and that is exactly what hides the
 * decline from the customer: their view falls back to the ordinary "still
 * matching" state, as if nothing had happened. Reassignment is the operator's
 * problem to solve invisibly, so nothing downstream of this may surface a
 * declined assignment to the customer.
 */
export function coordinated(s: State, requestId: string) {
  return s.visits
    .filter((v) => v.requestId === requestId && v.status !== "Cancelled")
    .some((v) =>
      s.assignments.some(
        (a) =>
          a.visitId === v.id &&
          a.providerId === v.providerId &&
          !["Declined", "Expired"].includes(a.status),
      ),
    );
}
/** A quote is only customer-visible once the request is genuinely coordinated. */
export function quoted(s: State, requestId: string) {
  const q = s.quotes.find(
    (q) => q.requestId === requestId && q.status !== "Superseded",
  );
  return !!q && q.amount > 0 && coordinated(s, requestId);
}
/**
 * Three-way AND, not two. Approval and acceptance are not enough: a visit is not
 * confirmed until a time actually exists for it.
 */
export function confirmed(s: State, requestId: string) {
  const q = s.quotes.find(
    (q) => q.requestId === requestId && q.status !== "Superseded",
  );
  const accepted = s.visits
    .filter((v) => v.requestId === requestId && v.status !== "Cancelled")
    .some(
      (v) =>
        !!v.start &&
        s.assignments.some(
          (a) =>
            a.visitId === v.id &&
            a.providerId === v.providerId &&
            a.status === "Accepted",
        ),
    );
  return q?.status === "Approved" && accepted;
}
/**
 * What changed, who changed it, and what it was before.
 *
 * `events` used to be `{ id, text, at }` — a narrative. It could say "Quote
 * sent to Daniel Brooks · $420" but not answer "who changed this price, and
 * from what", which is the question `docs/permissions.md` records as missing.
 *
 * Every field beyond the original three is optional, so the twenty-odd
 * existing one-line entries stay exactly as they were. A log where only some
 * entries carry detail is more useful than one nobody finished filling in.
 */
export type AuditDetail = {
  /** Who did it: a role, a provider, or a named contact. */
  actor?: string;
  /** The request this belongs to, so a request can show its own history. */
  requestId?: string;
  entity?: string;
  entityId?: string;
  field?: string;
  /** Rendered, not raw — a price reads as "$420", a status as its own name. */
  from?: string;
  to?: string;
};
export type AuditEntry = AuditDetail & {
  id: string;
  text: string;
  at: string;
};
export function log(s: State, text: string, detail: AuditDetail = {}) {
  s.events.unshift({
    id: uid(),
    text,
    at: new Date(s.clock).toISOString(),
    ...detail,
  });
}
/** The trail for one request, newest first. */
export const auditFor = (s: State, requestId: string) =>
  s.events.filter((e) => e.requestId === requestId);
/** True when an entry records a change rather than narrating one. */
export const isChange = (e: AuditEntry) => !!e.field;
/** The stored method for whoever is paying for this quote, if there is one. */
export function methodFor(s: State, quote: Quote) {
  const r = s.requests.find((x) => x.id === quote.requestId);
  if (!r) return undefined;
  return (s.paymentMethods ?? []).find((m) => m.accountId === r.accountId);
}
/**
 * Whether the money side of a quote is far enough along to confirm a visit.
 *
 * The decided sequence is approve → method on file → confirm → authorize near
 * service → capture at completion, so confirmation waits on a **method**, not
 * on money having moved. That is the point of the sequence: a job three weeks
 * out cannot hold an authorization that long, and the customer should still get
 * a confirmed appointment.
 *
 * `Paid` and `Authorized` also count. The simulated checkout still writes
 * `Paid` directly, and the five demo scenarios depend on it, so this predicate
 * has to accept the shortcut as well as the full sequence.
 */
export const secured = (s: State, q: Quote) =>
  q.payOnCompletion ||
  s.payments.some(
    (p) => p.quoteId === q.id && ["Authorized", "Paid"].includes(p.status),
  ) ||
  !!methodFor(s, q);
/**
 * A payment for the quote's own work. A late-cancellation fee (ADR 064) and
 * an additional charge (ADR 065) are recorded against the quote too, so
 * "has the quote been paid?" must not count them.
 */
export const workPayment = (p: Payment) => !p.fee && !p.chargeId;
/**
 * Every kind of notification this app emits.
 *
 * A union rather than a loose string so `urgency` below must cover all of
 * them: adding a kind without deciding how urgent it is fails the build
 * instead of quietly taking a default.
 */
export const notificationKinds = [
  "request",
  "information",
  "offer",
  "accepted",
  "declined",
  "visit",
  "message",
  "quote",
  "payment",
] as const;
export type NotificationKind = (typeof notificationKinds)[number];
export type Urgency = "time-sensitive" | "documentary";
export type Channel = "sms" | "email" | "in-app";
/**
 * Channel follows **urgency, not role** — `docs/decisions.md` #11.
 *
 * An earlier version of `docs/notifications.md` implied role, because the
 * taxonomy had been read off `emit()`'s recipient strings, which are roles. A
 * cancellation two hours before an appointment is urgent whoever receives it,
 * and a receipt is a document whoever receives it.
 */
export const urgency: Record<NotificationKind, Urgency> = {
  // Someone has to act, and soon, or something expires or goes wrong.
  offer: "time-sensitive",
  declined: "time-sensitive",
  accepted: "time-sensitive",
  visit: "time-sensitive",
  message: "time-sensitive",
  information: "time-sensitive",
  // A record someone will want to find again, rather than act on this hour.
  request: "documentary",
  quote: "documentary",
  payment: "documentary",
};
/** In-app always, plus the one that matches the urgency. */
export const channelsFor = (kind: NotificationKind): Channel[] =>
  urgency[kind] === "time-sensitive" ? ["sms", "in-app"] : ["email", "in-app"];
export function reconcile(s: State) {
  // Beside offer expiry, because they are the same kind of fact: a promise
  // with a clock on it that nobody is coming back to release by hand.
  if (s.holds?.length)
    s.holds = s.holds.filter((h) => h.expiresAt > s.clock);
  for (const a of s.assignments)
    if (a.status === "Offered" && a.expiresAt <= s.clock) {
      a.status = "Expired";
      log(s, "Contractor offer expired · reassignment required");
    }
  for (const r of s.requests) {
    if (["Draft", "Cancelled", "Declined", "Completed"].includes(r.status))
      continue;
    /* An unanswered operator question is a waiting state in its own right.
       The Waiting bucket has always recognized it; until now nothing set it,
       so "Need More Info" left the request sitting in Needs Action. */
    const asked = !!r.operatorNote && !r.customerReply;
    const tasks = s.tasks.filter((t) => t.requestId === r.id && !t.mergedInto);
    if (tasks.some((t) => !t.reviewed)) {
      r.status = asked ? "Information requested" : "Needs Review";
      continue;
    }
    const vs = s.visits.filter(
      (v) => v.requestId === r.id && v.status !== "Cancelled",
    );
    const q = s.quotes.find(
      (q) => q.requestId === r.id && q.status !== "Superseded",
    );
    const accepted = (v: Visit) =>
      s.assignments.some(
        (a) =>
          a.visitId === v.id &&
          a.providerId === v.providerId &&
          a.status === "Accepted",
      );
    const allAssigned = tasks.every((t) =>
      vs.some((v) => v.taskIds.includes(t.id)),
    );
    const ready =
      vs.length > 0 &&
      allAssigned &&
      vs.every(
        (v) =>
          accepted(v) &&
          eligible(
            v.providerId,
            tasks.filter((t) => v.taskIds.includes(t.id)),
          ),
      ) &&
      q?.status === "Approved" &&
      secured(s, q);
    r.status = ready
      ? "Confirmed"
      : q && q.status !== "Approved"
        ? "Awaiting Quote Approval"
        : vs.length && !vs.every(accepted)
          ? "Awaiting Provider Acceptance"
          : q?.status === "Approved" && !secured(s, q)
            ? "Awaiting Payment"
            : asked
              ? "Information requested"
              : "Submitted";
    for (const v of vs)
      if (!["In Progress", "Completed"].includes(v.status))
        v.status = ready ? "Confirmed" : "Proposed";
    for (const t of tasks) {
      const done = (v: Visit) =>
        v.execution?.finishedAt ? v.execution.outcomes[t.id] : undefined;
      const completed = vs.some((v) => done(v)?.outcome === "Completed");
      /* Closed by the operator after a visit could not finish it (ADR 065):
         finished with, but not done, so neither Completed nor waiting. */
      const closed = vs.some((v) => done(v)?.resolution?.kind === "Closed");
      /* A finished visit no longer holds a task it did not finish: the task
         waits for a return visit, which is the visit that holds it next. */
      t.status = completed
        ? "Completed"
        : closed
          ? "Not done"
          : vs.some((v) => v.taskIds.includes(t.id) && !v.execution?.finishedAt)
            ? "assigned to visit"
            : "unassigned";
    }
    if (
      vs.length &&
      vs.every((v) => v.status === "Completed") &&
      tasks.every((t) => ["Completed", "Not done"].includes(t.status!))
    )
      r.status = "Completed";
  }
}
export function torontoParts(date: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
}
export function localTime(day: string, hour: number) {
  let d = new Date(day + "T12:00:00Z");
  const p = torontoParts(d);
  return new Date(+d + (hour - Number(p.hour)) * 3600000);
}
export function available(
  s: State,
  providerId: string,
  duration: number,
  city: string,
  start: string,
  exclude?: string,
  timing = "",
  /** Whose hold to ignore: a request never blocks itself. */
  forRequest?: string,
) {
  const d = new Date(start),
    p = torontoParts(d);
  const mins = Number(p.hour) * 60 + Number(p.minute);
  const travel =
    providers.find((p) => p.id === providerId)?.city === city ? 8 : 24;
  if (
    !Number.isFinite(+d) ||
    +d <= s.clock ||
    !providerId ||
    duration < 15 ||
    ["Sat", "Sun"].includes(p.weekday) ||
    mins - travel < 9 * 60 ||
    mins + duration + 15 > 17 * 60
  )
    return false;
  if (timing.includes("9 AM–12 PM") && mins + duration > 12 * 60) return false;
  if (timing.includes("1–5 PM") && mins < 13 * 60) return false;
  /* The same overlap arithmetic answers both questions, so it is written once
     and asked of booked visits and of live holds in turn. */
  const clashes = (other: { start: string; duration: number }) =>
    +d - travel * 60000 < +new Date(other.start) + (other.duration + 15) * 60000 &&
    +d + (duration + 15 + travel) * 60000 > +new Date(other.start);
  if (
    s.visits.some(
      (v) =>
        v.id !== exclude &&
        v.providerId === providerId &&
        v.status !== "Cancelled" &&
        clashes(v),
    )
  )
    return false;
  /* Someone else's live hold blocks the slot; this request's own does not, or
     a customer could not book the slot they are holding. */
  return !(s.holds ?? []).some(
    (h) =>
      h.providerId === providerId &&
      h.requestId !== forRequest &&
      h.expiresAt > s.clock &&
      clashes(h),
  );
}
/**
 * Take a slot while a customer finishes booking it. One hold per request: a
 * customer changing their mind about the time replaces their own hold rather
 * than accumulating them.
 */
export function holdSlot(
  s: State,
  o: { requestId: string; providerId: string; start: string; duration: number },
) {
  s.holds = (s.holds ?? []).filter((h) => h.requestId !== o.requestId);
  const hold: Hold = { id: uid(), ...o, expiresAt: s.clock + HOLD_MS };
  s.holds.push(hold);
  return hold;
}
/** Give the slot back — on cancel, on going back, and once a visit exists. */
export function releaseHold(s: State, requestId: string) {
  s.holds = (s.holds ?? []).filter((h) => h.requestId !== requestId);
}
/**
 * Create a visit, checking the slot is still free **at the moment of writing**.
 *
 * The check has to live here rather than in the screen. `commit()` re-applies
 * this function against whatever is newest on disk, so a slot that was free
 * when the customer saw it may not be free when the write lands; validating
 * before the commit would be checking a state that no longer exists by the
 * time it matters.
 *
 * Returns null when the slot has gone, so the caller can say so rather than
 * silently creating a clash.
 */
export function bookVisit(
  s: State,
  o: {
    requestId: string;
    taskIds: string[];
    providerId: string;
    start: string;
    duration: number;
    travel: number;
    city: string;
    timing?: string;
    opKey: string;
  },
): Visit | null {
  const already = s.visits.find((v) => v.opKey && v.opKey === o.opKey);
  if (already) return already;
  if (
    !available(
      s,
      o.providerId,
      o.duration,
      o.city,
      o.start,
      undefined,
      o.timing ?? "",
      o.requestId,
    )
  )
    return null;
  const visit: Visit = {
    id: uid(),
    requestId: o.requestId,
    taskIds: o.taskIds,
    providerId: o.providerId,
    start: o.start,
    duration: o.duration,
    status: "Proposed",
    travel: o.travel,
    opKey: o.opKey,
  };
  s.visits.push(visit);
  releaseHold(s, o.requestId);
  return visit;
}
export function slots(
  s: State,
  providerId: string,
  duration: number,
  city: string,
  exclude?: string,
  timing = "",
  limit = 3,
) {
  if (!providerId) return [];
  const out: { start: string; travel: number; score: number }[] = [];
  const base = new Date(s.clock + 2 * 86400000);
  for (let day = 0; day < 10; day++) {
    const p = torontoParts(new Date(+base + day * 86400000));
    for (const h of [10, 11, 13, 15]) {
      const d = localTime(`${p.year}-${p.month}-${p.day}`, h);
      const travel =
        providers.find((p) => p.id === providerId)?.city === city ? 8 : 24;
      if (
        available(
          s,
          providerId,
          duration,
          city,
          d.toISOString(),
          exclude,
          timing,
        )
      )
        out.push({
          start: d.toISOString(),
          travel,
          score: 100 - travel - day * 2 - (h === 11 ? 0 : 4),
        });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
export function scopeMatch(providerId: string, tasks: Task[]) {
  const p = providers.find((p) => p.id === providerId);
  const active = tasks.filter((t) => !t.mergedInto);
  const checks = active.map((t) => {
    const referral = getIssue(t.description).availability === "Referral only";
    const family = t.category.split(" / ")[0].toLowerCase();
    const matchedSkill = !p
      ? ""
      : p.skills.toLowerCase().includes(family)
        ? family
        : t.category.includes("Doors") && p.skills.includes("doors")
          ? "doors"
          : t.category.includes("Walls") && p.skills.includes("walls")
            ? "walls"
            : t.category.includes("Fixtures") &&
                p.skills.includes("installation")
              ? "installation"
              : "";
    const skill =
      !!p && (t.restricted || providerId === "yousef" || !!matchedSkill);
    const qualified = !!p && (!t.restricted || p.eligible);
    const fits = !referral && t.reviewed && qualified && skill;
    const reason = referral
      ? "Referral-only work is not bookable"
      : !t.reviewed
        ? "Operator scope review required"
        : !qualified
          ? "Restricted-work eligibility required"
          : !skill
            ? "Required skill not listed for this provider"
            : t.restricted
              ? "Operator-reviewed scope and manually marked specialist eligibility"
              : providerId === "yousef"
                ? "Covered by the existing owner/lead-handyman eligibility policy"
                : `Listed ${matchedSkill} skill matches this task; operator scope review is complete`;
    return {
      taskId: t.id,
      title: t.summary,
      category: t.category,
      fits,
      reason,
    };
  });
  return {
    eligible: !!p && checks.length > 0 && checks.every((c) => c.fits),
    checks,
  };
}
export function eligible(providerId: string, tasks: Task[]) {
  return scopeMatch(providerId, tasks).eligible;
}
export function instantEligible(tasks: Task[]) {
  return (
    tasks.length === 1 &&
    tasks[0].category.includes("Doors") &&
    tasks[0].reviewed &&
    !needsClarificationReview(tasks[0]) &&
    (!tasks[0].answers["door-adjust:count"] ||
      /^(1|one)( door)?$/i.test(
        tasks[0].answers["door-adjust:count"].trim(),
      )) &&
    tasks[0].answers["door-adjust:location"] !== "Exterior" &&
    !tasks[0].restricted &&
    !/damaged|broken|replace|rott|crack|fire.rated/i.test(
      tasks[0].description + " " + Object.values(tasks[0].answers).join(" "),
    )
  );
}
