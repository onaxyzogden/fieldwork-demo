import { describe, it, expect } from "vitest";
import {
  seed,
  classify,
  reconcile,
  slots,
  available,
  eligible,
  localTime,
  torontoParts,
  type State,
  instantEligible,
} from "./model";
function ready() {
  const s = seed();
  const r = s.requests.find((r) => r.id === "r3")!;
  const t = s.tasks.find((t) => t.requestId === r.id)!;
  s.visits.push({
    id: "test",
    requestId: r.id,
    taskIds: [t.id],
    providerId: "marcus",
    start: slots(s, "marcus", 120, r.city)[0].start,
    duration: 120,
    status: "Proposed",
    travel: 8,
  });
  s.assignments.push({
    id: "offer",
    visitId: "test",
    providerId: "marcus",
    status: "Offered",
    pay: 150,
    expiresAt: s.clock + 7200000,
  });
  s.quotes.push({
    id: "quote",
    requestId: r.id,
    type: "Manual quote",
    amount: 300,
    high: 300,
    status: "Approved",
    notes: "",
    payOnCompletion: false,
  });
  return s;
}
describe("classification and eligibility", () => {
  it("excludes damaged scope from fixed-price Instant Book", () => {
    const t = seed().tasks[0];
    expect(instantEligible([t])).toBe(true);
    t.answers = { condition: "Damaged and cracked" };
    expect(instantEligible([t])).toBe(false);
  });
  it("classifies simple Oakville door without exposing a taxonomy fallback", () => {
    expect(classify("My door is rubbing").category).toContain("Doors");
    expect(classify("sink").reviewed).toBe(false);
    expect(classify("something is loose").category).toBe("Needs Review");
  });
  it("safety override outranks ordinary rules", () => {
    const c = classify("door rubbing and electrical wiring");
    expect(c.restricted).toBe(true);
    expect(c.reviewed).toBe(false);
    expect(c.reason).toContain("SAFE-01");
  });
  it("restricts specialist work after operator review", () => {
    const t = seed().tasks.find((t) => t.restricted)!;
    t.reviewed = true;
    expect(eligible("yousef", [t])).toBe(false);
    expect(eligible("eli", [t])).toBe(true);
  });
  it("uses contractor skills", () => {
    const t = seed().tasks.find((t) => t.category.includes("Walls"))!;
    expect(eligible("marcus", [t])).toBe(false);
    expect(eligible("nina", [t])).toBe(true);
  });
});
describe("connected lifecycle", () => {
  it("quote approval and payment cannot confirm an unaccepted offer", () => {
    const s = ready();
    s.payments.push({
      id: "p",
      quoteId: "quote",
      status: "Paid",
      amount: 300,
      reference: "demo",
    });
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r3")!.status).toBe(
      "Awaiting Provider Acceptance",
    );
    s.assignments.find((a) => a.id === "offer")!.status = "Accepted";
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r3")!.status).toBe("Confirmed");
  });
  it("failed payment remains unconfirmed; successful retry confirms", () => {
    const s = ready();
    s.assignments.find((a) => a.id === "offer")!.status = "Accepted";
    s.payments.push({
      id: "p",
      quoteId: "quote",
      status: "Failed",
      amount: 300,
      reference: "demo",
    });
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r3")!.status).toBe(
      "Awaiting Payment",
    );
    s.payments.push({
      id: "p2",
      quoteId: "quote",
      status: "Paid",
      amount: 300,
      reference: "demo2",
    });
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r3")!.status).toBe("Confirmed");
  });
  it("expires offers and allows sequential reassignment", () => {
    const s = ready();
    s.clock += 3 * 3600000;
    reconcile(s);
    expect(s.assignments.find((a) => a.id === "offer")!.status).toBe("Expired");
    const v = s.visits.find((v) => v.id === "test")!;
    v.providerId = "nina";
    s.assignments.push({
      id: "second",
      visitId: v.id,
      providerId: "nina",
      status: "Accepted",
      pay: 150,
      expiresAt: s.clock,
    });
    s.quotes.find((q) => q.id === "quote")!.payOnCompletion = true;
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r3")!.status).toBe("Confirmed");
    expect(s.assignments.find((a) => a.id === "offer")!.status).toBe("Expired");
  });
  it("declined quote and contractor keep the booking unconfirmed", () => {
    const s = ready();
    s.assignments.find((a) => a.id === "offer")!.status = "Declined";
    s.quotes.find((q) => q.id === "quote")!.status = "Declined";
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r3")!.status).toBe(
      "Awaiting Quote Approval",
    );
    expect(s.visits.find((v) => v.id === "test")!.status).toBe("Proposed");
  });
  it("bundles four distinct tasks and requires coverage of every task", () => {
    const s = seed();
    const ts = s.tasks.filter((t) => t.requestId === "r2");
    expect(ts.reduce((a, t) => a + t.duration, 0)).toBe(240);
    s.visits.push({
      id: "bundle",
      requestId: "r2",
      taskIds: ts.map((t) => t.id),
      providerId: "yousef",
      start: slots(s, "yousef", 240, "Oakville")[0].start,
      duration: 240,
      status: "Proposed",
      travel: 8,
    });
    s.assignments.push({
      id: "self",
      visitId: "bundle",
      providerId: "yousef",
      status: "Accepted",
      pay: 0,
      expiresAt: s.clock,
    });
    s.quotes.push({
      id: "q2",
      requestId: "r2",
      type: "Manual quote",
      amount: 395,
      high: 395,
      status: "Approved",
      notes: "",
      payOnCompletion: true,
    });
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r2")!.status).toBe("Confirmed");
    s.visits.find((v) => v.id === "bundle")!.taskIds.pop();
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r2")!.status).not.toBe("Confirmed");
    expect(s.tasks.filter((t) => t.requestId === "r2")).toHaveLength(4);
  });
  it("preserves cancellation and survives JSON persistence", () => {
    const s = ready();
    s.requests.find((r) => r.id === "r3")!.status = "Cancelled";
    reconcile(s);
    const copy: State = JSON.parse(JSON.stringify(s));
    expect(copy.requests.find((r) => r.id === "r3")!.status).toBe("Cancelled");
    expect(copy.assignments).toEqual(s.assignments);
  });
});
describe("provider-aware scheduling", () => {
  it("reserves buffers and avoids duplicate or overlapping visits", () => {
    const s = seed();
    const o = slots(s, "yousef", 240, "Oakville")[0];
    s.visits.push({
      id: "v",
      requestId: "r2",
      taskIds: [],
      providerId: "yousef",
      start: o.start,
      duration: 240,
      status: "Confirmed",
      travel: 8,
    });
    expect(available(s, "yousef", 60, "Oakville", o.start)).toBe(false);
    expect(
      slots(s, "yousef", 60, "Oakville").every((x) => x.start !== o.start),
    ).toBe(true);
    expect(available(s, "yousef", 240, "Oakville", o.start, "v")).toBe(true);
  });
  it("honors weekday working hours and morning preferences", () => {
    const s = seed();
    const os = slots(
      s,
      "yousef",
      60,
      "Oakville",
      undefined,
      "Weekdays · 9 AM–12 PM",
    );
    expect(os.length).toBeGreaterThan(0);
    for (const o of os) {
      const p = torontoParts(new Date(o.start));
      expect(["Sat", "Sun"]).not.toContain(p.weekday);
      expect(+p.hour).toBeLessThan(12);
    }
    expect(slots(s, "yousef", 500, "Oakville")).toHaveLength(0);
  });
  it("creates Toronto times independently of host timezone", () => {
    expect(torontoParts(localTime("2026-09-08", 10)).hour).toBe("10");
    expect(torontoParts(localTime("2026-12-08", 10)).hour).toBe("10");
  });
});
