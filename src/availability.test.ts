import { describe, it, expect } from "vitest";
import {
  type Availability,
  type State,
  available,
  defaultAvailability,
  hoursLabel,
  localTime,
  seed,
  slots,
  torontoParts,
  windows,
  withinHours,
} from "./model";
import {
  OUTSIDE_HOURS,
  migrateDispatch,
  outsideHours,
  setAvailability,
} from "./dispatch";
import { earnings, weekLabel, weekOf } from "./earnings";

/**
 * A contractor's hours, and what they have earned (ADR 067).
 *
 * The week used throughout: Monday 2026-10-12 to Sunday 2026-10-18, with the
 * clock on the Monday before, so every time below is in the future.
 */

const at = (day: string, h: number, m = 0) =>
  new Date(+localTime(day, h) + m * 60000).toISOString();
const MON = "2026-10-12",
  TUE = "2026-10-13",
  WED = "2026-10-14",
  SAT = "2026-10-17";

function setup() {
  const s = migrateDispatch(seed());
  s.clock = +localTime("2026-10-05", 8);
  return s;
}
/** Hours edited from the default the way the page does it. */
function hours(edit: (av: Availability) => void) {
  const av = defaultAvailability();
  edit(av);
  return av;
}
const nina = (s: State, av: Availability) => {
  s.availability = { ...s.availability, nina: av };
};

describe("a day's working windows", () => {
  it("joins neighbouring blocks, morning and afternoon across lunch", () => {
    const av = defaultAvailability();
    expect(windows(av, "Mon")).toEqual([[540, 1020]]);
    expect(windows(av, "Sat")).toEqual([]);
    av.days.Mon = ["Morning"];
    expect(windows(av, "Mon")).toEqual([[540, 720]]);
    av.days.Mon = ["Morning", "Evening"];
    expect(windows(av, "Mon")).toEqual([
      [540, 720],
      [1020, 1260],
    ]);
    av.days.Mon = ["Afternoon", "Evening"];
    expect(windows(av, "Mon")).toEqual([[780, 1260]]);
    av.days.Mon = ["Morning", "Afternoon", "Evening"];
    expect(windows(av, "Mon")).toEqual([[540, 1260]]);
  });
});

describe("whether a visit fits the hours", () => {
  it("keeps today's 9–5 by default, with the drive before and the wrap-up after", () => {
    const s = setup();
    expect(withinHours(s, "nina", at(MON, 9, 8), 60, 8)).toBe(true);
    expect(withinHours(s, "nina", at(MON, 9, 7), 60, 8)).toBe(false);
    expect(withinHours(s, "nina", at(MON, 15, 45), 60, 8)).toBe(true);
    expect(withinHours(s, "nina", at(MON, 15, 46), 60, 8)).toBe(false);
    expect(withinHours(s, "nina", at(SAT, 10), 60, 8)).toBe(false);
  });

  it("holds a visit inside one window", () => {
    const s = setup();
    nina(
      s,
      hours((av) => {
        av.days.Mon = ["Morning", "Evening"];
        av.days.Tue = ["Evening"];
      }),
    );
    expect(withinHours(s, "nina", at(MON, 10), 105, 8)).toBe(true);
    expect(withinHours(s, "nina", at(MON, 10), 106, 8)).toBe(false);
    // Morning and evening are two windows, not one long day.
    expect(withinHours(s, "nina", at(MON, 11), 120, 8)).toBe(false);
    expect(withinHours(s, "nina", at(MON, 14), 60, 8)).toBe(false);
    expect(withinHours(s, "nina", at(TUE, 17, 24), 60, 24)).toBe(true);
    expect(withinHours(s, "nina", at(TUE, 17, 23), 60, 24)).toBe(false);
    expect(withinHours(s, "nina", at(TUE, 18), 165, 8)).toBe(true);
    expect(withinHours(s, "nina", at(TUE, 18), 166, 8)).toBe(false);
  });

  it("closes a day off, and only that day", () => {
    const s = setup();
    nina(
      s,
      hours((av) => {
        av.off = [MON];
      }),
    );
    expect(withinHours(s, "nina", at(MON, 10), 60, 8)).toBe(false);
    expect(withinHours(s, "nina", at(TUE, 10), 60, 8)).toBe(true);
    // Somebody else's day off is not hers.
    expect(withinHours(s, "marcus", at(MON, 10), 60, 24)).toBe(true);
  });
});

describe("times offered to customers and the operator", () => {
  const open = (s: State) =>
    nina(
      s,
      hours((av) => {
        av.days.Tue = ["Morning", "Afternoon", "Evening"];
        av.days.Sat = ["Morning"];
      }),
    );
  const hourOf = (iso: string) => Number(torontoParts(new Date(iso)).hour);
  const dayOf = (iso: string) => torontoParts(new Date(iso)).weekday;

  it("offers no evening or weekend until a contractor opens them", () => {
    const s = setup();
    const all = slots(s, "nina", 60, "Oakville", undefined, "", 60);
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((x) => hourOf(x.start) >= 17)).toBe(false);
    expect(all.some((x) => ["Sat", "Sun"].includes(dayOf(x.start)))).toBe(
      false,
    );
    open(s);
    const more = slots(s, "nina", 60, "Oakville", undefined, "", 60);
    expect(more.some((x) => hourOf(x.start) >= 17)).toBe(true);
    expect(more.some((x) => dayOf(x.start) === "Sat")).toBe(true);
    // Daytime still comes first where both fit.
    expect(hourOf(more[0].start)).toBeLessThan(17);
  });

  it("holds the customer to what they asked for", () => {
    const s = setup();
    open(s);
    const ok = (start: string, timing: string, duration = 60) =>
      available(s, "nina", duration, "Oakville", start, undefined, timing);
    expect(ok(at(SAT, 10), "Any day · flexible")).toBe(true);
    expect(ok(at(SAT, 10), "Weekdays · flexible")).toBe(false);
    expect(ok(at(TUE, 18), "Weekdays · flexible")).toBe(true);
    expect(ok(at(TUE, 17), "Weekdays · 5–9 PM")).toBe(true);
    expect(ok(at(TUE, 15), "Weekdays · 5–9 PM")).toBe(false);
    expect(ok(at(TUE, 16), "Weekdays · 1–5 PM")).toBe(true);
    expect(ok(at(TUE, 16, 30), "Weekdays · 1–5 PM")).toBe(false);
    expect(ok(at(TUE, 12, 30), "Weekdays · 1–5 PM")).toBe(false);
    expect(ok(at(TUE, 11), "Weekdays · 9 AM–12 PM")).toBe(true);
    expect(ok(at(TUE, 11, 30), "Weekdays · 9 AM–12 PM")).toBe(false);
    expect(ok(at(TUE, 16), "Weekdays · 9 AM–5 PM · Flexible")).toBe(true);
    expect(ok(at(TUE, 16, 30), "Weekdays · 9 AM–5 PM · Flexible")).toBe(false);
  });
});

describe("hours in a line", () => {
  it("groups the days that share hours", () => {
    expect(hoursLabel(defaultAvailability())).toBe("Mon–Fri 9–5");
    expect(
      hoursLabel(
        hours((av) => {
          av.days.Tue = ["Morning", "Afternoon", "Evening"];
          av.days.Thu = ["Morning", "Afternoon", "Evening"];
          av.days.Sat = ["Morning"];
        }),
      ),
    ).toBe("Mon, Wed, Fri 9–5 · Tue, Thu 9–9 · Sat 9–12");
    expect(
      hoursLabel(
        hours((av) => {
          for (const d of ["Mon", "Tue", "Wed", "Thu"] as const)
            av.days[d] = ["Morning", "Evening"];
          av.days.Fri = [];
        }),
      ),
    ).toBe("Mon–Thu 9–12, 5–9");
    expect(
      hoursLabel(
        hours((av) => {
          av.days.Wed = av.days.Thu = av.days.Fri = [];
        }),
      ),
    ).toBe("Mon, Tue 9–5");
    expect(
      hoursLabel(
        hours((av) => {
          for (const d of Object.keys(av.days) as (keyof typeof av.days)[])
            av.days[d] = [];
        }),
      ),
    ).toBe("No hours set");
  });
});

/** Another visit and its assignment for an existing request. */
function job(
  s: State,
  o: {
    id: string;
    provider?: string;
    start: string;
    status?: string;
    visitStatus?: string;
    finishedAt?: string;
    pay?: number;
    duration?: number;
  },
) {
  const base = s.visits[0];
  s.visits.push({
    ...structuredClone(base),
    id: "v-" + o.id,
    providerId: o.provider ?? "nina",
    start: o.start,
    duration: o.duration ?? 60,
    travel: 8,
    status: o.visitStatus ?? "Confirmed",
    execution: o.finishedAt
      ? { finishedAt: o.finishedAt, outcomes: {} }
      : undefined,
  });
  s.assignments.push({
    id: o.id,
    visitId: "v-" + o.id,
    providerId: o.provider ?? "nina",
    status: o.status ?? "Accepted",
    pay: o.pay ?? 100,
    expiresAt: s.clock + 7200000,
  });
}

describe("changing hours", () => {
  it("withdraws open offers the new hours miss and keeps accepted jobs", () => {
    const s = setup();
    job(s, {
      id: "morning",
      start: at(MON, 10),
      status: "Offered",
      visitStatus: "Proposed",
    });
    job(s, {
      id: "afternoon",
      start: at(MON, 14),
      status: "Offered",
      visitStatus: "Proposed",
    });
    job(s, { id: "booked", start: at(WED, 10) });
    job(s, { id: "started", start: at(WED, 10), visitStatus: "In Progress" });
    job(s, { id: "fits", start: at(WED, 14) });
    job(s, { id: "theirs", provider: "marcus", start: at(WED, 10) });
    job(s, {
      id: "elsewhere",
      provider: "marcus",
      start: at(MON, 10),
      status: "Offered",
      visitStatus: "Proposed",
    });
    const r = setAvailability(
      s,
      "nina",
      hours((av) => {
        av.days.Mon = av.days.Wed = ["Afternoon"];
      }),
    );
    const a = (id: string) => s.assignments.find((x) => x.id === id)!;
    expect(r.withdrawn.map((x) => x.id)).toEqual(["morning"]);
    expect(a("morning")).toMatchObject({
      status: "Declined",
      declineReason: OUTSIDE_HOURS,
    });
    expect(a("afternoon").status).toBe("Offered");
    expect(a("elsewhere").status).toBe("Offered");
    expect(a("booked").status).toBe("Accepted");
    // Only work not yet started is shown as outside the new hours.
    expect(r.outside.map((x) => x.id)).toEqual(["booked"]);
    expect(outsideHours(s, "nina").map((x) => x.id)).toEqual(["booked"]);
    expect(
      s.notifications!.some(
        (n) => n.assignmentId === "morning" && n.kind === "declined",
      ),
    ).toBe(true);
    expect(
      s.events.some((e) =>
        e.text.startsWith("Nina Patel changed their hours · Mon, Wed 1–5"),
      ),
    ).toBe(true);
    // Saving again withdraws nothing more.
    expect(setAvailability(s, "nina", s.availability!.nina).withdrawn).toEqual(
      [],
    );
  });

  it("hands a withdrawn offer to the auto-reoffer, as any decline", () => {
    const s = migrateDispatch(seed());
    s.settings!.autoReofferDeclined = true;
    s.visits.find((v) => v.id === "v5")!.start = slots(
      s,
      "nina",
      90,
      "Oakville",
    )[0].start;
    setAvailability(
      s,
      "marcus",
      hours((av) => {
        for (const d of Object.keys(av.days) as (keyof typeof av.days)[])
          av.days[d] = [];
      }),
    );
    expect(s.assignments.find((a) => a.id === "a5")!.declineReason).toBe(
      OUTSIDE_HOURS,
    );
    expect(s.assignments.at(-1)).toMatchObject({
      providerId: "nina",
      status: "Offered",
    });
  });
});

describe("earnings", () => {
  it("starts the week on Monday, Toronto time", () => {
    // Sunday 11:30 p.m. in Toronto is already Monday in UTC.
    expect(weekOf(at("2026-10-18", 23, 30))).toBe(MON);
    expect(weekOf(at("2026-10-19", 0, 30))).toBe("2026-10-19");
    expect(weekOf(at(MON, 0))).toBe(MON);
  });

  it("counts finished work as earned and accepted work as upcoming", () => {
    const s = setup();
    s.clock = +localTime(TUE, 10);
    job(s, {
      id: "last",
      start: at("2026-10-07", 10),
      finishedAt: at("2026-10-07", 11, 30),
      pay: 100,
    });
    // Left unfinished, still paid as agreed.
    job(s, {
      id: "unfinished",
      start: at(MON, 10),
      finishedAt: at(MON, 11),
      pay: 80,
    });
    job(s, { id: "soon", start: at("2026-10-15", 10), pay: 90 });
    job(s, { id: "cancelled", start: at(WED, 10), visitStatus: "Cancelled" });
    job(s, { id: "declined", start: at(WED, 13), status: "Declined" });
    job(s, { id: "theirs", provider: "marcus", start: at(WED, 10) });
    const e = earnings(s, "nina", s.clock);
    expect(e.now).toBe(MON);
    expect(e.weeks.map((w) => w.start)).toEqual([MON, "2026-10-05"]);
    expect(e.weeks[0]).toMatchObject({ earned: 80, upcoming: 90 });
    expect(e.weeks[0].jobs.map((j) => j.assignmentId)).toEqual([
      "unfinished",
      "soon",
    ]);
    expect(e.weeks[1]).toMatchObject({
      earned: 100,
      upcoming: 0,
      payout: { day: "2026-10-16", paid: false },
    });
    expect(e.weeks[1].jobs[0]).toMatchObject({ pay: 100, done: true });
  });

  it("counts a job in the week it was finished", () => {
    const s = setup();
    s.clock = +localTime(TUE, 10);
    job(s, {
      id: "late",
      start: at("2026-10-09", 10),
      finishedAt: at(MON, 11),
      pay: 70,
    });
    const e = earnings(s, "nina", s.clock);
    expect(e.weeks.map((w) => w.start)).toEqual([MON]);
    expect(e.weeks[0]).toMatchObject({ earned: 70 });
  });

  it("pays a week the Friday after it", () => {
    const s = setup();
    job(s, {
      id: "last",
      start: at("2026-10-07", 10),
      finishedAt: at("2026-10-07", 11),
    });
    const paid = (clock: number) =>
      earnings(s, "nina", clock).weeks.find((w) => w.start === "2026-10-05")!
        .payout;
    expect(paid(+localTime("2026-10-16", 0) - 1).paid).toBe(false);
    expect(paid(+localTime("2026-10-16", 0)).paid).toBe(true);
  });

  it("always has this week, empty for someone with no work", () => {
    const e = earnings(setup(), "eli", +localTime(TUE, 10));
    expect(e.weeks).toEqual([
      {
        start: MON,
        earned: 0,
        upcoming: 0,
        jobs: [],
        payout: { day: "2026-10-23", paid: false },
      },
    ]);
  });

  it("names weeks plainly", () => {
    expect(weekLabel(MON, MON)).toBe("This week");
    expect(weekLabel("2026-10-05", MON)).toBe("Last week");
    expect(weekLabel("2026-10-19", MON)).toBe("Next week");
    expect(weekLabel("2026-09-21", MON)).toBe("Sep 21 – 27");
    expect(weekLabel("2026-09-28", MON)).toBe("Sep 28 – Oct 4");
  });
});
