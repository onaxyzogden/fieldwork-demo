import { describe, it, expect } from "vitest";
import { approveQuote, reconcile, type State } from "./model";
import { freshDemo } from "./store";
import { payQuote } from "./payments";
import { deliverUpdates, inbox } from "./notifications";
import { bucket } from "./work";
import {
  cancelBooking,
  completeCallBack,
  decisionQueue,
  issueQuote,
  nextDecision,
  offerVisit,
  requestCallBack,
  rescheduleVisit,
  settleLateCancel,
} from "./decisions";

/**
 * Changes inside 24 hours (ADR 064): a late cancellation holds the money until
 * the operator settles the fee, and a late change promises a call.
 */

const HOUR = 3600000;

/** r3 booked, quoted at $200, approved and paid: a confirmed visit. `by` is
 *  "self" (the operator, accepted at once) or "contractor" (accepted here). */
function booked(by: "self" | "contractor" = "self") {
  const s = freshDemo();
  const d = nextDecision(s, "r3");
  if (d?.kind !== "assign") throw new Error("expected assign");
  const offer = by === "self" ? d.self : d.offer;
  if (!offer) throw new Error("expected an offer");
  const v = offerVisit(s, {
    requestId: "r3",
    taskIds: d.taskIds,
    ...offer,
    duration: d.duration,
    opKey: "k",
  })!;
  for (const a of s.assignments)
    if (a.visitId === v.id && a.status === "Offered") a.status = "Accepted";
  issueQuote(s, "r3", {
    type: "Manual quote",
    amount: 200,
    payOnCompletion: false,
  });
  const q = s.quotes.find((x) => x.requestId === "r3" && x.status === "Sent")!;
  expect(approveQuote(s, q.id)).toBe(true);
  expect(payQuote(s, q.id)).toBe(true);
  reconcile(s);
  expect(s.requests.find((r) => r.id === "r3")!.status).toBe("Confirmed");
  return { s, v: s.visits.find((x) => x.id === v.id)!, q };
}

/** Move the clock to `hours` before the visit. */
const before = (s: State, start: string, hours: number) => {
  s.clock = +new Date(start) - hours * HOUR;
  reconcile(s);
};

const r3 = (s: State) => s.requests.find((r) => r.id === "r3")!;
const paymentsOf = (s: State) =>
  s.payments.filter((p) =>
    s.quotes.some((q) => q.id === p.quoteId && q.requestId === "r3"),
  );

describe("cancelling (ADR 064)", () => {
  it("refunds a cancellation more than a day out, as it always did", () => {
    const { s, v } = booked();
    before(s, v.start, 30);
    expect(cancelBooking(s, "r3")).toBe(true);
    expect(r3(s).status).toBe("Cancelled");
    expect(r3(s).lateCancel).toBeUndefined();
    expect(paymentsOf(s).map((p) => p.status)).toEqual(["Refunded"]);
    expect(bucket(s, "r3")).toBe("History");
    expect(nextDecision(s, "r3")).toBeNull();
  });

  it("holds the money inside a day, and asks the operator for the fee first", () => {
    const { s, v } = booked();
    before(s, v.start, 3);
    expect(cancelBooking(s, "r3")).toBe(true);
    expect(r3(s).status).toBe("Cancelled");
    expect(r3(s).lateCancel?.fee).toBeUndefined();
    expect(paymentsOf(s).map((p) => p.status)).toEqual(["Paid"]);
    expect(s.visits.find((x) => x.id === v.id)!.status).toBe("Cancelled");
    expect(bucket(s, "r3")).toBe("Needs Action");
    expect(nextDecision(s, "r3")).toEqual({
      kind: "late-cancel",
      fee: 50,
      held: 200,
    });
    expect(decisionQueue(s)[0].requestId).toBe("r3");
    // Cancelling twice changes nothing.
    expect(cancelBooking(s, "r3")).toBe(false);
  });

  it("closes only the offers still open, leaving declines as they were", () => {
    const { s, v } = booked();
    s.assignments.push({
      id: "old",
      visitId: v.id,
      providerId: "p2",
      status: "Declined",
      pay: 1,
      expiresAt: 0,
    });
    before(s, v.start, 3);
    cancelBooking(s, "r3");
    expect(s.assignments.find((a) => a.id === "old")!.status).toBe("Declined");
  });
});

describe("what counts as late", () => {
  it("only a visit still to happen: not one cancelled or finished", () => {
    for (const gone of ["cancelled", "finished"] as const) {
      const { s, v } = booked();
      before(s, v.start, 3);
      const visit = s.visits.find((x) => x.id === v.id)!;
      if (gone === "cancelled") visit.status = "Cancelled";
      else
        visit.execution = {
          finishedAt: new Date(s.clock).toISOString(),
          outcomes: {},
        };
      cancelBooking(s, "r3");
      expect(r3(s).lateCancel).toBeUndefined();
    }
  });
});

describe("settling a late cancellation", () => {
  const late = () => {
    const x = booked();
    before(x.s, x.v.start, 3);
    cancelBooking(x.s, "r3");
    return x;
  };

  it("refunds in full when the fee is waived, and is done", () => {
    const { s } = late();
    expect(settleLateCancel(s, "r3", 0)).toBe(true);
    expect(r3(s).lateCancel?.fee).toBe(0);
    expect(paymentsOf(s).map((p) => p.status)).toEqual(["Refunded"]);
    expect(bucket(s, "r3")).toBe("History");
    expect(nextDecision(s, "r3")).toBeNull();
    expect(settleLateCancel(s, "r3", 50)).toBe(false);
  });

  it("keeps the fee and refunds the rest", () => {
    const { s } = late();
    expect(settleLateCancel(s, "r3", 50)).toBe(true);
    const [p] = paymentsOf(s);
    expect(p.status).toBe("Partially Refunded");
    expect(p.refunded).toBe(150);
    expect(paymentsOf(s)).toHaveLength(1);
  });

  it("charges the card on file for a fee larger than what was paid", () => {
    const { s } = late();
    expect(settleLateCancel(s, "r3", 250)).toBe(true);
    const [paid, fee] = paymentsOf(s);
    expect(paid.status).toBe("Paid");
    expect(paid.refunded).toBeUndefined();
    expect(fee).toMatchObject({ status: "Paid", amount: 50, fee: true });
  });

  it("charges the whole fee when nothing was paid, or records it owed with no card", () => {
    const { s } = late();
    s.payments = s.payments.filter((p) => !paymentsOf(s).includes(p));
    const unpaid = structuredClone(s);
    expect(settleLateCancel(s, "r3", 50)).toBe(true);
    expect(paymentsOf(s)).toMatchObject([{ status: "Paid", amount: 50 }]);
    unpaid.paymentMethods = [];
    expect(settleLateCancel(unpaid, "r3", 50)).toBe(true);
    expect(paymentsOf(unpaid)).toMatchObject([
      { status: "Outstanding", amount: 50, fee: true },
    ]);
  });

  it("refuses a fee that is not a number or below zero, or one with no quote", () => {
    const { s } = late();
    expect(settleLateCancel(s, "r3", -1)).toBe(false);
    expect(settleLateCancel(s, "r3", Number.NaN)).toBe(false);
    s.quotes = s.quotes.filter((q) => q.requestId !== "r3");
    expect(settleLateCancel(s, "r3", 50)).toBe(false);
    expect(settleLateCancel(s, "r3", 0)).toBe(true);
  });
});

describe("a late change asks for a call (ADR 064)", () => {
  it("promises a call two hours out, once, and puts it in front of the operator", () => {
    const { s, v } = booked();
    before(s, v.start, 5);
    expect(requestCallBack(s, v.id)).toBe(true);
    expect(r3(s).callBack).toEqual({
      visitId: v.id,
      by: new Date(s.clock + 2 * HOUR).toISOString(),
    });
    expect(requestCallBack(s, v.id)).toBe(false);
    expect(bucket(s, "r3")).toBe("Needs Action");
    expect(nextDecision(s, "r3")).toEqual({
      kind: "call-back",
      visitId: v.id,
      by: r3(s).callBack!.by,
    });
    expect(completeCallBack(s, "r3")).toBe(true);
    expect(completeCallBack(s, "r3")).toBe(false);
    expect(bucket(s, "r3")).toBe("Scheduled");
    expect(nextDecision(s, "r3")).toBeNull();
  });

  it("refuses a cancelled visit", () => {
    const { s, v } = booked();
    s.visits.find((x) => x.id === v.id)!.status = "Cancelled";
    expect(requestCallBack(s, v.id)).toBe(false);
  });

  it("is closed by moving the visit, which asks the contractor again at the pay they accepted", () => {
    const { s, v } = booked("contractor");
    before(s, v.start, 5);
    requestCallBack(s, v.id);
    const accepted = s.assignments.find(
      (a) => a.visitId === v.id && a.status === "Accepted",
    )!;
    const later = new Date(+new Date(v.start) + 24 * HOUR).toISOString();
    expect(
      rescheduleVisit(s, v.id, { start: later, travel: 12 }, "Operator"),
    ).toBe(true);
    expect(r3(s).callBack?.done).toBe(true);
    expect(accepted.status).toBe("Reassigned");
    expect(s.assignments.at(-1)).toMatchObject({
      visitId: v.id,
      providerId: v.providerId,
      status: "Offered",
      pay: accepted.pay,
    });
    expect(s.visits.find((x) => x.id === v.id)!.start).toBe(later);
    expect(
      rescheduleVisit(s, "nope", { start: later, travel: 0 }, "Customer"),
    ).toBe(false);
  });
});

describe("moving a visit", () => {
  it("refuses a cancelled visit, and asks nobody again when the operator does it", () => {
    const { s, v } = booked();
    const later = new Date(+new Date(v.start) + 24 * HOUR).toISOString();
    const offers = s.assignments.length;
    expect(
      rescheduleVisit(s, v.id, { start: later, travel: 0 }, "Customer"),
    ).toBe(true);
    expect(s.assignments).toHaveLength(offers);
    s.visits.find((x) => x.id === v.id)!.status = "Cancelled";
    expect(
      rescheduleVisit(s, v.id, { start: v.start, travel: 0 }, "Customer"),
    ).toBe(false);
  });

  it("closes only the call about that visit", () => {
    const { s, v } = booked();
    before(s, v.start, 5);
    requestCallBack(s, v.id);
    r3(s).callBack!.visitId = "another";
    const later = new Date(+new Date(v.start) + 24 * HOUR).toISOString();
    rescheduleVisit(s, v.id, { start: later, travel: 0 }, "Operator");
    expect(r3(s).callBack?.done).toBeUndefined();
  });
});

describe("what everyone is told", () => {
  const texts = (s: State, who: string) => inbox(s, who).map((n) => n.text);

  it("tells the customer the fee may apply, then what it was", () => {
    const { s, v } = booked();
    before(s, v.start, 3);
    let was = structuredClone(s);
    cancelBooking(s, "r3");
    deliverUpdates(was, s);
    expect(texts(s, "Customer:c3")).toContain(
      "Your visit is cancelled. Because it was less than 24 hours away, a late-cancellation fee may apply. We’ll confirm.",
    );
    expect(texts(s, "Operator")).toContain(
      `${r3(s).name} cancelled within 24 hours · decide the late fee`,
    );
    was = structuredClone(s);
    settleLateCancel(s, "r3", 50);
    deliverUpdates(was, s);
    expect(texts(s, "Customer:c3")).toContain(
      "Late-cancellation fee: $50. Anything else you paid has been refunded.",
    );
  });

  it("tells the customer when to expect the call, and the operator to make it", () => {
    const { s, v } = booked();
    s.clock = Date.parse("2026-10-07T18:15:00Z") - 2 * HOUR;
    s.visits.find((x) => x.id === v.id)!.start = new Date(
      s.clock + 5 * HOUR,
    ).toISOString();
    const was = structuredClone(s);
    requestCallBack(s, v.id);
    deliverUpdates(was, s);
    expect(texts(s, "Customer:c3")).toContain(
      "Your visit is less than 24 hours away, so we’ll arrange the new time with you. Expect a call by 2:15 p.m.",
    );
    expect(texts(s, "Operator")).toContain(
      `Call ${r3(s).name} by 2:15 p.m. to reschedule`,
    );
  });
});
