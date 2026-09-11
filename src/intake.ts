import {
  type State,
  type Request,
  type Task,
  slots,
  eligible,
  providers,
  instantEligible,
} from "./model";
import { getIssue, inferredAnswers, answerKey } from "./clarification";
export const entryTasks = (s: State, id: string) =>
  s.tasks.filter(
    (t) => t.requestId === id && !t.mergedInto && !!t.description.trim(),
  );
export const taskLabel = (t: Task) =>
  t.description.trim().replace(/\s+/g, " ").slice(0, 48) +
  (t.description.trim().length > 48 ? "…" : "");
export const validAddress = (r: Request) =>
  !!r.address.trim() &&
  ["Oakville", "Burlington", "Milton", "Mississauga"].includes(r.city) &&
  /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(r.postalCode || "");
export function missingQuestions(t: Task) {
  const i = getIssue(t.description),
    a = { ...inferredAnswers(t.description), ...t.answers };
  return i.questions.filter((q) => !a[answerKey(i, q)]?.trim());
}
export function completeEntry(t: Task, uncertain = false) {
  const i = getIssue(t.description);
  if (uncertain)
    for (const q of missingQuestions(t))
      t.answers[answerKey(i, q)] = "Not sure";
  if (missingQuestions(t).length) return false;
  t.entryStage = "done";
  if (Object.values(t.answers).some((a) => /not sure|unknown/i.test(a)))
    t.reviewed = false;
  return true;
}
export const preferenceSignature = (r: Request, tasks: Task[]) =>
  JSON.stringify([
    r.address,
    r.city,
    r.postalCode,
    tasks.map((t) => [
      t.id,
      t.description,
      t.answers,
      t.duration,
      t.reviewed,
      t.restricted,
    ]),
  ]);
export function intakeOptions(s: State, r: Request) {
  const tasks = entryTasks(s, r.id);
  if (
    !validAddress(r) ||
    !tasks.length ||
    tasks.some(
      (t) =>
        !t.reviewed ||
        missingQuestions(t).length ||
        Object.values(t.answers).some((a) => /not sure|unknown/i.test(a)),
    )
  )
    return [];
  const duration = tasks.reduce((n, t) => n + t.duration, 0);
  const candidates = providers
    .filter(
      (p) =>
        eligible(p.id, tasks) && (!instantEligible(tasks) || p.id === "yousef"),
    )
    .map((p) => ({
      providerId: p.id,
      options: slots(s, p.id, duration, r.city, undefined, "", 12),
    }))
    .filter((p) => p.options.length)
    .sort(
      (a, b) =>
        b.options[0].score - a.options[0].score ||
        a.providerId.localeCompare(b.providerId),
    );
  if (!candidates.length) return [];
  return candidates[0].options.map((o) => ({
    ...o,
    providerId: candidates[0].providerId,
    duration,
  }));
}
