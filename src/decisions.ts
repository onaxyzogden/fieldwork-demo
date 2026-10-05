/**
 * The operator's next decision, one request at a time (ADR 059).
 *
 * The request page already shows exactly one decision (ADR 010); this is that
 * same choice as data, so a queue can walk through it without the page, and
 * with the app's own suggestion filled in. The branch order is the decision
 * card's own (main.tsx decisionCard), plus the one state the card has no
 * action for: a work issue on a confirmed job.
 *
 * The writes are extracted from the request page rather than written again,
 * and the page now calls them too — so "Send quote" in the queue and "Send
 * quote" on the page cannot drift into two behaviours.
 */
import {
  type State,
  type Task,
  type Visit,
  bookVisit,
  log,
  money,
  providers,
  uid,
} from "./model";
import { dispatchStatus, replacementOptions } from "./dispatch";
import { suitableProviders } from "./suitability";
import { bucket, workIssue } from "./work";

/** A slot, a provider and what they would be paid for it. */
export type Offer = {
  providerId: string;
  start: string;
  travel: number;
  pay: number;
};

export type Decision =
  | { kind: "follow-up"; visitId: string; issue: string }
  | {
      kind: "reassign";
      visitId: string;
      expired: boolean;
      previousProviderId?: string;
      /** The first other contractor the reassign modal would list. */
      offer?: Offer & { minimumPay: number };
      /** The operator covering it themselves, if they are free. */
      self?: Offer;
    }
  | { kind: "review"; taskIds: string[] }
  | {
      kind: "assign";
      taskIds: string[];
      duration: number;
      /** The best contractor with an appointment, if any can take every task. */
      offer?: Offer;
      /** The operator doing it themselves, if they can. */
      self?: Offer;
    }
  | { kind: "quote"; amount: number }
  | { kind: "revise"; quoteId: string; amount: number };

/**
 * Simulated customer price: a flat call-out plus a labour rate over the
 * estimated duration, rounded to $5, never under $95. Moved here from the
 * request page so the page and the queue suggest the same number.
 */
export function suggestQuote(tasks: Task[]) {
  const minutes = tasks.reduce((n, t) => n + t.duration, 0);
  return Math.max(95, Math.round((45 + (minutes / 60) * 120) / 5) * 5);
}

/**
 * What a contractor is offered for a job: their listed hourly rate over its
 * length — the same floor the reassignment already enforces. The operator
 * doing it themselves is paid nothing.
 */
export function suggestPay(providerId: string, duration: number) {
  if (providerId === "yousef") return 0;
  const p = providers.find((x) => x.id === providerId);
  return p ? Math.ceil((p.rate * duration) / 60) : 0;
}

const requestTasks = (s: State, requestId: string) =>
  s.tasks.filter((t) => t.requestId === requestId && !t.mergedInto);

export function nextDecision(s: State, requestId: string): Decision | null {
  const r = s.requests.find((x) => x.id === requestId);
  if (!r || ["Cancelled", "Declined", "Completed", "Draft"].includes(r.status))
    return null;
  const live = s.visits.filter(
    (v) => v.requestId === r.id && v.status !== "Cancelled",
  );
  /* First, because the card cannot show it: a confirmed job that is late or
     came back unresolved has nothing to press, but it is still the operator's
     to look at. */
  const troubled = live.find((v) => workIssue(v));
  if (troubled)
    return {
      kind: "follow-up",
      visitId: troubled.id,
      issue: workIssue(troubled),
    };
  /* Mirrors the card's "Confirmed" state. Unreachable today — a confirmed
     request has every task reviewed, assigned and accepted and its quote
     approved, so the checks below return null for it anyway, and removing
     this changes no test — kept so the order stays the card's. */
  if (r.status === "Confirmed") return null;

  const stalled = live.find((v) =>
    dispatchStatus(s, v).includes("Needs reassignment"),
  );
  if (stalled) {
    const previous = s.assignments
      .filter(
        (a) =>
          a.visitId === stalled.id &&
          ["Declined", "Expired"].includes(a.status),
      )
      .at(-1);
    /* The suggestion is always another contractor; covering it yourself is
       a separate button, as it is when assigning. */
    const options = replacementOptions(s, stalled).filter((o) => o.start);
    const option = options.find((o) => o.provider.id !== "yousef");
    const mine = options.find((o) => o.provider.id === "yousef");
    return {
      kind: "reassign",
      visitId: stalled.id,
      expired: dispatchStatus(s, stalled).startsWith("Offer expired"),
      previousProviderId: previous?.providerId,
      ...(option
        ? {
            offer: {
              providerId: option.provider.id,
              start: option.start!,
              travel: option.travel,
              pay: Math.max(previous?.pay ?? 0, option.minimumPay),
              minimumPay: option.minimumPay,
            },
          }
        : {}),
      ...(mine
        ? {
            self: {
              providerId: "yousef",
              start: mine.start!,
              travel: mine.travel,
              pay: 0,
            },
          }
        : {}),
    };
  }

  const tasks = requestTasks(s, r.id);
  const unreviewed = tasks.filter((t) => !t.reviewed);
  if (unreviewed.length)
    return { kind: "review", taskIds: unreviewed.map((t) => t.id) };

  const loose = tasks.filter(
    (t) => !live.some((v) => v.taskIds.includes(t.id)),
  );
  if (loose.length) {
    const duration = loose.reduce((n, t) => n + t.duration, 0);
    const pick = (self: boolean): Offer | undefined => {
      const c = suitableProviders(s, loose, r.city, r.timing, self).find(
        (c) => c.appointments.length,
      );
      if (!c) return undefined;
      const slot = c.appointments[0];
      return {
        providerId: c.provider.id,
        start: slot.start,
        travel: slot.travel,
        pay: suggestPay(c.provider.id, duration),
      };
    };
    return {
      kind: "assign",
      taskIds: loose.map((t) => t.id),
      duration,
      offer: pick(false),
      self: pick(true),
    };
  }

  const accepted = (v: Visit) =>
    s.assignments.some(
      (a) =>
        a.visitId === v.id &&
        a.providerId === v.providerId &&
        a.status === "Accepted",
    );
  if (live.some((v) => !accepted(v))) return null; // waiting on a contractor

  const quote = s.quotes.find(
    (q) => q.requestId === r.id && q.status !== "Superseded",
  );
  if (!quote) return { kind: "quote", amount: suggestQuote(tasks) };
  if (quote.status === "Declined")
    return { kind: "revise", quoteId: quote.id, amount: quote.amount };
  return null; // waiting on the customer or the payment
}

/** Decisions that are about something going wrong, not something new. */
const URGENT = new Set<Decision["kind"]>(["reassign", "follow-up"]);

/**
 * The requests the operator has a decision on, urgent first, then oldest.
 * A request carries no timestamp of its own, so its age is its earliest
 * logged event; requests with none keep the order they were stored in.
 */
export function decisionQueue(s: State) {
  /* Plain string order on ISO times. Not localeCompare: collation ranks
     punctuation before digits, which would put "no events" first. */
  const byAge = (a: string, b: string) =>
    a === b ? 0 : !a ? 1 : !b ? -1 : a < b ? -1 : 1;
  const first = (id: string) =>
    (s.events ?? [])
      .filter((e) => e.requestId === id)
      .map((e) => e.at)
      .sort()[0] ?? "";
  return s.requests
    .map((r, i) => ({ r, i, d: nextDecision(s, r.id) }))
    .filter(({ r, d }) => d && bucket(s, r.id) === "Needs Action")
    .sort(
      (a, b) =>
        Number(URGENT.has(b.d!.kind)) - Number(URGENT.has(a.d!.kind)) ||
        byAge(first(a.r.id), first(b.r.id)) ||
        a.i - b.i,
    )
    .map(({ r, d }) => ({ requestId: r.id, decision: d! }));
}

/** "Scope looks right": every task still waiting for review, reviewed. */
export function approveScope(s: State, requestId: string) {
  const pending = requestTasks(s, requestId).filter((t) => !t.reviewed);
  for (const t of pending) {
    t.reviewed = true;
    log(s, "Operator reviewed task; compliance flag retained", {
      actor: "Operator",
      requestId,
      entity: "task",
      entityId: t.id,
      field: "reviewed",
      from: "no",
      to: "yes",
    });
  }
  return pending.length;
}

/**
 * Book a visit and offer it — the request page's "Create visit". Refuses an
 * offer below the contractor's rate for the job, the same floor reassignment
 * has always enforced; the operator doing it themselves is paid nothing and
 * accepts at once.
 */
export function offerVisit(
  s: State,
  o: {
    requestId: string;
    taskIds: string[];
    providerId: string;
    start: string;
    travel: number;
    duration: number;
    pay: number;
    opKey: string;
  },
): Visit | null {
  const r = s.requests.find((x) => x.id === o.requestId);
  if (!r) return null;
  const self = o.providerId === "yousef";
  if (
    !self &&
    (!Number.isFinite(o.pay) || o.pay < suggestPay(o.providerId, o.duration))
  )
    return null;
  const booked = bookVisit(s, {
    requestId: r.id,
    taskIds: o.taskIds,
    providerId: o.providerId,
    start: o.start,
    duration: o.duration,
    travel: o.travel,
    city: r.city,
    timing: r.timing,
    opKey: o.opKey,
  });
  if (!booked) return null;
  /* bookVisit returns the earlier visit for a repeated key; the offer it made
     then is already there. */
  if (s.assignments.some((a) => a.visitId === booked.id)) return booked;
  const name = providers.find((p) => p.id === o.providerId)?.name;
  s.assignments.push({
    id: uid(),
    visitId: booked.id,
    providerId: o.providerId,
    status: self ? "Accepted" : "Offered",
    pay: self ? 0 : o.pay,
    expiresAt: s.clock + 7200000,
  });
  log(
    s,
    `${r.name} · visit created for ${name}${self ? "" : " · offer sent"}`,
    {
      actor: "Operator",
      requestId: r.id,
      entity: "visit",
      entityId: booked.id,
      field: "providerId",
      to: name || o.providerId,
    },
  );
  return booked;
}

/** Send, or re-send, the customer's quote — the request page's "Send quote". */
export function issueQuote(
  s: State,
  requestId: string,
  q: { type: string; amount: number; payOnCompletion: boolean },
) {
  const r = s.requests.find((x) => x.id === requestId);
  if (!r || !Number.isFinite(q.amount) || q.amount < 1) return false;
  const previous = s.quotes.find(
    (x) => x.requestId === r.id && x.status !== "Superseded",
  );
  s.quotes
    .filter((x) => x.requestId === r.id)
    .forEach((x) => (x.status = "Superseded"));
  s.quotes.push({
    id: uid(),
    requestId: r.id,
    type: q.type,
    amount: q.amount,
    high: Math.round(q.amount * 1.25),
    status: "Sent",
    notes:
      q.type === "Estimated range"
        ? "Final price depends on site conditions. Any additional work requires your approval."
        : "Labour and standard materials included. Quote valid for 7 days.",
    payOnCompletion: q.payOnCompletion,
  });
  log(s, `Quote sent to ${r.name} · ${money(q.amount)}`, {
    actor: "Operator",
    requestId: r.id,
    entity: "quote",
    entityId: r.id,
    field: "amount",
    // Absent rather than "none" when this is the first quote: there was no
    // previous price, which is different from a previous price of nothing.
    ...(previous ? { from: money(previous.amount) } : {}),
    to: money(q.amount),
  });
  return true;
}
