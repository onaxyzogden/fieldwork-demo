import { describe, it, expect } from "vitest";
import {
  seed,
  accounts,
  contacts,
  contactsFor,
  primaryContact,
  contactLabel,
  migrateAccounts,
  approveQuote,
  createRework,
  adjudicateWarranty,
  reconcile,
  type State,
} from "./model";
import { migrateDispatch } from "./dispatch";

/** A state saved before accounts existed: customerId on disk, no contacts. */
function legacy(): State {
  const s: State = JSON.parse(JSON.stringify(seed()));
  for (const r of s.requests) {
    (r as unknown as { customerId: string }).customerId = r.accountId;
    delete (r as Partial<typeof r>).accountId;
    delete (r as Partial<typeof r>).contactId;
  }
  for (const p of s.properties) {
    (p as unknown as { customerId: string }).customerId = p.accountId;
    delete (p as Partial<typeof p>).accountId;
  }
  for (const t of s.tasks) delete (t as Partial<typeof t>).materials;
  return s;
}

describe("the account roster", () => {
  it("gives every account at least one contact, and individuals exactly one", () => {
    for (const a of accounts) {
      const own = contactsFor(a.id);
      expect(own.length).toBeGreaterThan(0);
      if (a.type === "individual") expect(own).toHaveLength(1);
    }
  });
  it("keeps contact ids out of the property id namespace", () => {
    // Both were "p1", "p2", … once. Different tables, so nothing broke — and
    // an id that means two things is a bug waiting for the first lookup that
    // takes the wrong one.
    const propertyIds = new Set(seed().properties.map((p) => p.id));
    for (const c of contacts) expect(propertyIds.has(c.id)).toBe(false);
  });
  it("points every contact at an account that exists", () => {
    for (const c of contacts)
      expect(accounts.some((a) => a.id === c.accountId)).toBe(true);
  });
  it("signs an organization contact with their role and an individual without", () => {
    const org = accounts.find((a) => a.type === "organization")!;
    expect(contactLabel(primaryContact(org.id)!.id)).toContain(", ");
    const person = accounts.find((a) => a.type === "individual")!;
    expect(contactLabel(primaryContact(person.id)!.id)).not.toContain(", ");
  });
});

describe("migrating a state saved before accounts", () => {
  it("renames customerId and leaves nothing of the old field behind", () => {
    const s = migrateAccounts(legacy());
    for (const r of s.requests) {
      expect(r.accountId).toBeTruthy();
      expect("customerId" in r).toBe(false);
    }
    for (const p of s.properties) {
      expect(p.accountId).toBeTruthy();
      expect("customerId" in p).toBe(false);
    }
  });
  it("attributes every old request to its account's one contact", () => {
    const s = migrateAccounts(legacy());
    for (const r of s.requests) {
      const c = contacts.find((x) => x.id === r.contactId);
      expect(c?.accountId).toBe(r.accountId);
    }
  });
  it("defaults materials to an explicit 'nobody has said yet'", () => {
    const s = migrateAccounts(legacy());
    expect(s.tasks.every((t) => !!t.materials)).toBe(true);
  });
  it("runs inside migrateDispatch, before properties are built from requests", () => {
    const stripped = legacy();
    delete (stripped as Partial<State>).properties;
    const s = migrateDispatch(stripped);
    expect(s.properties.every((p) => !!p.accountId)).toBe(true);
  });
  it("is idempotent", () => {
    const once = migrateAccounts(legacy());
    const twice = migrateAccounts(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});

/** A request with one sent quote, ready to approve. */
function quoted() {
  const s = seed();
  const r = s.requests.find((x) => x.id === "r2")!;
  s.quotes.push({
    id: "q1",
    requestId: r.id,
    type: "Manual quote",
    amount: 420,
    high: 480,
    status: "Sent",
    notes: "",
    payOnCompletion: false,
  });
  return { s, r };
}

describe("what was approved", () => {
  it("freezes the scope and the price at the moment of approval", () => {
    const { s, r } = quoted();
    expect(approveQuote(s, "q1")).toBe(true);
    const q = s.quotes.find((x) => x.id === "q1")!;
    expect(q.status).toBe("Approved");
    expect(q.approval?.amount).toBe(420);
    expect(q.approval?.high).toBe(480);
    expect(q.approval?.taskIds).toEqual(
      s.tasks.filter((t) => t.requestId === r.id).map((t) => t.id),
    );
  });
  it("does not widen when a task is added afterwards", () => {
    const { s, r } = quoted();
    approveQuote(s, "q1");
    const agreed = [...s.quotes.find((x) => x.id === "q1")!.approval!.taskIds];
    s.tasks.push({ ...s.tasks[0], id: "late", requestId: r.id });
    expect(s.quotes.find((x) => x.id === "q1")!.approval!.taskIds).toEqual(
      agreed,
    );
    expect(agreed).not.toContain("late");
  });
  it("records the approver, with their role when the account has several", () => {
    const { s } = quoted();
    approveQuote(s, "q1", "ct6");
    const a = s.quotes.find((x) => x.id === "q1")!.approval!;
    expect(a.contactId).toBe("ct6");
    expect(a.name).toBe("Maya Okonkwo");
    expect(a.role).toBe("Property Manager");
  });
  it("refuses a second approval rather than re-stamping the first", () => {
    const { s } = quoted();
    approveQuote(s, "q1");
    const first = s.quotes.find((x) => x.id === "q1")!.approval!.approvedAt;
    s.clock += 86400000;
    expect(approveQuote(s, "q1")).toBe(false);
    expect(s.quotes.find((x) => x.id === "q1")!.approval!.approvedAt).toBe(
      first,
    );
  });
});

/** A seeded task driven to Completed so rework can be raised against it. */
function completed() {
  const s = seed();
  const t = s.tasks.find((x) => x.requestId === "r1")!;
  t.status = "Completed";
  return { s, t };
}

describe("rework", () => {
  it("leaves the original completed and puts the rework on a new request", () => {
    const { s, t } = completed();
    const made = createRework(s, t.id, "Door is rubbing again")!;
    expect(t.status).toBe("Completed");
    expect(made.request.id).not.toBe(t.requestId);
    expect(made.task.originTaskId).toBe(t.id);
    expect(made.task.reworkReason).toBe("Door is rubbing again");
    expect(made.request.propertyId).toBe(
      s.requests.find((r) => r.id === t.requestId)!.propertyId,
    );
  });
  it("cannot derive the finished request back out of Completed", () => {
    const { s, t } = completed();
    const original = s.requests.find((r) => r.id === t.requestId)!;
    createRework(s, t.id, "again");
    reconcile(s);
    expect(s.tasks.filter((x) => x.requestId === original.id)).toHaveLength(1);
  });
  it("refuses work that is not finished", () => {
    const s = seed();
    expect(createRework(s, s.tasks[0].id, "too soon")).toBe(null);
  });
  it("starts undecided about who pays, then records who decided", () => {
    const { s, t } = completed();
    const made = createRework(s, t.id, "again")!;
    expect(made.task.warranty).toBeUndefined();
    expect(adjudicateWarranty(s, made.task.id, false, "Operator")).toBe(true);
    expect(made.task.warranty).toEqual({
      billable: false,
      decidedBy: "Operator",
      decidedAt: new Date(s.clock).toISOString(),
    });
  });
  it("refuses to adjudicate a task that is not rework", () => {
    const { s, t } = completed();
    expect(adjudicateWarranty(s, t.id, true, "Operator")).toBe(false);
  });
});
