import { describe, it, expect } from "vitest";
import { reconcile } from "./model";
import { freshDemo } from "./store";
import { nextDecision, offerVisit } from "./decisions";
import { customerProgressText, customerStatusText } from "./customerText";

/** Offer r2 to a provider, who has not answered yet. */
function offered() {
  const s = freshDemo();
  const d = nextDecision(s, "r2");
  if (d?.kind !== "assign" || !d.offer) throw new Error("expected an offer");
  offerVisit(s, {
    requestId: "r2",
    taskIds: d.taskIds,
    ...d.offer,
    duration: d.duration,
    opKey: "k",
  });
  reconcile(s);
  return { s, r: s.requests.find((r) => r.id === "r2")! };
}

describe("the line under a request's badge (ADR 070)", () => {
  it("agrees with the badge while an offer is only out", () => {
    const { s, r } = offered();
    expect(customerStatusText(r.status)).toBe("Matching you with a provider");
    expect(customerProgressText(s, r)).toBe(
      "We’ve asked a provider and are waiting for them to accept.",
    );
  });

  it("says a provider accepted only once one has", () => {
    const { s, r } = offered();
    for (const a of s.assignments)
      if (s.visits.some((v) => v.id === a.visitId && v.requestId === r.id))
        a.status = "Accepted";
    expect(customerProgressText(s, r)).toBe(
      "A provider has accepted. We’re preparing your quote.",
    );
  });

  it("puts an unanswered question first", () => {
    const { s, r } = offered();
    r.operatorNote = "Is there parking?";
    expect(customerProgressText(s, r)).toMatch(/^We have a question for you/);
    r.customerReply = "Yes";
    expect(customerProgressText(s, r)).not.toMatch(/question/);
  });
});
