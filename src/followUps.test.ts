import { describe, it, expect } from "vitest";
import { approveQuote, reconcile, uid, type State, type Visit } from "./model";
import { freshDemo } from "./store";
import { payQuote, readyToPay } from "./payments";
import { deliverUpdates, inbox } from "./notifications";
import { bucket, workIssue } from "./work";
import { customerQueue } from "./roleQueues";
import {
  refundLeft,
  approveCharge,
  approveScope,
  bookReturnVisit,
  closeTask,
  declineCharge,
  issueQuote,
  nextDecision,
  offerVisit,
  refundShare,
  requestExtraCharge,
  returnOptions,
  returnPay,
  suggestPay,
  tellCustomerLate,
} from "./decisions";

/**
 * Follow-ups solved (ADR 065): every task a visit left undone gets a return
 * visit or is closed as not done, and a late arrival gets the customer told.
 */

const HOUR = 3600000;

/** r2 (four tasks) booked with a contractor, quoted at $400, paid, and the
 *  visit finished with these outcomes, in task order; the rest Completed. */
function finished(outcomes: string[] = []) {
  const s = freshDemo();
  approveScope(s, "r2");
  const d = nextDecision(s, "r2");
  if (d?.kind !== "assign" || !d.offer) throw new Error("expected an offer");
  const v = offerVisit(s, {
    requestId: "r2",
    taskIds: d.taskIds,
    ...d.offer,
    duration: d.duration,
    opKey: "k",
  })!;
  for (const a of s.assignments)
    if (a.visitId === v.id && a.status === "Offered") a.status = "Accepted";
  issueQuote(s, "r2", {
    type: "Manual quote",
    amount: 400,
    payOnCompletion: false,
  });
  const q = s.quotes.find((x) => x.requestId === "r2" && x.status === "Sent")!;
  expect(approveQuote(s, q.id)).toBe(true);
  expect(payQuote(s, q.id)).toBe(true);
  reconcile(s);
  expect(r2(s).status).toBe("Confirmed");
  const at = new Date(s.clock).toISOString();
  v.execution = {
    startedAt: at,
    finishedAt: at,
    outcomes: Object.fromEntries(
      v.taskIds.map((id, i) => [
        id,
        {
          outcome: outcomes[i] ?? "Completed",
          note: "Hinge is cracked",
          before: [],
          after: [],
        },
      ]),
    ),
  };
  v.status = "Completed";
  reconcile(s);
  return { s, v, ids: v.taskIds };
}

const r2 = (s: State) => s.requests.find((r) => r.id === "r2")!;
const task = (s: State, id: string) => s.tasks.find((t) => t.id === id)!;
const paid = (s: State) =>
  s.payments.filter((p) =>
    s.quotes.some((q) => q.id === p.quoteId && q.requestId === "r2"),
  );
const later = (s: State) =>
  returnOptions(s, "r2", r2Unfinished(s)).offer ?? null;
const r2Unfinished = (s: State) => {
  const d = nextDecision(s, "r2");
  return d?.kind === "follow-up" ? d.tasks.map((t) => t.taskId) : [];
};

describe("what a visit leaves undone (ADR 065)", () => {
  it("stays the operator's until each task is decided", () => {
    const { s, v, ids } = finished(["Materials required", "Customer declined"]);
    expect(task(s, ids[0]).status).toBe("unassigned");
    expect(task(s, ids[2]).status).toBe("Completed");
    expect(r2(s).status).not.toBe("Completed");
    expect(bucket(s, "r2")).toBe("Needs Action");
    const d = nextDecision(s, "r2");
    if (d?.kind !== "follow-up") throw new Error("expected a follow-up");
    expect(d.visitId).toBe(v.id);
    expect(d.tasks.map((t) => [t.outcome, t.action])).toEqual([
      ["Materials required", "return"],
      ["Customer declined", "close"],
    ]);
    // The return is suggested for the tasks coming back, not the declined one.
    expect(d.offer?.providerId).toBe(v.providerId);
    expect(d.offer?.pay).toBe(returnPay(s, v.providerId, [ids[0]]));
  });

  it("suggests each task's share of what was paid as its refund", () => {
    const { s, ids } = finished(["Customer declined"]);
    const minutes = s.tasks
      .filter((t) => t.requestId === "r2")
      .reduce((n, t) => n + t.duration, 0);
    expect(refundShare(s, ids[0])).toBe(
      Math.round((400 * task(s, ids[0]).duration) / minutes),
    );
    expect(refundShare(s, "nope")).toBe(0);
    // No quote, no share.
    s.quotes = s.quotes.filter((q) => q.requestId !== "r2");
    expect(refundShare(s, ids[0])).toBe(0);
  });

  it("refunds only from the work's payments, not a fee or a charge", () => {
    const { s } = finished(["Customer declined"]);
    const quoteId = paid(s)[0].quoteId;
    expect(refundLeft(s, "r2")).toBe(400);
    for (const extra of [{ fee: true }, { chargeId: "c" }])
      s.payments.push({
        id: uid(),
        quoteId,
        status: "Paid",
        amount: 45,
        reference: "x",
        ...extra,
      });
    expect(refundLeft(s, "r2")).toBe(400);
  });

  it("pays a second trip at the contractor's rate, and finishing what they could not at $0", () => {
    const { s, v, ids } = finished([
      "Materials required",
      "Unable to complete",
    ]);
    expect(returnPay(s, v.providerId, [ids[0]])).toBe(
      suggestPay(v.providerId, task(s, ids[0]).duration),
    );
    expect(returnPay(s, v.providerId, [ids[1]])).toBe(0);
    expect(returnPay(s, "yousef", [ids[0]])).toBe(0);
  });
});

describe("which follow-up comes first", () => {
  it("puts unfinished work before a late arrival on the same request", () => {
    const { s, v, ids } = finished(["Materials required"]);
    s.visits.push({
      ...structuredClone(v),
      id: "late",
      start: new Date(s.clock + HOUR).toISOString(),
      status: "Confirmed",
      execution: {
        eta: new Date(s.clock + 2 * HOUR).toISOString(),
        outcomes: {},
      },
    });
    s.visits.reverse();
    const d = nextDecision(s, "r2");
    if (d?.kind !== "follow-up") throw new Error("expected a follow-up");
    expect(d.visitId).toBe(v.id);
    expect(d.tasks.map((t) => t.taskId)).toEqual([ids[0]]);
  });

  it("forgets a declined charge once its tasks are decided", () => {
    const { s, ids } = finished(["Materials required", "Customer declined"]);
    const o = later(s)!;
    const c = requestExtraCharge(s, "r2", {
      amount: 45,
      reason: "Hinge",
      taskIds: [ids[0]],
      plan: { ...o, duration: 60 },
    })!;
    declineCharge(s, c.id);
    closeTask(s, ids[0], 0);
    const d = nextDecision(s, "r2");
    if (d?.kind !== "follow-up") throw new Error("expected a follow-up");
    expect(d.tasks.map((t) => t.taskId)).toEqual([ids[1]]);
    expect(d.charge).toBeUndefined();
  });
});

describe("closing a task as not done", () => {
  it("refunds the amount given, marks it Not done, and completes the request", () => {
    const { s, ids } = finished(["Customer declined"]);
    expect(closeTask(s, ids[0], 50)).toBe(true);
    reconcile(s);
    expect(task(s, ids[0]).status).toBe("Not done");
    expect(paid(s)[0]).toMatchObject({
      status: "Partially Refunded",
      refunded: 50,
    });
    expect(r2(s).status).toBe("Completed");
    expect(workIssue(s.visits.find((v) => v.requestId === "r2")!)).toBe("");
    expect(closeTask(s, ids[0], 0)).toBe(false);
  });

  it("refunds nothing at $0, and refuses a refund that is negative, not a number, or more than was paid", () => {
    const { s, ids } = finished(["Customer declined"]);
    expect(closeTask(s, ids[0], -1)).toBe(false);
    expect(closeTask(s, ids[0], Number.NaN)).toBe(false);
    expect(closeTask(s, ids[0], 401)).toBe(false);
    expect(closeTask(s, "nope", 0)).toBe(false);
    expect(closeTask(s, ids[0], 0)).toBe(true);
    expect(paid(s).map((p) => p.status)).toEqual(["Paid"]);
  });
});

describe("booking a return visit", () => {
  it("offers it to the same contractor and resolves the tasks", () => {
    const { s, v, ids } = finished(["Materials required"]);
    const o = later(s)!;
    expect(o.providerId).toBe(v.providerId);
    const back = bookReturnVisit(s, "r2", [ids[0]], { ...o, opKey: "r" })!;
    expect(back.taskIds).toEqual([ids[0]]);
    reconcile(s);
    expect(task(s, ids[0]).status).toBe("assigned to visit");
    expect(workIssue(v)).toBe("");
    expect(v.execution!.outcomes[ids[0]].resolution).toMatchObject({
      kind: "Return visit",
      visitId: back.id,
    });
    expect(s.assignments.at(-1)).toMatchObject({
      visitId: back.id,
      providerId: v.providerId,
      status: "Offered",
      pay: o.pay,
    });
    // Once decided, it cannot be booked again, even at a free time.
    const free = returnOptions(s, "r2", [ids[0]]).offer!;
    expect(free.start).not.toBe(o.start);
    expect(
      bookReturnVisit(s, "r2", [ids[0]], { ...free, opKey: "r2" }),
    ).toBeNull();
    // Nor can a task the visit finished.
    expect(
      bookReturnVisit(s, "r2", [ids[1]], { ...free, opKey: "r4" }),
    ).toBeNull();
    expect(bookReturnVisit(s, "r2", [], { ...o, opKey: "r3" })).toBeNull();
  });

  it("goes out at $0 only as a return visit", () => {
    const { s, ids } = finished(["Unable to complete"]);
    const o = later(s)!;
    expect(o.pay).toBe(0);
    const d = s.tasks.find((t) => t.id === ids[0])!.duration;
    expect(
      offerVisit(s, {
        requestId: "r2",
        taskIds: [ids[0]],
        ...o,
        duration: d,
        opKey: "plain",
      }),
    ).toBeNull();
    expect(
      bookReturnVisit(s, "r2", [ids[0]], { ...o, opKey: "r" }),
    ).not.toBeNull();
  });

  it("falls back to the first free contractor when the original cannot come", () => {
    const { s, v, ids } = finished(["Materials required"]);
    expect(returnOptions(s, "r2", [ids[0]]).offer?.providerId).toBe(
      v.providerId,
    );
    // The original contractor has left the roster.
    // Whoever went first is asked first, even when someone else is nearer.
    v.providerId = "marcus";
    expect(returnOptions(s, "r2", [ids[0]]).offer?.providerId).toBe("marcus");
    v.providerId = "gone";
    const o = returnOptions(s, "r2", [ids[0]]);
    expect(o.offer?.providerId).toBeTruthy();
    expect(o.offer?.providerId).not.toBe("gone");
    expect(o.self?.providerId).toBe("yousef");
    expect(o.self?.pay).toBe(0);
    expect(returnOptions(s, "r2", [])).toEqual({});
    expect(returnOptions(s, "nope", [ids[0]])).toEqual({});
  });
});

describe("an additional charge for a changed scope", () => {
  const sent = () => {
    const x = finished(["Materials required"]);
    const o = later(x.s)!;
    const plan = {
      providerId: o.providerId,
      start: o.start,
      travel: o.travel,
      duration: task(x.s, x.ids[0]).duration,
      pay: o.pay,
    };
    const c = requestExtraCharge(x.s, "r2", {
      amount: 45,
      reason: "Replacement hinge and second trip",
      taskIds: [x.ids[0]],
      plan,
    })!;
    return { ...x, c, plan };
  };

  it("waits on the customer, not the operator", () => {
    const { s, c } = sent();
    expect(c.status).toBe("Sent");
    expect(bucket(s, "r2")).toBe("Waiting");
    expect(nextDecision(s, "r2")?.kind).not.toBe("follow-up");
    expect(customerQueue(s, "c2", s.clock)[0]).toMatchObject({
      kind: "charge",
      chargeId: c.id,
    });
  });

  it("refuses an amount under $1, no reason, or tasks already decided", () => {
    const { s, ids, plan } = sent();
    const base = { amount: 45, reason: "x", taskIds: [ids[0]], plan };
    expect(requestExtraCharge(s, "r2", base)).toBeNull();
    const fresh = finished(["Materials required"]);
    const f = { ...base, taskIds: [fresh.ids[0]] };
    expect(requestExtraCharge(fresh.s, "r2", { ...f, amount: 0 })).toBeNull();
    expect(requestExtraCharge(fresh.s, "r2", { ...f, reason: " " })).toBeNull();
    expect(requestExtraCharge(fresh.s, "r2", { ...f, taskIds: [] })).toBeNull();
  });

  it("books the return visit once approved and paid", () => {
    const { s, v, ids, c } = sent();
    expect(approveCharge(s, c.id, true)).toBe(false);
    expect(s.payments.at(-1)).toMatchObject({
      status: "Failed",
      chargeId: c.id,
    });
    expect(c.status).toBe("Sent");
    expect(approveCharge(s, c.id)).toBe(true);
    expect(s.payments.at(-1)).toMatchObject({
      status: "Paid",
      amount: 45,
      chargeId: c.id,
    });
    expect(c.status).toBe("Approved");
    expect(c.visitId).toBeTruthy();
    expect(v.execution!.outcomes[ids[0]].resolution).toMatchObject({
      kind: "Return visit",
      visitId: c.visitId,
      chargeId: c.id,
    });
    expect(approveCharge(s, c.id)).toBe(false);
    // Booked once: the paid charge cannot book a second visit.
    const free = returnOptions(s, "r2", [ids[0]]).offer!;
    expect(
      bookReturnVisit(s, "r2", [ids[0]], { ...free, opKey: "again" }, c.id),
    ).toBeNull();
  });

  it("is not reused when its return visit leaves the task undone again", () => {
    const { s, ids, c } = sent();
    approveCharge(s, c.id);
    const back = s.visits.find((v) => v.id === c.visitId)!;
    const at = new Date(s.clock).toISOString();
    back.execution = {
      startedAt: at,
      finishedAt: at,
      outcomes: {
        [ids[0]]: {
          outcome: "Unable to complete",
          note: "x",
          before: [],
          after: [],
        },
      },
    };
    const d = nextDecision(s, "r2");
    if (d?.kind !== "follow-up") throw new Error("expected a follow-up");
    expect(d.tasks.map((t) => t.taskId)).toEqual([ids[0]]);
    expect(d.charge).toBeUndefined();
  });

  it("books only the tasks that charge is waiting on", () => {
    const { s, ids, c } = sent();
    const free = returnOptions(s, "r2", [ids[0]]).offer!;
    expect(
      bookReturnVisit(s, "r2", [ids[0]], { ...free, opKey: "x" }, "other"),
    ).toBeNull();
    expect(
      bookReturnVisit(s, "r2", [ids[0]], { ...free, opKey: "y" }),
    ).toBeNull();
    expect(c.status).toBe("Sent");
  });

  it("hands the paid tasks back to the operator if the time has gone", () => {
    const { s, ids, c } = sent();
    c.plan.start = new Date(s.clock - HOUR).toISOString();
    expect(approveCharge(s, c.id)).toBe(true);
    expect(c.visitId).toBeUndefined();
    const d = nextDecision(s, "r2");
    if (d?.kind !== "follow-up") throw new Error("expected a follow-up");
    expect(d.charge).toEqual({ id: c.id, amount: 45, status: "Approved" });
    const o = d.offer!;
    const back = bookReturnVisit(s, "r2", [ids[0]], { ...o, opKey: "r" }, c.id);
    expect(back).not.toBeNull();
    expect(c.visitId).toBe(back!.id);
  });

  it("hands it back to the operator when declined", () => {
    const { s, c } = sent();
    expect(declineCharge(s, c.id)).toBe(true);
    expect(c.status).toBe("Declined");
    expect(declineCharge(s, c.id)).toBe(false);
    expect(approveCharge(s, c.id)).toBe(false);
    expect(bucket(s, "r2")).toBe("Needs Action");
    const d = nextDecision(s, "r2");
    if (d?.kind !== "follow-up") throw new Error("expected a follow-up");
    expect(d.charge?.status).toBe("Declined");
  });

  it("refuses to charge with no quote to charge against", () => {
    const { s, c } = sent();
    s.quotes = s.quotes.filter((q) => q.requestId !== "r2");
    expect(approveCharge(s, c.id)).toBe(false);
    expect(approveCharge(s, "nope")).toBe(false);
  });
});

describe("a charge is not the work's payment", () => {
  it("still asks for the work's own payment on completion", () => {
    const { s } = finished(["Materials required"]);
    const q = s.quotes.find(
      (x) => x.requestId === "r2" && x.status === "Approved",
    )!;
    q.payOnCompletion = true;
    s.payments = s.payments.filter((p) => p.quoteId !== q.id);
    expect(readyToPay(s, q)).toBe(true);
    s.payments.push({
      id: "c",
      quoteId: q.id,
      chargeId: "x",
      status: "Paid",
      amount: 45,
      reference: "c",
    });
    expect(readyToPay(s, q)).toBe(true);
    expect(payQuote(s, q.id)).toBe(true);
    expect(readyToPay(s, q)).toBe(false);
  });
});

describe("a late arrival", () => {
  const late = () => {
    const { s, v } = finished();
    const visit = s.visits.find((x) => x.id === v.id)! as Visit;
    visit.execution = {
      onWayAt: new Date(s.clock).toISOString(),
      eta: new Date(+new Date(visit.start) + 20 * 60000).toISOString(),
      outcomes: {},
    };
    visit.status = "Confirmed";
    // On its way, not done: the request is still confirmed.
    r2(s).status = "Confirmed";
    return { s, v: visit };
  };

  it("is told to the customer once, in the visit's conversation", () => {
    const { s, v } = late();
    expect(workIssue(v)).toMatch(/^Late arrival/);
    const d = nextDecision(s, "r2");
    if (d?.kind !== "follow-up") throw new Error("expected a follow-up");
    expect(d.tasks).toEqual([]);
    expect(d.eta).toBe(v.execution!.eta);
    expect(tellCustomerLate(s, v.id)).toBe(true);
    expect(v.messages!.at(-1)).toMatchObject({ sender: "Operator" });
    expect(v.messages!.at(-1)!.text).toMatch(
      /^Running a little late: .+ is arriving around \d{1,2}:\d{2} [ap]\.m\.$/,
    );
    expect(workIssue(v)).toBe("");
    expect(tellCustomerLate(s, v.id)).toBe(false);
    expect(tellCustomerLate(s, "nope")).toBe(false);
  });

  it("is not told when it is not late", () => {
    const { s, v } = finished();
    expect(tellCustomerLate(s, v.id)).toBe(false);
    // On the way and early: nothing to tell.
    const early = late();
    early.v.execution!.eta = new Date(
      +new Date(early.v.start) - 10 * 60000,
    ).toISOString();
    expect(tellCustomerLate(early.s, early.v.id)).toBe(false);
  });
});

describe("what everyone is told", () => {
  const texts = (s: State, who: string) => inbox(s, who).map((n) => n.text);

  it("asks the customer to approve a charge and tells the operator the answer", () => {
    const x = finished(["Materials required"]);
    const o = later(x.s)!;
    let was = structuredClone(x.s);
    const c = requestExtraCharge(x.s, "r2", {
      amount: 45,
      reason: "Replacement hinge and second trip",
      taskIds: [x.ids[0]],
      plan: { ...o, duration: 60 },
    })!;
    deliverUpdates(was, x.s);
    expect(texts(x.s, "Customer:c2")).toContain(
      "Additional charge to approve · $45 · Replacement hinge and second trip",
    );
    was = structuredClone(x.s);
    declineCharge(x.s, c.id);
    deliverUpdates(was, x.s);
    expect(texts(x.s, "Operator")).toContain(
      `${r2(x.s).name} declined the $45 charge`,
    );
    // Said once: a later change does not repeat it.
    was = structuredClone(x.s);
    x.s.clock += 1;
    deliverUpdates(was, x.s);
    expect(
      texts(x.s, "Customer:c2").filter((t) =>
        t.startsWith("Additional charge"),
      ),
    ).toHaveLength(1);
    expect(
      texts(x.s, "Operator").filter((t) => t.endsWith("the $45 charge")),
    ).toHaveLength(1);
  });

  it("tells the customer a task was closed, and what came back", () => {
    const { s, ids } = finished(["Customer declined"]);
    const was = structuredClone(s);
    closeTask(s, ids[0], 50);
    deliverUpdates(was, s);
    expect(texts(s, "Customer:c2")).toContain(
      `We’ve closed “${task(s, ids[0]).summary}” without doing it and refunded $50.`,
    );
    const again = structuredClone(s);
    deliverUpdates(again, s);
    expect(
      texts(s, "Customer:c2").filter((t) => t.startsWith("We’ve closed")),
    ).toHaveLength(1);
  });
});
