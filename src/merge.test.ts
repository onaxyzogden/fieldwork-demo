import { describe, it, expect } from "vitest";
import {
  addressKey,
  duplicateProperties,
  mergeProperties,
  resolveProperty,
  seed,
  uid,
  type Property,
  type State,
} from "./model";
import { createWalkthrough } from "./pmw";

/** A second record for a property the seed already has, as the app can produce. */
function twinned(s: State, overrides: Partial<Property> = {}) {
  const first = s.properties[0];
  const twin: Property = {
    id: uid(),
    accountId: first.accountId,
    // Same place, typed differently — which is how the duplicate arises.
    address: "  " + first.address.toUpperCase() + " ",
    city: first.city.toLowerCase(),
    ...overrides,
  };
  s.properties.push(twin);
  return { first, twin };
}

describe("spotting duplicate properties", () => {
  it("ignores case and spacing, the way the addresses are actually typed", () => {
    expect(addressKey({ address: " 12  Elm ST ", city: "Oakville" })).toBe(
      addressKey({ address: "12 Elm st", city: " oakville " }),
    );
  });
  it("finds nothing in the seed, where every address is its own", () => {
    expect(duplicateProperties(seed())).toEqual([]);
  });
  it("groups two records for one address", () => {
    const s = seed();
    const { first, twin } = twinned(s);
    const groups = duplicateProperties(s);
    expect(groups).toHaveLength(1);
    expect(groups[0].properties.map((p) => p.id).sort()).toEqual(
      [first.id, twin.id].sort(),
    );
    expect(groups[0].crossAccount).toBe(false);
  });
  it("flags a match that spans accounts rather than treating it as routine", () => {
    const s = seed();
    twinned(s, { accountId: "a1" });
    expect(duplicateProperties(s)[0].crossAccount).toBe(true);
  });
  it("does not group two genuinely different addresses", () => {
    const s = seed();
    twinned(s, { address: "Somewhere else entirely" });
    expect(duplicateProperties(s)).toEqual([]);
  });
});

describe("merging two records for one property", () => {
  it("moves the requests and walkthroughs, then removes the loser", () => {
    const s = seed();
    const { first, twin } = twinned(s);
    const w = createWalkthrough(s, twin.id);
    s.requests[0].propertyId = twin.id;

    expect(mergeProperties(s, first.id, twin.id)).toEqual({ ok: true });
    expect(s.properties.some((p) => p.id === twin.id)).toBe(false);
    expect(s.requests.every((r) => r.propertyId !== twin.id)).toBe(true);
    expect(s.walkthroughs.find((x) => x.id === w.id)!.propertyId).toBe(first.id);
    expect(s.requests[0].propertyId).toBe(first.id);
  });
  it("leaves an old id pointing somewhere true", () => {
    const s = seed();
    const { first, twin } = twinned(s);
    mergeProperties(s, first.id, twin.id);
    expect(resolveProperty(s, twin.id)).toBe(first.id);
    // An id that was never merged resolves to itself.
    expect(resolveProperty(s, first.id)).toBe(first.id);
  });
  it("follows a chain of merges to the record still standing", () => {
    const s = seed();
    const { first, twin } = twinned(s);
    const { twin: third } = twinned(s);
    mergeProperties(s, twin.id, third.id);
    mergeProperties(s, first.id, twin.id);
    expect(resolveProperty(s, third.id)).toBe(first.id);
  });
  it("refuses to move one account's history under another account", () => {
    const s = seed();
    const { first, twin } = twinned(s, { accountId: "a1" });
    const result = mergeProperties(s, first.id, twin.id);
    expect(result.ok).toBe(false);
    expect(s.properties.some((p) => p.id === twin.id)).toBe(true);
  });
  it("refuses rather than choosing which notes to discard", () => {
    const s = seed();
    s.properties[0].notes = "Key is with the neighbour";
    const { first, twin } = twinned(s, { notes: "Gate code 4821" });
    expect(mergeProperties(s, first.id, twin.id).ok).toBe(false);
    expect(s.properties.some((p) => p.id === twin.id)).toBe(true);
  });
  it("keeps detail the survivor was missing", () => {
    const s = seed();
    const { first, twin } = twinned(s, {
      notes: "Gate code 4821",
      unit: "Rear",
    });
    expect(mergeProperties(s, first.id, twin.id)).toEqual({ ok: true });
    const kept = s.properties.find((p) => p.id === first.id)!;
    expect(kept.notes).toBe("Gate code 4821");
    expect(kept.unit).toBe("Rear");
  });
  it("refuses a property that is not there, and refuses merging one with itself", () => {
    const s = seed();
    expect(mergeProperties(s, s.properties[0].id, "nope").ok).toBe(false);
    expect(
      mergeProperties(s, s.properties[0].id, s.properties[0].id).ok,
    ).toBe(false);
  });
  it("records the merge in the event log", () => {
    const s = seed();
    const { first, twin } = twinned(s);
    const before = s.events.length;
    mergeProperties(s, first.id, twin.id);
    expect(s.events.length).toBeGreaterThan(before);
    expect(s.events[0].text).toMatch(/merged duplicate property/i);
  });
});
