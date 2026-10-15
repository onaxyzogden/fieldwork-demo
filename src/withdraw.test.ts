import { describe, it, expect } from "vitest";
import { reconcile, seed, type State } from "./model";
import { reoffer, replacementOptions, respondToOffer } from "./dispatch";
import { nextDecision, offerVisit, withdrawOffer } from "./decisions";
import { deliverUpdates, inbox } from "./notifications";

/** One change, committed as the store does: reconcile, then the notices. */
function commit<T>(s: State, write: (x: State) => T): T {
  const before = structuredClone(s);
  const out = write(s);
  reconcile(s);
  deliverUpdates(before, s);
  return out;
}
/** Take the suggested contractor offer on a request, as the queue's button does. */
function offer(s: State, requestId = "r2") {
  const d = nextDecision(s, requestId);
  if (d?.kind !== "assign" || !d.offer) throw new Error("no assign offer");
  const o = d.offer;
  const v = commit(s, (x) =>
    offerVisit(x, {
      requestId,
      taskIds: d.taskIds,
      providerId: o.providerId,
      start: o.start,
      travel: o.travel,
      duration: d.duration,
      pay: o.pay,
      opKey: "k-withdraw",
    }),
  )!;
  const a = s.assignments.find((x) => x.visitId === v.id)!;
  return { v, a, provider: o.providerId };
}
const offers = (s: State, providerId: string) =>
  inbox(s, "Contractor:" + providerId).filter((n) => n.kind === "offer");
/** Everything the contractor sees, of any kind, as "text" lines. */
const seen = (s: State, providerId: string) =>
  inbox(s, "Contractor:" + providerId).map((n) => n.text.split(" · ")[0]);

describe("withdrawing an offer (ADR 083)", () => {
  it("cancels a new offer's visit, frees the time and the request", () => {
    const s = seed();
    const status = s.requests.find((r) => r.id === "r2")!.status;
    const { v, a } = offer(s);
    expect(commit(s, (x) => withdrawOffer(x, a.id))).toBe(true);
    expect(a.status).toBe("Withdrawn");
    expect(s.visits.find((x) => x.id === v.id)!.status).toBe("Cancelled");
    expect(s.requests.find((r) => r.id === "r2")!.status).toBe(status);
    expect(nextDecision(s, "r2")?.kind).toBe("assign");
    expect(s.events[0]).toMatchObject({ actor: "Operator", requestId: "r2" });
    expect(s.events[0].text).toMatch(/withdrawn/);
  });

  it("takes back an unread offer notice and sends nothing else", () => {
    const s = seed();
    const untouched = structuredClone(s);
    const { a, provider } = offer(s);
    expect(offers(s, provider).some((n) => n.assignmentId === a.id)).toBe(true);
    commit(s, (x) => withdrawOffer(x, a.id));
    // Not the offer, nor the "Visit proposed" beside it, nor a "Visit cancelled".
    expect(seen(s, provider)).toEqual(seen(untouched, provider));
  });

  it("tells a contractor who read the offer that it was withdrawn", () => {
    const s = seed();
    const { a, provider } = offer(s);
    for (const n of offers(s, provider)) n.read = true;
    commit(s, (x) => withdrawOffer(x, a.id));
    const mine = offers(s, provider).filter((n) => n.assignmentId === a.id);
    expect(mine.map((n) => n.text.split(" · ")[0])).toEqual([
      "Offer withdrawn",
      "New job offer",
    ]);
    // "Offer withdrawn" speaks for the visit; no "Visit cancelled" beside it.
    expect(seen(s, provider)).not.toContain("Visit cancelled");
  });

  it("refuses once the contractor has accepted", () => {
    const s = seed();
    const { v, a } = offer(s);
    commit(s, (x) => respondToOffer(x, a.id, "Accepted"));
    expect(commit(s, (x) => withdrawOffer(x, a.id))).toBe(false);
    expect(a.status).toBe("Accepted");
    expect(s.visits.find((x) => x.id === v.id)!.status).not.toBe("Cancelled");
  });

  it("puts a replacement offer's visit back as it was before", () => {
    const s = seed();
    s.settings = { autoReofferDeclined: false };
    // r3 has a second contractor to offer it to; r2 has only Yousef.
    const { v, a, provider } = offer(s, "r3");
    commit(s, (x) => respondToOffer(x, a.id, "Declined", "Too far"));
    const was = { providerId: v.providerId, start: v.start, travel: v.travel };
    const o = replacementOptions(s, v).find(
      (x) => x.provider.id !== provider && x.provider.id !== "yousef",
    );
    if (!o) throw new Error("no other contractor");
    commit(s, (x) => reoffer(x, v.id, o.provider.id, o.start!, o.minimumPay));
    const again = s.assignments.at(-1)!;
    expect(commit(s, (x) => withdrawOffer(x, again.id))).toBe(true);
    expect(again.status).toBe("Withdrawn");
    const back = s.visits.find((x) => x.id === v.id)!;
    expect({ providerId: back.providerId, start: back.start, travel: back.travel }).toEqual(was);
    expect(back.status).toBe("Proposed");
    expect(nextDecision(s, "r3")?.kind).toBe("reassign");
  });
});
