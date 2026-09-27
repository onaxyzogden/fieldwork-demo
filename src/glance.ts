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
import type { Assignment, State, Visit } from "./model";
import { dayKey } from "./work";
import { findingsFor, findingState } from "./pmw";

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

export type CustomerGlance = {
  waiting: number;
  upcoming: number;
  open: number;
  next: { visit: Visit; address: string } | null;
};

export function customerGlance(
  s: State,
  accountId: string,
  clock: number,
): CustomerGlance {
  const own = s.requests.filter(
    (r) => r.accountId === accountId && r.status !== "Draft",
  );
  const ids = new Set(own.map((r) => r.id));
  const live = s.visits
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
  const assessments = s.walkthroughs.filter(
    (w) =>
      w.status === "Sent" &&
      properties.has(w.propertyId) &&
      findingsFor(s, w.id).some(
        (f) => findingState(s, f) === "Pending decision",
      ),
  ).length;

  const first = live[0];
  return {
    waiting:
      own.filter((r) => WAITING_ON_CUSTOMER.has(r.status)).length + assessments,
    upcoming: live.length,
    open: own.filter((r) => !CLOSED.has(r.status)).length,
    next: first
      ? {
          visit: first,
          address: own.find((r) => r.id === first.requestId)?.address ?? "",
        }
      : null,
  };
}
