import { describe, it, expect } from "vitest";
import { seed, classify, reconcile, instantEligible, type Task } from "./model";
import { getIssue, answerKey, inferredAnswers } from "./clarification";
import {
  entryTasks,
  missingQuestions,
  completeEntry,
  intakeOptions,
  preferenceSignature,
  validAddress,
  taskLabel,
} from "./intake";
function fill(t: Task) {
  const i = getIssue(t.description);
  for (const q of i.questions)
    t.answers[answerKey(i, q)] = q.options
      ? q.options.find((x) => x === "No" || x === "No visible damage") ||
        q.options[0]
      : "1";
  completeEntry(t);
}
describe("three-screen intake", () => {
  it("preserves classification review when details are saved", () => {
    const t = {
      ...seed().tasks[0],
      ...classify("sink is clogged"),
      description: "sink is clogged",
    };
    fill(t);
    expect(t.entryStage).toBe("done");
    expect(t.reviewed).toBe(false);
  });
  it("requires outstanding details or explicit uncertainty", () => {
    const t = seed().tasks[0];
    expect(completeEntry(t)).toBe(false);
    expect(completeEntry(t, true)).toBe(true);
    expect(t.reviewed).toBe(false);
    expect(missingQuestions(t)).toHaveLength(0);
    expect(instantEligible([t])).toBe(false);
  });
  it("preserves old drafts and counts only nonempty active tasks", () => {
    const s = seed();
    const t = s.tasks[0];
    delete t.entryStage;
    s.tasks.push(
      { ...t, id: "empty", description: "  " },
      { ...t, id: "merged", mergedInto: t.id },
    );
    expect(entryTasks(s, t.requestId)).toHaveLength(1);
    expect(missingQuestions(t).length).toBeGreaterThan(0);
  });
  it("builds a four-task visit using one eligible provider and summed duration", () => {
    const s = seed(),
      r = s.requests.find((r) => r.id === "r2")!;
    r.postalCode = "L6J 4S7";
    const ts = entryTasks(s, r.id);
    ts.forEach(fill);
    const options = intakeOptions(s, r);
    expect(options.length).toBeGreaterThan(3);
    expect(new Set(options.map((o) => o.providerId)).size).toBe(1);
    expect(options[0].duration).toBe(ts.reduce((n, t) => n + t.duration, 0));
    expect(s.visits.filter((v) => v.requestId === r.id)).toHaveLength(0);
  });
  it("does not offer exact slots for unreviewed, uncertain, referral, or oversized scope", () => {
    for (const description of ["sink is clogged", "roof repair"]) {
      const s = seed(),
        r = s.requests[0];
      r.postalCode = "L6J 4S7";
      Object.assign(s.tasks[0], classify(description), { description });
      fill(s.tasks[0]);
      expect(intakeOptions(s, r)).toHaveLength(0);
    }
    const s = seed(),
      r = s.requests.find((r) => r.id === "r2")!;
    r.postalCode = "L6J 4S7";
    entryTasks(s, r.id).forEach((t) => {
      fill(t);
      t.duration = 180;
    });
    expect(intakeOptions(s, r)).toHaveLength(0);
  });
  it("accounts for existing visits and offers more than the first three slots", () => {
    const s = seed(),
      r = s.requests[0];
    r.postalCode = "L6J 4S7";
    fill(s.tasks[0]);
    const options = intakeOptions(s, r);
    expect(options.length).toBeGreaterThan(3);
    const first = options[0];
    s.visits.push({
      id: "busy",
      requestId: "other",
      taskIds: [],
      providerId: first.providerId,
      start: first.start,
      duration: first.duration,
      travel: first.travel,
      status: "Confirmed",
    });
    expect(intakeOptions(s, r).some((o) => o.start === first.start)).toBe(
      false,
    );
  });
  it("invalidates selection signatures for task and address edits", () => {
    const s = seed(),
      r = s.requests[0],
      ts = entryTasks(s, r.id);
    const before = preferenceSignature(r, ts);
    r.address = "Different property";
    expect(preferenceSignature(r, ts)).not.toBe(before);
    const next = preferenceSignature(r, ts);
    ts[0].duration += 30;
    expect(preferenceSignature(r, ts)).not.toBe(next);
  });
  it("stores preferences without creating a visit or confirming a request", () => {
    const s = seed(),
      r = s.requests[0];
    r.postalCode = "L6J 4S7";
    fill(s.tasks[0]);
    const o = intakeOptions(s, r)[0];
    r.preferredSlot = {
      ...o,
      signature: preferenceSignature(r, entryTasks(s, r.id)),
    };
    r.status = "Submitted";
    reconcile(s);
    expect(r.status).not.toBe("Confirmed");
    expect(s.visits.some((v) => v.requestId === r.id)).toBe(false);
  });
  it("validates address and makes short labels from customer words", () => {
    const s = seed(),
      r = s.requests[0];
    r.postalCode = "not a postal code";
    expect(validAddress(r)).toBe(false);
    r.postalCode = "L6J 4S7";
    expect(validAddress(r)).toBe(true);
    expect(
      taskLabel({ ...s.tasks[0], description: "A".repeat(100) }).length,
    ).toBe(49);
  });
  it("persists independent progress, photos, and preferences through JSON refresh", () => {
    const s = seed();
    s.tasks[0].entryStage = "details";
    s.tasks[0].photos = ["data:image/png;base64,example"];
    s.requests[0].intakeScreen = "booking";
    s.requests[0].editingTaskId = s.tasks[0].id;
    const restored = JSON.parse(JSON.stringify(s));
    expect(restored.tasks[0].entryStage).toBe("details");
    expect(restored.tasks[0].photos).toEqual(s.tasks[0].photos);
    expect(restored.requests[0].intakeScreen).toBe("booking");
  });
});
