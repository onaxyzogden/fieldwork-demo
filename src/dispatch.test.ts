import { describe, it, expect } from "vitest";
import { seed, reconcile, slots, type State } from "./model";
import {
  migrateDispatch,
  respondToOffer,
  replacementOptions,
  reoffer,
  requestDispatch,
  dispatchStatus,
} from "./dispatch";
function setup(auto = false) {
  const s = migrateDispatch(seed());
  s.settings!.autoReofferDeclined = auto;
  const v = s.visits.find((v) => v.id === "v5")!;
  v.start = slots(s, "nina", 90, "Oakville")[0].start;
  return s;
}
describe("dispatch decline visibility", () => {
  it("migrates saved states without losing data or auto-enabling", () => {
    const old = seed();
    old.assignments[0].status = "Declined";
    const s = migrateDispatch(JSON.parse(JSON.stringify(old)));
    expect(s.settings!.autoReofferDeclined).toBe(false);
    expect(s.requests).toEqual(old.requests);
    expect(s.notifications).toHaveLength(1);
    migrateDispatch(s);
    expect(s.notifications).toHaveLength(1);
    expect(s.assignments).toHaveLength(1);
  });
  it("shows a decline independently of pending quote approval", () => {
    const s = setup();
    s.quotes.push({
      id: "q",
      requestId: "r5",
      type: "Manual quote",
      amount: 250,
      high: 250,
      status: "Sent",
      notes: "",
      payOnCompletion: false,
    });
    expect(respondToOffer(s, "a5", "Declined")).toBe(true);
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r5")!.status).toBe(
      "Awaiting Quote Approval",
    );
    expect(requestDispatch(s, "r5")).toBe(
      "Contractor declined · Needs reassignment",
    );
    expect(s.notifications![0]).toMatchObject({
      assignmentId: "a5",
      visitId: "v5",
      requestId: "r5",
      read: false,
    });
    expect(s.notifications![0].text).toContain("Marcus Chen");
    expect(s.notifications![0].text).toContain("Sophie Laurent");
  });
  it("manual replacement preserves history and remains pending until acceptance", () => {
    const s = setup();
    respondToOffer(s, "a5", "Declined");
    const v = s.visits[0];
    const o = replacementOptions(s, v).find((o) => o.provider.id === "nina")!;
    expect(reoffer(s, v.id, "nina", o.start!, 110)).toBe(true);
    expect(dispatchStatus(s, v)).toBe("Replacement offer pending");
    expect(s.assignments[0].status).toBe("Declined");
    respondToOffer(s, s.assignments.at(-1)!.id, "Accepted");
    expect(dispatchStatus(s, v)).toBe("");
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r5")!.status).not.toBe("Confirmed");
  });
  it("offers Do It Myself through the same guarded path", () => {
    const s = setup();
    respondToOffer(s, "a5", "Declined");
    const o = replacementOptions(s, s.visits[0]).find(
      (o) => o.provider.id === "yousef",
    )!;
    expect(reoffer(s, "v5", "yousef", o.start!, 0)).toBe(true);
    expect(s.assignments.at(-1)!.status).toBe("Accepted");
    expect(s.assignments.at(-1)!.pay).toBe(0);
    expect(dispatchStatus(s, s.visits[0])).toBe("");
  });
  it("rejects duplicate and stale responses and reoffers", () => {
    const s = setup();
    respondToOffer(s, "a5", "Declined");
    const o = replacementOptions(s, s.visits[0]).find(
      (o) => o.provider.id === "nina",
    )!;
    expect(respondToOffer(s, "a5", "Accepted")).toBe(false);
    reoffer(s, "v5", "nina", o.start!, 110);
    expect(reoffer(s, "v5", "nina", o.start!, 110)).toBe(false);
    expect(s.assignments).toHaveLength(2);
  });
});
describe("optional automatic reoffers", () => {
  it("creates exactly one same-time same-pay offer and notifies the operator", () => {
    const s = setup(true);
    const time = s.visits[0].start;
    respondToOffer(s, "a5", "Declined");
    expect(s.assignments).toHaveLength(2);
    expect(s.assignments[1]).toMatchObject({
      providerId: "nina",
      status: "Offered",
      pay: 110,
    });
    expect(s.visits[0].start).toBe(time);
    expect(s.notifications).toHaveLength(2);
    expect(s.notifications![0].kind).toBe("replacement");
    expect(s.notifications![0].text).toContain("Automatically offered");
    expect(respondToOffer(s, "a5", "Declined")).toBe(false);
    expect(s.assignments).toHaveLength(2);
  });
  it("never confirms through pending acceptance even after payment", () => {
    const s = setup(true);
    s.quotes.push({
      id: "q",
      requestId: "r5",
      type: "Fixed price",
      amount: 200,
      high: 200,
      status: "Approved",
      notes: "",
      payOnCompletion: false,
    });
    s.payments.push({
      id: "p",
      quoteId: "q",
      status: "Paid",
      amount: 200,
      reference: "demo",
    });
    respondToOffer(s, "a5", "Declined");
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r5")!.status).toBe(
      "Awaiting Provider Acceptance",
    );
    respondToOffer(s, s.assignments.at(-1)!.id, "Accepted");
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r5")!.status).toBe("Confirmed");
    expect(s.quotes[0].amount).toBe(200);
  });
  it("falls back to manual action when the existing pay is insufficient", () => {
    const s = setup(true);
    s.assignments[0].pay = 10;
    respondToOffer(s, "a5", "Declined");
    expect(s.assignments).toHaveLength(1);
    expect(s.notifications![0].kind).toBe("manual-required");
    expect(requestDispatch(s, "r5")).toContain("Needs reassignment");
  });
  it("does not move the appointment when replacements are unavailable", () => {
    const s = setup(true);
    const v = s.visits[0];
    s.visits.push({ ...v, id: "busy", providerId: "nina", requestId: "r3" });
    respondToOffer(s, "a5", "Declined");
    expect(s.assignments).toHaveLength(1);
    expect(s.notifications![0].kind).toBe("manual-required");
  });
  it("excludes previous declines and expires without automatic retry", () => {
    const s = setup(true);
    respondToOffer(s, "a5", "Declined");
    respondToOffer(s, s.assignments[1].id, "Declined");
    expect(s.assignments).toHaveLength(2);
    expect(s.notifications![0].kind).toBe("manual-required");
    expect(replacementOptions(s, s.visits[0], true)).toHaveLength(0);
    const expired = setup(true);
    expired.clock += 3 * 3600000;
    reconcile(expired);
    expect(expired.assignments).toHaveLength(1);
    expect(dispatchStatus(expired, expired.visits[0])).toContain("expired");
    expect(respondToOffer(expired, "a5", "Accepted")).toBe(false);
  });
  it("never routes restricted work to ordinary contractors", () => {
    const s = setup(true);
    const v = s.visits[0];
    const task = s.tasks.find((t) => t.requestId === "r4")!;
    task.reviewed = true;
    v.taskIds = [task.id];
    v.requestId = "r4";
    v.providerId = "eli";
    s.assignments[0].providerId = "eli";
    respondToOffer(s, "a5", "Declined");
    expect(s.assignments).toHaveLength(1);
    expect(s.notifications![0].kind).toBe("manual-required");
  });
  it("persists settings and notification read state", () => {
    const s = setup(true);
    respondToOffer(s, "a5", "Declined");
    s.notifications![0].read = true;
    const copy: State = migrateDispatch(JSON.parse(JSON.stringify(s)));
    expect(copy.settings!.autoReofferDeclined).toBe(true);
    expect(copy.notifications![0].read).toBe(true);
    expect(copy.notifications).toHaveLength(2);
  });
});
