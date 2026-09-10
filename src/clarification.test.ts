import catalogue from "./catalogue.generated.json";
import { describe, it, expect } from "vitest";
import {
  getIssue,
  issues,
  inferredAnswers,
  questionAnswers,
  needsClarificationReview,
  matchIssues,
} from "./clarification";
import { classify, instantEligible, seed, reconcile, eligible } from "./model";
const examples: [string, string][] = [
  ["sink-drain", "sink is clogged"],
  ["bath-drain", "shower drains slowly"],
  ["toilet-block", "toilet is overflowing"],
  ["toilet-running", "toilet keeps running"],
  ["fixture-replace", "replace sink"],
  ["sink-leak", "sink leaking underneath"],
  ["faucet-leak", "leaking faucet"],
  ["door-adjust", "door is sticking"],
  ["door-hardware", "loose door handle"],
  ["cabinet", "cabinet door is misaligned"],
  ["damp", "damp ceiling"],
  ["drywall", "hole in wall"],
  ["paint", "painting a bedroom"],
  ["shelves", "install two shelves"],
  ["tv", "mount TV"],
  ["hanging", "hang mirror"],
  ["curtains", "install blinds"],
  ["assembly", "assemble furniture"],
  ["accessory", "loose towel bar"],
  ["sealant", "replace caulk"],
  ["fence", "repair fence"],
  ["deck", "repair deck"],
  ["outlet", "outlet not working"],
  ["lighting", "replace ceiling fan"],
  ["wiring", "breaker keeps tripping"],
];
describe("issue catalogue", () => {
  it.each(examples)("recognizes %s", (id, text) =>
    expect(getIssue(text).id).toBe(id),
  );
  it("has 81 unique issues with three or four initial questions", () => {
    expect(new Set(issues.map((i) => i.id)).size).toBe(81);
    expect(
      issues.every((i) => i.questions.length >= 3 && i.questions.length <= 4),
    ).toBe(true);
  });
  it.each([
    "sink",
    "something is loose",
    "sink is not clogged",
    "not a blocked sink",
  ])("does not force a diagnosis for %s", (text) =>
    expect(getIssue(text).id).toBe("unknown"),
  );
  it.each([
    "blocked sink",
    "kitchen sink drains slowly",
    "sink will not drain",
  ])("recognizes drainage synonyms: %s", (text) =>
    expect(getIssue(text).id).toBe("sink-drain"),
  );
  it("does not confuse leaking drain with a blockage", () =>
    expect(getIssue("sink drain is leaking").id).toBe("sink-leak"));
  it("prefills only explicit details and permits correction", () => {
    expect(inferredAnswers("kitchen sink drains slowly")).toEqual({
      "sink-drain:location": "Kitchen",
      "sink-drain:drainage": "Drains slowly",
    });
    expect(inferredAnswers("sink is clogged")).toEqual({});
    expect(
      questionAnswers({
        description: "kitchen sink drains slowly",
        answers: { "sink-drain:location": "Bathroom" },
      }).find((a) => a.key === "sink-drain:location")?.value,
    ).toBe("Bathroom");
  });
  it("preserves legacy answers and omits stale issue-specific answers from active details", () => {
    const task = {
      description: "sink is clogged",
      answers: { "What happened?": "Yesterday", "door-adjust:count": "2" },
    };
    expect(questionAnswers(task).map((a) => a.value)).toEqual(["Yesterday"]);
    expect(task.answers["door-adjust:count"]).toBe("2");
  });
  it("identifies multiple problems", () =>
    expect(
      matchIssues("door is sticking and sink is clogged").length,
    ).toBeGreaterThan(1));
  it("keeps specialist intake reviewed=false and out of Instant Book", () => {
    for (const description of [
      "sink is clogged",
      "leaking faucet",
      "replace ceiling fan",
      "outlet broken",
    ]) {
      const task = {
        ...seed().tasks[0],
        ...classify(description),
        description,
        answers: {},
      };
      expect(task.reviewed).toBe(false);
      expect(instantEligible([task])).toBe(false);
      task.reviewed = true;
      task.category = "Handyman / Doors / Adjustment";
      expect(instantEligible([task])).toBe(false);
    }
  });
  it("flags relevant follow-up answers for review", () =>
    expect(
      needsClarificationReview({
        description: "mount TV",
        answers: { "tv:cables": "New electrical outlet" },
      }),
    ).toBe(true));
  it("reconciles clogged sink requests to Needs Review", () => {
    const s = seed();
    const t = s.tasks[0];
    Object.assign(t, classify("sink is clogged"), {
      description: "sink is clogged",
    });
    s.requests[0].status = "Submitted";
    reconcile(s);
    expect(s.requests[0].status).toBe("Needs Review");
  });
});

it("keeps multi-door and exterior scope out of fixed-price Instant Book", () => {
  const t = seed().tasks[0];
  t.answers = { "door-adjust:count": "2" };
  expect(instantEligible([t])).toBe(false);
  t.answers = { "door-adjust:count": "1" };
  expect(instantEligible([t])).toBe(true);
  t.answers = { "door-adjust:location": "Exterior" };
  expect(instantEligible([t])).toBe(false);
});

describe("expanded matrix matching", () => {
  it.each(catalogue.map((i) => [i.id, i.example]))(
    "matches %s example",
    (id, text) => expect(getIssue(text).id).toBe(id),
  );
  it.each(["leak", "loose", "patch", "draft", "tripping"])(
    "does not classify generic word %s",
    (text) => expect(getIssue(text).id).toBe("unknown"),
  );
  it.each([
    ["roof is leaking", "roof"],
    ["loose stair railing", "handrail"],
    ["replace dryer vent cover", "vent-cover"],
    ["deck staining", "staining"],
    ["install ceiling fan", "lighting"],
    ["closet system", "closet"],
    ["patch driveway crack", "driveway"],
  ])("disambiguates %s", (text, id) => expect(getIssue(text).id).toBe(id));
  it("keeps every source row traceable", () => {
    const rows = new Set(
      catalogue.flatMap((i) => i.source_rows.split("|").filter(Boolean)),
    );
    expect(rows.size).toBe(78);
  });
});

it("does not allow referral services to become assignments after review", () => {
  for (const description of ["roof repair", "furnace repair", "junk removal"]) {
    const t = {
      ...seed().tasks[0],
      ...classify(description),
      description,
      reviewed: true,
    };
    expect(eligible("yousef", [t])).toBe(false);
    expect(instantEligible([t])).toBe(false);
  }
});
it("excludes explicitly negated service clauses", () =>
  expect(getIssue("no roof work; door is sticking").id).toBe("door-adjust"));
