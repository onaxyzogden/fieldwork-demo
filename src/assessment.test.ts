import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import Assessment from "./Assessment";
import { reconcile, seed, uid, type State } from "./model";
import {
  addFinding,
  convertApproved,
  createWalkthrough,
  decide,
  sendWalkthrough,
} from "./pmw";

afterEach(() => vi.unstubAllGlobals());

/** A sent assessment: one priced finding, one deferred, one that cannot be priced. */
function sent() {
  const s = seed();
  const w = createWalkthrough(s, "p2");
  const door = addFinding(s, w.id, {
    area: "Main floor hallway",
    title: "Door rubbing against frame",
    observed: "The door catches on the frame at the latch side.",
    proposed: "Adjust the sticking door and reset the hinges",
    price: 180,
  });
  const shelf = addFinding(s, w.id, {
    title: "Shelving pulling away",
    observed: "Two shelves are pulling away from the wall.",
    proposed: "Install two shelves securely into studs",
    price: 220,
  });
  const damp = addFinding(s, w.id, {
    title: "Damp patch below window",
    observed: "Staining on the wall; the source is not visible.",
    proposed: "Investigate the source before any repair is scoped",
    pricing: "Further Assessment Required",
  });
  sendWalkthrough(s, w.id);
  return { s, w, door, shelf, damp };
}

/** Server rendering splits interpolations with comment markers; drop them so
    assertions can read the page the way a person does. */
const readable = (html: string) => html.replace(/<!--\s*-->/g, "");

function render(s: State, assessmentId: string) {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) =>
      key === "fieldwork-demo-v1" ? JSON.stringify(s) : null,
    setItem: () => {},
    removeItem: () => {},
  });
  return readable(renderToString(createElement(Assessment, { assessmentId })));
}
/** Only what the customer sees on screen, without the print document below it. */
const screenOnly = (html: string) => html.slice(0, html.indexOf("pmw-print"));
const printOnly = (html: string) => html.slice(html.indexOf("pmw-print"));

describe("the customer's assessment", () => {
  it("opens from the link alone, with no sign-in and no account", () => {
    const { s, w } = sent();
    const html = render(s, w.assessmentId);
    expect(html).toContain(w.assessmentId);
    expect(html).toContain("38 Lakeshore Road West");
    expect(html).not.toMatch(/sign in|log in|create an account to view/i);
  });
  it("refuses a link that names no sent assessment", () => {
    const { s } = sent();
    expect(render(s, "PMW-9999")).toContain("Assessment not found");
    const draft = seed();
    createWalkthrough(draft, "p1");
    expect(render(draft, "PMW-0001")).toContain("Assessment not found");
  });
  it("offers no approval control and no price for a further-assessment finding", () => {
    const { s, w, damp } = sent();
    const html = screenOnly(render(s, w.assessmentId));
    const card = html.slice(html.indexOf(damp.title));
    const next = card.indexOf("Work summary");
    const section = card.slice(0, next > 0 ? next : undefined);
    expect(section).toContain("Assessment required before pricing");
    expect(section).toContain("Request an assessment");
    expect(section).not.toContain("applicable tax");
    expect(section).not.toMatch(/>\s*Approve\b/);
  });
  it("totals only what was approved, taxed at the walkthrough's own rate", () => {
    const { s, w, door, shelf } = sent();
    decide(s, door.id, "Approved");
    decide(s, shelf.id, "Not Now");
    const html = render(s, w.assessmentId);
    expect(html).toContain("$180");
    expect(html).toContain("$23.40");
    expect(html).toContain("$203.40");
    expect(html).toContain("Approve 1 item");
  });
  it("swaps the approval form for progress once the work exists", () => {
    const { s, w, door } = sent();
    decide(s, door.id, "Approved");
    convertApproved(s, w.id);
    reconcile(s);
    const screen = screenOnly(render(s, w.assessmentId));
    expect(screen).toContain("Review findings");
    expect(screen).toContain("Scheduled");
    expect(screen).not.toContain("Approval &amp; payment");
    expect(screen).not.toContain("Authorized by");
  });
});

describe("the printed assessment is the same record", () => {
  it("carries the identifiers, scopes, prices and statuses shown on screen", () => {
    const { s, w, door, shelf, damp } = sent();
    decide(s, door.id, "Approved");
    decide(s, shelf.id, "Not Now");
    const print = printOnly(render(s, w.assessmentId));
    /* Parity is what §11 asks for: one data path, so the document cannot be
       edited into disagreeing with the record it was generated from. */
    expect(print).toContain(w.assessmentId);
    for (const f of [door, shelf, damp]) {
      expect(print).toContain(String(f.number).padStart(2, "0"));
      expect(print).toContain(f.title);
      expect(print).toContain(f.proposed);
    }
    expect(print).toContain("$180");
    expect(print).toContain("$220");
    expect(print).toContain("$23.40");
    expect(print).toContain("$203.40");
    expect(print).toContain("Further assessment required");
    expect(print).toContain("Deferred");
  });
  it("records who authorized the work once they have", () => {
    const { s, w, door } = sent();
    decide(s, door.id, "Approved");
    s.walkthroughs.find((x) => x.id === w.id)!.authorization = {
      name: "Daniel Brooks",
      agreedAt: new Date(s.clock).toISOString(),
    };
    convertApproved(s, w.id);
    expect(printOnly(render(s, w.assessmentId))).toContain("Daniel Brooks");
  });
  it("never writes to the customer's browser just by being opened", () => {
    const { s, w } = sent();
    const setItem = vi.fn();
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) =>
        key === "fieldwork-demo-v1" ? JSON.stringify(s) : null,
      setItem,
      removeItem,
    });
    renderToString(
      createElement(Assessment, { assessmentId: w.assessmentId }),
    );
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});

/** Keeps the fixture honest: ids the tests lean on must be the seeded ones. */
it("is written against the seeded property", () => {
  const s = seed();
  expect(s.properties.find((p) => p.id === "p2")?.address).toBe(
    "38 Lakeshore Road West",
  );
  expect(uid()).toHaveLength(8);
});
