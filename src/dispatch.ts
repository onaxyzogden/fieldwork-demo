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
  accounts,
  migrateAccounts,
  accountName,
  type Availability,
  hoursLabel,
  withinHours,
} from "./model";
import { migratePmw } from "./pmw";

export function migrateDispatch(s: State): State {
  s.settings ??= { autoReofferDeclined: false };
  s.rev ??= 0;
  s.holds ??= [];
  s.charges ??= [];
  s.mergedFrom ??= {};
  s.paymentMethods ??= [];
  s.approvers ??= {};
  s.notifications ??= [];
  migrateAccounts(s);
  migratePmw(s);
  // Saved states predate the redesign fields and the current customer roster.
  // The stored name is a denormalized copy, so refresh it from the roster the
  // identity switcher reads; otherwise a returning visitor sees one name on the
  // pill and a different one on their own request. Nothing else is rewritten.
  for (const r of s.requests) {
    r.preferredSlots ??= [];
    r.timingConstraints ??= "";
    r.operatorNote ??= null;
    r.customerReply ??= null;
    if (accounts.some((c) => c.id === r.accountId))
      r.name = accountName(r.accountId);
  }
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
export function reassignmentForScope(
  s: State,
  requestId: string,
  taskIds: string[],
) {
  const ids = new Set(taskIds);
  if (!ids.size) return undefined;
  const overlapping = s.visits.filter(
    (v) => v.status !== "Cancelled" && v.taskIds.some((id) => ids.has(id)),
  );
  if (overlapping.length !== 1) return undefined;
  const v = overlapping[0];
  return v.requestId === requestId &&
    v.taskIds.length === ids.size &&
    v.taskIds.every((id) => ids.has(id)) &&
    dispatchStatus(s, v).includes("Needs reassignment")
    ? v
    : undefined;
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
const providerName = (id: string) =>
  providers.find((p) => p.id === id)?.name || id;
export function respondToOffer(
  s: State,
  id: string,
  status: "Accepted" | "Declined",
  reason = "",
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
  if (status === "Declined") a.declineReason = reason;
  log(s, `${providerName(a.providerId)} ${status.toLowerCase()} the offer`, {
    actor: providerName(a.providerId),
    requestId: req.id,
    entity: "assignment",
    entityId: a.id,
    field: "status",
    from: "Offered",
    to: status,
  });
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
    `${providers.find((p) => p.id === a.providerId)?.name} declined${reason ? `: ${reason}` : ""}`,
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

/* ── The trip to a job (ADR 066) ─────────────────────────────────────────── */

/** Rough driving distances between the cities the demo serves, in km. */
const KM: Record<string, number> = {
  "Burlington|Oakville": 16,
  "Milton|Oakville": 22,
  "Mississauga|Oakville": 20,
  "Burlington|Milton": 20,
  "Burlington|Mississauga": 35,
  "Milton|Mississauga": 30,
};
/** Across town, inside one city. */
const SAME_CITY_KM = 5;

/**
 * How far a contractor travels to a job: where from, and roughly how far. The
 * minutes are the visit's own `travel`, the figure the scheduler booked it
 * with, so they are not worked out a second time here. An estimate either
 * way, which is how the offer words it.
 */
export function trip(providerId: string, city: string) {
  const from = providers.find((p) => p.id === providerId)?.city ?? "";
  const km = from === city ? SAME_CITY_KM : KM[[from, city].sort().join("|")];
  return { from, km };
}

/** "About 24 min · 16 km from Burlington", or without the distance when the
 *  pair is not in the table. */
export function tripLabel(providerId: string, city: string, minutes: number) {
  const t = trip(providerId, city);
  return `About ${minutes} min${t.km ? ` · ${t.km} km` : ""}${t.from ? ` from ${t.from}` : ""}`;
}

/* ── A contractor's hours (ADR 067) ──────────────────────────────────────── */

/** The decline reason an offer withdrawn by a change of hours carries. */
export const OUTSIDE_HOURS = "Outside my availability";

/** Accepted jobs not yet started that the contractor's hours no longer
 *  cover. They stay booked; the contractor is shown them. */
export function outsideHours(s: State, providerId: string) {
  return s.assignments.filter((a) => {
    const v = s.visits.find((v) => v.id === a.visitId);
    return (
      a.providerId === providerId &&
      a.status === "Accepted" &&
      !!v &&
      ["Proposed", "Confirmed"].includes(v.status) &&
      !withinHours(s, providerId, v.start, v.duration, v.travel)
    );
  });
}

/**
 * Save a contractor's hours. Open offers the new hours no longer cover are
 * withdrawn through the ordinary decline, so the operator hears about them
 * and the auto-reoffer setting applies, exactly as if the contractor had
 * declined each one; accepted jobs stay booked.
 */
export function setAvailability(
  s: State,
  providerId: string,
  av: Availability,
) {
  s.availability = { ...s.availability, [providerId]: av };
  const who = providerName(providerId);
  log(s, `${who} changed their hours · ${hoursLabel(av)}`, { actor: who });
  const withdrawn = s.assignments.filter((a) => {
    const v = s.visits.find((v) => v.id === a.visitId);
    return (
      a.providerId === providerId &&
      !!v &&
      !withinHours(s, providerId, v.start, v.duration, v.travel) &&
      /* Only an open offer can be declined; anything else is refused. */
      respondToOffer(s, a.id, "Declined", OUTSIDE_HOURS)
    );
  });
  return { withdrawn, outside: outsideHours(s, providerId) };
}
