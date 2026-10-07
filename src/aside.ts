import { questionAnswers } from "./clarification";
import { type State, accountName, auditFor } from "./model";

/**
 * What the desktop side panel beside a queue item shows (ADR 068): read-only
 * context for the decision on screen, so it never has to leave the queue to
 * see what the request is.
 *
 * Each role sees what it already sees elsewhere and no more. The customer is
 * not shown the operator's history. A contractor deciding on an offer gets
 * the city, not the address or the customer's notes, as on the offer screen.
 */
export type AsideRole = "Operator" | "Customer" | "Contractor";

/** A request with a visit that is not cancelled: booked, in whatever state. */
export const hasLiveVisit = (s: State, requestId: string) =>
  s.visits.some((v) => v.requestId === requestId && v.status !== "Cancelled");

export function asideFor(
  s: State,
  role: AsideRole,
  requestId: string,
  /** The offer's visit, for a contractor: only its tasks are theirs. */
  visitId?: string,
) {
  const r = s.requests.find((x) => x.id === requestId);
  if (!r) return undefined;
  const offer = role === "Contractor";
  const visit = s.visits.find((v) => v.id === visitId);
  const next = s.visits
    .filter(
      (v) =>
        v.requestId === r.id &&
        v.status !== "Cancelled" &&
        !v.execution?.finishedAt,
    )
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return {
    /* The customer knows who they are; it is their booking. */
    title: role === "Customer" ? "Your booking" : accountName(r.accountId),
    where: offer ? r.city : `${r.address}, ${r.city}`,
    when: (visit ?? next)?.start,
    tasks: s.tasks
      .filter((t) =>
        visit ? visit.taskIds.includes(t.id) : t.requestId === r.id,
      )
      .filter((t) => !t.mergedInto)
      .map((t) => ({
        id: t.id,
        summary: t.summary,
        photos: t.photos,
        answers: offer ? questionAnswers(t) : [],
      })),
    notes: offer ? "" : r.notes,
    history: role === "Operator" ? auditFor(s, r.id).slice(0, 5) : [],
  };
}
