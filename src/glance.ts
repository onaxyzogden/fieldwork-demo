/**
 * What each role needs to know before scrolling: the next thing in the diary,
 * and three counts.
 *
 * All of it is derived on read. Nothing here is stored, so a count cannot drift
 * away from the records it counts — the same reason `reconcile()` recomputes
 * status rather than trusting a field.
 *
 * The contractor's counts are not a second opinion about its screen. `tabWork()`
 * is the filter the Offers / Today / Upcoming tabs themselves run, so a count
 * and the list it promises are the same code rather than two implementations
 * that happen to agree today.
 */
import type { Assignment, State, Visit, Walkthrough } from "./model";
import { dayKey } from "./work";
import { findingsFor, findingState, quotable } from "./pmw";

export type ContractorTab = "Offers" | "Today" | "Upcoming";

/** The date on the card's chip. Short, and in the demo's timezone like the
 *  rest of the app's dates. */
export const glanceDate = (clock: number) =>
  new Date(clock).toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

/** Assignments behind one of the contractor's three tabs. */
export function tabWork(
  s: State,
  providerId: string,
  tab: ContractorTab,
  clock: number,
): Assignment[] {
  const today = dayKey(clock);
  return s.assignments
    .filter((a) => a.providerId === providerId)
    .filter((a) => {
      const v = s.visits.find((v) => v.id === a.visitId);
      if (!v) return false;
      if (tab === "Offers") return a.status === "Offered";
      if (a.status !== "Accepted") return false;
      const running = !!v.execution?.startedAt && !v.execution.finishedAt;
      /* Today claims anything in progress regardless of its scheduled date —
         an overrunning job shouldn't vanish — and Upcoming excludes the same
         visit so it cannot appear under both. */
      return tab === "Today"
        ? dayKey(v.start) === today || running
        : dayKey(v.start) > today && !running;
    })
    .sort((a, b) => start(s, a).localeCompare(start(s, b)));
}

const start = (s: State, a: Assignment) =>
  s.visits.find((v) => v.id === a.visitId)?.start ?? "";

export type ContractorGlance = {
  offers: number;
  today: number;
  upcoming: number;
  /** The next accepted job, today's or later. Null when there is none. */
  next: { visit: Visit; assignment: Assignment } | null;
};

export function contractorGlance(
  s: State,
  providerId: string,
  clock: number,
): ContractorGlance {
  const of = (tab: ContractorTab) => tabWork(s, providerId, tab, clock);
  const accepted = [...of("Today"), ...of("Upcoming")];
  const first = accepted[0];
  return {
    offers: of("Offers").length,
    today: of("Today").length,
    upcoming: of("Upcoming").length,
    next: first
      ? {
          assignment: first,
          visit: s.visits.find((v) => v.id === first.visitId)!,
        }
      : null,
  };
}

/**
 * The request statuses that mean the ball is in the customer's court. They are
 * the same three the portal already relabels in plain language, rather than a
 * second list that could fall out of step with them.
 */
const WAITING_ON_CUSTOMER = new Set([
  "Awaiting Quote Approval",
  "Awaiting Payment",
  "Information requested",
]);
const CLOSED = new Set(["Completed", "Cancelled", "Declined"]);

/**
 * Each count carries the ids behind it, for two reasons. A click on a number
 * can then open something the number actually counted, rather than re-deriving
 * the set and hoping the two agree. And "these numbers do not double count"
 * becomes an invariant a test can check — see `glance.test.ts` — instead of a
 * claim about three separate filters.
 */
export type CustomerGlance = {
  waiting: number;
  upcoming: number;
  inProgress: number;
  /** Requests in each bucket, in the order they should be opened. */
  waitingIds: string[];
  /** Requests carrying an upcoming visit, earliest first. */
  scheduledIds: string[];
  inProgressIds: string[];
  /** Sent assessments still holding an undecided finding. Counted under
   *  `waiting`, but they are not requests and have no row to open. */
  assessmentIds: string[];
  next: { visit: Visit; address: string; requestId: string } | null;
};

export function customerGlance(
  s: State,
  accountId: string,
  clock: number,
): CustomerGlance {
  const own = s.requests.filter(
    (r) => r.accountId === accountId && r.status !== "Draft",
  );
  const live = own.filter((r) => !CLOSED.has(r.status));
  const ids = new Set(live.map((r) => r.id));
  /* Keyed on live requests, not merely non-Draft ones: a cancelled request's
     leftover visit is not something the customer has coming up. */
  const visits = s.visits
    .filter(
      (v) =>
        ids.has(v.requestId) &&
        v.status !== "Cancelled" &&
        !v.execution?.finishedAt &&
        +new Date(v.start) >= clock,
    )
    .sort((a, b) => a.start.localeCompare(b.start));

  /* An assessment sent to this account and still holding an undecided finding
     is waiting on the customer just as much as an unapproved quote is, and it
     is the one that would otherwise be invisible from this screen. */
  const properties = new Set(
    s.properties.filter((p) => p.accountId === accountId).map((p) => p.id),
  );
  const assessmentIds = s.walkthroughs
    .filter(
      (w) =>
        w.status === "Sent" &&
        properties.has(w.propertyId) &&
        findingsFor(s, w.id).some(
          (f) => findingState(s, f) === "Pending decision",
        ),
    )
    .map((w) => w.id);

  /* Three buckets that do not overlap. The third used to be every live
     request, which made it a total wearing a bucket's label: one job with a
     visit booked read as "1 upcoming visit" AND "1 open request", and anything
     waiting on the customer was counted twice as well. In progress is now what
     is left — neither waiting on them nor already carrying a date. */
  /* Filtering `live` here is belt and braces: no status is in both
     WAITING_ON_CUSTOMER and CLOSED today, so removing it changes nothing and
     no test catches it. It stays because that is a property of two lists that
     a later edit could break, not something the code guarantees. */
  const waitingIds = live
    .filter((r) => WAITING_ON_CUSTOMER.has(r.status))
    .map((r) => r.id);
  const scheduled = new Set(visits.map((v) => v.requestId));
  const scheduledIds = [...new Set(visits.map((v) => v.requestId))];
  const waiting = new Set(waitingIds);
  const inProgressIds = live
    .filter((r) => !waiting.has(r.id) && !scheduled.has(r.id))
    .map((r) => r.id);

  const first = visits[0];
  return {
    waiting: waitingIds.length + assessmentIds.length,
    upcoming: visits.length,
    inProgress: inProgressIds.length,
    waitingIds,
    scheduledIds,
    inProgressIds,
    assessmentIds,
    next: first
      ? {
          visit: first,
          address: own.find((r) => r.id === first.requestId)?.address ?? "",
          requestId: first.requestId,
        }
      : null,
  };
}

/**
 * The operator's walkthrough pipeline, bucketed by whose move it is. Each
 * walkthrough lands in at most one bucket:
 *
 * - drafts — still being written; the operator's move.
 * - readyToConvert — sent, with approved findings not yet turned into work.
 *   This wins over "with customer" when a walkthrough has both, because
 *   conversion works per approval: the approved half can be acted on now
 *   without waiting for the undecided half.
 * - withCustomer — sent, a finding still undecided, nothing approved waiting.
 *
 * Converted walkthroughs are history and belong to none. A sent walkthrough
 * whose findings were all deferred also belongs to none: nobody owes anything.
 * Keyed on `Sent` rather than "anything not a draft" because the detail page
 * only offers conversion on a sent walkthrough, and a count must point at
 * something the page it opens can act on.
 */
export type WalkthroughGlance = {
  draftIds: string[];
  withCustomerIds: string[];
  readyToConvertIds: string[];
  /** The oldest assessment still waiting on the customer — the one to chase. */
  chase: { walkthrough: Walkthrough; daysSent: number; opens: number } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function walkthroughGlance(s: State, clock: number): WalkthroughGlance {
  const sent = s.walkthroughs.filter((w) => w.status === "Sent");
  /* The same filter convertApproved() uses to pick what it converts, so
     "ready" means exactly "the Convert button would do something". `!f.taskId`
     is unreachable while conversion always flips the walkthrough to Converted
     — removing it changes no test — and stays so the two cannot drift. */
  const hasApprovedWaiting = (w: Walkthrough) =>
    findingsFor(s, w.id).some(
      (f) => f.decision === "Approved" && quotable(f) && !f.taskId,
    );
  const hasUndecided = (w: Walkthrough) =>
    findingsFor(s, w.id).some((f) => findingState(s, f) === "Pending decision");
  const readyToConvert = sent.filter(hasApprovedWaiting);
  const ready = new Set(readyToConvert.map((w) => w.id));
  const withCustomer = sent
    .filter((w) => !ready.has(w.id) && hasUndecided(w))
    .sort((a, b) => (a.sentAt ?? a.date).localeCompare(b.sentAt ?? b.date));
  const oldest = withCustomer[0];
  return {
    draftIds: s.walkthroughs
      .filter((w) => w.status === "Draft")
      .map((w) => w.id),
    withCustomerIds: withCustomer.map((w) => w.id),
    readyToConvertIds: readyToConvert.map((w) => w.id),
    chase: oldest
      ? {
          walkthrough: oldest,
          daysSent: Math.max(
            0,
            Math.floor(
              (clock - +new Date(oldest.sentAt ?? oldest.date)) / DAY_MS,
            ),
          ),
          opens: oldest.access?.opens.length ?? 0,
        }
      : null,
  };
}
