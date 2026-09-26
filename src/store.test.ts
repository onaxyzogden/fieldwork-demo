import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  load,
  save,
  isSaveFailing,
  subscribeSaveHealth,
  UnusableState,
  KEY,
  commit,
  freshDemo,
} from "./store";
import { seed, type State } from "./model";

/** A localStorage that can be told to run out of room. */
function storage(initial?: string) {
  let value: string | null = initial ?? null;
  const api = {
    full: false,
    getItem: (k: string) => (k === KEY ? value : null),
    setItem: (k: string, v: string) => {
      if (api.full) {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      }
      if (k === KEY) value = v;
    },
    removeItem: () => {
      value = null;
    },
    read: () => value,
  };
  return api;
}

const use = (s: ReturnType<typeof storage>) => vi.stubGlobal("localStorage", s);

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loading a saved state", () => {
  it("seeds a first visit", () => {
    use(storage());
    expect(load().requests.length).toBeGreaterThan(0);
  });

  it("seeds when the stored value is the literal null", () => {
    use(storage("null"));
    expect(load().requests.length).toBeGreaterThan(0);
  });

  it("round-trips a state it wrote itself", () => {
    const store = storage();
    use(store);
    const s = seed();
    save(s);
    expect(load().requests.length).toBe(s.requests.length);
  });

  /* The four shapes that used to render a blank page with no way back: the
     migrations only backfill the collections added after the fact, so nothing
     checked the original set and the throw landed inside render instead. */
  it("refuses a state that is not JSON", () => {
    use(storage("{{{"));
    expect(() => load()).toThrow(UnusableState);
  });

  it("refuses a state that is not an object", () => {
    use(storage("[1,2,3]"));
    expect(() => load()).toThrow(UnusableState);
  });

  it("refuses a state missing a collection every screen reads", () => {
    const s = seed() as Partial<State>;
    delete s.tasks;
    use(storage(JSON.stringify(s)));
    expect(() => load()).toThrow(/tasks/);
  });

  it("names every collection that is wrong, not just the first", () => {
    const s = seed() as Record<string, unknown>;
    delete s.tasks;
    s.visits = "not an array";
    use(storage(JSON.stringify(s)));
    expect(() => load()).toThrow(/tasks, visits/);
  });

  it("leaves the broken state on disk for the user to decide about", () => {
    const s = seed() as Partial<State>;
    delete s.tasks;
    const store = storage(JSON.stringify(s));
    use(store);
    expect(() => load()).toThrow(UnusableState);
    expect(store.read()).not.toBeNull();
  });
});

describe("a write that cannot be persisted", () => {
  it("reports failure instead of swallowing it", () => {
    const store = storage();
    use(store);
    expect(save(seed())).toBe(true);
    expect(isSaveFailing()).toBe(false);
    store.full = true;
    expect(save(seed())).toBe(false);
    expect(isSaveFailing()).toBe(true);
  });

  it("clears once a write lands again", () => {
    const store = storage();
    use(store);
    store.full = true;
    save(seed());
    expect(isSaveFailing()).toBe(true);
    store.full = false;
    save(seed());
    expect(isSaveFailing()).toBe(false);
  });

  it("tells whoever is listening, once per change", () => {
    const store = storage();
    use(store);
    const seen: boolean[] = [];
    const stop = subscribeSaveHealth(() => seen.push(isSaveFailing()));
    save(seed());
    store.full = true;
    save(seed());
    save(seed());
    store.full = false;
    save(seed());
    stop();
    expect(seen).toEqual([true, false]);
  });
});

describe("notifications are part of the state, not a view of it", () => {
  /**
   * A regression. `commit()` once serialized the draft and only then ran
   * `deliverUpdates()`, so every notification lived in the writing tab's
   * memory and nowhere else: visible until reload, gone afterwards. The
   * browser hid it, because the tab that raised one could always see it.
   */
  it("persists a notification raised by the same write", () => {
    const store = storage();
    use(store);
    const before = commit(freshDemo(), () => {});
    commit(before, (d) => {
      d.requests.find((r) => r.id === "r2")!.operatorNote = "Solid core?";
    });
    const onDisk = JSON.parse(store.read()!) as State;
    expect(
      (onDisk.notifications ?? []).some((n) => n.kind === "information"),
    ).toBe(true);
  });
  it("does not double them when a write has to be re-applied", () => {
    const store = storage();
    use(store);
    const before = commit(freshDemo(), () => {});
    const after = commit(before, (d) => {
      d.requests.find((r) => r.id === "r2")!.operatorNote = "Solid core?";
    });
    // One per recipient is correct — this kind goes to the operator and the
    // customer — so the property worth asserting is no recipient getting two.
    const raised = (after.notifications ?? []).filter(
      (n) => n.kind === "information",
    );
    expect(new Set(raised.map((n) => n.recipient)).size).toBe(raised.length);
    expect(raised.map((n) => n.recipient).sort()).toEqual([
      "Customer:c2",
      "Operator",
    ]);
  });
});
