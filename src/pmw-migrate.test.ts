import { describe, it, expect } from "vitest";
import { seed, type State } from "./model";
import { migrateDispatch } from "./dispatch";
import { migratePmw, propertyKey } from "./pmw";

/**
 * Every seeded request is at its own address, so a correct migration produces
 * exactly this many properties. Derived rather than written as a number: the
 * count is a fact about the seed, and pinning it made four tests fail the day a
 * sixth request was added, none of which was about the seed's size.
 */
const SEEDED = seed().requests.length;

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
    expect(s.requests.every((r) => !!r.propertyId)).toBe(true);
    for (const r of s.requests) {
      const p = s.properties.find((p) => p.id === r.propertyId)!;
      expect(p.address).toBe(r.address);
      expect(p.city).toBe(r.city);
      expect(p.accountId).toBe(r.accountId);
    }
  });
  it("gives two requests at one address the same property, and never merges across customers", () => {
    const s = legacy();
    const [first] = s.requests;
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
    const moved = s.requests[0];
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
