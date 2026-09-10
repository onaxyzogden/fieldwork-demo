import catalogue from "./catalogue.generated.json";
export type Question = {
  id: string;
  label: string;
  options?: string[];
  when?: string;
};
export type Issue = {
  id: string;
  title: string;
  exclude?: RegExp;
  priority?: number;
  availability?: "Offered" | "Review first" | "Referral only";
  qualification?: string;
  category?: string;
  match: RegExp;
  review: boolean;
  questions: Question[];
};
const q = (
  id: string,
  label: string,
  options?: string,
  when?: string,
): Question => ({
  id,
  label,
  options: options ? [...options.split("|"), "Not sure"] : undefined,
  when,
});
const issue = (
  id: string,
  title: string,
  match: RegExp,
  review: boolean,
  questions: Question[],
): Issue => ({ id, title, match, review, questions });
export const issues: Issue[] = catalogue.map((row) => ({
  id: row.id,
  title: row.title,
  match: new RegExp(row.pattern, "i"),
  exclude: row.exclude ? new RegExp(row.exclude, "i") : undefined,
  priority: row.priority,
  availability: row.availability as Issue["availability"],
  qualification: row.qualification,
  category: row.category,
  review: row.availability !== "Offered",
  questions: row.questions,
}));
export const fallback = issue(
  "unknown",
  "Tell us about the problem",
  /$^/,
  true,
  [
    q("item", "Which item or part of your home needs attention?"),
    q("symptom", "What is happening, or what would you like changed?"),
    q("extent", "How many items or areas are affected?"),
  ],
);
function clean(description: string) {
  return description
    .replace(
      /\b(?:no|without)\s+(?:any\s+)?[^,.;]+?\b(?:work|repair|problem|issue)\b/gi,
      "",
    )
    .replace(
      /\b(?:no|not|without)\s+(?:a\s+)?(?:clogged|blocked|leaking|broken)\b/gi,
      "",
    );
}
export function matchIssues(description: string): Issue[] {
  const text = clean(description).replace(/[’]/g, "'");
  return issues
    .map((i, index) => ({ i, index, match: text.match(i.match) }))
    .filter(({ i, match }) => match && !i.exclude?.test(text))
    .sort(
      (a, b) =>
        (b.i.priority || 50) - (a.i.priority || 50) ||
        ((a.i.priority || 50) > 50
          ? b.match![0].length - a.match![0].length
          : 0) ||
        a.index - b.index,
    )
    .map(({ i }) => i);
}
export function getIssue(description: string): Issue {
  return matchIssues(description)[0] || fallback;
}
export const answerKey = (i: Issue, q: Question) => `${i.id}:${q.id}`;
export function inferredAnswers(description: string): Record<string, string> {
  const i = getIssue(description);
  const a: Record<string, string> = {};
  if (i.id === "sink-drain") {
    const locations = ["Kitchen", "Bathroom", "Laundry"].filter((s) =>
      new RegExp(`\\b${s}\\s+sink\\b`, "i").test(description),
    );
    if (locations.length === 1) a["sink-drain:location"] = locations[0];
    if (
      /\bdrains? slowly\b|\bslow.draining\b/i.test(description) &&
      !/\bnot\s+(?:draining|slow)/i.test(description)
    )
      a["sink-drain:drainage"] = "Drains slowly";
  }
  return a;
}
export function questionAnswers(t: {
  description: string;
  answers: Record<string, string>;
}) {
  const inferred = inferredAnswers(t.description);
  const active = getIssue(t.description);
  const entries = { ...inferred, ...t.answers };
  return Object.entries(entries)
    .filter(
      ([key, value]) =>
        value &&
        (!key.includes(":") ||
          key.startsWith(active.id + ":") ||
          key === "intake:details"),
    )
    .map(([key, value]) => ({
      key,
      label:
        key === "intake:details"
          ? "Additional details"
          : (key.endsWith(":product")
              ? "Which product was used, and when?"
              : undefined) ||
            active.questions.find((q) => answerKey(active, q) === key)?.label ||
            key,
      value,
      inferred: !(key in t.answers) && key in inferred,
    }));
}
export function needsClarificationReview(t: {
  description: string;
  answers: Record<string, string>;
}) {
  const i = getIssue(t.description);
  const a = Object.fromEntries(
    Object.entries(t.answers).filter(([key]) => key.startsWith(i.id + ":")),
  );
  return (
    i.review ||
    ["drywall:damp", "sealant:leak", "fence:stable", "deck:stable"].some(
      (k) => a[k] === "Yes",
    ) ||
    ["Conceal cables inside wall", "New electrical outlet"].includes(
      a["tv:cables"],
    )
  );
}
export function reportedConcern(t: {
  description: string;
  answers: Record<string, string>;
}) {
  return (
    questionAnswers(t).some(
      ({ key, value }) =>
        /:(hazard|spill|sagging|stable|damp|leak)$/.test(key) &&
        value === "Yes",
    ) ||
    (getIssue(t.description).id === "sink-leak" &&
      t.answers["sink-leak:spread"] === "Spreading") ||
    (["sink-drain", "bath-drain", "toilet-block"].includes(
      getIssue(t.description).id,
    ) &&
      t.answers[getIssue(t.description).id + ":other"] ===
        "Yes, other fixtures too")
  );
}
