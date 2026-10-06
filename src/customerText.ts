/**
 * How a status reads to the customer (ADR 061).
 *
 * The records keep their own states — the operator needs "Awaiting Provider
 * Acceptance" and "Sent" to be exactly that. The customer gets what they are
 * waiting for or have to do, in the same words on a badge and in a
 * notification, so the two cannot disagree.
 */
export const customerStatusText = (status: string) =>
  ({
    "Needs Review": "In review",
    "Awaiting Provider Acceptance": "Matching you with a provider",
    "Awaiting Quote Approval": "Quote ready",
    "Awaiting Payment": "Payment due",
    "Information requested": "Waiting on your reply",
  })[status] || status;

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
