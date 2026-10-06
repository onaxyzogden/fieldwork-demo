import { describe, it, expect } from "vitest";
import {
  accounts,
  answerQuestion,
  approveQuote,
  contactsFor,
  declineQuote,
  mayApprove,
  reconcile,
  type State,
} from "./model";
import { freshDemo } from "./store";
import { customerGlance, tabWork } from "./glance";
import { payQuote } from "./payments";
import { issueQuote, nextDecision, offerVisit } from "./decisions";
import { contractorQueue, customerQueue } from "./roleQueues";

const kinds = (s: State, accountId: string) =>
  customerQueue(s, accountId, s.clock).map((t) => t.kind);

/* freshDemo(), not seed(): the app starts with the seeded walkthroughs, and
   the assessments waiting on a customer are part of their queue. */

/** Book r3 with the operator, and send its quote: a quote awaiting c3. */
function quoted() {
  const s = freshDemo();
  const d = nextDecision(s, "r3");
  if (d?.kind !== "assign" || !d.self) throw new Error("expected assign");
  offerVisit(s, {
    requestId: "r3",
    taskIds: d.taskIds,
    ...d.self,
    duration: d.duration,
    opKey: "k",
  });
  issueQuote(s, "r3", {
    type: "Manual quote",
    amount: 200,
    payOnCompletion: false,
  });
  reconcile(s);
  return s;
}

describe("the customer's queue (ADR 062)", () => {
  it("is exactly what the glance counts as waiting on them", () => {
    for (const s of [freshDemo(), quoted()])
      for (const a of accounts)
        expect(customerQueue(s, a.id, s.clock)).toHaveLength(
          customerGlance(s, a.id, s.clock).waiting,
        );
    expect(kinds(freshDemo(), "c1")).toEqual(["assessment"]);
  });

  it("asks for the quote, then the payment, and puts assessments last", () => {
    const s = quoted();
    // Move the request to Northline, raised by someone who may approve.
    const r = s.requests.find((r) => r.id === "r3")!;
    r.accountId = "a1";
    r.contactId = contactsFor("a1").find((c) => mayApprove(s, "a1", c.id))!.id;
    reconcile(s);
    // Northline: its own assessment, and now this quote ahead of it.
    expect(kinds(s, "a1")).toEqual(["quote", "assessment"]);
    const t = customerQueue(s, "a1", s.clock)[0];
    if (t.kind !== "quote") throw new Error("expected a quote");
    // Nothing is paid before it is approved.
    expect(payQuote(s, t.quoteId)).toBe(false);
    expect(approveQuote(s, t.quoteId)).toBe(true);
    reconcile(s);
    expect(kinds(s, "a1")).toEqual(["pay", "assessment"]);
    // A failed payment leaves it to pay, and stores no card.
    expect(payQuote(s, t.quoteId, true)).toBe(false);
    reconcile(s);
    expect(s.payments.at(-1)?.status).toBe("Failed");
    expect(s.paymentMethods ?? []).toHaveLength(0);
    expect(kinds(s, "a1")).toEqual(["pay", "assessment"]);
    expect(payQuote(s, t.quoteId)).toBe(true);
    reconcile(s);
    expect(kinds(s, "a1")).toEqual(["assessment"]);
    // Paying twice takes one payment.
    expect(payQuote(s, t.quoteId)).toBe(false);
    expect(
      s.payments.filter((p) => p.quoteId === t.quoteId && p.status === "Paid"),
    ).toHaveLength(1);
  });

  it("hands a declined quote back to the operator, with the reason", () => {
    const s = quoted();
    const q = s.quotes.find(
      (q) => q.requestId === "r3" && q.status === "Sent",
    )!;
    expect(kinds(s, "c3")).toEqual(["quote"]);
    expect(declineQuote(s, q.id, "Too expensive")).toBe(true);
    reconcile(s);
    expect(q.declineReason).toBe("Too expensive");
    expect(s.events[0]?.text).toBe(
      "Customer declined the quote · Too expensive",
    );
    expect(kinds(s, "c3")).toEqual([]);
    expect(customerGlance(s, "c3", s.clock).waiting).toBe(0);
    expect(nextDecision(s, "r3")?.kind).toBe("revise");
    expect(declineQuote(s, q.id)).toBe(false);
  });

  it("asks our question even while a contractor is still being found", () => {
    const s = freshDemo();
    const d = nextDecision(s, "r2");
    if (d?.kind !== "assign" || !d.offer) throw new Error("expected an offer");
    offerVisit(s, {
      requestId: "r2",
      taskIds: d.taskIds,
      ...d.offer,
      duration: d.duration,
      opKey: "k2",
    });
    const r = s.requests.find((r) => r.id === "r2")!;
    r.operatorNote = "Is there parking?";
    reconcile(s);
    // The offer outranks the question in the request's status…
    expect(r.status).toBe("Awaiting Provider Acceptance");
    // …but the question is still the customer's to answer.
    expect(kinds(s, r.accountId)).toEqual(["question"]);
    expect(customerGlance(s, r.accountId, s.clock).waiting).toBe(1);
  });

  it("asks the customer's question, and drops it once answered", () => {
    const s = freshDemo();
    const r = s.requests.find((r) => r.id === "r2")!;
    r.operatorNote = "Which floor?";
    reconcile(s);
    expect(kinds(s, r.accountId)).toEqual(["question"]);
    expect(answerQuestion(s, r.id, "   ")).toBe(false);
    expect(answerQuestion(s, r.id, " Second ")).toBe(true);
    expect(r.customerReply).toBe("Second");
    expect(answerQuestion(s, r.id, "Third")).toBe(false);
    reconcile(s);
    expect(kinds(s, r.accountId)).toEqual([]);
  });
});

describe("the contractor's queue (ADR 062)", () => {
  it("is the Offers tab, in its order", () => {
    const s = quoted();
    for (const p of ["marcus", "nina", "eli", "yousef"])
      expect(contractorQueue(s, p, s.clock)).toEqual(
        tabWork(s, p, "Offers", s.clock).map((a) => a.id),
      );
    expect(
      contractorQueue(freshDemo(), "marcus", freshDemo().clock).length,
    ).toBeGreaterThan(0);
  });
});
