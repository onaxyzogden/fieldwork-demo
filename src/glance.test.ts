import { describe, it, expect } from "vitest";
import { accounts, seed, type State, type Visit } from "./model";
import {
  addFinding,
  createWalkthrough,
  findingState,
  findingsFor,
  seedWalkthroughs,
  sendWalkthrough,
} from "./pmw";
import { dayKey } from "./work";
import { contractorGlance, customerGlance, tabWork } from "./glance";

const DAY = 24 * 60 * 60 * 1000;

function job(
  s: State,
  id: string,
  start: number,
  status: string,
  execution?: Visit["execution"],
) {
  const r = s.requests.find((r) => r.status !== "Draft")!;
  s.visits.push({
    id,
    requestId: r.id,
    taskIds: [],
    providerId: "marcus",
    start: new Date(start).toISOString(),
    duration: 60,
    status: "Confirmed",
    travel: 5,
    ...(execution ? { execution } : {}),
  });
  s.assignments.push({
    id: id + "-a",
    visitId: id,
    providerId: "marcus",
    status,
    pay: 100,
    expiresAt: s.clock + DAY,
  });
  return r;
}

describe("the contractor's glance", () => {
  it("counts exactly what each tab will show", () => {
    const s = seed();
    s.assignments = [];
    job(s, "v-today", s.clock, "Accepted");
    job(s, "v-later", s.clock + 3 * DAY, "Accepted");
    job(s, "v-offer", s.clock + 2 * DAY, "Offered");
    const g = contractorGlance(s, "marcus", s.clock);
    // The whole reason to prefer these three numbers: a count that promises a
    // list has to be that list, not a second opinion about it.
    expect(g.offers).toBe(tabWork(s, "marcus", "Offers", s.clock).length);
    expect(g.today).toBe(tabWork(s, "marcus", "Today", s.clock).length);
    expect(g.upcoming).toBe(tabWork(s, "marcus", "Upcoming", s.clock).length);
    expect([g.offers, g.today, g.upcoming]).toEqual([1, 1, 1]);
  });

  it("keeps an overrunning job in Today and out of Upcoming", () => {
    const s = seed();
    s.assignments = [];
    job(s, "v-run", s.clock - 2 * DAY, "Accepted", {
      startedAt: new Date(s.clock - 2 * DAY).toISOString(),
      outcomes: {},
    });
    const g = contractorGlance(s, "marcus", s.clock);
    expect(g.today).toBe(1);
    expect(g.upcoming).toBe(0);
    expect(
      tabWork(s, "marcus", "Today", s.clock).map((a) => a.visitId),
    ).toEqual(["v-run"]);
  });

  it("keeps a job started ahead of its date out of Upcoming", () => {
    // The case the exclusion actually exists for. A job merely overrunning is
    // already in the past, so dropping `&& !running` does not change it — this
    // is the one that proves the rule is load-bearing.
    const s = seed();
    s.assignments = [];
    job(s, "v-early", s.clock + DAY, "Accepted", {
      startedAt: new Date(s.clock).toISOString(),
      outcomes: {},
    });
    const g = contractorGlance(s, "marcus", s.clock);
    expect(g.today).toBe(1);
    expect(g.upcoming).toBe(0);
  });

  it("names the next accepted job, and nothing when there is none", () => {
    const s = seed();
    s.assignments = [];
    job(s, "v-far", s.clock + 5 * DAY, "Accepted");
    job(s, "v-near", s.clock + 1 * DAY, "Accepted");
    expect(contractorGlance(s, "marcus", s.clock).next?.visit.id).toBe(
      "v-near",
    );
    const empty = seed();
    empty.assignments = [];
    expect(contractorGlance(empty, "marcus", empty.clock).next).toBe(null);
  });

  it("gives a contractor with nothing three zeroes rather than failing", () => {
    const s = seed();
    s.assignments = [];
    expect(contractorGlance(s, "nobody", s.clock)).toMatchObject({
      offers: 0,
      today: 0,
      upcoming: 0,
      next: null,
    });
  });

  it("counts only this contractor's work", () => {
    const s = seed();
    s.assignments = [];
    job(s, "v-mine", s.clock, "Accepted");
    expect(contractorGlance(s, "marcus", s.clock).today).toBe(1);
    expect(contractorGlance(s, "nina", s.clock).today).toBe(0);
  });
});

describe("the customer's glance", () => {
  const account = (s: State) =>
    s.requests.find((r) => r.status !== "Draft")!.accountId;

  it("counts a request as waiting only in the states that need the customer", () => {
    const s = seed();
    const id = account(s);
    const own = s.requests.filter((r) => r.accountId === id);
    own.forEach((r) => (r.status = "Needs Review"));
    expect(customerGlance(s, id, s.clock).waiting).toBe(0);
    own[0].status = "Awaiting Quote Approval";
    expect(customerGlance(s, id, s.clock).waiting).toBe(1);
    own[0].status = "Awaiting Payment";
    expect(customerGlance(s, id, s.clock).waiting).toBe(1);
    own[0].status = "Information requested";
    expect(customerGlance(s, id, s.clock).waiting).toBe(1);
  });

  it("counts a sent assessment still holding an undecided finding", () => {
    const s = seed();
    seedWalkthroughs(s);
    const property = s.properties[0];
    const id = property.accountId;
    const before = customerGlance(s, id, s.clock).waiting;

    // Built rather than found: depending on what the seed happens to ship is
    // how a test quietly stops asserting anything.
    const w = createWalkthrough(s, property.id);
    addFinding(s, w.id, { title: "Loose railing", price: 200 });
    sendWalkthrough(s, w.id);
    expect(w.status).toBe("Sent");
    expect(findingsFor(s, w.id).map((f) => findingState(s, f))).toEqual([
      "Pending decision",
    ]);
    expect(customerGlance(s, id, s.clock).waiting).toBe(before + 1);

    // Decided, and it stops waiting on anyone.
    findingsFor(s, w.id).forEach((f) => (f.decision = "Not Now"));
    expect(customerGlance(s, id, s.clock).waiting).toBe(before);
  });

  it("never counts another account's requests or visits", () => {
    const s = seed();
    const id = account(s);
    const other = accounts.find((a) => a.id !== id)!.id;
    const mine = customerGlance(s, id, s.clock);
    const theirs = customerGlance(s, other, s.clock);
    expect(mine.open + theirs.open).toBeLessThanOrEqual(
      s.requests.filter((r) => r.status !== "Draft").length,
    );
    expect(customerGlance(s, "no-such-account", s.clock)).toMatchObject({
      waiting: 0,
      upcoming: 0,
      open: 0,
      next: null,
    });
  });

  it("counts a future visit as upcoming and a finished one as not", () => {
    const s = seed();
    const id = account(s);
    const r = s.requests.find((r) => r.accountId === id)!;
    s.visits.push({
      id: "cv",
      requestId: r.id,
      taskIds: [],
      providerId: "marcus",
      start: new Date(s.clock + DAY).toISOString(),
      duration: 60,
      status: "Confirmed",
      travel: 5,
    });
    expect(customerGlance(s, id, s.clock).upcoming).toBe(1);
    expect(customerGlance(s, id, s.clock).next?.visit.id).toBe("cv");
    s.visits.find((v) => v.id === "cv")!.execution = {
      finishedAt: new Date(s.clock).toISOString(),
      outcomes: {},
    };
    expect(customerGlance(s, id, s.clock).upcoming).toBe(0);
    s.visits.find((v) => v.id === "cv")!.execution = undefined;
    s.visits.find((v) => v.id === "cv")!.status = "Cancelled";
    expect(customerGlance(s, id, s.clock).upcoming).toBe(0);
  });

  it("does not count a visit that has already started today as upcoming", () => {
    const s = seed();
    const id = account(s);
    const r = s.requests.find((r) => r.accountId === id)!;
    s.visits.push({
      id: "past",
      requestId: r.id,
      taskIds: [],
      providerId: "marcus",
      start: new Date(s.clock - 60 * 60 * 1000).toISOString(),
      duration: 60,
      status: "Confirmed",
      travel: 5,
    });
    expect(customerGlance(s, id, s.clock).upcoming).toBe(0);
  });

  it("leaves drafts out of every count", () => {
    const s = seed();
    const id = account(s);
    const draft = s.requests.find((r) => r.accountId === id)!;
    const open = customerGlance(s, id, s.clock).open;
    draft.status = "Draft";
    expect(customerGlance(s, id, s.clock).open).toBe(open - 1);
  });

  it("agrees with dayKey about what 'today' is for the contractor", () => {
    const s = seed();
    s.assignments = [];
    job(s, "v-edge", s.clock, "Accepted");
    const v = s.visits.find((v) => v.id === "v-edge")!;
    expect(dayKey(v.start)).toBe(dayKey(s.clock));
    expect(contractorGlance(s, "marcus", s.clock).today).toBe(1);
  });
});
