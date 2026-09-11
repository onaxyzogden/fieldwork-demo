import {
  type State,
  type Visit,
  uid,
  log,
  providers,
  torontoParts,
} from "./model";
import { requestDispatch } from "./dispatch";
export const outcomes = [
  "Completed",
  "Needs return visit",
  "Unable to complete",
  "Customer declined",
  "Materials required",
];
export const dayKey = (value: string | number) => {
  const p = torontoParts(new Date(value));
  return `${p.year}-${p.month}-${p.day}`;
};
export function workIssue(v: Visit) {
  if (
    v.execution?.finishedAt &&
    Object.values(v.execution.outcomes).some((o) => o.outcome !== "Completed")
  )
    return "Unresolved tasks · Operator follow-up";
  if (
    !v.execution?.startedAt &&
    !v.execution?.finishedAt &&
    v.execution?.eta &&
    +new Date(v.execution.eta) > +new Date(v.start)
  )
    return "Late arrival · Simulated ETA";
  return "";
}
export function workStatus(v: Visit) {
  return workIssue(v)
    ? "Issue"
    : v.execution?.finishedAt
      ? "Completed"
      : v.execution?.startedAt
        ? "In Progress"
        : v.execution?.onWayAt
          ? "On the Way"
          : v.status;
}
export function bucket(s: State, id: string) {
  const r = s.requests.find((r) => r.id === id)!;
  if (["Cancelled", "Declined", "Completed"].includes(r.status))
    return "History";
  if (r.status === "Draft") return "Draft";
  const dispatch = requestDispatch(s, id);
  if (
    s.visits.some(
      (v) => v.requestId === id && v.status !== "Cancelled" && workIssue(v),
    ) ||
    dispatch.includes("Needs reassignment")
  )
    return "Needs Action";
  if (
    dispatch ||
    r.status.startsWith("Awaiting") ||
    r.status === "Information requested"
  )
    return "Waiting";
  return r.status === "Confirmed" ? "Scheduled" : "Needs Action";
}
export function canWork(s: State, v: Visit, provider: string) {
  const r = s.requests.find((r) => r.id === v.requestId);
  return (
    !!r &&
    !["Cancelled", "Declined"].includes(r.status) &&
    v.providerId === provider &&
    ["Confirmed", "In Progress"].includes(v.status) &&
    !v.execution?.finishedAt &&
    s.assignments.some(
      (a) =>
        a.visitId === v.id &&
        a.providerId === provider &&
        a.status === "Accepted",
    )
  );
}
function signal(s: State, v: Visit, kind: string, text: string) {
  const a = s.assignments.find(
    (a) =>
      a.visitId === v.id &&
      a.providerId === v.providerId &&
      a.status === "Accepted",
  );
  const r = s.requests.find((r) => r.id === v.requestId)!;
  s.notifications ??= [];
  s.notifications.unshift({
    id: uid(),
    assignmentId: a?.id || "",
    visitId: v.id,
    requestId: v.requestId,
    kind,
    text: `${providers.find((p) => p.id === v.providerId)?.name} · ${r.name} · ${text}`,
    at: new Date(s.clock).toISOString(),
    read: false,
  });
  log(s, text);
}
export function execute(
  s: State,
  id: string,
  provider: string,
  action: "way" | "start" | "finish",
) {
  const v = s.visits.find((v) => v.id === id);
  if (!v || !canWork(s, v, provider)) return false;
  const x = (v.execution ??= { outcomes: {} });
  const now = new Date(s.clock).toISOString();
  if (action === "way") {
    if (x.onWayAt || x.startedAt) return false;
    x.onWayAt = now;
    x.eta = new Date(s.clock + v.travel * 60000).toISOString();
  }
  if (action === "start") {
    if (x.startedAt) return false;
    x.startedAt = now;
    v.status = "In Progress";
  }
  if (action === "finish") {
    if (
      !x.startedAt ||
      !v.taskIds.length ||
      !v.taskIds.every((id) => outcomes.includes(x.outcomes[id]?.outcome))
    )
      return false;
    x.finishedAt = now;
    v.status = "Completed";
  }
  signal(
    s,
    v,
    `work-${action}`,
    action === "finish"
      ? workIssue(v) ||
          "Visit completed · in-app customer notification simulated"
      : action === "start"
        ? "Job started"
        : "On the way · ETA simulated",
  );
  return true;
}
export function saveOutcome(
  s: State,
  id: string,
  provider: string,
  task: string,
  patch: Partial<NonNullable<Visit["execution"]>["outcomes"][string]>,
) {
  const v = s.visits.find((v) => v.id === id);
  if (
    !v ||
    !canWork(s, v, provider) ||
    !v.execution?.startedAt ||
    !v.taskIds.includes(task) ||
    (patch.outcome && !outcomes.includes(patch.outcome))
  )
    return false;
  v.execution.outcomes[task] = {
    ...(v.execution.outcomes[task] || {
      outcome: "",
      note: "",
      before: [],
      after: [],
    }),
    ...patch,
  };
  return true;
}
export function message(s: State, id: string, provider: string, text: string) {
  const v = s.visits.find((v) => v.id === id);
  if (!v || !canWork(s, v, provider) || !text.trim()) return false;
  (v.messages ??= []).push({
    id: uid(),
    sender: provider,
    text: text.trim(),
    at: new Date(s.clock).toISOString(),
  });
  signal(s, v, "message", `Simulated customer message: ${text.trim()}`);
  return true;
}
