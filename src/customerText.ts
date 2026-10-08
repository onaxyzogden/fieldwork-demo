/**
 * How a status reads to the customer (ADR 061).
 *
 * The records keep their own states — the operator needs "Awaiting Provider
 * Acceptance" and "Sent" to be exactly that. The customer gets what they are
 * waiting for or have to do, in the same words on a badge and in a
 * notification, so the two cannot disagree.
 */
import { type Request, type State, coordinated, quoted } from "./model";

export const customerStatusText = (status: string) =>
  ({
    "Needs Review": "In review",
    "Awaiting Provider Acceptance": "Matching you with a provider",
    "Awaiting Quote Approval": "Quote ready",
    "Awaiting Payment": "Payment due",
    "Information requested": "Waiting on your reply",
  })[status] || status;

/** The customer declined the live quote, and a new one hasn't replaced it.
 *  The request is still "Awaiting Quote Approval", but nothing is ready for
 *  them: the operator is revising it (ADR 080). */
export const quoteDeclined = (s: State, requestId: string) =>
  s.quotes.find((q) => q.requestId === requestId && q.status !== "Superseded")
    ?.status === "Declined";

/** A request's badge, which reads the quote as well as the request. */
export const customerRequestText = (s: State, r: Request) =>
  r.status === "Awaiting Quote Approval" && quoteDeclined(s, r.id)
    ? "Quote declined · we’re revising it"
    : customerStatusText(r.status);

/** "Sent" is the operator's side of a quote; to the customer it awaits them. */
export const customerQuoteText = (status: string) =>
  ({ Sent: "Awaiting your approval" })[status] || status;

export const customerVisitText = (status: string) =>
  ({
    Proposed: "Awaiting confirmation",
    "On the Way": "On the way",
    "In Progress": "In progress",
    Issue: "Follow-up needed",
  })[status] || status;

/** An assessment: "Converted" is what happened to it; to the customer it was
 *  approved. */
export const customerAssessmentText = (status: string) =>
  ({
    Draft: "Being prepared",
    Sent: "Awaiting your approval",
    Converted: "Approved",
  })[status] || status;

/** A provider has said yes: an Accepted assignment on a live visit. */
const accepted = (s: State, requestId: string) =>
  s.visits.some(
    (v) =>
      v.requestId === requestId &&
      v.status !== "Cancelled" &&
      s.assignments.some(
        (a) =>
          a.visitId === v.id &&
          a.providerId === v.providerId &&
          a.status === "Accepted",
      ),
  );

/**
 * The one line under a request's badge, chosen from derived state (ADR 070).
 *
 * An unanswered question comes first: it is the one thing here the customer
 * can do. "Matched" waits for the provider's yes — while an offer is only out,
 * the line says so, and agrees with "Matching you with a provider" on the
 * badge. A decline still reverts to the ordinary matching line, so the
 * customer never sees it.
 */
export function customerProgressText(s: State, r: Request): string {
  if (r.operatorNote && !r.customerReply)
    return "We have a question for you. Answer it below so we can keep going.";
  if (quoteDeclined(s, r.id))
    return "You declined the quote. We’re revising it and will send you a new one.";
  if (!coordinated(s, r.id))
    return r.status === "Needs Review"
      ? "A coordinator is reviewing your request and will follow up shortly."
      : "We’re matching your request with a provider.";
  if (!quoted(s, r.id))
    return accepted(s, r.id)
      ? "A provider has accepted. We’re preparing your quote."
      : "We’ve asked a provider and are waiting for them to accept.";
  return "Your appointment is not confirmed until provider acceptance, quote approval, and any required payment are complete.";
}
