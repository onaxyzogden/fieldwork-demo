import { describe, it, expect } from "vitest";
import { seed, reconcile, providers, type State } from "./model";
import { reoffer, respondToOffer } from "./dispatch";
import {
  approveScope,
  decisionQueue,
  issueQuote,
  nextDecision,
  offerVisit,
  suggestPay,
  suggestQuote,
} from "./decisions";

const tasksOf = (s: State, id: string) =>
  s.tasks.filter((t) => t.requestId === id && !t.mergedInto);

/** Take the suggested offer on an assign decision, as the queue's button does. */
function takeOffer(s: State, requestId: string, self = false) {
  const d = nextDecision(s, requestId);
  if (d?.kind !== "assign") throw new Error("not an assign decision");
  const o = self ? d.self! : d.offer!;
  const v = offerVisit(s, {
    requestId,
    taskIds: d.taskIds,
    providerId: o.providerId,
    start: o.start,
    travel: o.travel,
    duration: d.duration,
    pay: o.pay,
    opKey: "k-" + requestId + (self ? "-self" : ""),
  });
  reconcile(s);
  return v;
}

describe("the operator's next decision", () => {
  it("queues every request the operator has to act on, and nothing else", () => {
    const s = seed();
    expect(decisionQueue(s).map((q) => [q.requestId, q.decision.kind])).toEqual(
      [
        ["r2", "assign"],
        ["r3", "assign"],
        ["r4", "review"],
        ["r6", "review"],
      ],
    );
    expect(nextDecision(s, "r1")).toBeNull(); // a draft
    expect(nextDecision(s, "r5")).toBeNull(); // waiting on a contractor
  });

  it("approves a request's whole scope in one go and moves it on", () => {
    const s = seed();
    expect(approveScope(s, "r4")).toBe(1);
    expect(tasksOf(s, "r4").every((t) => t.reviewed)).toBe(true);
    expect(
      s.events.some(
        (e) => e.requestId === "r4" && e.field === "reviewed" && e.to === "yes",
      ),
    ).toBe(true);
    expect(nextDecision(s, "r4")?.kind).toBe("assign");
    expect(approveScope(s, "r4")).toBe(0);
  });

  it("says plainly when no contractor can take every task", () => {
    const s = seed();
    approveScope(s, "r6");
    const d = nextDecision(s, "r6");
    expect(d?.kind).toBe("assign");
    expect(d?.kind === "assign" && d.offer).toBeUndefined();
  });

  it("offers nobody when nobody has a free time for the job", () => {
    const s = seed();
    // Longer than any working day, so no contractor and no operator slot fits.
    tasksOf(s, "r2").forEach((t) => (t.duration = 2000));
    const d = nextDecision(s, "r2");
    expect(d?.kind).toBe("assign");
    expect(d?.kind === "assign" && [d.offer, d.self]).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("suggests pay at the contractor's rate for the job, and refuses less", () => {
    const s = seed();
    const d = nextDecision(s, "r2");
    if (d?.kind !== "assign" || !d.offer) throw new Error("expected an offer");
    const rate = providers.find((p) => p.id === d.offer!.providerId)!.rate;
    expect(d.offer.pay).toBe(Math.ceil((rate * d.duration) / 60));
    expect(suggestPay("yousef", 240)).toBe(0);
    const base = {
      requestId: "r2",
      taskIds: d.taskIds,
      providerId: d.offer.providerId,
      start: d.offer.start,
      travel: d.offer.travel,
      duration: d.duration,
      opKey: "low",
    };
    expect(offerVisit(s, { ...base, pay: d.offer.pay - 1 })).toBeNull();
    expect(s.visits.some((v) => v.requestId === "r2")).toBe(false);
    const v = offerVisit(s, { ...base, pay: d.offer.pay, opKey: "ok" });
    expect(v).not.toBeNull();
    expect(
      s.assignments.filter((a) => a.visitId === v!.id).map((a) => a.status),
    ).toEqual(["Offered"]);
    // The same press twice books one visit and one offer.
    offerVisit(s, { ...base, pay: d.offer.pay, opKey: "ok" });
    expect(s.assignments.filter((a) => a.visitId === v!.id)).toHaveLength(1);
    reconcile(s);
    expect(nextDecision(s, "r2")).toBeNull(); // now waiting on the contractor
  });

  it("asks for the quote once the work is accepted, at the suggested price", () => {
    const s = seed();
    takeOffer(s, "r3", true); // doing it yourself is accepted at once
    const d = nextDecision(s, "r3");
    expect(d).toEqual({
      kind: "quote",
      amount: suggestQuote(tasksOf(s, "r3")),
    });
    expect(
      issueQuote(s, "r3", {
        type: "Fixed price",
        amount: 0,
        payOnCompletion: false,
      }),
    ).toBe(false);
    expect(
      issueQuote(s, "r3", {
        type: "Fixed price",
        amount: (d as { amount: number }).amount,
        payOnCompletion: false,
      }),
    ).toBe(true);
    reconcile(s);
    expect(nextDecision(s, "r3")).toBeNull(); // waiting on the customer
    const q = s.quotes.find(
      (q) => q.requestId === "r3" && q.status !== "Superseded",
    )!;
    q.status = "Declined";
    reconcile(s);
    expect(nextDecision(s, "r3")).toEqual({
      kind: "revise",
      quoteId: q.id,
      amount: q.amount,
    });
    issueQuote(s, "r3", {
      type: "Fixed price",
      amount: 300,
      payOnCompletion: false,
    });
    expect(
      s.quotes.filter((x) => x.requestId === "r3" && x.status !== "Superseded"),
    ).toHaveLength(1);
  });

  it("puts a declined offer first, with a replacement at no less than the floor", () => {
    const s = seed();
    s.settings = { autoReofferDeclined: false };
    const v = takeOffer(s, "r3")!;
    const offer = s.assignments.find((a) => a.visitId === v.id)!;
    offer.pay = 999; // a generous first offer is not cut on the re-offer
    respondToOffer(s, offer.id, "Declined", "Too far");
    // r2 is older, so only urgency can put r3 first.
    s.events.push({
      id: "old",
      text: "r2 raised",
      at: "2020-01-01T00:00:00.000Z",
      requestId: "r2",
    });
    reconcile(s);
    const d = nextDecision(s, "r3");
    expect(d?.kind).toBe("reassign");
    if (d?.kind !== "reassign" || !d.offer)
      throw new Error("expected an offer");
    expect(d.expired).toBe(false);
    expect(d.previousProviderId).toBe(offer.providerId);
    expect(d.offer.providerId).not.toBe(offer.providerId);
    expect(d.offer.providerId).not.toBe("yousef");
    expect(d.offer.pay).toBe(999);
    expect(d.offer.pay).toBeGreaterThanOrEqual(d.offer.minimumPay);
    expect(d.offer.pay).toBeGreaterThanOrEqual(offer.pay);
    expect(decisionQueue(s)[0]).toEqual({ requestId: "r3", decision: d });
  });

  it("never suggests the operator as the replacement, only offers it", () => {
    const s = seed();
    s.settings = { autoReofferDeclined: false };
    const v = takeOffer(s, "r2")!;
    const offer = s.assignments.find((a) => a.visitId === v.id)!;
    respondToOffer(s, offer.id, "Declined", "Too far");
    reconcile(s);
    const d = nextDecision(s, "r2");
    if (d?.kind !== "reassign") throw new Error("expected a reassignment");
    // Nobody else can take this job, but the operator is free.
    expect(d.offer).toBeUndefined();
    expect(d.self).toMatchObject({ providerId: "yousef", pay: 0 });
    expect(reoffer(s, d.visitId, "yousef", d.self!.start, 0)).toBe(true);
    reconcile(s);
    expect(nextDecision(s, "r2")?.kind).toBe("quote");
  });

  it("puts a finished job with an unresolved task first, as a follow-up", () => {
    const s = seed();
    const v = takeOffer(s, "r3", true)!;
    issueQuote(s, "r3", {
      type: "Fixed price",
      amount: 200,
      payOnCompletion: true,
    });
    reconcile(s);
    const task = v.taskIds[0];
    v.execution = {
      startedAt: new Date(s.clock).toISOString(),
      finishedAt: new Date(s.clock).toISOString(),
      outcomes: {
        [task]: {
          outcome: "Materials required",
          note: "Longer bracket",
          before: [],
          after: [],
        },
      },
    };
    v.status = "Completed";
    reconcile(s);
    const d = nextDecision(s, "r3");
    expect(d?.kind).toBe("follow-up");
    expect(decisionQueue(s)[0].requestId).toBe("r3");
  });

  it("orders the rest oldest first by their earliest event", () => {
    const s = seed();
    s.events.push(
      {
        id: "e1",
        text: "r6 raised",
        at: "2020-01-01T00:00:00.000Z",
        requestId: "r6",
      },
      {
        id: "e2",
        text: "r4 raised",
        at: "2020-01-02T00:00:00.000Z",
        requestId: "r4",
      },
    );
    expect(decisionQueue(s).map((q) => q.requestId)).toEqual([
      "r6",
      "r4",
      "r2",
      "r3",
    ]);
  });

  it("prices from the work's length, never under the call-out minimum", () => {
    const at = (minutes: number) =>
      suggestQuote([{ duration: minutes }] as never);
    expect(at(0)).toBe(95);
    expect(at(30)).toBe(105);
    expect(at(240)).toBe(525);
  });

  it("leaves out a request waiting on the customer, whatever is left on it", () => {
    const s = seed();
    s.requests.find((r) => r.id === "r2")!.operatorNote =
      "Which floor is it on?";
    reconcile(s);
    expect(nextDecision(s, "r2")?.kind).toBe("assign");
    expect(decisionQueue(s).map((q) => q.requestId)).not.toContain("r2");
  });
});
