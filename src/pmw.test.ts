import { describe, it, expect } from "vitest";
import { seed, reconcile, uid, accounts, type State } from "./model";
import { execute, saveOutcome } from "./work";
import { storePaymentMethod } from "./payments";
import {
  HST,
  addFinding,
  approveAssessment,
  assessmentTotals,
  carryForward,
  convertApproved,
  createWalkthrough,
  decide,
  findingEvidence,
  findingState,
  findingsFor,
  needsPricing,
  nextAssessmentId,
  propertyRecord,
  roomsFor,
  ROOMS,
  quotable,
  carryCandidates,
  closeOutUndecided,
  requestAssessment,
  seedWalkthroughs,
  sendBlockers,
  sendWalkthrough,
  suggestTitle,
  undecided,
} from "./pmw";

/** A sent walkthrough: two priced findings and one that cannot be priced yet. */
function walked() {
  const s = seed();
  const w = createWalkthrough(s, "p2");
  const door = addFinding(s, w.id, {
    area: "Main floor hallway",
    title: "Door rubbing against frame",
    observed: "The door catches on the frame at the latch side.",
    /* Converted scope runs through the same classifier and the same provider
       eligibility as intake text does — it is not waved through. */
    proposed: "Adjust the sticking door and reset the hinges",
    price: 180,
  });
  const shelf = addFinding(s, w.id, {
    area: "Office",
    title: "Shelving not secured",
    observed: "Two shelves are pulling away from the wall.",
    proposed: "Install two shelves securely into studs",
    price: 220,
  });
  const damp = addFinding(s, w.id, {
    area: "Basement",
    title: "Damp patch below the window",
    observed: "Staining on the wall; the source is not visible.",
    proposed: "Investigate the source before any repair is scoped",
    pricing: "Further Assessment Required",
  });
  sendWalkthrough(s, w.id);
  return { s, w, door, shelf, damp };
}

describe("identifiers stay stable", () => {
  it("numbers assessments in sequence without a stored counter", () => {
    const s = seed();
    expect(nextAssessmentId(s)).toBe("PMW-0001");
    const first = createWalkthrough(s, "p1");
    expect(first.assessmentId).toBe("PMW-0001");
    expect(createWalkthrough(s, "p2").assessmentId).toBe("PMW-0002");
  });
  it("keeps finding numbers after one in the middle is removed", () => {
    const s = seed();
    const w = createWalkthrough(s, "p1");
    const one = addFinding(s, w.id, { title: "One", price: 100 });
    const two = addFinding(s, w.id, { title: "Two", price: 100 });
    const three = addFinding(s, w.id, { title: "Three", price: 100 });
    expect([one.number, two.number, three.number]).toEqual([1, 2, 3]);
    s.findings = s.findings.filter((f) => f.id !== two.id);
    expect(findingsFor(s, w.id).map((f) => f.number)).toEqual([1, 3]);
    expect(addFinding(s, w.id, { title: "Four" }).number).toBe(4);
    expect(three.number).toBe(3);
  });
  it("carries the assessment id and finding number onto the converted task", () => {
    const { s, w, door } = walked();
    decide(s, door.id, "Approved");
    const request = convertApproved(s, w.id)!;
    const task = s.tasks.find((t) => t.requestId === request.id)!;
    expect(task.reason).toBe(`PMW · ${w.assessmentId} · finding 01`);
  });
});

describe("a finding that cannot be priced cannot be approved", () => {
  it("refuses approval for further-assessment and unpriced findings", () => {
    const { s, damp, w } = walked();
    const unpriced = addFinding(s, w.id, { title: "No price yet" });
    expect(quotable(damp)).toBe(false);
    expect(decide(s, damp.id, "Approved")).toBe(false);
    expect(decide(s, unpriced.id, "Approved")).toBe(false);
    expect(damp.decision).toBe("Pending");
    expect(findingState(s, damp)).toBe("Further assessment required");
  });
  it("still lets the customer ask for an assessment, which creates no work", () => {
    const { s, damp, w } = walked();
    expect(requestAssessment(s, damp.id)).toBe(true);
    expect(damp.followUpRequestedAt).toBeTruthy();
    expect(convertApproved(s, w.id)).toBe(null);
    expect(s.tasks.some((t) => t.findingId === damp.id)).toBe(false);
    expect(s.quotes).toHaveLength(0);
  });
  it("supersedes the original when the operator rescopes it in a later walkthrough", () => {
    const { s, damp } = walked();
    const before = JSON.parse(JSON.stringify(damp));
    const later = createWalkthrough(s, "p2");
    const rescoped = carryForward(s, damp.id, later.id)!;
    expect(rescoped.carriedFrom).toBe(damp.id);
    expect(damp.resolvedBy).toBe(rescoped.id);
    expect(findingState(s, damp)).toBe("Superseded");
    expect({ ...damp, resolvedBy: undefined }).toEqual({
      ...before,
      resolvedBy: undefined,
    });
  });
});

describe("totals", () => {
  it("counts only approved findings, and taxes at the stored rate", () => {
    const { s, w, door, shelf } = walked();
    expect(assessmentTotals(s, w.id).subtotal).toBe(0);
    decide(s, door.id, "Approved");
    decide(s, shelf.id, "Not Now");
    const totals = assessmentTotals(s, w.id);
    expect(totals.approved).toHaveLength(1);
    expect(totals.deferred).toHaveLength(1);
    expect(totals.furtherAssessment).toHaveLength(1);
    expect(totals.subtotal).toBe(180);
    expect(totals.tax).toBe(round(180 * HST));
    expect(totals.total).toBe(round(180 + 180 * HST));
  });
  const round = (n: number) => Math.round(n * 100) / 100;
});

describe("conversion into the existing pipeline", () => {
  it("creates one request, a task per approved finding, and one approved quote", () => {
    const { s, w, door, shelf, damp } = walked();
    decide(s, door.id, "Approved");
    decide(s, shelf.id, "Approved");
    const request = convertApproved(s, w.id)!;
    expect(request.mode).toBe("Walkthrough Approval");
    expect(request.propertyId).toBe("p2");
    expect(request.walkthroughId).toBe(w.id);
    const tasks = s.tasks.filter((t) => t.requestId === request.id);
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.reviewed)).toBe(true);
    expect(new Set(tasks.map((t) => t.findingId))).toEqual(
      new Set([door.id, shelf.id]),
    );
    expect(door.taskId).toBe(tasks.find((t) => t.findingId === door.id)!.id);
    const quotes = s.quotes.filter((q) => q.requestId === request.id);
    expect(quotes).toHaveLength(1);
    expect(quotes[0].status).toBe("Approved");
    expect(quotes[0].amount).toBe(400);
    expect(s.tasks.some((t) => t.findingId === damp.id)).toBe(false);
    expect(s.walkthroughs.find((x) => x.id === w.id)!.status).toBe("Converted");
  });
  it("copies the finding's photos onto the task so nothing is retyped", () => {
    const { s, w, door } = walked();
    door.photos = ["data:image/png;base64,example"];
    decide(s, door.id, "Approved");
    const request = convertApproved(s, w.id)!;
    expect(s.tasks.find((t) => t.requestId === request.id)!.photos).toEqual(
      door.photos,
    );
  });
  it("blocks scheduling until payment, then confirms once paid and accepted", () => {
    const { s, w, door } = walked();
    decide(s, door.id, "Approved");
    const request = convertApproved(s, w.id)!;
    reconcile(s);
    expect(request.status).toBe("Awaiting Payment");
    expect(findingState(s, door)).toBe("Approved");

    const quote = s.quotes.find((q) => q.requestId === request.id)!;
    s.payments.push({
      id: uid(),
      quoteId: quote.id,
      status: "Paid",
      amount: quote.amount,
      reference: "demo_" + uid(),
    });
    reconcile(s);
    expect(request.status).toBe("Submitted");

    const task = s.tasks.find((t) => t.requestId === request.id)!;
    scheduleVisit(s, request.id, [task.id]);
    reconcile(s);
    expect(request.status).toBe("Confirmed");
    expect(findingState(s, door)).toBe("Scheduled");
  });
  it("refuses to convert twice, and a converted finding cannot change its mind", () => {
    const { s, w, door } = walked();
    decide(s, door.id, "Approved");
    convertApproved(s, w.id);
    expect(convertApproved(s, w.id)).toBe(null);
    expect(decide(s, door.id, "Not Now")).toBe(false);
    expect(s.requests.filter((r) => r.walkthroughId === w.id)).toHaveLength(1);
  });
  it("starts a second request when a deferred finding is approved later", () => {
    const { s, w, door, shelf } = walked();
    decide(s, door.id, "Approved");
    decide(s, shelf.id, "Not Now");
    const first = convertApproved(s, w.id)!;
    s.walkthroughs.find((x) => x.id === w.id)!.status = "Sent";
    decide(s, shelf.id, "Approved");
    const second = convertApproved(s, w.id)!;
    expect(second.id).not.toBe(first.id);
    expect(s.tasks.filter((t) => t.requestId === second.id)).toHaveLength(1);
  });
});

describe("completion returns to the property record", () => {
  it("drives the finding to Completed and keeps the after photos", () => {
    const { s, w, door } = walked();
    decide(s, door.id, "Approved");
    const request = convertApproved(s, w.id)!;
    const quote = s.quotes.find((q) => q.requestId === request.id)!;
    s.payments.push({
      id: uid(),
      quoteId: quote.id,
      status: "Paid",
      amount: quote.amount,
      reference: "demo_" + uid(),
    });
    const task = s.tasks.find((t) => t.requestId === request.id)!;
    const visit = scheduleVisit(s, request.id, [task.id]);
    reconcile(s);

    expect(execute(s, visit.id, "marcus", "way")).toBe(true);
    expect(findingState(s, door)).toBe("On the Way");
    expect(execute(s, visit.id, "marcus", "start")).toBe(true);
    expect(findingState(s, door)).toBe("In Progress");
    saveOutcome(s, visit.id, "marcus", task.id, {
      outcome: "Completed",
      note: "Hinges reset, door closes cleanly.",
      after: ["data:image/png;base64,after"],
    });
    execute(s, visit.id, "marcus", "finish");
    reconcile(s);

    expect(findingState(s, door)).toBe("Completed");
    expect(findingEvidence(s, door).after).toEqual([
      "data:image/png;base64,after",
    ]);
    const record = propertyRecord(s, "p2");
    expect(record.completed.map((f) => f.id)).toEqual([door.id]);
    expect(record.walkthroughs.map((x) => x.id)).toEqual([w.id]);
    expect(record.payments).toHaveLength(1);
  });
  it("keeps deferred and further-assessment findings against the property", () => {
    const { s, door, shelf, damp } = walked();
    decide(s, door.id, "Not Now");
    decide(s, shelf.id, "Not Now");
    const record = propertyRecord(s, "p2");
    expect(record.deferred.map((f) => f.id).sort()).toEqual(
      [door.id, shelf.id].sort(),
    );
    expect(record.furtherAssessment.map((f) => f.id)).toEqual([damp.id]);
    expect(propertyRecord(s, "p1").findings).toHaveLength(0);
  });
});

describe("what has to be true before an assessment can be sent", () => {
  /* The rule used to live in the send button's onClick, so it bound exactly
     one caller. A finding with a price and no title went to the customer as
     "Untitled finding · $450" with an Approve button under it. */
  const drafted = () => {
    const s = seed();
    const w = createWalkthrough(s, "p1");
    return { s, w };
  };

  it("refuses a finding the customer cannot identify", () => {
    const { s, w } = drafted();
    addFinding(s, w.id, { title: "  ", price: 450 });
    expect(sendBlockers(s, w.id).map((b) => b.reason)).toEqual(["title"]);
    expect(sendWalkthrough(s, w.id)).toBe(false);
    expect(s.walkthroughs[0].status).toBe("Draft");
  });

  it("refuses a quoted finding with no price", () => {
    const { s, w } = drafted();
    addFinding(s, w.id, { title: "Door rubbing against frame" });
    expect(sendBlockers(s, w.id).map((b) => b.reason)).toEqual(["price"]);
    expect(sendWalkthrough(s, w.id)).toBe(false);
  });

  it("reports every reason a finding is not ready, not just the first", () => {
    const { s, w } = drafted();
    addFinding(s, w.id, { title: "" });
    expect(sendBlockers(s, w.id).map((b) => b.reason)).toEqual([
      "title",
      "price",
    ]);
  });

  it("asks nothing of a finding that needs further assessment but its title", () => {
    const { s, w } = drafted();
    addFinding(s, w.id, {
      title: "Damp patch below window",
      pricing: "Further Assessment Required",
    });
    expect(sendBlockers(s, w.id)).toEqual([]);
    expect(sendWalkthrough(s, w.id)).toBe(true);
  });

  it("still refuses a walkthrough with no findings at all", () => {
    const { s, w } = drafted();
    expect(sendWalkthrough(s, w.id)).toBe(false);
  });

  it("sends once every finding is named and priced", () => {
    const { s, w } = drafted();
    addFinding(s, w.id, { title: "Door rubbing against frame", price: 180 });
    addFinding(s, w.id, { title: "Shelving pulling away", price: 220 });
    expect(sendBlockers(s, w.id)).toEqual([]);
    expect(sendWalkthrough(s, w.id)).toBe(true);
    expect(s.walkthroughs[0].status).toBe("Sent");
    expect(s.walkthroughs[0].sentAt).toBeTruthy();
  });
});

describe("the walkthroughs the demo opens with", () => {
  it("ships at least one sent assessment and at least one draft", () => {
    const s = seed();
    seedWalkthroughs(s);
    const statuses = s.walkthroughs.map((w) => w.status);
    expect(statuses).toContain("Sent");
    expect(statuses).toContain("Draft");
  });
  it("numbers every assessment uniquely and in sequence", () => {
    const s = seed();
    seedWalkthroughs(s);
    const ids = s.walkthroughs.map((w) => w.assessmentId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      ids.map((_, i) => "PMW-" + String(i + 1).padStart(4, "0")),
    );
  });
  /* The role on an approval only renders when the account is an organization.
     Without a sent assessment on an organization's property that branch is
     unreachable in the running app — the defect ADR 034 was written about. */
  it("puts one sent assessment on an organization's property", () => {
    const s = seed();
    const { commercial } = seedWalkthroughs(s);
    const property = s.properties.find((p) => p.id === commercial.propertyId)!;
    expect(accounts.find((a) => a.id === property.accountId)?.type).toBe(
      "organization",
    );
    expect(commercial.status).toBe("Sent");
    expect(sendBlockers(s, commercial.id)).toEqual([]);
  });

  /* The sent one is what a reviewer opens first, so it has to be a complete
     assessment rather than a placeholder: priced work, unpriced work, and a
     total that adds up. */
  it("the sent assessment is one a customer could actually act on", () => {
    const s = seed();
    const { sent } = seedWalkthroughs(s);
    expect(sendBlockers(s, sent.id)).toEqual([]);
    expect(sent.sentAt).toBeTruthy();
    const t = assessmentTotals(s, sent.id);
    expect(t.findings).toHaveLength(3);
    expect(t.findings.filter((f) => quotable(f))).toHaveLength(2);
    expect(
      t.findings.filter((f) => f.pricing === "Further Assessment Required"),
    ).toHaveLength(1);
    expect(t.findings.every((f) => f.title && f.observed && f.proposed)).toBe(
      true,
    );
  });

  it("every seeded finding hangs off a property that exists", () => {
    const s = seed();
    seedWalkthroughs(s);
    for (const w of s.walkthroughs)
      expect(s.properties.some((p) => p.id === w.propertyId)).toBe(true);
    for (const f of s.findings)
      expect(s.walkthroughs.some((w) => w.id === f.walkthroughId)).toBe(true);
  });
});

describe("carrying an unresolved finding into a later walkthrough", () => {
  /* A property walked twice: the first visit leaves one deferred item and one
     nobody could price, which is the whole reason to come back. */
  const twice = () => {
    const s = seed();
    const first = createWalkthrough(s, "p1");
    const deferred = addFinding(s, first.id, {
      title: "Gutter needs clearing",
      price: 120,
    });
    const unpriced = addFinding(s, first.id, {
      title: "Damp patch below window",
      pricing: "Further Assessment Required",
    });
    const priced = addFinding(s, first.id, { title: "Door sticks", price: 90 });
    sendWalkthrough(s, first.id);
    decide(s, deferred.id, "Not Now");
    decide(s, priced.id, "Approved");
    const second = createWalkthrough(s, "p1");
    return { s, first, second, deferred, unpriced, priced };
  };

  it("offers the deferred and the unpriced, and nothing else", () => {
    const { s, second, deferred, unpriced } = twice();
    expect(
      carryCandidates(s, second.id)
        .map((f) => f.id)
        .sort(),
    ).toEqual([deferred.id, unpriced.id].sort());
  });

  it("offers nothing on a walkthrough that has already been sent", () => {
    const { s, first } = twice();
    expect(carryCandidates(s, first.id)).toEqual([]);
  });

  it("restates the finding and supersedes the original", () => {
    const { s, second, unpriced } = twice();
    const copy = carryForward(s, unpriced.id, second.id)!;
    expect(copy.walkthroughId).toBe(second.id);
    expect(copy.title).toBe(unpriced.title);
    expect(copy.carriedFrom).toBe(unpriced.id);
    expect(s.findings.find((f) => f.id === unpriced.id)!.resolvedBy).toBe(
      copy.id,
    );
    expect(
      findingState(
        s,
        s.findings.find((f) => f.id === unpriced.id)!,
      ),
    ).toBe("Superseded");
  });

  it("stops offering what has already been carried", () => {
    const { s, second, deferred, unpriced } = twice();
    carryForward(s, unpriced.id, second.id);
    expect(carryCandidates(s, second.id).map((f) => f.id)).toEqual([
      deferred.id,
    ]);
  });
});

/** The operator's own scheduling path, condensed: a visit plus an accepted offer. */
function scheduleVisit(s: State, requestId: string, taskIds: string[]) {
  const visit = {
    id: uid(),
    requestId,
    taskIds,
    providerId: "marcus",
    start: new Date(s.clock + 86400000).toISOString(),
    duration: 90,
    status: "Proposed",
    travel: 10,
  };
  s.visits.push(visit);
  s.assignments.push({
    id: uid(),
    visitId: visit.id,
    providerId: "marcus",
    status: "Accepted",
    pay: 110,
    expiresAt: s.clock + 7200000,
  });
  return visit;
}

describe("leftover findings once an assessment's work goes ahead", () => {
  /** One sent assessment: two priced findings, nothing decided yet. */
  function twoFindings() {
    const s = seed();
    s.walkthroughs = [];
    s.findings = [];
    const property = s.properties[0];
    const w = createWalkthrough(s, property.id);
    addFinding(s, w.id, { title: "Side door", price: 140 });
    addFinding(s, w.id, { title: "Loose railing", price: 90 });
    sendWalkthrough(s, w.id);
    const [door, railing] = findingsFor(s, w.id);
    return { s, w, door, railing, property };
  }
  const nextDraft = (s: State, propertyId: string) =>
    createWalkthrough(s, propertyId);

  it("closes the customer's round: undecided becomes Not now, decided is untouched", () => {
    const { s, w, door, railing } = twoFindings();
    decide(s, door.id, "Approved");
    expect(closeOutUndecided(s, w.id)).toBe(1);
    expect(findingState(s, railing)).toBe("Deferred");
    expect(door.decision).toBe("Approved");
    expect(undecided(s, w.id)).toEqual([]);
  });

  it("leaves nothing stranded after the customer submits", () => {
    const { s, w, door, railing, property } = twoFindings();
    decide(s, door.id, "Approved");
    closeOutUndecided(s, w.id); // what the customer's submit now does
    convertApproved(s, w.id);
    const next = nextDraft(s, property.id);
    expect(carryCandidates(s, next.id).map((f) => f.id)).toContain(railing.id);
  });

  it("never records a decision for the customer when the operator converts early", () => {
    const { s, w, door, railing, property } = twoFindings();
    decide(s, door.id, "Approved");
    convertApproved(s, w.id); // the operator's button: no close-out
    expect(w.status).toBe("Converted");
    // Still undecided — the customer never said "Not now".
    expect(findingState(s, railing)).toBe("Pending decision");
    expect(railing.decision).toBe("Pending");
    // ...but rescued: the next walkthrough offers it.
    const next = nextDraft(s, property.id);
    expect(carryCandidates(s, next.id).map((f) => f.id)).toContain(railing.id);
  });

  it("does not offer an undecided finding while it is still the customer's turn", () => {
    const { s, railing, property } = twoFindings();
    const next = nextDraft(s, property.id);
    expect(carryCandidates(s, next.id).map((f) => f.id)).not.toContain(
      railing.id,
    );
  });

  it("stops offering a stranded finding once it has been carried", () => {
    const { s, w, door, railing, property } = twoFindings();
    decide(s, door.id, "Approved");
    convertApproved(s, w.id);
    const next = nextDraft(s, property.id);
    carryForward(s, railing.id, next.id);
    expect(railing.resolvedBy).toBeTruthy();
    const later = nextDraft(s, property.id);
    expect(carryCandidates(s, later.id).map((f) => f.id)).not.toContain(
      railing.id,
    );
  });
});

describe("capture on site, price later", () => {
  it("seeds organisation properties as Commercial and the rest as House", () => {
    const s = seed();
    for (const p of s.properties) {
      const org = accounts.find((a) => a.id === p.accountId)?.type;
      expect(p.type).toBe(org === "organization" ? "Commercial" : "House");
    }
    expect(s.properties.some((p) => p.type === "Commercial")).toBe(true);
  });

  it("offers the type's rooms first, then this property's own areas once", () => {
    const s = seed();
    s.walkthroughs = [];
    s.findings = [];
    const property = s.properties.find((p) => p.type === "House")!;
    const earlier = createWalkthrough(s, property.id);
    addFinding(s, earlier.id, { area: "Second-floor corridor" });
    addFinding(s, earlier.id, { area: "kitchen" }); // already a room
    addFinding(s, earlier.id, { area: "second-floor corridor " }); // repeat
    addFinding(s, earlier.id, { area: "" });
    // Another property's area never leaks in.
    const other = s.properties.find((p) => p.id !== property.id)!;
    const elsewhere = createWalkthrough(s, other.id);
    addFinding(s, elsewhere.id, { area: "Boiler room" });
    expect(roomsFor(s, property.id)).toEqual([
      ...ROOMS.House,
      "Second-floor corridor",
    ]);
  });

  it("offers a property with no type its own history only", () => {
    const s = seed();
    s.walkthroughs = [];
    s.findings = [];
    const property = s.properties[0];
    delete property.type;
    expect(roomsFor(s, property.id)).toEqual([]);
    const w = createWalkthrough(s, property.id);
    addFinding(s, w.id, { area: "Shed" });
    expect(roomsFor(s, property.id)).toEqual(["Shed"]);
  });

  it("suggests a title from the first clause of the note", () => {
    expect(suggestTitle("")).toBe("");
    expect(suggestTitle("   ")).toBe("");
    expect(suggestTitle("cabinet hinge loose, door sags when opened.")).toBe(
      "Cabinet hinge loose",
    );
    expect(suggestTitle("Gap of 1.5 cm under the door. Draughty.")).toBe(
      "Gap of 1.5 cm under the door",
    );
    expect(suggestTitle("Leak under sink\nsecond line")).toBe(
      "Leak under sink",
    );
    const long = suggestTitle(
      "The flashing along the whole north side of the roof has lifted and is letting water in",
    );
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith(" ")).toBe(false);
    expect("The flashing along the whole north side of the roof has").toBe(
      long,
    );
  });

  it("holds a capture back from sending until it is priced", () => {
    const s = seed();
    const w = createWalkthrough(s, s.properties[1].id);
    const photo = addFinding(s, w.id, { area: "Kitchen", photos: ["data:x"] });
    const noted = addFinding(s, w.id, {
      area: "Bathroom",
      observed: "Caulking cracked around the tub.",
    });
    expect(needsPricing(s, w.id).map((f) => f.id)).toEqual([
      photo.id,
      noted.id,
    ]);
    expect(sendWalkthrough(s, w.id)).toBe(false);
    photo.title = "Cabinet hinge loose";
    photo.price = 85;
    expect(needsPricing(s, w.id).map((f) => f.id)).toEqual([noted.id]);
    noted.title = suggestTitle(noted.observed);
    noted.pricing = "Further Assessment Required";
    expect(needsPricing(s, w.id)).toEqual([]);
    expect(sendWalkthrough(s, w.id)).toBe(true);
  });
});

describe("approving an assessment", () => {
  /** A sent assessment on the given property: two priced, one unpriced. */
  function ready(propertyId: string) {
    const s = seed();
    const w = createWalkthrough(s, propertyId);
    const door = addFinding(s, w.id, { title: "Door", price: 180 });
    const shelf = addFinding(s, w.id, { title: "Shelf", price: 220 });
    const damp = addFinding(s, w.id, {
      title: "Damp",
      pricing: "Further Assessment Required",
    });
    sendWalkthrough(s, w.id);
    const accountId = s.properties.find((p) => p.id === propertyId)!.accountId;
    return { s, w, door, shelf, damp, accountId };
  }
  const card = { brand: "Visa", last4: "4242" };

  it("needs something approved, a name and a saved card, in that order", () => {
    const { s, w, door, accountId } = ready("p2");
    const by = { name: "Daniel Brooks", contactId: "ct2" };
    expect(approveAssessment(s, w.id, by)).toEqual({
      ok: false,
      reason: "nothing approved",
    });
    decide(s, door.id, "Approved");
    expect(approveAssessment(s, w.id, { ...by, name: "  " })).toEqual({
      ok: false,
      reason: "name",
    });
    expect(approveAssessment(s, w.id, by)).toEqual({
      ok: false,
      reason: "payment",
    });
    expect(w.status).toBe("Sent");
    const method = storePaymentMethod(s, accountId, card);
    expect(approveAssessment(s, w.id, by)).toEqual({ ok: true });
    expect(w.status).toBe("Converted");
    expect(w.authorization).toMatchObject({
      name: "Daniel Brooks",
      contactId: "ct2",
    });
    const request = s.requests.find((r) => r.walkthroughId === w.id)!;
    const quote = s.quotes.find((q) => q.requestId === request.id)!;
    expect(s.payments.find((p) => p.quoteId === quote.id)?.methodId).toBe(
      method.id,
    );
  });

  it("keeps the undecided as Not now and refuses a second approval", () => {
    const { s, w, door, shelf, accountId } = ready("p2");
    decide(s, door.id, "Approved");
    storePaymentMethod(s, accountId, card);
    approveAssessment(s, w.id, { name: "Daniel Brooks", contactId: "ct2" });
    expect(shelf.decision).toBe("Not Now");
    expect(
      approveAssessment(s, w.id, { name: "Daniel Brooks", contactId: "ct2" }),
    ).toEqual({ ok: false, reason: "closed" });
  });

  it("takes an organisation's approval only from someone with authority", () => {
    const { s, w, door, accountId } = ready("p6");
    storePaymentMethod(s, accountId, card);
    expect(decide(s, door.id, "Approved", "ct6")).toBe(true);
    expect(
      approveAssessment(s, w.id, {
        name: "Tomas Reyes",
        role: "Operations Manager",
        contactId: "ct7",
      }),
    ).toEqual({ ok: false, reason: "approver" });
    expect(
      approveAssessment(s, w.id, { name: "Nobody", role: "Manager" }),
    ).toEqual({ ok: false, reason: "approver" });
    expect(
      approveAssessment(s, w.id, {
        name: "Maya Okonkwo",
        role: "Property Manager",
        contactId: "ct6",
      }),
    ).toEqual({ ok: true });
    expect(w.authorization?.role).toBe("Property Manager");
  });
});
