import { describe, it, expect } from "vitest";
import { seed, reconcile, type State } from "./model";
import {
  execute,
  saveOutcome,
  canWork,
  bucket,
  message,
  workStatus,
} from "./work";
function ready() {
  const s = seed();
  const r = s.requests.find((r) => r.id === "r3")!;
  const task = s.tasks.find((t) => t.requestId === r.id)!;
  task.reviewed = true;
  s.visits.push({
    id: "work",
    requestId: r.id,
    taskIds: [task.id],
    providerId: "marcus",
    start: new Date(s.clock).toISOString(),
    duration: 120,
    status: "Confirmed",
    travel: 8,
  });
  s.assignments.push({
    id: "work-offer",
    visitId: "work",
    providerId: "marcus",
    status: "Accepted",
    pay: 180,
    expiresAt: s.clock + 7200000,
  });
  s.quotes.push({
    id: "work-quote",
    requestId: r.id,
    type: "Fixed",
    amount: 250,
    high: 250,
    status: "Approved",
    notes: "",
    payOnCompletion: true,
  });
  reconcile(s);
  return s;
}
const visit = (s: State) => s.visits.find((v) => v.id === "work")!;
describe("job execution", () => {
  it("requires provider acceptance and customer confirmation", () => {
    const s = ready();
    visit(s).status = "Proposed";
    expect(execute(s, "work", "marcus", "start")).toBe(false);
    visit(s).status = "Confirmed";
    s.assignments.find((a) => a.id === "work-offer")!.status = "Offered";
    expect(execute(s, "work", "marcus", "start")).toBe(false);
  });
  it("rejects wrong provider, cancelled and stale actions", () => {
    const s = ready();
    expect(execute(s, "work", "nina", "start")).toBe(false);
    expect(execute(s, "work", "marcus", "start")).toBe(true);
    expect(execute(s, "work", "marcus", "start")).toBe(false);
    visit(s).status = "Cancelled";
    expect(canWork(s, visit(s), "marcus")).toBe(false);
  });
  it("records on-way separately from booking status", () => {
    const s = ready();
    expect(execute(s, "work", "marcus", "way")).toBe(true);
    expect(visit(s).status).toBe("Confirmed");
    expect(visit(s).execution?.eta).toBeTruthy();
    expect(execute(s, "work", "marcus", "way")).toBe(false);
  });
  it("requires every task outcome and preserves payments", () => {
    const s = ready();
    const payments = JSON.stringify(s.payments);
    execute(s, "work", "marcus", "start");
    expect(execute(s, "work", "marcus", "finish")).toBe(false);
    saveOutcome(s, "work", "marcus", visit(s).taskIds[0], {
      outcome: "Completed",
      after: ["photo"],
    });
    expect(execute(s, "work", "marcus", "finish")).toBe(true);
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r3")?.status).toBe("Completed");
    expect(JSON.stringify(s.payments)).toBe(payments);
    expect(execute(s, "work", "marcus", "finish")).toBe(false);
  });
  it("partial completion keeps tasks unresolved and queues operator attention", () => {
    const s = ready();
    execute(s, "work", "marcus", "start");
    saveOutcome(s, "work", "marcus", visit(s).taskIds[0], {
      outcome: "Materials required",
      note: "Bracket missing",
    });
    execute(s, "work", "marcus", "finish");
    reconcile(s);
    expect(bucket(s, "r3")).toBe("Needs Action");
    expect(workStatus(visit(s))).toBe("Issue");
    expect(s.tasks.find((t) => t.id === visit(s).taskIds[0])?.status).not.toBe(
      "Completed",
    );
    expect(s.notifications?.some((n) => n.kind === "work-finish")).toBe(true);
  });
  it("rejects unrelated tasks and changes after finishing", () => {
    const s = ready();
    execute(s, "work", "marcus", "start");
    expect(
      saveOutcome(s, "work", "marcus", "other", { outcome: "Completed" }),
    ).toBe(false);
    saveOutcome(s, "work", "marcus", visit(s).taskIds[0], {
      outcome: "Completed",
    });
    execute(s, "work", "marcus", "finish");
    expect(
      saveOutcome(s, "work", "marcus", visit(s).taskIds[0], {
        outcome: "Unable to complete",
      }),
    ).toBe(false);
  });
  it("messages are simulated, persisted and provider restricted", () => {
    const s = ready();
    expect(message(s, "work", "nina", "Hello")).toBe(false);
    expect(message(s, "work", "marcus", "Hello")).toBe(true);
    const saved = JSON.parse(JSON.stringify(s));
    expect(visit(saved).messages?.[0].text).toBe("Hello");
  });
  it("legacy visits remain executable and initialize progress lazily", () => {
    const s = ready();
    expect(visit(s).execution).toBeUndefined();
    execute(s, "work", "marcus", "start");
    expect(visit(s).execution?.outcomes).toEqual({});
  });
  it("keeps a multi-visit request open until every task is completed", () => {
    const s = ready();
    const t = s.tasks.find((t) => t.id === visit(s).taskIds[0])!;
    s.tasks.push({ ...structuredClone(t), id: "second-task" });
    s.visits.push({
      ...structuredClone(visit(s)),
      id: "second-visit",
      taskIds: ["second-task"],
    });
    s.assignments.push({
      ...s.assignments.find((a) => a.id === "work-offer")!,
      id: "second-offer",
      visitId: "second-visit",
    });
    execute(s, "work", "marcus", "start");
    saveOutcome(s, "work", "marcus", t.id, { outcome: "Completed" });
    execute(s, "work", "marcus", "finish");
    reconcile(s);
    expect(s.requests.find((r) => r.id === "r3")?.status).not.toBe("Completed");
    expect(
      s.visits.find((v) => v.id === "second-visit")?.execution,
    ).toBeUndefined();
  });
  it("retains booking status when a waiting request needs dispatch attention", () => {
    const s = ready();
    const a = s.assignments.find((a) => a.id === "work-offer")!;
    a.status = "Declined";
    s.quotes.find((q) => q.id === "work-quote")!.status = "Sent";
    reconcile(s);
    expect(bucket(s, "r3")).toBe("Needs Action");
    expect(s.requests.find((r) => r.id === "r3")?.status).toBe(
      "Awaiting Quote Approval",
    );
  });
});
