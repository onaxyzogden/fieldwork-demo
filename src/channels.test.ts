import { describe, it, expect } from "vitest";
import {
  channelsFor,
  notificationKinds,
  reconcile,
  seed,
  urgency,
  type NotificationKind,
  type State,
} from "./model";
import {
  addressFor,
  bounced,
  deliverUpdates,
  deliveriesFor,
  deliveryLabel,
  markOfferSeen,
  markRead,
  offerSeen,
  sendMessage,
  unreachable,
  unseen,
} from "./notifications";
import { commit } from "./store";
import {
  approveScope,
  issueQuote,
  nextDecision,
  offerVisit,
} from "./decisions";

const at = "2026-01-01T00:00:00.000Z";

describe("channel follows urgency, not role", () => {
  it("classifies every kind, with nothing falling through", () => {
    for (const k of notificationKinds) expect(urgency[k]).toBeTruthy();
    // The record is typed over the union, so an unclassified kind is a build
    // error rather than a silent default. This asserts the union is the whole
    // set the app actually emits.
    expect(Object.keys(urgency).sort()).toEqual([...notificationKinds].sort());
  });
  it("sends urgent things by SMS and documents by email, both plus in-app", () => {
    expect(channelsFor("offer")).toEqual(["sms", "in-app"]);
    expect(channelsFor("visit")).toEqual(["sms", "in-app"]);
    expect(channelsFor("quote")).toEqual(["email", "in-app"]);
    expect(channelsFor("payment")).toEqual(["email", "in-app"]);
  });
  it("treats a cancellation as urgent whoever receives it", () => {
    // The point of the urgency axis: the same kind does not change channel
    // because the recipient changed.
    expect(channelsFor("visit")).toEqual(channelsFor("visit"));
    expect(urgency.visit).toBe("time-sensitive");
  });
});

describe("resolving an address", () => {
  it("finds a customer through their account's contact", () => {
    const s = seed();
    expect(addressFor(s, "Customer:c2", "sms")).toMatch(/^\+1-/);
    expect(addressFor(s, "Customer:c2", "email")).toContain("@");
  });
  it("finds a contractor on the roster", () => {
    const s = seed();
    expect(addressFor(s, "Contractor:marcus", "sms")).toBeTruthy();
  });
  it("returns nothing where there is no address on file", () => {
    const s = seed();
    // James Carter has an email and no mobile.
    expect(addressFor(s, "Customer:c4", "email")).toBeTruthy();
    expect(addressFor(s, "Customer:c4", "sms")).toBeUndefined();
  });
  it("treats in-app as always reachable", () => {
    const s = seed();
    expect(addressFor(s, "Operator", "in-app")).toBe("Operator");
  });
});

describe("delivery state", () => {
  it("marks in-app delivered and an external channel merely sent", () => {
    const s = seed();
    const rows = deliveriesFor(s, "Customer:c2", "offer", at);
    expect(rows.find((d) => d.channel === "in-app")!.state).toBe("delivered");
    // Frozen at sent on purpose: without a provider nothing reports back.
    expect(rows.find((d) => d.channel === "sms")!.state).toBe("sent");
  });
  it("bounces the channel with no address, and says why", () => {
    const s = seed();
    const rows = deliveriesFor(s, "Customer:c4", "offer", at);
    const sms = rows.find((d) => d.channel === "sms")!;
    expect(sms.state).toBe("bounced");
    expect(sms.reason).toMatch(/mobile number/i);
    // The other channel is unaffected.
    expect(rows.find((d) => d.channel === "in-app")!.state).toBe("delivered");
  });
  it("reads as something a person can act on", () => {
    const s = seed();
    const [sms] = deliveriesFor(s, "Customer:c4", "offer", at);
    expect(deliveryLabel(sms)).toBe("SMS · No mobile number on file");
    expect(deliveryLabel({ channel: "in-app", state: "read" })).toBe(
      "In-app · read",
    );
  });
});

describe("what the operator could not ask before", () => {
  function withOffer(): State {
    const s = seed();
    (s.notifications ??= []).unshift({
      id: "n1",
      recipient: "Contractor:marcus",
      requestId: "r2",
      visitId: "",
      assignmentId: "a1",
      kind: "offer",
      text: "New offer",
      at,
      read: false,
      deliveries: deliveriesFor(s, "Contractor:marcus", "offer", at),
    });
    return s;
  }
  it("lists a time-sensitive notification nobody has opened", () => {
    const s = withOffer();
    expect(unseen(s).map((n) => n.id)).toContain("n1");
  });
  it("drops it once it is opened, and records the transition", () => {
    const s = withOffer();
    expect(markRead(s, "n1")).toBe(true);
    expect(unseen(s).map((n) => n.id)).not.toContain("n1");
    const inApp = s.notifications![0].deliveries!.find(
      (d) => d.channel === "in-app",
    )!;
    expect(inApp.state).toBe("read");
  });
  it("does not count a document nobody opened as needing chasing", () => {
    const s = withOffer();
    s.notifications![0].kind = "quote";
    expect(unseen(s)).toHaveLength(0);
  });
  it("surfaces anything that bounced", () => {
    const s = seed();
    (s.notifications ??= []).unshift({
      id: "n2",
      recipient: "Customer:c4",
      requestId: "r4",
      visitId: "",
      assignmentId: "",
      kind: "visit",
      text: "Moved",
      at,
      read: false,
      deliveries: deliveriesFor(s, "Customer:c4", "visit", at),
    });
    expect(bounced(s).map((n) => n.id)).toEqual(["n2"]);
  });
});

describe("notifications raised by a real write", () => {
  it("carry their channels without anyone asking", () => {
    const before = seed();
    const after = commit(before, (d) => {
      const r = d.requests.find((x) => x.id === "r2")!;
      r.operatorNote = "Can you confirm the door is solid core?";
    });
    const raised = (after.notifications ?? []).find(
      (n) => n.kind === "information",
    )!;
    expect(raised.deliveries?.length).toBe(2);
    expect(raised.deliveries!.map((d) => d.channel)).toContain("sms");
  });
});

/** Book a request with the queue's own suggestion, and raise the notices a
 *  real write would (commit()'s own steps, without the storage it needs). */
function book(before: State, requestId: string) {
  const d: State = structuredClone(before);
  approveScope(d, requestId);
  const x = nextDecision(d, requestId);
  if (x?.kind !== "assign" || !x.offer) throw new Error("no offer");
  offerVisit(d, {
    requestId,
    taskIds: x.taskIds,
    ...x.offer,
    duration: x.duration,
    opKey: "book-" + requestId,
  });
  reconcile(d);
  deliverUpdates(before, d);
  return d;
}

describe("what the operator reads on a request (ADR 060)", () => {
  it("says whether the contractor has opened a waiting offer", () => {
    const s = book(seed(), "r2");
    const a = s.assignments.at(-1)!;
    expect(offerSeen(s, a.id)).toEqual({ sentAt: expect.any(String) });
    expect(markOfferSeen(s, a.id)).toBe(true);
    expect(offerSeen(s, a.id)?.openedAt).toBeTruthy();
    // Only the contractor's copy: the operator's own notice of the offer is
    // not the contractor seeing it.
    expect(
      s
        .notifications!.filter(
          (n) => n.assignmentId === a.id && n.recipient === "Operator",
        )
        .every((n) => !n.read),
    ).toBe(true);
    expect(markOfferSeen(s, a.id)).toBe(false);
    expect(offerSeen(s, "nope")).toBeUndefined();
  });
  it("reads only the contractor's own offer notice", () => {
    const s = book(seed(), "r2");
    const a = s.assignments.at(-1)!;
    // Opened notices about the same offer that are not the contractor's copy
    // of it, raised before it, so they come first if the filter slips.
    for (const other of [
      { recipient: "Operator", kind: "offer" },
      { recipient: "Contractor:" + a.providerId, kind: "message" },
    ]) {
      s.notifications!.push({
        id: "other",
        ...other,
        requestId: "r2",
        visitId: a.visitId,
        assignmentId: a.id,
        text: "Not the offer",
        at,
        read: true,
      });
      expect(offerSeen(s, a.id)?.openedAt).toBeUndefined();
      s.notifications!.pop();
    }
  });
  it("counts the bell inbox opening it the same way", () => {
    const s = book(seed(), "r2");
    const a = s.assignments.at(-1)!;
    const n = s.notifications!.find(
      (n) =>
        n.assignmentId === a.id && n.recipient === "Contractor:" + a.providerId,
    )!;
    markRead(s, n.id);
    expect(offerSeen(s, a.id)?.openedAt).toBeTruthy();
  });
  it("names each person who could not be reached, once per channel", () => {
    const s = book(seed(), "r4");
    // James Carter has no mobile, so the visit notice's SMS bounced. A
    // second bounced notice to him still makes one line, not two.
    (s.notifications ??= []).unshift({
      id: "again",
      recipient: "Customer:c4",
      requestId: "r4",
      visitId: "",
      assignmentId: "",
      kind: "visit",
      text: "Moved",
      at,
      read: false,
      deliveries: deliveriesFor(s, "Customer:c4", "visit", at),
    });
    expect(
      bounced(s).filter((n) => n.requestId === "r4").length,
    ).toBeGreaterThan(1);
    expect(unreachable(s, "r4")).toEqual([
      {
        name: "James Carter",
        channel: "sms",
        reason: "No mobile number on file",
      },
    ]);
    // The operator's own copy bouncing is not someone to reach.
    s.notifications.unshift({
      id: "mine",
      recipient: "Operator",
      requestId: "r4",
      visitId: "",
      assignmentId: "",
      kind: "visit",
      text: "Moved",
      at,
      read: false,
      deliveries: [
        {
          channel: "sms",
          state: "bounced",
          at,
          reason: "No mobile number on file",
        },
      ],
    });
    expect(unreachable(s, "r4")).toHaveLength(1);
    // Another request's bounces are not this one's.
    expect(unreachable(s, "r2")).toEqual([]);
    expect(unreachable(book(seed(), "r2"), "r2")).toEqual([]);
  });
});

describe("the customer's notices read as production (ADR 061)", () => {
  const texts = (s: State, recipient: string) =>
    (s.notifications ?? [])
      .filter((n) => n.recipient === recipient)
      .map((n) => n.text);
  /** Apply a write and raise its notices, as commit() does. */
  const after = (before: State, write: (d: State) => void) => {
    const d: State = structuredClone(before);
    write(d);
    reconcile(d);
    deliverUpdates(before, d);
    return d;
  };

  it("words a booking the way the badges do", () => {
    const s = book(seed(), "r2");
    const mine = texts(s, "Customer:c2");
    expect(mine).toContain("Your request: Matching you with a provider");
    expect(
      mine.some((t) => t.startsWith("Visit awaiting confirmation · ")),
    ).toBe(true);
    // The operator keeps the record's own words.
    const ops = texts(s, "Operator");
    expect(ops.some((t) => t.startsWith("Visit proposed · "))).toBe(true);
    expect(ops.some((t) => /awaiting provider acceptance/.test(t))).toBe(true);
  });

  it("says a quote is ready and a payment was received", () => {
    const quoted = after(seed(), (d) => {
      issueQuote(d, "r2", {
        type: "Manual quote",
        amount: 300,
        payOnCompletion: false,
      });
    });
    expect(texts(quoted, "Customer:c2")).toContain(
      "Your quote is ready · 38 Lakeshore Road West",
    );
    expect(texts(quoted, "Operator")).toContain(
      "Quote sent · 38 Lakeshore Road West",
    );
    const q = quoted.quotes.at(-1)!;
    for (const [status, mine] of [
      ["Paid", "Payment received"],
      ["Failed", "Your payment didn’t go through"],
    ] as const) {
      const paid = after(quoted, (d) => {
        d.payments.push({
          id: "p-" + status,
          quoteId: q.id,
          status,
          amount: 300,
          reference: "r",
        });
      });
      expect(texts(paid, "Customer:c2")).toContain(
        `${mine} · 38 Lakeshore Road West`,
      );
      expect(texts(paid, "Operator")).toContain(
        `Simulated payment ${status.toLowerCase()} · 38 Lakeshore Road West`,
      );
    }
  });

  it("signs the business's messages as the business, and asks as us", () => {
    const booked = book(seed(), "r2");
    const v = booked.visits.at(-1)!;
    const sent = after(booked, (d) => {
      sendMessage(d, v.id, "Operator", "Gate code is 1234");
      d.requests.find((r) => r.id === "r2")!.operatorNote = "Which door?";
    });
    expect(texts(sent, "Customer:c2")).toContain(
      "fieldwork: Gate code is 1234",
    );
    expect(texts(sent, "Customer:c2")).toContain(
      "We have a question: Which door?",
    );
    expect(texts(sent, "Operator")).toContain(
      "Information requested: Which door?",
    );
  });
});
