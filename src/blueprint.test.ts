import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import Blueprint from "./Blueprint";
import { stages, entities, examples, roles } from "./blueprint-data";
afterEach(() => vi.unstubAllGlobals());
describe("developer blueprint", () => {
  it("covers eight unique stages with all four perspectives", () => {
    expect(stages).toHaveLength(8);
    expect(new Set(stages.map((s) => s.id)).size).toBe(8);
    for (const s of stages) {
      expect(Object.keys(s.lanes)).toEqual([...roles]);
      expect(s.trigger.length).toBeGreaterThan(10);
      expect(s.gate.length).toBeGreaterThan(10);
    }
  });
  it("has valid entity links and example stage references", () => {
    const ids = entities.map((e) => e.id);
    for (const s of stages)
      for (const id of s.records) expect(ids).toContain(id);
    for (const e of entities)
      for (const id of e.links) expect(ids).toContain(id);
    expect(examples).toHaveLength(6);
    for (const e of examples)
      for (const id of e.steps)
        expect(stages.some((s) => s.id === id)).toBe(true);
  });
  it("renders without writing or reading demo records", () => {
    const stored = {
      "fieldwork-demo-v1": '{"requests":[{"id":"existing-draft"}]}',
      "fieldwork-theme": "dark",
    };
    const before = JSON.stringify(stored);
    const getItem = vi.fn((key: keyof typeof stored) => stored[key]);
    const setItem = vi.fn();
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem, setItem, removeItem });
    const html = renderToString(createElement(Blueprint));
    expect(html).toContain("Read-only");
    expect(getItem.mock.calls.every(([key]) => key === "fieldwork-theme")).toBe(
      true,
    );
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(JSON.stringify(stored)).toBe(before);
  });
  it("prints all eight stages independently of the current filter", () => {
    const html = renderToString(createElement(Blueprint));
    expect(html).toContain("bp-print-overview");
    expect(html).toContain("bp-print-details");
    for (const stage of stages) expect(html).toContain(stage.subtitle);
  });
});
