import { describe, it, expect } from "vitest";
import { seed } from "./model";
import { deliverUpdates, inbox, sendMessage } from "./notifications";
function ready() {
  const s = seed();
  const v = s.visits[0];
  s.assignments.push({
    id: "accepted",
    visitId: v.id,
    providerId: v.providerId,
    status: "Accepted",
    pay: 100,
    expiresAt: s.clock + 7200000,
  });
  return s;
}
describe("Account notifications", () => {
  it("routes messages to participants only and preserves sender history", () => {
    const s = ready(),
      v = s.visits[0],
      r = s.requests.find((r) => r.id === v.requestId)!;
    const before = structuredClone(s);
    expect(sendMessage(s, v.id, "Customer:" + r.customerId, "Hello")).toBe(
      true,
    );
    deliverUpdates(before, s);
    expect(
      inbox(s, "Customer:" + r.customerId).some((n) => n.kind === "message"),
    ).toBe(true);
    expect(
      inbox(s, "Contractor:" + v.providerId).some((n) => n.kind === "message"),
    ).toBe(true);
    expect(inbox(s, "Customer:unrelated")).toHaveLength(0);
    expect(inbox(s, "Contractor:unrelated")).toHaveLength(0);
  });
  it("does not deliver unchanged records again", () => {
    const s = ready();
    const before = structuredClone(s);
    sendMessage(s, s.visits[0].id, "Operator", "Hi");
    deliverUpdates(before, s);
    const count = s.notifications?.length;
    deliverUpdates(structuredClone(s), s);
    expect(s.notifications?.length).toBe(count);
  });
  it("rejects unrelated providers, customers and cancelled visit sends", () => {
    const s = ready(),
      id = s.visits[0].id;
    expect(sendMessage(s, id, "Customer:wrong", "Hi")).toBe(false);
    expect(sendMessage(s, id, "wrong", "Hi")).toBe(false);
    s.visits[0].status = "Cancelled";
    expect(sendMessage(s, id, "Operator", "Hi")).toBe(false);
  });
  it("keeps legacy notices operator-only and read states independent", () => {
    const s = ready();
    s.notifications = [
      {
        id: "old",
        assignmentId: "",
        visitId: "",
        requestId: "r1",
        kind: "decline",
        text: "Legacy",
        at: new Date(s.clock).toISOString(),
        read: false,
      },
    ];
    expect(inbox(s, "Operator")).toHaveLength(1);
    expect(inbox(s, "Contractor:marcus")).toHaveLength(0);
  });
  it("notifies the offered provider without exposing customer pricing", () => {
    const s = ready(),
      before = structuredClone(s);
    s.assignments[0].status = "Accepted";
    deliverUpdates(before, s);
    expect(
      inbox(s, "Contractor:" + s.assignments[0].providerId).some(
        (n) => n.kind === "offer",
      ),
    ).toBe(true);
  });
  it("delivers quote updates only to customer and operator", () => {
    const s = ready(),
      before = structuredClone(s);
    s.quotes.push({
      id: "test-quote",
      requestId: s.visits[0].requestId,
      type: "Manual quote",
      amount: 200,
      high: 200,
      status: "Declined",
      notes: "",
      payOnCompletion: false,
    });
    deliverUpdates(before, s);
    expect(inbox(s, "Operator").some((n) => n.kind === "quote")).toBe(true);
    expect(
      (s.notifications || [])
        .filter((n) => n.kind === "quote")
        .every((n) => !n.recipient?.startsWith("Contractor:")),
    ).toBe(true);
  });
});
