/**
 * The customer's and the contractor's to-dos, one at a time (ADR 062).
 *
 * The same idea as the operator's decision queue (ADR 059), built on the
 * counts each role already sees rather than a second opinion about them: the
 * customer's queue is what the glance counts as "Waiting on you", and the
 * contractor's is the Offers tab's own list. A button reading "Review 2 things"
 * therefore cannot disagree with a "2" beside it.
 */
import type { State } from "./model";
import { customerGlance, tabWork } from "./glance";

export type CustomerTodo =
  | { key: string; kind: "quote"; requestId: string; quoteId: string }
  | { key: string; kind: "pay"; requestId: string; quoteId: string }
  | { key: string; kind: "question"; requestId: string }
  | { key: string; kind: "charge"; requestId: string; chargeId: string }
  | { key: string; kind: "assessment"; walkthroughId: string };

const liveQuote = (s: State, requestId: string) =>
  s.quotes.find((q) => q.requestId === requestId && q.status !== "Superseded");

/**
 * What a request waiting on the customer is waiting for. Our question first —
 * it is quick, and the request comes round again for whatever follows. Then
 * the status says which; the quote is the live one. "Awaiting Quote Approval"
 * means it is Sent (a declined one is the operator's move and never reaches
 * here, see customerGlance), and "Awaiting Payment" means it is Approved.
 */
function requestTodo(s: State, requestId: string): CustomerTodo | null {
  const r = s.requests.find((x) => x.id === requestId);
  const q = liveQuote(s, requestId);
  if (!r) return null;
  if (r.operatorNote && !r.customerReply)
    return { key: requestId, kind: "question", requestId };
  /* An additional charge (ADR 065): the return visit waits on it. */
  const charge = s.charges?.find(
    (c) => c.requestId === requestId && c.status === "Sent",
  );
  if (charge)
    return { key: requestId, kind: "charge", requestId, chargeId: charge.id };
  if (r.status === "Awaiting Quote Approval" && q)
    return { key: requestId, kind: "quote", requestId, quoteId: q.id };
  if (r.status === "Awaiting Payment" && q)
    return { key: requestId, kind: "pay", requestId, quoteId: q.id };
  return null;
}

/**
 * Requests first, in the glance's order, then assessments: reviewing one
 * opens the assessment's own one-at-a-time flow, which leaves the queue.
 */
export function customerQueue(
  s: State,
  accountId: string,
  clock: number,
): CustomerTodo[] {
  const g = customerGlance(s, accountId, clock);
  return [
    ...g.waitingIds
      .map((id) => requestTodo(s, id))
      .filter((t): t is CustomerTodo => !!t),
    ...g.assessmentIds.map((id): CustomerTodo => ({
      key: "w:" + id,
      kind: "assessment",
      walkthroughId: id,
    })),
  ];
}

/**
 * One to-do named for the button that opens the queue (ADR 070): with a
 * single thing waiting, the button says what it is rather than counting it.
 */
export function customerTodoLabel(s: State, todo: CustomerTodo): string {
  if (todo.kind === "assessment") {
    const w = s.walkthroughs.find((x) => x.id === todo.walkthroughId);
    const address = s.properties.find((p) => p.id === w?.propertyId)?.address;
    return address
      ? `Review your assessment for ${address}`
      : "Review your assessment";
  }
  const address = s.requests.find((r) => r.id === todo.requestId)?.address;
  const where = address ? ` for ${address}` : "";
  if (todo.kind === "quote") return `Review your quote${where}`;
  if (todo.kind === "pay") return `Pay${where}`;
  if (todo.kind === "charge") return `Review an additional charge${where}`;
  return address
    ? `Answer our question about ${address}`
    : "Answer our question";
}

/** The contractor's offers awaiting an answer, in the Offers tab's order. */
export const contractorQueue = (s: State, providerId: string, clock: number) =>
  tabWork(s, providerId, "Offers", clock).map((a) => a.id);
