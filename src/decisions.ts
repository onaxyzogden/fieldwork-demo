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
  type Charge,
  type ReturnPlan,
  type State,
  type Task,
  type Visit,
  bookVisit,
  genericTitle,
  log,
  methodFor,
  money,
  providers,
  sentence,
  timeLabel,
  uid,
} from "./model";
import { dispatchStatus, replacementOptions } from "./dispatch";
import { refundPayment } from "./payments";
import { suggestTitle } from "./pmw";
import { suitableProviders } from "./suitability";
import {
  bucket,
  callBackDue,
  feeUndecided,
  unresolved,
  workIssue,
} from "./work";

/** A slot, a provider and what they would be paid for it. */
export type Offer = {
  providerId: string;
  start: string;
  travel: number;
  pay: number;
};

export type Decision =
  /** Money held after a late cancellation: keep a fee, or refund it all. */
  | { kind: "late-cancel"; fee: number; held: number }
  /** A customer who could not change a visit themselves, waiting on a call. */
  | { kind: "call-back"; visitId: string; by: string }
  | {
      kind: "follow-up";
      visitId: string;
      issue: string;
      /** What the visits left undone (ADR 065). Empty for a late arrival. */
      tasks: Unfinished[];
      /** A late arrival the customer has not been told about: when. */
      eta?: string;
      /** The return visit for the tasks suggested back, if anyone is free. */
      offer?: Offer;
      self?: Offer;
      /** The last charge on these tasks, if it came back: paid but its time
       *  had gone, or declined. */
      charge?: { id: string; amount: number; status: string };
    }
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

/** One task a visit could not finish, as the follow-up shows it (ADR 065). */
export type Unfinished = {
  taskId: string;
  visitId: string;
  outcome: string;
  note: string;
  /** Close what the customer declined; bring everything else back. */
  action: "return" | "close";
  /** Its share of what was paid: the refund suggested if it is closed. */
  refund: number;
};

export function nextDecision(s: State, requestId: string): Decision | null {
  const r = s.requests.find((x) => x.id === requestId);
  if (!r) return null;
  /* The one decision a cancelled request can still have (ADR 064). */
  if (feeUndecided(r))
    return {
      kind: "late-cancel",
      fee: suggestLateFee(s, r.id),
      held: heldFor(s, r.id),
    };
  if (["Cancelled", "Declined", "Completed", "Draft"].includes(r.status))
    return null;
  const live = s.visits.filter(
    (v) => v.requestId === r.id && v.status !== "Cancelled",
  );
  /* Before anything else on a live request: someone was promised a call by
     a time, and the visit they want moved is less than a day away. */
  if (callBackDue(r))
    return {
      kind: "call-back",
      visitId: r.callBack!.visitId,
      by: r.callBack!.by,
    };
  /* First, because the card cannot show it: a confirmed job that is late or
     came back unresolved has nothing to press, but it is still the operator's
     to look at. */
  /* Unfinished work before a late arrival: it is the one with money and a
     second trip in it. */
  const troubled =
    live.find((v) => unresolved(v).length) ?? live.find((v) => workIssue(v));
  if (troubled) {
    const tasks = unfinished(s, r.id);
    const back = tasks.filter((t) => t.action === "return");
    const charge = (s.charges ?? [])
      .filter(
        (c) =>
          c.requestId === r.id &&
          c.taskIds.some((id) => tasks.some((t) => t.taskId === id)) &&
          (c.status === "Declined" || (c.status === "Approved" && !c.visitId)),
      )
      .at(-1);
    return {
      kind: "follow-up",
      visitId: troubled.id,
      issue: workIssue(troubled),
      tasks,
      ...(tasks.length
        ? returnOptions(
            s,
            r.id,
            (back.length ? back : tasks).map((t) => t.taskId),
          )
        : { eta: troubled.execution?.eta }),
      ...(charge
        ? {
            charge: {
              id: charge.id,
              amount: charge.amount,
              status: charge.status,
            },
          }
        : {}),
    };
  }
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
      const c = suitableProviders(s, loose, r.city, r.timing, self, r.id).find(
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
const URGENT = new Set<Decision["kind"]>([
  "late-cancel",
  "call-back",
  "reassign",
  "follow-up",
]);

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

/**
 * Review one task. A task still carrying the classifier's fallback title gets
 * a real one on the way through (ADR 063): the operator's, or the first clause
 * of the customer's own description — the rule walkthrough findings already
 * use. That title is what the contractor's offer will be headed with.
 */
export function reviewTask(s: State, taskId: string, title?: string) {
  const t = s.tasks.find((x) => x.id === taskId);
  if (!t || t.reviewed) return false;
  if (genericTitle(t)) {
    const named = title?.trim() || suggestTitle(t.description);
    if (named) {
      log(s, `Operator named the task · ${named}`, {
        actor: "Operator",
        requestId: t.requestId,
        entity: "task",
        entityId: t.id,
        field: "summary",
        from: t.summary,
        to: named,
      });
      t.summary = named;
    }
  }
  t.reviewed = true;
  log(s, "Operator reviewed task; compliance flag retained", {
    actor: "Operator",
    requestId: t.requestId,
    entity: "task",
    entityId: t.id,
    field: "reviewed",
    from: "no",
    to: "yes",
  });
  return true;
}

/** "Scope looks right": every task still waiting for review, reviewed, with
 *  any titles the operator gave by task id. */
export function approveScope(
  s: State,
  requestId: string,
  titles: Record<string, string> = {},
) {
  const pending = requestTasks(s, requestId).filter((t) => !t.reviewed);
  for (const t of pending) reviewTask(s, t.id, titles[t.id]);
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
    /** A return visit (ADR 065): any pay from $0, set by the reason. */
    returning?: boolean;
  },
): Visit | null {
  const r = s.requests.find((x) => x.id === o.requestId);
  if (!r) return null;
  const self = o.providerId === "yousef";
  if (
    !self &&
    (!Number.isFinite(o.pay) ||
      o.pay < (o.returning ? 0 : suggestPay(o.providerId, o.duration)))
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

/* ── Changes inside 24 hours (ADR 064) ───────────────────────────────────── */

/** How close to a visit the customer stops changing it themselves. */
export const LATE_WINDOW = 24 * 3600000;
/** How soon the customer is promised a call about a late change. */
export const CALL_BACK_WITHIN = 2 * 3600000;
/** The late-cancellation fee starts at this share of the quote. */
export const LATE_FEE_SHARE = 0.25;

/** A visit close enough that changing it is the operator's to arrange. */
export const lateFor = (s: State, v: Visit) =>
  +new Date(v.start) - s.clock < LATE_WINDOW;

const liveQuote = (s: State, requestId: string) =>
  s.quotes.find((q) => q.requestId === requestId && q.status !== "Superseded");

/** The request's payments still holding money, the only ones a cancellation
 *  refunds. */
const paidFor = (s: State, requestId: string) =>
  s.payments.filter(
    (p) =>
      p.status === "Paid" &&
      s.quotes.some((q) => q.id === p.quoteId && q.requestId === requestId),
  );

/** What the customer has paid that a late cancellation is holding. */
export const heldFor = (s: State, requestId: string) =>
  paidFor(s, requestId).reduce((n, p) => n + p.amount, 0);

/** The fee the operator is offered: a share of the quote, to the dollar. */
export const suggestLateFee = (s: State, requestId: string) =>
  Math.round((liveQuote(s, requestId)?.amount ?? 0) * LATE_FEE_SHARE);

/**
 * The customer's "Cancel", the only cancellation write. It always cancels the
 * request, its visits and the offers still open on them. Whether the money
 * goes back depends on how close the work was: with every visit more than a
 * day out it is refunded, as it always was; inside that, it is held and the
 * operator decides the fee (settleLateCancel).
 */
export function cancelBooking(s: State, requestId: string) {
  const r = s.requests.find((x) => x.id === requestId);
  if (!r || ["Cancelled", "Declined", "Completed", "Draft"].includes(r.status))
    return false;
  const visits = s.visits.filter((v) => v.requestId === r.id);
  const late = visits.some(
    (v) =>
      v.status !== "Cancelled" && !v.execution?.finishedAt && lateFor(s, v),
  );
  r.status = "Cancelled";
  visits.forEach((v) => (v.status = "Cancelled"));
  /* Open offers only: a decline or an expiry already said what it says. */
  s.assignments
    .filter(
      (a) =>
        visits.some((v) => v.id === a.visitId) &&
        ["Offered", "Accepted"].includes(a.status),
    )
    .forEach((a) => (a.status = "Cancelled"));
  if (late) {
    r.lateCancel = { at: new Date(s.clock).toISOString() };
    log(s, "Customer cancelled within 24 hours · payment held for the fee", {
      actor: "Customer",
      requestId: r.id,
      entity: "request",
      entityId: r.id,
      field: "status",
      to: "Cancelled",
    });
    return true;
  }
  paidFor(s, r.id).forEach((p) => (p.status = "Refunded"));
  log(s, "Customer cancelled booking · simulated refund issued");
  return true;
}

/**
 * Settle a late cancellation: keep `fee` and refund the rest, or refund it
 * all with a fee of 0. A fee larger than what was paid charges the
 * difference to the card on file; with no card on file it is owed instead
 * (`Outstanding`, the operator's to chase), never silently dropped.
 */
export function settleLateCancel(s: State, requestId: string, fee: number) {
  const r = s.requests.find((x) => x.id === requestId);
  if (!r || !feeUndecided(r) || !Number.isFinite(fee) || fee < 0) return false;
  const quote = liveQuote(s, r.id);
  /* A fee is charged against the quote. Unreachable from the screens — only
     a confirmed visit can be cancelled, and confirming needs a quote. */
  if (fee > 0 && !quote) return false;
  let keep = Math.round(fee * 100) / 100;
  for (const p of paidFor(s, r.id)) {
    const kept = Math.min(keep, p.amount);
    keep -= kept;
    /* Kept whole, nothing goes back: refundPayment refuses a zero refund. */
    refundPayment(s, p.id, p.amount - kept);
  }
  if (keep > 0) {
    const method = methodFor(s, quote!);
    s.payments.push({
      id: uid(),
      quoteId: quote!.id,
      status: method ? "Paid" : "Outstanding",
      amount: keep,
      reference: uid(),
      fee: true,
      ...(method
        ? {
            methodId: method.id,
            capturedAt: new Date(s.clock).toISOString(),
          }
        : {}),
    });
  }
  r.lateCancel = { ...r.lateCancel!, fee };
  log(
    s,
    fee
      ? `Late-cancellation fee ${money(fee)} · the rest refunded`
      : "Late-cancellation fee waived · refunded in full",
    {
      actor: "Operator",
      requestId: r.id,
      entity: "request",
      entityId: r.id,
      field: "lateFee",
      to: money(fee),
    },
  );
  return true;
}

/**
 * The customer's "Reschedule" inside the window: no new time is picked, a
 * call is promised instead. One promise at a time — asking again while one is
 * open changes nothing.
 */
export function requestCallBack(s: State, visitId: string) {
  const v = s.visits.find((x) => x.id === visitId);
  const r = v && s.requests.find((x) => x.id === v.requestId);
  if (!v || !r || v.status === "Cancelled" || callBackDue(r)) return false;
  r.callBack = {
    visitId,
    by: new Date(s.clock + CALL_BACK_WITHIN).toISOString(),
  };
  log(s, "Customer asked to change a visit within 24 hours · call back due", {
    actor: "Customer",
    requestId: r.id,
    entity: "visit",
    entityId: v.id,
    field: "callBack",
    to: r.callBack.by,
  });
  return true;
}

/** The operator called and the visit stays as it is. */
export function completeCallBack(s: State, requestId: string) {
  const r = s.requests.find((x) => x.id === requestId);
  if (!r || !callBackDue(r)) return false;
  r.callBack!.done = true;
  log(s, "Operator called the customer · visit unchanged", {
    actor: "Operator",
    requestId: r.id,
    entity: "request",
    entityId: r.id,
    field: "callBack",
    to: "done",
  });
  return true;
}

/**
 * Move a visit to a new time with the same contractor, who has to accept
 * again. The customer's own reschedule and the operator's, after the call,
 * both land here; moving the visit is what the call was for, so it closes it.
 */
export function rescheduleVisit(
  s: State,
  visitId: string,
  slot: { start: string; travel: number },
  actor: "Customer" | "Operator",
) {
  const v = s.visits.find((x) => x.id === visitId);
  if (!v || v.status === "Cancelled") return false;
  v.start = slot.start;
  v.travel = slot.travel;
  if (v.providerId !== "yousef") {
    const accepted = s.assignments.filter(
      (a) => a.visitId === v.id && a.status === "Accepted",
    );
    const pay =
      accepted.at(-1)?.pay ??
      s.assignments.find((a) => a.visitId === v.id)?.pay ??
      0;
    accepted.forEach((a) => (a.status = "Reassigned"));
    s.assignments.push({
      id: uid(),
      visitId: v.id,
      providerId: v.providerId,
      status: "Offered",
      pay,
      expiresAt: s.clock + 7200000,
    });
  }
  log(s, `${actor} rescheduled visit · provider notified`);
  const r = s.requests.find((x) => x.id === v.requestId);
  if (r && callBackDue(r) && r.callBack!.visitId === v.id)
    r.callBack!.done = true;
  return true;
}

/* ── Follow-ups (ADR 065) ────────────────────────────────────────────────── */

/** "Unable to complete" is finishing work already paid for; anything else
 *  is a second trip the contractor is paid for. */
const UNPAID_RETURN = new Set(["Unable to complete"]);

/** What the request's paid payments still hold, the most a refund can be.
 *  The work's own payments only: not a late fee or an additional charge. */
const refundable = (s: State, requestId: string) =>
  s.payments
    .filter(
      (p) =>
        ["Paid", "Partially Refunded"].includes(p.status) &&
        !p.fee &&
        !p.chargeId &&
        s.quotes.some((q) => q.id === p.quoteId && q.requestId === requestId),
    )
    .map((p) => ({ p, left: p.amount - (p.refunded ?? 0) }));

/** A task's share of the quote by its estimated time, to the dollar, and no
 *  more than is left to refund. */
export function refundShare(s: State, taskId: string) {
  const t = s.tasks.find((x) => x.id === taskId);
  if (!t) return 0;
  const quote = liveQuote(s, t.requestId);
  const all = requestTasks(s, t.requestId);
  const minutes = all.reduce((n, x) => n + x.duration, 0);
  const share = quote && minutes ? (quote.amount * t.duration) / minutes : 0;
  return Math.round(Math.min(share, refundLeft(s, t.requestId)));
}

/** The most the work's payments can still give back. */
export const refundLeft = (s: State, requestId: string) =>
  refundable(s, requestId).reduce((n, x) => n + x.left, 0);

/** Every task a finished visit on the request left undone and nobody has
 *  decided about, with what the follow-up suggests for it. */
export function unfinished(s: State, requestId: string): Unfinished[] {
  return s.visits
    .filter((v) => v.requestId === requestId && v.status !== "Cancelled")
    .flatMap((v) =>
      unresolved(v).map((taskId) => {
        const o = v.execution!.outcomes[taskId];
        return {
          taskId,
          visitId: v.id,
          outcome: o.outcome,
          note: o.note,
          action: o.outcome === "Customer declined" ? "close" : "return",
          refund: refundShare(s, taskId),
        } as Unfinished;
      }),
    );
}

/** What a contractor is offered to come back for these tasks: their rate for
 *  the ones that need a second trip, nothing for finishing what they could
 *  not. The operator doing it themselves is paid nothing either way. */
export function returnPay(s: State, providerId: string, taskIds: string[]) {
  const minutes = taskIds
    .filter((id) => {
      const o = s.visits
        .map((v) =>
          v.execution?.finishedAt ? v.execution.outcomes[id] : undefined,
        )
        .filter(Boolean)
        .at(-1);
      return !UNPAID_RETURN.has(o?.outcome ?? "");
    })
    .reduce(
      (n, id) => n + (s.tasks.find((t) => t.id === id)?.duration ?? 0),
      0,
    );
  /* No minutes is no pay: suggestPay of nothing is $0. */
  return suggestPay(providerId, minutes);
}

/**
 * Who could come back for these tasks, and when: the contractor who was there
 * first if they are free, else the first other contractor who can do them,
 * and the operator themselves.
 */
export function returnOptions(
  s: State,
  requestId: string,
  taskIds: string[],
): { offer?: Offer; self?: Offer } {
  const r = s.requests.find((x) => x.id === requestId);
  const tasks = s.tasks.filter((t) => taskIds.includes(t.id));
  /* No tasks needs no time, and no time gets no slot, so an empty list
     comes back empty without a check of its own. */
  if (!r) return {};
  const first = s.visits
    .filter((v) => v.requestId === r.id && v.execution?.finishedAt)
    .find((v) => v.taskIds.some((id) => taskIds.includes(id)))?.providerId;
  const free = (self: boolean) =>
    suitableProviders(s, tasks, r.city, r.timing, self, r.id).filter(
      (c) => c.appointments.length,
    );
  const others = free(false);
  const pick = others.find((c) => c.provider.id === first) ?? others[0];
  const mine = free(true)[0];
  const as = (c: (typeof others)[number]): Offer => ({
    providerId: c.provider.id,
    start: c.appointments[0].start,
    travel: c.appointments[0].travel,
    pay: returnPay(s, c.provider.id, taskIds),
  });
  return {
    ...(pick ? { offer: as(pick) } : {}),
    ...(mine ? { self: as(mine) } : {}),
  };
}

/** The undecided outcome for a task, or the one waiting on `chargeId`. */
const openOutcome = (s: State, taskId: string, chargeId?: string) =>
  s.visits
    .filter((v) => v.execution?.finishedAt && v.status !== "Cancelled")
    .map((v) => v.execution!.outcomes[taskId])
    .find(
      (o) =>
        o &&
        o.outcome !== "Completed" &&
        (!o.resolution ||
          (!!chargeId &&
            o.resolution.kind === "Return visit" &&
            o.resolution.chargeId === chargeId &&
            !o.resolution.visitId)),
    );

/**
 * Book the return visit for unfinished tasks and resolve them. The offer goes
 * through offerVisit like any other, at any pay from $0. With `chargeId`, the
 * tasks are the ones a paid charge was waiting on.
 */
export function bookReturnVisit(
  s: State,
  requestId: string,
  taskIds: string[],
  o: Offer & { opKey: string },
  chargeId?: string,
) {
  const outcomes = taskIds.map((id) => openOutcome(s, id, chargeId));
  /* An empty list books nothing: bookVisit refuses a visit under 15
     minutes. */
  if (outcomes.some((x) => !x)) return null;
  const duration = taskIds.reduce(
    (n, id) => n + (s.tasks.find((t) => t.id === id)?.duration ?? 0),
    0,
  );
  const booked = offerVisit(s, {
    requestId,
    taskIds,
    providerId: o.providerId,
    start: o.start,
    travel: o.travel,
    duration,
    pay: o.pay,
    opKey: o.opKey,
    returning: true,
  });
  if (!booked) return null;
  const at = new Date(s.clock).toISOString();
  for (const x of outcomes)
    x!.resolution = {
      kind: "Return visit",
      at,
      visitId: booked.id,
      ...(chargeId ? { chargeId } : {}),
    };
  const charge = s.charges?.find((c) => c.id === chargeId);
  if (charge) charge.visitId = booked.id;
  log(
    s,
    `Return visit booked · ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}`,
    {
      actor: "Operator",
      requestId,
      entity: "visit",
      entityId: booked.id,
      field: "returnFor",
      to: taskIds.join(", "),
    },
  );
  return booked;
}

/**
 * Send the customer an additional charge for a return visit whose scope
 * changed. The tasks count as heading for a return visit from now, so the
 * follow-up leaves the operator's list while the customer decides.
 */
export function requestExtraCharge(
  s: State,
  requestId: string,
  c: { amount: number; reason: string; taskIds: string[]; plan: ReturnPlan },
) {
  const outcomes = c.taskIds.map((id) => openOutcome(s, id));
  if (
    !c.taskIds.length ||
    outcomes.some((x) => !x) ||
    !Number.isFinite(c.amount) ||
    c.amount < 1 ||
    !c.reason.trim()
  )
    return null;
  const at = new Date(s.clock).toISOString();
  const charge: Charge = {
    id: uid(),
    requestId,
    amount: Math.round(c.amount * 100) / 100,
    reason: c.reason.trim(),
    taskIds: c.taskIds,
    status: "Sent",
    plan: c.plan,
    sentAt: at,
  };
  (s.charges ??= []).push(charge);
  for (const x of outcomes)
    x!.resolution = { kind: "Return visit", at, chargeId: charge.id };
  log(
    s,
    `Additional charge sent · ${money(charge.amount)} · ${charge.reason}`,
    {
      actor: "Operator",
      requestId,
      entity: "charge",
      entityId: charge.id,
      field: "status",
      to: "Sent",
    },
  );
  return charge;
}

/** Undo the "heading for a return visit" a charge put on its tasks. */
const release = (s: State, charge: Charge) => {
  for (const id of charge.taskIds) {
    const o = openOutcome(s, id, charge.id);
    if (o?.resolution) delete o.resolution;
  }
};

/**
 * The customer approves and pays an additional charge; the return visit it
 * pays for is then offered. Payment goes through the same simulated checkout
 * as a quote (`fail` is Demo settings' "Customer payments fail"). If the time
 * has gone meanwhile, the paid tasks go back to the operator to book.
 */
export function approveCharge(s: State, chargeId: string, fail = false) {
  const c = s.charges?.find((x) => x.id === chargeId);
  const quote = c && liveQuote(s, c.requestId);
  if (!c || c.status !== "Sent" || !quote) return false;
  if (fail) {
    s.payments.push({
      id: uid(),
      quoteId: quote.id,
      chargeId: c.id,
      status: "Failed",
      amount: c.amount,
      reference: uid(),
    });
    log(s, "Demo payment failed");
    return false;
  }
  s.payments.push({
    id: uid(),
    quoteId: quote.id,
    chargeId: c.id,
    status: "Paid",
    amount: c.amount,
    reference: uid(),
    capturedAt: new Date(s.clock).toISOString(),
  });
  c.status = "Approved";
  log(s, `Additional charge approved and paid · ${money(c.amount)}`, {
    actor: "Customer",
    requestId: c.requestId,
    entity: "charge",
    entityId: c.id,
    field: "status",
    from: "Sent",
    to: "Approved",
  });
  const booked = bookReturnVisit(
    s,
    c.requestId,
    c.taskIds,
    { ...c.plan, opKey: "charge-" + c.id },
    c.id,
  );
  if (!booked) release(s, c);
  return true;
}

/** The customer declines an additional charge: back to the operator. */
export function declineCharge(s: State, chargeId: string) {
  const c = s.charges?.find((x) => x.id === chargeId);
  if (!c || c.status !== "Sent") return false;
  c.status = "Declined";
  release(s, c);
  log(s, `Additional charge declined · ${money(c.amount)}`, {
    actor: "Customer",
    requestId: c.requestId,
    entity: "charge",
    entityId: c.id,
    field: "status",
    from: "Sent",
    to: "Declined",
  });
  return true;
}

/**
 * Close an unfinished task as not done, refunding `refund` from what was
 * paid for the work (0 refunds nothing). Never more than is left to refund.
 */
export function closeTask(s: State, taskId: string, refund: number) {
  const t = s.tasks.find((x) => x.id === taskId);
  const o = openOutcome(s, taskId);
  if (!t || !o || !Number.isFinite(refund) || refund < 0) return false;
  const pots = refundable(s, t.requestId);
  if (refund > refundLeft(s, t.requestId)) return false;
  let owed = Math.round(refund * 100) / 100;
  for (const { p, left } of pots) {
    const give = Math.min(owed, left);
    /* A payment with nothing to give back is skipped by refundPayment, which
       refuses a zero refund. */
    refundPayment(s, p.id, give);
    owed -= give;
  }
  o.resolution = {
    kind: "Closed",
    at: new Date(s.clock).toISOString(),
    refund,
  };
  log(
    s,
    `Task closed as not done · ${t.summary}${refund ? ` · ${money(refund)} refunded` : ""}`,
    {
      actor: "Operator",
      requestId: t.requestId,
      entity: "task",
      entityId: t.id,
      field: "status",
      to: "Not done",
    },
  );
  return true;
}

/**
 * Tell the customer their contractor is running late, in the visit's own
 * conversation, and take the late arrival off the operator's list.
 */
export function tellCustomerLate(s: State, visitId: string) {
  const v = s.visits.find((x) => x.id === visitId);
  const x = v?.execution;
  /* Once told, the visit is no longer a work issue, so telling twice is
     refused here too. */
  if (!v || !x?.eta || !workIssue(v)) return false;
  const name =
    providers.find((p) => p.id === v.providerId)?.name || "Your provider";
  (v.messages ??= []).push({
    id: uid(),
    sender: "Operator",
    text: sentence(
      `Running a little late: ${name} is arriving around ${timeLabel(x.eta)}`,
    ),
    at: new Date(s.clock).toISOString(),
  });
  x.lateToldAt = new Date(s.clock).toISOString();
  log(s, "Customer told about the late arrival", {
    actor: "Operator",
    requestId: v.requestId,
    entity: "visit",
    entityId: v.id,
    field: "lateToldAt",
    to: x.lateToldAt,
  });
  return true;
}
