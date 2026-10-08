import { describe, it, expect } from "vitest";
import { accounts, seed, type State, type Visit } from "./model";
import {
  addFinding,
  convertApproved,
  createWalkthrough,
  findingState,
  findingsFor,
  seedWalkthroughs,
  sendWalkthrough,
} from "./pmw";
import { dayKey } from "./work";
import {
  contractorGlance,
  customerGlance,
  tabWork,
  walkthroughGlance,
} from "./glance";

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
    expect(mine.inProgress + theirs.inProgress).toBeLessThanOrEqual(
      s.requests.filter((r) => r.status !== "Draft").length,
    );
    expect(customerGlance(s, "no-such-account", s.clock)).toMatchObject({
      waiting: 0,
      upcoming: 0,
      inProgress: 0,
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

  it("does not count a proposed, unconfirmed time as upcoming (ADR 070)", () => {
    const s = seed();
    const id = account(s);
    const r = s.requests.find((r) => r.accountId === id)!;
    s.visits.push({
      id: "offered",
      requestId: r.id,
      taskIds: [],
      providerId: "marcus",
      start: new Date(s.clock + DAY).toISOString(),
      duration: 60,
      status: "Proposed",
      travel: 5,
    });
    const g = customerGlance(s, id, s.clock);
    expect(g.upcoming).toBe(0);
    expect(g.next).toBe(null);
    expect(g.scheduledIds).not.toContain(r.id);
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
    const before = customerGlance(s, id, s.clock).inProgress;
    draft.status = "Draft";
    expect(customerGlance(s, id, s.clock).inProgress).toBe(before - 1);
  });

  it("counts one job once, not once per number", () => {
    // The reported defect: a customer with a single booked job read
    // "1 upcoming visit" AND "1 open request". The three buckets are
    // disjoint now, and this asserts it rather than describing it.
    const s = seed();
    const id = account(s);
    const r = s.requests.find((r) => r.accountId === id)!;
    s.requests = s.requests.filter((x) => x.accountId !== id || x.id === r.id);
    s.visits.push({
      id: "booked",
      requestId: r.id,
      taskIds: [],
      providerId: "marcus",
      start: new Date(s.clock + DAY).toISOString(),
      duration: 60,
      status: "Confirmed",
      travel: 5,
    });
    const g = customerGlance(s, id, s.clock);
    expect(g.upcoming).toBe(1);
    expect(g.inProgress).toBe(0);
    expect(g.waiting).toBe(0);
  });

  it("puts no request in two buckets, whatever its status", () => {
    // Every status reconcile() can produce, against a request that does and
    // does not carry a visit. Disjointness is a property of the pair of sets,
    // so checking it once per status beats checking one lucky example.
    const statuses = [
      "Submitted",
      "Needs Review",
      "Information requested",
      "Awaiting Quote Approval",
      "Awaiting Payment",
      "Awaiting Provider Acceptance",
      "Confirmed",
      "Completed",
      "Cancelled",
      "Declined",
    ];
    for (const withVisit of [false, true]) {
      for (const status of statuses) {
        const s = seed();
        const id = account(s);
        const r = s.requests.find((r) => r.accountId === id)!;
        s.requests = s.requests.filter(
          (x) => x.accountId !== id || x.id === r.id,
        );
        r.status = status;
        if (withVisit)
          s.visits.push({
            id: "v",
            requestId: r.id,
            taskIds: [],
            providerId: "marcus",
            start: new Date(s.clock + DAY).toISOString(),
            duration: 60,
            status: "Confirmed",
            travel: 5,
          });
        const g = customerGlance(s, id, s.clock);
        const where = `${status}${withVisit ? " with a visit" : ""}`;
        const overlap = (a: string[], b: string[]) =>
          a.filter((x) => b.includes(x));
        // A request that is over does not belong to any bucket.
        if (["Completed", "Cancelled", "Declined"].includes(status))
          expect([g.waiting, g.upcoming, g.inProgress].join(), where).toBe(
            "0,0,0",
          );
        expect(overlap(g.waitingIds, g.inProgressIds), where).toEqual([]);
        expect(overlap(g.scheduledIds, g.inProgressIds), where).toEqual([]);
        // and every count is exactly the length of the ids behind it
        expect(g.inProgress, where).toBe(g.inProgressIds.length);
        expect(g.waiting, where).toBe(
          g.waitingIds.length + g.assessmentIds.length,
        );
      }
    }
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

describe("the walkthrough pipeline's glance", () => {
  /** A clean slate with one sent assessment of `n` priced findings. */
  function sent(n = 2) {
    const s = seed();
    s.walkthroughs = [];
    s.findings = [];
    const w = createWalkthrough(s, s.properties[0].id);
    for (let i = 0; i < n; i++)
      addFinding(s, w.id, { title: `Finding ${i + 1}`, price: 100 });
    sendWalkthrough(s, w.id);
    return { s, w };
  }
  const bucketOf = (s: State, id: string) => {
    const g = walkthroughGlance(s, s.clock);
    return [
      g.draftIds.includes(id) && "draft",
      g.withCustomerIds.includes(id) && "with customer",
      g.readyToConvertIds.includes(id) && "ready to convert",
    ].filter(Boolean);
  };

  it("puts a draft under Drafts and nowhere else", () => {
    const s = seed();
    s.walkthroughs = [];
    const w = createWalkthrough(s, s.properties[0].id);
    expect(bucketOf(s, w.id)).toEqual(["draft"]);
  });

  it("puts an undecided sent assessment with the customer", () => {
    const { s, w } = sent();
    expect(bucketOf(s, w.id)).toEqual(["with customer"]);
  });

  it("puts a part-approved assessment under Ready to convert, not both", () => {
    // Conversion works per approval, so the approved half is actionable now
    // even while the other finding is still undecided.
    const { s, w } = sent(2);
    findingsFor(s, w.id)[0].decision = "Approved";
    expect(bucketOf(s, w.id)).toEqual(["ready to convert"]);
  });

  it("drops an assessment out once converted", () => {
    const { s, w } = sent(1);
    findingsFor(s, w.id)[0].decision = "Approved";
    convertApproved(s, w.id);
    expect(w.status).toBe("Converted");
    expect(bucketOf(s, w.id)).toEqual([]);
  });

  it("keeps a converted walkthrough out even with a finding still undecided", () => {
    // Conversion flips the walkthrough to Converted while a second finding can
    // still be pending. It is history to the pipeline: the page it would open
    // offers "Open the request", not anything about the undecided finding.
    const { s, w } = sent(2);
    findingsFor(s, w.id)[0].decision = "Approved";
    convertApproved(s, w.id);
    expect(w.status).toBe("Converted");
    expect(findingState(s, findingsFor(s, w.id)[1])).toBe("Pending decision");
    expect(bucketOf(s, w.id)).toEqual([]);
  });

  it("counts nobody as owing anything when every finding was deferred", () => {
    const { s, w } = sent(2);
    findingsFor(s, w.id).forEach((f) => (f.decision = "Not Now"));
    expect(bucketOf(s, w.id)).toEqual([]);
  });

  it("chases the oldest undecided assessment and reports whether it was opened", () => {
    const { s, w: newer } = sent();
    const older = createWalkthrough(s, s.properties[0].id);
    addFinding(s, older.id, { title: "Old", price: 50 });
    sendWalkthrough(s, older.id);
    older.sentAt = new Date(s.clock - 5 * DAY).toISOString();
    newer.sentAt = new Date(s.clock - 1 * DAY).toISOString();
    let g = walkthroughGlance(s, s.clock);
    expect(g.chase?.walkthrough.id).toBe(older.id);
    expect(g.chase?.daysSent).toBe(5);
    expect(g.chase?.opens).toBe(0);
    older.access!.opens.push(new Date(s.clock).toISOString());
    g = walkthroughGlance(s, s.clock);
    expect(g.chase?.opens).toBe(1);
  });

  it("never puts one walkthrough in two buckets, whatever its findings say", () => {
    const decisions = ["Pending", "Approved", "Not Now"] as const;
    for (const a of decisions)
      for (const b of decisions) {
        const { s, w } = sent(2);
        const [f1, f2] = findingsFor(s, w.id);
        f1.decision = a;
        f2.decision = b;
        expect(bucketOf(s, w.id).length, `${a} + ${b}`).toBeLessThanOrEqual(1);
      }
  });
});
