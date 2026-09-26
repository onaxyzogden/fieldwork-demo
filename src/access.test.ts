import { describe, it, expect } from "vitest";
import {
  ASSESSMENT_LINK_DAYS,
  accessToken,
  approveQuote,
  mayApprove,
  setApprover,
  seed,
  type State,
} from "./model";
import {
  byToken,
  decide,
  findingsFor,
  issueAccess,
  linkState,
  recordOpen,
  revokeAccess,
  seedWalkthroughs,
} from "./pmw";

function sent() {
  const s = seed();
  const { sent, commercial } = seedWalkthroughs(s);
  return { s, w: sent, commercial };
}

describe("the token", () => {
  it("is not built from Math.random when a real source exists", () => {
    const t = accessToken();
    expect(t).not.toMatch(/^insecure-/);
    expect(t).toHaveLength(48);
  });
  it("differs every time", () => {
    expect(new Set([...Array(50)].map(accessToken)).size).toBe(50);
  });
  it("is issued when the assessment is sent, not before", () => {
    const s = seed();
    const { sent: w } = seedWalkthroughs(s);
    expect(w.access?.token).toBeTruthy();
    expect(linkState(s, w)).toBe("live");
  });
  it("does not carry the assessment number, so counting finds nothing", () => {
    const { s, w } = sent();
    expect(w.access!.token).not.toContain(w.assessmentId);
    expect(byToken(s, "PMW-0001").ok).toBe(false);
    expect(byToken(s, "PMW-0002").ok).toBe(false);
  });
});

describe("resolving a link", () => {
  it("finds the assessment for a live token", () => {
    const { s, w } = sent();
    const found = byToken(s, w.access!.token);
    expect(found.ok && found.walkthrough.id).toBe(w.id);
  });
  it("says why, rather than just no", () => {
    const { s, w } = sent();
    expect(byToken(s, "nonsense")).toEqual({ ok: false, reason: "unknown" });

    revokeAccess(s, w.id);
    expect(byToken(s, w.access!.token)).toEqual({
      ok: false,
      reason: "revoked",
    });
  });
  it("expires on its own, without anyone revoking it", () => {
    const { s, w } = sent();
    s.clock += (ASSESSMENT_LINK_DAYS + 1) * 86400000;
    expect(linkState(s, w)).toBe("expired");
    expect(byToken(s, w.access!.token)).toEqual({
      ok: false,
      reason: "expired",
    });
  });
});

describe("revoking and re-issuing", () => {
  it("kills the old link when a fresh one is issued", () => {
    const { s, w } = sent();
    const old = w.access!.token;
    issueAccess(s, w.id);
    expect(w.access!.token).not.toBe(old);
    expect(byToken(s, old).ok).toBe(false);
    expect(byToken(s, w.access!.token).ok).toBe(true);
  });
  it("keeps the record of how often it was opened across a re-issue", () => {
    const { s, w } = sent();
    recordOpen(s, w.id);
    recordOpen(s, w.id);
    issueAccess(s, w.id);
    // How often the assessment was looked at is a fact about the assessment,
    // not about the current link.
    expect(w.access!.opens).toHaveLength(2);
  });
  it("refuses to revoke twice", () => {
    const { s, w } = sent();
    expect(revokeAccess(s, w.id)).toBe(true);
    expect(revokeAccess(s, w.id)).toBe(false);
  });
  it("records the opens the operator could not see before", () => {
    const { s, w } = sent();
    expect(w.access!.opens).toEqual([]);
    recordOpen(s, w.id);
    expect(w.access!.opens).toHaveLength(1);
  });
});

describe("who may approve", () => {
  it("lets an individual's only contact approve without being granted it", () => {
    const s = seed();
    expect(mayApprove(s, "c2")).toBe(true);
    expect(mayApprove(s, "c2", "ct2")).toBe(true);
  });
  it("refuses an organization contact who has not been granted it", () => {
    const s = seed();
    expect(mayApprove(s, "a1", "ct7")).toBe(false);
    expect(mayApprove(s, "a1", "ct6")).toBe(true);
  });
  it("refuses an organization with nobody named at all", () => {
    const s = seed();
    expect(mayApprove(s, "a1")).toBe(false);
  });
  it("refuses a contact from another account", () => {
    const s = seed();
    expect(mayApprove(s, "c2", "ct6")).toBe(false);
  });
});

describe("the operator can actually change it", () => {
  it("grants authority that was not there before", () => {
    const s = seed();
    expect(mayApprove(s, "a1", "ct7")).toBe(false);
    setApprover(s, "ct7", true);
    expect(mayApprove(s, "a1", "ct7")).toBe(true);
  });
  it("withdraws authority that was", () => {
    const s = seed();
    expect(mayApprove(s, "a1", "ct6")).toBe(true);
    setApprover(s, "ct6", false);
    expect(mayApprove(s, "a1", "ct6")).toBe(false);
  });
  it("records the change, with who it was about", () => {
    const s = seed();
    setApprover(s, "ct7", true);
    const entry = s.events.find((e) => e.entity === "contact")!;
    expect(entry.entityId).toBe("ct7");
    expect([entry.from, entry.to]).toEqual(["no", "yes"]);
  });
  it("says nothing when nothing changed", () => {
    const s = seed();
    const before = s.events.length;
    setApprover(s, "ct6", true);
    expect(s.events).toHaveLength(before);
  });
  it("survives a round trip, because it is state and not a roster edit", () => {
    const s = seed();
    setApprover(s, "ct7", true);
    const restored: State = JSON.parse(JSON.stringify(s));
    expect(mayApprove(restored, "a1", "ct7")).toBe(true);
  });
});

describe("approval is gated where it counts", () => {
  it("lets an individual approve a finding as before", () => {
    const { s, w } = sent();
    const f = findingsFor(s, w.id).find((x) => x.pricing === "Quoted")!;
    expect(decide(s, f.id, "Approved")).toBe(true);
  });
  it("refuses an organization finding with no approver named", () => {
    const { s, commercial } = sent();
    const f = findingsFor(s, commercial.id).find(
      (x) => x.pricing === "Quoted",
    )!;
    expect(decide(s, f.id, "Approved")).toBe(false);
    expect(f.decision).toBe("Pending");
  });
  it("refuses the contact who has not been granted authority", () => {
    const { s, commercial } = sent();
    const f = findingsFor(s, commercial.id).find(
      (x) => x.pricing === "Quoted",
    )!;
    expect(decide(s, f.id, "Approved", "ct7")).toBe(false);
    expect(decide(s, f.id, "Approved", "ct6")).toBe(true);
  });
  it("lets anyone defer, because deferring commits the account to nothing", () => {
    const { s, commercial } = sent();
    const f = findingsFor(s, commercial.id).find(
      (x) => x.pricing === "Quoted",
    )!;
    expect(decide(s, f.id, "Not Now", "ct7")).toBe(true);
  });
  it("gates the quote path on the same rule", () => {
    const s: State = seed();
    s.quotes.push({
      id: "q6",
      requestId: "r6",
      type: "Manual quote",
      amount: 260,
      high: 260,
      status: "Sent",
      notes: "",
      payOnCompletion: false,
    });
    expect(approveQuote(s, "q6", "ct7")).toBe(false);
    expect(approveQuote(s, "q6", "ct6")).toBe(true);
  });
});
