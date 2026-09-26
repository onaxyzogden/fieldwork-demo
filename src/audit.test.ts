import { describe, it, expect } from "vitest";
import {
  approveQuote,
  auditFor,
  isChange,
  log,
  mergeProperties,
  seed,
  uid,
  type Property,
  type State,
} from "./model";
import { respondToOffer } from "./dispatch";

function quoted(s: State) {
  const r = s.requests.find((x) => x.id === "r2")!;
  s.quotes.push({
    id: "q1",
    requestId: r.id,
    type: "Manual quote",
    amount: 420,
    high: 480,
    status: "Sent",
    notes: "",
    payOnCompletion: false,
  });
  return r;
}

describe("the event log still narrates", () => {
  it("leaves a one-argument entry exactly as it was", () => {
    const s = seed();
    log(s, "Something happened");
    const e = s.events[0];
    expect(e.text).toBe("Something happened");
    expect(e.actor).toBeUndefined();
    expect(isChange(e)).toBe(false);
  });
  it("puts the newest entry first", () => {
    const s = seed();
    log(s, "first");
    log(s, "second");
    expect(s.events[0].text).toBe("second");
  });
});

describe("the event log now records changes", () => {
  it("carries who, what field, and what it went from and to", () => {
    const s = seed();
    log(s, "Operator changed the price", {
      actor: "Operator",
      requestId: "r2",
      entity: "quote",
      field: "amount",
      from: "$400",
      to: "$420",
    });
    const e = s.events[0];
    expect(isChange(e)).toBe(true);
    expect([e.actor, e.field, e.from, e.to]).toEqual([
      "Operator",
      "amount",
      "$400",
      "$420",
    ]);
  });
  it("gives a request its own trail and nobody else's", () => {
    const s = seed();
    log(s, "theirs", { requestId: "r3", field: "mode", to: "Instant Book" });
    log(s, "mine", { requestId: "r2", field: "mode", to: "Instant Book" });
    log(s, "untagged narrative");
    const trail = auditFor(s, "r2");
    expect(trail).toHaveLength(1);
    expect(trail[0].text).toBe("mine");
  });
});

describe("what gets recorded", () => {
  it("records who approved a quote, and the move that approval made", () => {
    const s = seed();
    const r = quoted(s);
    approveQuote(s, "q1", "ct6");
    const entry = auditFor(s, r.id).find((e) => e.entity === "quote")!;
    expect(entry.actor).toBe("Maya Okonkwo, Property Manager");
    expect([entry.field, entry.from, entry.to]).toEqual([
      "status",
      "Sent",
      "Approved",
    ]);
  });
  it("records nothing when the approval is refused", () => {
    const s = seed();
    const r = quoted(s);
    approveQuote(s, "q1");
    const after = auditFor(s, r.id).length;
    // Already approved, so the second call is a no-op and must not log.
    approveQuote(s, "q1");
    expect(auditFor(s, r.id)).toHaveLength(after);
  });
  it("records a contractor's answer against the request it belongs to", () => {
    const s = seed();
    const a = s.assignments.find((x) => x.status === "Offered")!;
    const v = s.visits.find((x) => x.id === a.visitId)!;
    expect(respondToOffer(s, a.id, "Declined", "Too far")).toBe(true);
    const entry = auditFor(s, v.requestId).find(
      (e) => e.entity === "assignment",
    )!;
    expect(entry.field).toBe("status");
    expect(entry.from).toBe("Offered");
    expect(entry.to).toBe("Declined");
    expect(entry.actor).toBeTruthy();
  });
  it("records a property merge with both ids", () => {
    const s = seed();
    const first = s.properties[0];
    const twin: Property = {
      id: uid(),
      accountId: first.accountId,
      address: first.address.toUpperCase(),
      city: first.city,
    };
    s.properties.push(twin);
    mergeProperties(s, first.id, twin.id);
    const entry = s.events.find((e) => e.entity === "property")!;
    expect(entry.from).toBe(twin.id);
    expect(entry.to).toBe(first.id);
    expect(entry.actor).toBe("Operator");
  });
});
