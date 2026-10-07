import {
  type State,
  type Weekday,
  WEEK,
  accountName,
  localTime,
  torontoParts,
} from "./model";
import { dayKey } from "./work";

/**
 * What a contractor has earned, week by week (ADR 067). Worked out from the
 * accepted offers and their visits rather than stored, so it cannot disagree
 * with them. Payouts are simulated: each week is paid the Friday after it.
 */

const DAY = 86400000;
/** A Toronto date moved by whole days. Noon UTC keeps it clear of DST. */
const shift = (day: string, days: number) =>
  new Date(+new Date(day + "T12:00:00Z") + days * DAY)
    .toISOString()
    .slice(0, 10);
/** The Monday starting the Toronto week this moment falls in. */
export function weekOf(value: string | number) {
  const back = WEEK.indexOf(torontoParts(new Date(value)).weekday as Weekday);
  return shift(dayKey(value), -back);
}

export type EarningJob = {
  assignmentId: string;
  /** When it was finished, or when it starts if it has not been. */
  at: string;
  summary: string;
  customer: string;
  pay: number;
  done: boolean;
};
export type EarningWeek = {
  /** Its Monday. */
  start: string;
  earned: number;
  upcoming: number;
  jobs: EarningJob[];
  payout: { day: string; paid: boolean };
};

export function earnings(s: State, providerId: string, clock: number) {
  const weeks = new Map<string, EarningWeek>();
  const week = (start: string) => {
    const friday = shift(start, 11);
    const w = weeks.get(start) ?? {
      start,
      earned: 0,
      upcoming: 0,
      jobs: [],
      payout: { day: friday, paid: clock >= +localTime(friday, 0) },
    };
    weeks.set(start, w);
    return w;
  };
  /* This week is always there, so the page can say what it holds so far. */
  const now = weekOf(clock);
  week(now);
  for (const a of s.assignments) {
    const v = s.visits.find((v) => v.id === a.visitId);
    if (
      a.providerId !== providerId ||
      a.status !== "Accepted" ||
      !v ||
      v.status === "Cancelled"
    )
      continue;
    /* Finished is earned, at the agreed pay, whatever the outcomes: the
       contractor went and did what could be done. */
    const done = !!v.execution?.finishedAt;
    const at = v.execution?.finishedAt ?? v.start;
    const w = week(weekOf(at));
    w[done ? "earned" : "upcoming"] += a.pay;
    w.jobs.push({
      assignmentId: a.id,
      at,
      summary: s.tasks.find((t) => v.taskIds.includes(t.id))?.summary || "Job",
      customer: accountName(
        s.requests.find((r) => r.id === v.requestId)?.accountId ?? "",
      ),
      pay: a.pay,
      done,
    });
  }
  for (const w of weeks.values())
    w.jobs.sort((a, b) => a.at.localeCompare(b.at));
  return {
    now,
    /* Newest first: upcoming weeks, this one, then the ones already paid. */
    weeks: [...weeks.values()].sort((a, b) => b.start.localeCompare(a.start)),
  };
}

/** "This week", "Last week", "Next week", or "Sep 21 – 27". */
export function weekLabel(start: string, now: string) {
  if (start === now) return "This week";
  if (start === shift(now, -7)) return "Last week";
  if (start === shift(now, 7)) return "Next week";
  const day = (d: string, o: Intl.DateTimeFormatOptions) =>
    new Date(d + "T12:00:00Z").toLocaleDateString("en-CA", {
      timeZone: "UTC",
      ...o,
    });
  const end = shift(start, 6);
  return `${day(start, { month: "short", day: "numeric" })} – ${day(end, end.slice(5, 7) === start.slice(5, 7) ? { day: "numeric" } : { month: "short", day: "numeric" })}`;
}
