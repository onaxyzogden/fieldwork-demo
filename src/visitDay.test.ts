import { describe, it, expect } from "vitest";
import { localTime, seed, timeLabel, type State, type Visit } from "./model";
import { trip, tripLabel } from "./dispatch";
import { todaysVisits, visitDayLine, visitDayState } from "./glance";
import { noticeTarget } from "./notifications";

/**
 * Trips on offers, visit-day lines and where a notice opens (ADR 066).
 */

const HOUR = 3600000;
const CITIES = ["Oakville", "Burlington", "Milton", "Mississauga"];

describe("the trip to a job", () => {
  it("knows every pair of cities, both ways, and about 5 km across town", () => {
    // One provider per home city.
    const from = { Oakville: "nina", Burlington: "marcus", Milton: "eli" };
    for (const [home, id] of Object.entries(from))
      for (const city of CITIES) {
        const t = trip(id, city);
        expect(t.from).toBe(home);
        if (home === city) expect(t.km).toBe(5);
        expect(t.km).toBeGreaterThan(0);
      }
    expect(trip("marcus", "Oakville").km).toBe(trip("nina", "Burlington").km);
    expect(trip("eli", "Oakville").km).toBe(trip("nina", "Milton").km);
  });

  it("reads as an estimate, and leaves out what it does not know", () => {
    expect(tripLabel("marcus", "Oakville", 24)).toBe(
      "About 24 min · 16 km from Burlington",
    );
    expect(tripLabel("nina", "Oakville", 8)).toBe(
      "About 8 min · 5 km from Oakville",
    );
    expect(tripLabel("nobody", "Oakville", 24)).toBe("About 24 min");
  });
});

/** The seed with one visit moved to 11:00 today, the clock at 9:00. */
function today() {
  const s = seed();
  const v = s.visits[0];
  const day = new Date(s.clock).toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
  });
  s.clock = +localTime(day, 9);
  v.start = localTime(day, 11).toISOString();
  return { s, v };
}

describe("visits today", () => {
  it("lists today's live visits only, earliest first", () => {
    const { s, v } = today();
    expect(todaysVisits(s, s.clock).map((x) => x.id)).toEqual([v.id]);
    // Another one earlier the same day comes first.
    const early: Visit = {
      ...structuredClone(v),
      id: "early",
      start: new Date(+new Date(v.start) - HOUR).toISOString(),
    };
    s.visits.push(early);
    expect(todaysVisits(s, s.clock).map((x) => x.id)).toEqual(["early", v.id]);
    // Not tomorrow, not cancelled, not on a cancelled request.
    early.start = new Date(+new Date(v.start) + 24 * HOUR).toISOString();
    expect(todaysVisits(s, s.clock).map((x) => x.id)).toEqual([v.id]);
    v.status = "Cancelled";
    expect(todaysVisits(s, s.clock)).toEqual([]);
    v.status = "Confirmed";
    s.requests.find((r) => r.id === v.requestId)!.status = "Cancelled";
    expect(todaysVisits(s, s.clock)).toEqual([]);
  });

  it("filters to whose visits they are", () => {
    const { s, v } = today();
    expect(todaysVisits(s, s.clock, (x) => x.id !== v.id)).toEqual([]);
  });
});

describe("the day's line for each state", () => {
  const at = (s: State, minutes: number) =>
    new Date(s.clock + minutes * 60000).toISOString();
  const who = (v: Visit) =>
    ({ nina: "Nina Patel", marcus: "Marcus Chen", yousef: "Yousef Haddad" })[
      v.providerId
    ] ?? "";

  it("counts down, then follows the visit to done", () => {
    const { s, v } = today();
    expect(visitDayState(v)).toBe("Scheduled");
    expect(visitDayLine(v, s.clock)).toBe(
      `Today: ${who(v)} arrives at 11:00 a.m. · in 2 h`,
    );
    // Past the start with nothing heard: no countdown left to show.
    expect(visitDayLine(v, s.clock + 3 * HOUR)).toBe(
      `Today: ${who(v)} arrives at 11:00 a.m.`,
    );
    v.execution = { onWayAt: at(s, 90), eta: at(s, 110), outcomes: {} };
    expect(visitDayState(v)).toBe("On the way");
    expect(visitDayLine(v, s.clock)).toBe(
      `${who(v)} is on the way · arriving around ${timeLabel(at(s, 110))}`,
    );
    v.execution.eta = at(s, 140);
    expect(visitDayState(v)).toBe("Running late");
    expect(visitDayLine(v, s.clock)).toBe(
      `Running late · ${who(v)} is arriving around ${timeLabel(at(s, 140))}`,
    );
    v.execution.startedAt = at(s, 140);
    expect(visitDayLine(v, s.clock)).toBe(
      `Work in progress · started ${timeLabel(at(s, 140))}`,
    );
    v.execution.finishedAt = at(s, 200);
    expect(visitDayState(v)).toBe("Done");
    expect(visitDayLine(v, s.clock)).toBe(
      `Done · finished ${timeLabel(at(s, 200))}`,
    );
    v.execution.outcomes[v.taskIds[0]] = {
      outcome: "Materials required",
      note: "x",
      before: [],
      after: [],
    };
    expect(visitDayState(v)).toBe("Unfinished");
    expect(visitDayLine(v, s.clock)).toMatch(
      /^Visit finished at .+ · see your booking/,
    );
  });
});

describe("where a notice opens", () => {
  const n = (kind: string, visitId = "", chargeId?: string) => ({
    kind,
    visitId,
    ...(chargeId ? { chargeId } : {}),
  });

  it("takes the operator to the decision, the visit, the conversation or the question", () => {
    for (const kind of [
      "request",
      "offer",
      "accepted",
      "declined",
      "quote",
      "payment",
    ])
      expect(noticeTarget(n(kind, "v"), "Operator")).toBe("decision");
    expect(noticeTarget(n("visit", "v"), "Operator")).toBe("visit");
    expect(noticeTarget(n("work-way", "v"), "Operator")).toBe("visit");
    expect(noticeTarget(n("message", "v"), "Operator")).toBe("messages");
    expect(noticeTarget(n("information"), "Operator")).toBe("question");
  });

  it("takes the customer to the quote, the charge, the visit, the conversation, the question or the booking", () => {
    expect(noticeTarget(n("quote"), "Customer")).toBe("quote");
    expect(noticeTarget(n("quote", "", "c"), "Customer")).toBe("charge");
    expect(noticeTarget(n("payment"), "Customer")).toBe("quote");
    expect(noticeTarget(n("payment", "v"), "Customer")).toBe("visit");
    expect(noticeTarget(n("visit", "v"), "Customer")).toBe("visit");
    expect(noticeTarget(n("message", "v"), "Customer")).toBe("messages");
    expect(noticeTarget(n("information"), "Customer")).toBe("question");
    expect(noticeTarget(n("request"), "Customer")).toBe("booking");
    expect(noticeTarget(n("request", "v"), "Customer")).toBe("visit");
  });

  it("opens the job for a contractor, or its conversation", () => {
    for (const kind of ["offer", "visit", "work-start", "request"])
      expect(noticeTarget(n(kind, "v"), "Contractor")).toBe("job");
    expect(noticeTarget(n("message", "v"), "Contractor")).toBe("messages");
  });
});
