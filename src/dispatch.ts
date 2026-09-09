import {
  type State,
  type Visit,
  type Assignment,
  providers,
  eligible,
  available,
  slots,
  uid,
  log,
  dateLabel,
} from "./model";

export function migrateDispatch(s: State): State {
  s.settings ??= { autoReofferDeclined: false };
  s.notifications ??= [];
  // Existing declined offers get an actionable alert, without triggering a retroactive reoffer.
  for (const a of s.assignments)
    if (
      a.status === "Declined" &&
      !s.notifications.some(
        (n) => n.assignmentId === a.id && n.kind === "declined",
      )
    ) {
      const v = s.visits.find((v) => v.id === a.visitId);
      if (v)
        notification(
          s,
          a,
          "declined",
          `${providers.find((p) => p.id === a.providerId)?.name} declined`,
        );
    }
  return s;
}
function notification(s: State, a: Assignment, kind: string, message: string) {
  const v = s.visits.find((v) => v.id === a.visitId)!;
  const r = s.requests.find((r) => r.id === v.requestId)!;
  s.notifications ??= [];
  if (s.notifications.some((n) => n.assignmentId === a.id && n.kind === kind))
    return;
  s.notifications.unshift({
    id: uid(),
    assignmentId: a.id,
    visitId: v.id,
    requestId: r.id,
    kind,
    text: `${message} · ${r.name} · visit ${v.id.toUpperCase()} · ${dateLabel(v.start)}`,
    at: new Date(s.clock).toISOString(),
    read: false,
  });
  log(s, `${message} · ${r.name} · visit ${v.id.toUpperCase()}`);
}
export function dispatchStatus(s: State, v: Visit) {
  const r = s.requests.find((r) => r.id === v.requestId);
  if (
    ["Cancelled", "Completed", "In Progress"].includes(v.status) ||
    !r ||
    ["Cancelled", "Declined", "Completed"].includes(r.status)
  )
    return "";
  const history = s.assignments.filter((a) => a.visitId === v.id);
  if (!history.some((a) => ["Declined", "Expired"].includes(a.status)))
    return "";
  if (
    history.some(
      (a) => a.providerId === v.providerId && a.status === "Accepted",
    )
  )
    return "";
  if (
    history.some((a) => a.providerId === v.providerId && a.status === "Offered")
  )
    return "Replacement offer pending";
  return history.at(-1)?.status === "Expired"
    ? "Offer expired · Needs reassignment"
    : "Contractor declined · Needs reassignment";
}
export function requestDispatch(s: State, requestId: string) {
  const statuses = s.visits
    .filter((v) => v.requestId === requestId)
    .map((v) => dispatchStatus(s, v))
    .filter(Boolean);
  return (
    statuses.find((x) => x.includes("Needs reassignment")) || statuses[0] || ""
  );
}
export function replacementOptions(s: State, v: Visit, automatic = false) {
  const req = s.requests.find((r) => r.id === v.requestId)!;
  const tasks = s.tasks.filter((t) => v.taskIds.includes(t.id));
  const previous = s.assignments.filter((a) => a.visitId === v.id).at(-1);
  const pay = previous?.pay ?? 0;
  return providers
    .filter(
      (p) =>
        eligible(p.id, tasks) &&
        (!automatic || p.id !== "yousef") &&
        !s.assignments.some(
          (a) =>
            a.visitId === v.id &&
            a.providerId === p.id &&
            ["Declined", "Expired"].includes(a.status),
        ),
    )
    .map((p) => {
      const sameTime = available(
        s,
        p.id,
        v.duration,
        req.city,
        v.start,
        v.id,
        req.timing,
      );
      const candidate = sameTime
        ? { start: v.start, travel: p.city === req.city ? 8 : 24 }
        : slots(s, p.id, v.duration, req.city, v.id, req.timing)[0];
      // Mock compensation compatibility: fixed offer must cover the provider's listed hourly rate.
      const minimumPay = Math.ceil((p.rate * v.duration) / 60);
      return {
        provider: p,
        start: candidate?.start,
        travel: candidate?.travel ?? 0,
        sameTime,
        pay: p.id === "yousef" ? 0 : pay,
        minimumPay,
      };
    })
    .filter(
      (o) => o.start && (!automatic || (o.sameTime && pay >= o.minimumPay)),
    )
    .sort(
      (a, b) =>
        a.travel - b.travel || a.provider.id.localeCompare(b.provider.id),
    );
}
export function reoffer(
  s: State,
  visitId: string,
  providerId: string,
  start: string,
  pay: number,
  automatic = false,
) {
  const v = s.visits.find((v) => v.id === visitId);
  if (!v || !dispatchStatus(s, v).includes("Needs reassignment")) return false;
  if (
    s.assignments.some(
      (a) => a.visitId === v.id && ["Offered", "Accepted"].includes(a.status),
    )
  )
    return false;
  const option = replacementOptions(s, v, automatic).find(
    (o) => o.provider.id === providerId && o.start === start,
  );
  if (
    !option ||
    !Number.isFinite(pay) ||
    pay < 0 ||
    (providerId !== "yousef" && pay < option.minimumPay)
  )
    return false;
  if (automatic && (start !== v.start || pay !== option.pay)) return false;
  v.providerId = providerId;
  v.start = start;
  v.travel = option.travel;
  v.status = "Proposed";
  const a: Assignment = {
    id: uid(),
    visitId: v.id,
    providerId,
    status: providerId === "yousef" ? "Accepted" : "Offered",
    pay: providerId === "yousef" ? 0 : pay,
    expiresAt: s.clock + 7200000,
  };
  s.assignments.push(a);
  notification(
    s,
    a,
    "replacement",
    `${automatic ? "Automatically offered" : "Reassigned"} to ${option.provider.name}${providerId === "yousef" ? " · self-assigned" : " · replacement offer pending"}`,
  );
  return true;
}
export function respondToOffer(
  s: State,
  id: string,
  status: "Accepted" | "Declined",
) {
  const a = s.assignments.find((a) => a.id === id);
  const v = s.visits.find((v) => v.id === a?.visitId);
  const req = s.requests.find((r) => r.id === v?.requestId);
  if (
    !a ||
    !v ||
    !req ||
    a.status !== "Offered" ||
    a.expiresAt <= s.clock ||
    a.providerId !== v.providerId ||
    ["Cancelled", "Completed", "In Progress"].includes(v.status) ||
    ["Cancelled", "Declined", "Completed"].includes(req.status)
  )
    return false;
  a.status = status;
  if (status === "Accepted") {
    notification(
      s,
      a,
      "accepted",
      `${providers.find((p) => p.id === a.providerId)?.name} accepted the offer`,
    );
    return true;
  }
  notification(
    s,
    a,
    "declined",
    `${providers.find((p) => p.id === a.providerId)?.name} declined`,
  );
  if (s.settings?.autoReofferDeclined) {
    const option = replacementOptions(s, v, true)[0];
    if (
      option &&
      reoffer(s, v.id, option.provider.id, option.start!, a.pay, true)
    )
      return true;
    notification(
      s,
      a,
      "manual-required",
      "No eligible replacement fits the appointment and pay · operator action required",
    );
  }
  return true;
}
