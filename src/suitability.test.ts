import { describe, it, expect } from "vitest";
import { seed, scopeMatch, eligible, type Task } from "./model";
import { suitableProviders } from "./suitability";
const tasks = (id: string) =>
  seed().tasks.filter((t) => t.requestId === id && !t.mergedInto);
describe("provider suitability", () => {
  it("matches a door to door-skilled contractors", () => {
    const s = seed(),
      door = tasks("r2").filter((t) => t.category.includes("Doors"));
    expect(
      suitableProviders(s, door, "Oakville", "").map((c) => c.provider.id),
    ).toEqual(["nina", "marcus"]);
    expect(scopeMatch("marcus", door).checks[0].reason).toContain(
      "Listed doors skill",
    );
  });
  it("requires every task in a four-task bundle", () => {
    const s = seed();
    expect(
      suitableProviders(s, tasks("r2"), "Oakville", "").map(
        (c) => c.provider.id,
      ),
    ).toEqual(["nina"]);
    expect(
      scopeMatch("marcus", tasks("r2")).checks.some(
        (c) => !c.fits && c.category.includes("Walls"),
      ),
    ).toBe(true);
  });
  it("matches furniture assembly and ranks by travel", () => {
    const s = seed();
    expect(
      suitableProviders(s, tasks("r3"), "Burlington", "").map(
        (c) => c.provider.id,
      ),
    ).toEqual(["marcus", "nina"]);
  });
  it("blocks unreviewed electrical work; reviewed work still requires eligibility", () => {
    const s = seed(),
      electrical = tasks("r4");
    expect(suitableProviders(s, electrical, "Milton", "")).toEqual([]);
    electrical.forEach((t) => (t.reviewed = true));
    expect(
      suitableProviders(s, electrical, "Milton", "").map((c) => c.provider.id),
    ).toEqual(["eli"]);
    expect(scopeMatch("nina", electrical).eligible).toBe(false);
  });
  it("referral cannot be made eligible by marking reviewed", () => {
    const s = seed(),
      t = {
        ...tasks("r3")[0],
        description: "Repair leaking roof",
        reviewed: true,
      };
    expect(suitableProviders(s, [t], "Oakville", "")).toEqual([]);
    expect(scopeMatch("yousef", [t]).checks[0].reason).toContain(
      "Referral-only",
    );
  });
  it("retains qualified providers when no appointment fits", () => {
    const s = seed(),
      long = tasks("r2").map((t) => ({ ...t, duration: 480 }));
    const list = suitableProviders(s, long, "Oakville", "");
    expect(list.map((c) => c.provider.id)).toEqual(["nina"]);
    expect(list[0].appointments).toEqual([]);
  });
  it("does not invent skills for mixed unsupported scope", () => {
    const s = seed();
    const list = [
      ...tasks("r3"),
      {
        ...tasks("r3")[0],
        id: "custom",
        category: "Special craft / Custom",
        reviewed: true,
      },
    ];
    expect(suitableProviders(s, list, "Oakville", "")).toEqual([]);
  });
  it("rejects empty scope and ignores merged records", () => {
    expect(eligible("nina", [])).toBe(false);
    const door = tasks("r2").filter((t) => t.category.includes("Doors"));
    const merged = { ...tasks("r4")[0], mergedInto: door[0].id };
    expect(scopeMatch("nina", [...door, merged]).eligible).toBe(true);
  });
  it("explanations and eligibility always use the same result", () => {
    for (const id of ["yousef", "marcus", "nina", "eli"])
      for (const request of ["r2", "r3", "r4"]) {
        const scope = tasks(request);
        expect(eligible(id, scope)).toBe(scopeMatch(id, scope).eligible);
        if (eligible(id, scope))
          expect(scopeMatch(id, scope).checks.every((c) => c.fits)).toBe(true);
      }
  });
  it("recomputes after scope edits without mutating saved data", () => {
    const s = seed();
    const before = JSON.stringify(s);
    const door = tasks("r2").filter((t) => t.category.includes("Doors"));
    expect(suitableProviders(s, door, "Oakville", "")).toHaveLength(2);
    door[0].reviewed = false;
    expect(suitableProviders(s, door, "Oakville", "")).toHaveLength(0);
    expect(JSON.stringify(s)).toBe(before);
  });
});
