import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { commit, load, KEY } from "./store";
import {
  HOLD_MS,
  available,
  bookVisit,
  holdSlot,
  seed,
  type State,
} from "./model";

const PROVIDER = "marcus";

/** A weekday slot inside working hours, far enough out to be bookable. */
function slotThreeDaysOut(s: State) {
  const d = new Date(s.clock + 3 * 86400000);
  d.setUTCHours(15, 0, 0, 0);
  return d.toISOString();
}

/**
 * One localStorage shared by two "tabs", which is what two tabs of this app
 * actually have: same origin, same key, synchronous reads and writes.
 */
function sharedStorage() {
  let value: string | null = null;
  return {
    getItem: (k: string) => (k === KEY ? value : null),
    setItem: (k: string, v: string) => {
      if (k === KEY) value = v;
    },
    removeItem: () => {
      value = null;
    },
    read: () => (value === null ? null : (JSON.parse(value) as State)),
    seed: (s: State) => {
      value = JSON.stringify(s);
    },
  };
}

let store: ReturnType<typeof sharedStorage>;
beforeEach(() => {
  store = sharedStorage();
  vi.stubGlobal("localStorage", store);
  vi.spyOn(console, "error").mockImplementation(() => {});
  store.seed(seed());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("two tabs writing at once", () => {
  it("does not let the second tab's write erase the first tab's", () => {
    // Both tabs load the same state, as two open tabs do.
    const tabA = load();
    const tabB = load();

    commit(tabA, (d) => {
      d.requests.find((r) => r.id === "r1")!.notes = "written by tab A";
    });
    commit(tabB, (d) => {
      d.requests.find((r) => r.id === "r2")!.notes = "written by tab B";
    });

    const onDisk = store.read()!;
    expect(onDisk.requests.find((r) => r.id === "r2")!.notes).toBe(
      "written by tab B",
    );
    // The one that fails today: tab B cloned the state it rendered from, so
    // tab A's note was never in it and is gone from disk.
    expect(onDisk.requests.find((r) => r.id === "r1")!.notes).toBe(
      "written by tab A",
    );
  });

  it("does not let two tabs book the same provider at the same time", () => {
    const tabA = load();
    const tabB = load();
    const at = slotThreeDaysOut(tabA);

    // Both tabs check availability against their own copy, and both agree —
    // which is the whole problem, and is why the real check is inside the
    // write rather than here.
    expect(available(tabA, PROVIDER, 60, "Oakville", at)).toBe(true);
    expect(available(tabB, PROVIDER, 60, "Oakville", at)).toBe(true);

    const book = (s: State, requestId: string) => {
      let made: unknown = null;
      commit(s, (d) => {
        made = bookVisit(d, {
          requestId,
          taskIds: [],
          providerId: PROVIDER,
          start: at,
          duration: 60,
          travel: 8,
          city: "Oakville",
          opKey: "book-" + requestId,
        });
      });
      return made;
    };

    expect(book(tabA, "r1")).not.toBe(null);
    // The second tab is refused, rather than clashing or erasing the first.
    expect(book(tabB, "r2")).toBe(null);

    const onDisk = store.read()!;
    const clashing = onDisk.visits.filter(
      (v) => v.providerId === PROVIDER && v.start === at,
    );
    expect(clashing).toHaveLength(1);
    expect(clashing[0].requestId).toBe("r1");
  });

  it("returns the same visit for a repeated booking key", () => {
    const tab = load();
    const at = slotThreeDaysOut(tab);
    const once = (s: State) => {
      let made: { id: string } | null = null;
      const next = commit(s, (d) => {
        made = bookVisit(d, {
          requestId: "r1",
          taskIds: [],
          providerId: PROVIDER,
          start: at,
          duration: 60,
          travel: 8,
          city: "Oakville",
          opKey: "one-and-only",
        });
      });
      return { made: made as { id: string } | null, next };
    };
    const first = once(tab);
    const second = once(first.next);
    expect(first.made).not.toBe(null);
    expect(second.made!.id).toBe(first.made!.id);
    expect(store.read()!.visits.filter((v) => v.start === at)).toHaveLength(1);
  });

  it("holds a slot while someone is booking it, and lets it go when it lapses", () => {
    const tab = load();
    const at = slotThreeDaysOut(tab);
    const held = commit(tab, (d) => {
      holdSlot(d, {
        requestId: "r1",
        providerId: PROVIDER,
        start: at,
        duration: 60,
      });
    });
    // Another request cannot take it; the one holding it still can.
    expect(available(held, PROVIDER, 60, "Oakville", at, undefined, "", "r2")).toBe(
      false,
    );
    expect(available(held, PROVIDER, 60, "Oakville", at, undefined, "", "r1")).toBe(
      true,
    );
    // Nobody comes back to release an abandoned checkout, so it expires.
    const later = commit(held, (d) => {
      d.clock += HOLD_MS + 1000;
    });
    expect(later.holds).toHaveLength(0);
    expect(available(later, PROVIDER, 60, "Oakville", at, undefined, "", "r2")).toBe(
      true,
    );
  });

  it("gives the hold back once the visit exists", () => {
    const tab = load();
    const at = slotThreeDaysOut(tab);
    const after = commit(tab, (d) => {
      holdSlot(d, {
        requestId: "r1",
        providerId: PROVIDER,
        start: at,
        duration: 60,
      });
      bookVisit(d, {
        requestId: "r1",
        taskIds: [],
        providerId: PROVIDER,
        start: at,
        duration: 60,
        travel: 8,
        city: "Oakville",
        opKey: "held-then-booked",
      });
    });
    expect(after.holds).toHaveLength(0);
    expect(after.visits.filter((v) => v.start === at)).toHaveLength(1);
  });
});
