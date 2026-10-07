import { describe, it, expect } from "vitest";
import { seed, type State } from "./model";
import { migrateDispatch } from "./dispatch";
import { migratePmw, propertyKey, savedAddresses } from "./pmw";

/**
 * Every seeded request is at its own address, so a correct migration produces
 * exactly this many properties. Derived rather than written as a number: the
 * count is a fact about the seed, and pinning it made four tests fail the day a
 * sixth request was added, none of which was about the seed's size.
 *
 * Submitted requests only: a draft is linked once it is submitted, not while
 * its address is still being typed (ADR 064).
 */
const SEEDED = seed().requests.filter((r) => r.status !== "Draft").length;
const submitted = (s: State) => s.requests.filter((r) => r.status !== "Draft");

/** A state saved before properties existed: no PMW arrays, no request links. */
function legacy(): State {
  const s = JSON.parse(JSON.stringify(seed()));
  delete s.properties;
  delete s.walkthroughs;
  delete s.findings;
  for (const r of s.requests) delete r.propertyId;
  return s;
}

describe("property migration", () => {
  it("leaves seeded state untouched, because seed already links every request", () => {
    const s = seed();
    const before = JSON.parse(JSON.stringify(s));
    migratePmw(s);
    expect(s.requests).toEqual(before.requests);
    expect(s.properties).toEqual(before.properties);
  });
  it("rebuilds a property per address and links every request", () => {
    const s = legacy();
    migratePmw(s);
    expect(s.properties).toHaveLength(SEEDED);
    expect(submitted(s).every((r) => !!r.propertyId)).toBe(true);
    for (const r of submitted(s)) {
      const p = s.properties.find((p) => p.id === r.propertyId)!;
      expect(p.address).toBe(r.address);
      expect(p.city).toBe(r.city);
      expect(p.accountId).toBe(r.accountId);
    }
  });
  it("gives two requests at one address the same property, and never merges across customers", () => {
    const s = legacy();
    const [first] = submitted(s);
    s.requests.push({
      ...first,
      id: "repeat",
      address: "  " + first.address.toUpperCase() + " ",
    });
    s.requests.push({ ...first, id: "other-owner", accountId: "c4" });
    migratePmw(s);
    const repeat = s.requests.find((r) => r.id === "repeat")!;
    const owner = s.requests.find((r) => r.id === "other-owner")!;
    expect(repeat.propertyId).toBe(
      s.requests.find((r) => r.id === first.id)!.propertyId,
    );
    expect(owner.propertyId).not.toBe(repeat.propertyId);
    expect(s.properties).toHaveLength(SEEDED + 1);
  });
  it("is idempotent and never re-homes a request whose address later changes", () => {
    const s = legacy();
    migratePmw(s);
    const after = JSON.parse(JSON.stringify(s));
    migratePmw(s);
    expect(s).toEqual(after);
    const [moved] = submitted(s);
    const original = moved.propertyId;
    moved.address = "Somewhere else entirely";
    migratePmw(s);
    expect(moved.propertyId).toBe(original);
    expect(s.properties).toHaveLength(SEEDED);
  });
  it("runs as part of migrateDispatch and survives a JSON round trip", () => {
    const s = migrateDispatch(legacy());
    expect(s.properties).toHaveLength(SEEDED);
    expect(s.walkthroughs).toEqual([]);
    expect(s.findings).toEqual([]);
    const restored: State = JSON.parse(JSON.stringify(s));
    expect(restored.properties).toEqual(s.properties);
    expect(restored.requests.map((r) => r.propertyId)).toEqual(
      s.requests.map((r) => r.propertyId),
    );
  });
  it("keys on normalized address, city and owner together", () => {
    const base = { address: "12 Elm St", city: "Oakville", accountId: "c1" };
    expect(propertyKey(base)).toBe(
      propertyKey({ ...base, address: "  12   ELM st " }),
    );
    expect(propertyKey(base)).not.toBe(
      propertyKey({ ...base, city: "Burlington" }),
    );
    expect(propertyKey(base)).not.toBe(
      propertyKey({ ...base, accountId: "c2" }),
    );
  });
});

describe("drafts and properties (ADR 064)", () => {
  it("gives a draft no property while it is written, and links it once submitted", () => {
    const s = seed();
    const before = s.properties.length;
    s.requests.push({
      ...s.requests[1],
      id: "fresh",
      status: "Draft",
      address: "",
      propertyId: undefined,
    });
    migratePmw(s);
    const fresh = s.requests.find((r) => r.id === "fresh")!;
    expect(fresh.propertyId).toBeUndefined();
    expect(s.properties).toHaveLength(before);
    fresh.address = "7 Brand New Lane";
    fresh.status = "Submitted";
    migratePmw(s);
    const p = s.properties.find((x) => x.id === fresh.propertyId)!;
    expect(p.address).toBe("7 Brand New Lane");
    expect(s.properties).toHaveLength(before + 1);
  });
  it("links a submitted draft typed at a known address to that property", () => {
    const s = seed();
    const known = s.requests[1];
    s.requests.push({
      ...known,
      id: "again",
      status: "Submitted",
      address: known.address.toLowerCase(),
      propertyId: undefined,
    });
    migratePmw(s);
    expect(s.requests.find((r) => r.id === "again")!.propertyId).toBe(
      known.propertyId,
    );
  });
  it("lists an account's saved addresses, most recently booked first", () => {
    const s = seed();
    const own = s.requests[1];
    const older = s.properties.find((p) => p.id === own.propertyId)!;
    s.properties.push({
      id: "newer",
      accountId: own.accountId,
      address: "9 Newer Court",
      city: "Oakville",
    });
    s.properties.push({
      id: "blank",
      accountId: own.accountId,
      address: " ",
      city: "Oakville",
    });
    s.requests.push({ ...own, id: "later", propertyId: "newer" });
    // A draft at the older one is not a booking, so it does not move it up.
    s.requests.push({
      ...own,
      id: "draft",
      status: "Draft",
      propertyId: older.id,
    });
    expect(savedAddresses(s, own.accountId).map((p) => p.id)).toEqual([
      "newer",
      older.id,
    ]);
    expect(savedAddresses(s, "nobody")).toEqual([]);
  });
});
