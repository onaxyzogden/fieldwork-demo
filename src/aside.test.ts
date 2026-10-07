import { describe, it, expect } from "vitest";
import { log, seed } from "./model";
import { asideFor, hasLiveVisit } from "./aside";

/**
 * The request page's booked rule and the desktop side panel (ADR 068).
 */

describe("a request with a live visit", () => {
  it("is booked until its only visit is cancelled", () => {
    const s = seed();
    expect(hasLiveVisit(s, "r2")).toBe(false);
    expect(hasLiveVisit(s, "r5")).toBe(true);
    s.visits.find((v) => v.id === "v5")!.status = "Cancelled";
    expect(hasLiveVisit(s, "r5")).toBe(false);
  });
});

describe("the side panel beside a queue item", () => {
  it("gives the operator who, where, the tasks, notes and the latest history", () => {
    const s = seed();
    const r = s.requests.find((x) => x.id === "r5")!;
    r.notes = "Side gate code 1234";
    s.tasks.find((t) => t.requestId === "r5")!.answers["intake:details"] =
      "Bracket is in the box";
    for (let i = 0; i < 7; i++) log(s, `Entry ${i}`, { requestId: "r5" });
    log(s, "Someone else's", { requestId: "r2" });
    const a = asideFor(s, "Operator", "r5")!;
    expect(a.title).toBe("Amir Hassan");
    expect(a.where).toBe(`${r.address}, ${r.city}`);
    expect(a.notes).toBe("Side gate code 1234");
    expect(a.tasks.map((t) => t.id)).toEqual(
      s.tasks
        .filter((t) => t.requestId === "r5" && !t.mergedInto)
        .map((t) => t.id),
    );
    expect(a.tasks.every((t) => t.answers.length === 0)).toBe(true);
    // Newest first, five of them, and only this request's.
    expect(a.history.map((e) => e.text)).toEqual([
      "Entry 6",
      "Entry 5",
      "Entry 4",
      "Entry 3",
      "Entry 2",
    ]);
    expect(a.when).toBe(s.visits.find((v) => v.id === "v5")!.start);
  });

  it("never shows the customer the operator's history", () => {
    const s = seed();
    log(s, "Operator changed booking mode", { requestId: "r5" });
    const a = asideFor(s, "Customer", "r5")!;
    expect(a.history).toEqual([]);
    expect(a.title).toBe("Your booking");
    expect(a.where).toMatch(/, Oakville$/);
  });

  it("gives a contractor the city, the offer's own tasks and their answers, and no notes", () => {
    const s = seed();
    const r = s.requests.find((x) => x.id === "r5")!;
    r.notes = "Side gate code 1234";
    const v = s.visits.find((x) => x.id === "v5")!;
    s.tasks.find((t) => t.id === v.taskIds[0])!.answers["intake:details"] =
      "Bracket is in the box";
    // A task on the request but not on this visit is not theirs.
    s.tasks.push({
      ...structuredClone(s.tasks.find((t) => t.id === v.taskIds[0])!),
      id: "elsewhere",
    });
    const a = asideFor(s, "Contractor", "r5", "v5")!;
    expect(a.where).toBe("Oakville");
    expect(a.notes).toBe("");
    expect(a.tasks.map((t) => t.id)).toEqual(v.taskIds);
    expect(a.tasks[0].answers).toContainEqual(
      expect.objectContaining({
        label: "Additional details",
        value: "Bracket is in the box",
      }),
    );
    expect(a.history).toEqual([]);
    // Their offer's time, even with an earlier visit on the request.
    s.visits.push({
      ...structuredClone(v),
      id: "earlier",
      start: new Date(+new Date(v.start) - 86400000).toISOString(),
    });
    expect(asideFor(s, "Contractor", "r5", "v5")!.when).toBe(v.start);
  });

  it("shows the next visit not yet finished, and leaves out merged tasks", () => {
    const s = seed();
    const v = s.visits.find((x) => x.id === "v5")!;
    const t = s.tasks.find((x) => x.id === v.taskIds[0])!;
    expect(asideFor(s, "Customer", "r5")!.when).toBe(v.start);
    // An earlier one comes first; a cancelled one is no visit.
    const earlier = new Date(+new Date(v.start) - 86400000).toISOString();
    s.visits.push({ ...structuredClone(v), id: "earlier", start: earlier });
    expect(asideFor(s, "Customer", "r5")!.when).toBe(earlier);
    s.visits.find((x) => x.id === "earlier")!.status = "Cancelled";
    expect(asideFor(s, "Customer", "r5")!.when).toBe(v.start);
    v.execution = { finishedAt: v.start, outcomes: {} };
    expect(asideFor(s, "Customer", "r5")!.when).toBeUndefined();
    t.mergedInto = "other";
    expect(asideFor(s, "Customer", "r5")!.tasks.map((x) => x.id)).not.toContain(
      t.id,
    );
  });

  it("has nothing for a request that is not there", () => {
    expect(asideFor(seed(), "Operator", "nope")).toBeUndefined();
  });
});
