import { describe, it, expect } from "vitest";
import {
  AUTHORIZE_WITHIN_DAYS,
  methodFor,
  reconcile,
  secured,
  seed,
  type State,
} from "./model";
import {
  authorizationDue,
  authorizeAt,
  authorizePayment,
  capturePayment,
  forgetPaymentMethod,
  outstandingFor,
  refundPayment,
  storePaymentMethod,
} from "./payments";

/** An approved quote on r2, which is where the money side begins. */
function approved(s: State) {
  const r = s.requests.find((x) => x.id === "r2")!;
  s.quotes.push({
    id: "q1",
    requestId: r.id,
    type: "Manual quote",
    amount: 400,
    high: 400,
    status: "Approved",
    notes: "",
    payOnCompletion: false,
  });
  return { r, q: s.quotes.find((x) => x.id === "q1")! };
}
const card = { brand: "Visa", last4: "4242" };

describe("storing a method", () => {
  it("holds a token rather than anything resembling a card", () => {
    const s = seed();
    const m = storePaymentMethod(s, "c2", card);
    expect(m.token).toMatch(/^sim_tok_/);
    expect(JSON.stringify(m)).not.toContain("4242424242");
  });
  it("does not stack a second method on one account", () => {
    const s = seed();
    const first = storePaymentMethod(s, "c2", card);
    const again = storePaymentMethod(s, "c2", { brand: "Amex", last4: "0005" });
    expect(again.id).toBe(first.id);
    expect(s.paymentMethods).toHaveLength(1);
  });
  it("finds the method for whoever is paying for a quote", () => {
    const s = seed();
    const { q } = approved(s);
    expect(methodFor(s, q)).toBeUndefined();
    storePaymentMethod(s, "c2", card);
    expect(methodFor(s, q)?.accountId).toBe("c2");
  });
});

describe("when the hold goes on", () => {
  it("is placed now for work inside the window", () => {
    const s = seed();
    const soon = new Date(s.clock + 2 * 86400000).toISOString();
    expect(authorizeAt(s, soon)).toBe(s.clock);
    expect(authorizationDue(s, soon)).toBe(true);
  });
  it("waits for work further out than a hold survives", () => {
    const s = seed();
    const far = new Date(s.clock + 30 * 86400000).toISOString();
    expect(authorizeAt(s, far)).toBeGreaterThan(s.clock);
    expect(authorizationDue(s, far)).toBe(false);
    // …and lands exactly the configured lead before service.
    expect(+new Date(far) - authorizeAt(s, far)).toBe(
      AUTHORIZE_WITHIN_DAYS * 86400000,
    );
  });
});

describe("authorizing", () => {
  it("refuses without a method on file", () => {
    const s = seed();
    approved(s);
    expect(authorizePayment(s, "q1", "k1")).toBe(null);
  });
  it("places a hold that has not moved any money", () => {
    const s = seed();
    approved(s);
    storePaymentMethod(s, "c2", card);
    const p = authorizePayment(s, "q1", "k1")!;
    expect(p.status).toBe("Authorized");
    expect(p.authorizedAt).toBeTruthy();
    expect(p.capturedAt).toBeUndefined();
  });
  it("returns the same hold for a repeated key rather than a second one", () => {
    const s = seed();
    approved(s);
    storePaymentMethod(s, "c2", card);
    const first = authorizePayment(s, "q1", "k1")!;
    const again = authorizePayment(s, "q1", "k1")!;
    expect(again.id).toBe(first.id);
    expect(s.payments).toHaveLength(1);
  });
  it("refuses a quote the customer has not approved", () => {
    const s = seed();
    const { q } = approved(s);
    q.status = "Sent";
    storePaymentMethod(s, "c2", card);
    expect(authorizePayment(s, "q1", "k1")).toBe(null);
  });
});

describe("capturing", () => {
  function held() {
    const s = seed();
    approved(s);
    storePaymentMethod(s, "c2", card);
    const p = authorizePayment(s, "q1", "k1")!;
    return { s, p };
  }
  it("moves the money at completion", () => {
    const { s, p } = held();
    expect(capturePayment(s, p.id)).toBe(true);
    expect(p.status).toBe("Paid");
    expect(p.capturedAt).toBeTruthy();
  });
  it("leaves work-done-but-unpaid as Outstanding, not Failed", () => {
    const { s, p } = held();
    capturePayment(s, p.id, true);
    expect(p.status).toBe("Outstanding");
    expect(outstandingFor(s, "r2")).toBe(400);
  });
  it("cannot capture the same hold twice", () => {
    const { s, p } = held();
    capturePayment(s, p.id);
    expect(capturePayment(s, p.id)).toBe(false);
  });
});

describe("refunding", () => {
  function paid() {
    const s = seed();
    approved(s);
    storePaymentMethod(s, "c2", card);
    const p = authorizePayment(s, "q1", "k1")!;
    capturePayment(s, p.id);
    return { s, p };
  }
  it("marks a part refund as its own state", () => {
    const { s, p } = paid();
    expect(refundPayment(s, p.id, 100)).toBe(true);
    expect(p.status).toBe("Partially Refunded");
    expect(p.refunded).toBe(100);
  });
  it("becomes fully Refunded once the whole amount is back", () => {
    const { s, p } = paid();
    refundPayment(s, p.id, 100);
    refundPayment(s, p.id, 300);
    expect(p.status).toBe("Refunded");
  });
  it("refuses to send back more than was taken", () => {
    const { s, p } = paid();
    expect(refundPayment(s, p.id, 401)).toBe(false);
    refundPayment(s, p.id, 400);
    expect(refundPayment(s, p.id, 1)).toBe(false);
  });
  it("refuses to refund a hold that was never captured", () => {
    const s = seed();
    approved(s);
    storePaymentMethod(s, "c2", card);
    const p = authorizePayment(s, "q1", "k1")!;
    expect(refundPayment(s, p.id)).toBe(false);
  });
});

describe("what lets a visit be confirmed", () => {
  it("waits on a method, not on money having moved", () => {
    const s = seed();
    const { q } = approved(s);
    expect(secured(s, q)).toBe(false);
    storePaymentMethod(s, "c2", card);
    expect(secured(s, q)).toBe(true);
  });
  it("still accepts the simulated checkout's shortcut", () => {
    const s = seed();
    const { q } = approved(s);
    s.payments.push({
      id: "p1",
      quoteId: q.id,
      status: "Paid",
      amount: 400,
      reference: "demo",
    });
    expect(secured(s, q)).toBe(true);
  });
  it("puts a request back to Awaiting Payment when the method goes", () => {
    const s = seed();
    const { r, q } = approved(s);
    storePaymentMethod(s, "c2", card);
    forgetPaymentMethod(s, "c2");
    expect(secured(s, q)).toBe(false);
    reconcile(s);
    expect(s.requests.find((x) => x.id === r.id)!.status).toBe(
      "Awaiting Payment",
    );
  });
});
