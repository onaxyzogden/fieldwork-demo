import { describe, it, expect } from "vitest";
import { dateLabel, providers, seed, type State } from "./model";
import { deliverUpdates, inbox, operatorRequestText } from "./notifications";

/**
 * The operator's and the contractor's inbox say what happened and to whom
 * (ADR 064), and nobody is told about what they just did themselves.
 */

const texts = (s: State, who: string) => inbox(s, who).map((n) => n.text);

/** Apply a change to a seeded state and deliver its notices. */
function after(change: (s: State) => void) {
  const s = seed();
  const was = structuredClone(s);
  change(s);
  deliverUpdates(was, s);
  return s;
}

/** A contractor's offer on the first seeded visit, before any change. */
function offered() {
  const s = seed();
  const v = s.visits[0];
  const p = providers.find((x) => x.id !== "yousef")!;
  s.assignments.push({
    id: "o",
    visitId: v.id,
    providerId: p.id,
    status: "Offered",
    pay: 100,
    expiresAt: s.clock + 7200000,
  });
  return { s, p, when: dateLabel(v.start) };
}

describe("offer notices (ADR 064)", () => {
  it("tells the contractor about a new offer and the operator who it went to", () => {
    const { s, p, when } = offered();
    const was = structuredClone(s);
    was.assignments = was.assignments.filter((a) => a.id !== "o");
    deliverUpdates(was, s);
    expect(texts(s, "Contractor:" + p.id)).toContain(`New job offer · ${when}`);
    expect(texts(s, "Operator")).toContain(`Offer sent to ${p.name} · ${when}`);
  });

  for (const [status, contractor, operator] of [
    ["Accepted", null, "{name} accepted · {when}"],
    ["Declined", null, null],
    ["Expired", "Offer expired · {when}", null],
    ["Cancelled", "Job cancelled · {when}", null],
    ["Reassigned", "Offer withdrawn · {when}", null],
  ] as const)
    it(`words "${status}" for each side, or stays quiet`, () => {
      const { s, p, when } = offered();
      const was = structuredClone(s);
      s.assignments.find((a) => a.id === "o")!.status = status;
      deliverUpdates(was, s);
      const fill = (t: string) =>
        t.replace("{name}", p.name).replace("{when}", when);
      expect(texts(s, "Contractor:" + p.id)).toEqual(
        contractor ? [fill(contractor)] : [],
      );
      expect(texts(s, "Operator")).toEqual(operator ? [fill(operator)] : []);
    });

  it("does not call an offer renewed at a new time withdrawn", () => {
    const { s, p } = offered();
    s.assignments.find((a) => a.id === "o")!.status = "Accepted";
    const was = structuredClone(s);
    s.assignments.find((a) => a.id === "o")!.status = "Reassigned";
    s.assignments.push({
      ...s.assignments.find((a) => a.id === "o")!,
      id: "o2",
      status: "Offered",
    });
    deliverUpdates(was, s);
    const mine = texts(s, "Contractor:" + p.id);
    expect(mine.some((t) => t.startsWith("Offer withdrawn"))).toBe(false);
    expect(mine.some((t) => t.startsWith("New job offer"))).toBe(true);
  });
});

describe("request and visit notices for the operator (ADR 064)", () => {
  it("says what happened to whose request", () => {
    expect(operatorRequestText("Submitted", "Ana")).toBe(
      "New request from Ana",
    );
    expect(operatorRequestText("Awaiting Payment", "Ana")).toBe(
      "Ana approved the quote",
    );
    expect(operatorRequestText("Cancelled", "Ana")).toBe(
      "Ana’s request is cancelled",
    );
  });

  it("names the customer on a visit and the contractor on the way", () => {
    const s = after((d) => {
      const v = d.visits[0];
      v.execution = { onWayAt: new Date(d.clock).toISOString(), outcomes: {} };
    });
    const v = s.visits[0];
    const r = s.requests.find((x) => x.id === v.requestId)!;
    const name = providers.find((p) => p.id === v.providerId)!.name;
    const eta = dateLabel(v.start);
    expect(texts(s, "Operator")).toContain(
      `${name} is on the way · arriving around ${eta}`,
    );
    if (v.providerId !== "yousef")
      expect(texts(s, "Contractor:" + v.providerId)).toContain(
        `You’re on the way · arriving around ${eta}`,
      );
    const moved = after((d) => {
      d.visits[0].start = new Date(d.clock + 86400000).toISOString();
    });
    expect(texts(moved, "Operator")[0]).toMatch(
      new RegExp(`^${r.name}’s visit moved to `),
    );
  });
});
