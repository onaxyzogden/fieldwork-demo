import { type State, seed, reconcile } from "./model";
import { migrateDispatch } from "./dispatch";
import { seedWalkthroughs } from "./pmw";
import { deliverUpdates } from "./notifications";

export const KEY = "fieldwork-demo-v1";

/**
 * A first visit, or a reset: the sample data plus the two seeded walkthroughs.
 *
 * It lives here rather than in `seed()` because pmw.ts imports model.ts, so
 * model.ts cannot call back into it. That turns out to be the right seam
 * anyway — `seed()` stays the plain record set the logic tests build on, and
 * the demo content is added at the one place the demo actually starts.
 */
export function freshDemo(): State {
  const s = seed();
  seedWalkthroughs(s);
  return migrateDispatch(s);
}

/**
 * Collections every screen reads without checking. The migrations backfill the
 * ones added after the fact (`settings`, `notifications`, `properties`,
 * `walkthroughs`, `findings`), but nothing checks the original set — so a
 * saved state missing `tasks` used to sail through `load()` and throw later,
 * inside render, where there was no catch and no way back.
 */
const REQUIRED: (keyof State)[] = [
  "requests",
  "tasks",
  "visits",
  "assignments",
  "quotes",
  "payments",
  "events",
];

/** Thrown by load() when the stored state cannot be used. */
export class UnusableState extends Error {}

function checkShape(s: unknown): State {
  if (!s || typeof s !== "object" || Array.isArray(s))
    throw new UnusableState("Saved state is not an object.");
  const missing = REQUIRED.filter(
    (k) => !Array.isArray((s as Record<string, unknown>)[k]),
  );
  /* `clock` is the demo's idea of now. It is not a collection, but every
     timestamp is derived from it, so a state without one renders "Invalid
     Date" across three roles rather than failing anywhere useful. */
  if (typeof (s as Record<string, unknown>).clock !== "number")
    missing.push("clock");
  if (missing.length)
    throw new UnusableState(
      `Saved state is missing or has the wrong type for: ${missing.join(", ")}.`,
    );
  return s as State;
}

/**
 * The stored demo state, migrated forward, or a fresh seed on a first visit.
 *
 * Throws `UnusableState` rather than quietly reseeding when something is
 * already stored and cannot be read: discarding someone's work is a decision
 * they get to make, on the recovery screen, not one taken on their behalf by a
 * catch block.
 */
export function load(): State {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return freshDemo();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new UnusableState("Saved state is not valid JSON.");
  }
  if (parsed === null) return freshDemo();
  const checked = checkShape(parsed);
  try {
    return migrateDispatch(checked);
  } catch (err) {
    throw new UnusableState(
      `Saved state could not be migrated: ${(err as Error).message}`,
    );
  }
}

/**
 * The customer's assessment link. A URL parameter, not a secret — the
 * assessment page says so, the way the demo bar labels the rest of the
 * prototype.
 */
export const assessmentLink = (assessmentId: string) =>
  `${location.origin}${location.pathname}?view=assessment&id=${encodeURIComponent(assessmentId)}`;

/**
 * Whether the last write reached the browser.
 *
 * A demo that keeps everything in one localStorage key can run out of room,
 * and the failure is invisible from the inside: setItem throws, the app keeps
 * the change in memory, and the screen still shows it. The next reload is the
 * first time anyone finds out, by which point there is nothing to recover.
 * Photos are downscaled now (see photos.ts) so the ceiling is far away, but
 * "far away" is not "unreachable", and a write that does not land has to say
 * so rather than be swallowed by an empty catch.
 */
let failing = false;
const watchers = new Set<() => void>();

export function subscribeSaveHealth(fn: () => void) {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

/** True while the most recent write failed to persist. */
export function isSaveFailing() {
  return failing;
}

/**
 * What is on disk right now, or `fallback` when there is nothing readable
 * there. Unlike `load()` this never reseeds and never throws: a write in
 * progress is the wrong moment to decide someone's saved state is unusable,
 * and the recovery screen already owns that decision.
 */
function current(fallback: State): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed === null) return fallback;
    return migrateDispatch(checkShape(parsed));
  } catch {
    return fallback;
  }
}

type WriteOutcome = "written" | "stale" | "failed";

/**
 * Write, but only if nobody has written since `expectedRev`.
 *
 * The read and the write sit in one synchronous block, and JavaScript cannot
 * be preempted mid-block, so no other code *in this tab* can interleave. Two
 * tabs are genuinely concurrent, though, which is what the version check is
 * for: the loser sees a `rev` it did not expect and is told to start again
 * rather than saving over work it never saw.
 *
 * This is not a substitute for a server-side transaction. A backend has real
 * parallelism and needs a conditional write the database enforces; this is the
 * browser-shaped equivalent, and it is only sound because localStorage is
 * synchronous.
 */
function writeIfCurrent(draft: State, expectedRev: number): WriteOutcome {
  let onDisk: unknown = null;
  try {
    const raw = localStorage.getItem(KEY);
    onDisk = raw === null ? null : JSON.parse(raw);
  } catch {
    // Unreadable is not stale. Let the write proceed and replace it.
    onDisk = null;
  }
  const storedRev =
    onDisk && typeof onDisk === "object"
      ? ((onDisk as { rev?: number }).rev ?? 0)
      : null;
  if (storedRev !== null && storedRev !== expectedRev) return "stale";
  return save(draft) ? "written" : "failed";
}

export function save(s: State) {
  let ok = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (err) {
    ok = false;
    // Developers get the reason; the banner gives the user the consequence.
    console.error("fieldwork: could not persist state", err);
  }
  if (ok !== !failing) {
    failing = !ok;
    for (const fn of watchers) fn();
  }
  return ok;
}

/** How many times a losing write re-applies itself before giving up. */
const RETRIES = 3;

/**
 * Every write goes through one pipeline — read, migrate, mutate, reconcile,
 * deliver notifications, persist — so the guest assessment link and the
 * workspace cannot drift into two different ideas of what a write means.
 *
 * The read is the part that matters. `previous` is the state the calling tab
 * *rendered from*, which is not necessarily what is on disk: another tab may
 * have written since. Applying to `previous` and saving is how one customer's
 * confirmed appointment used to vanish — the second tab's clone never
 * contained the first tab's booking, and saved over it.
 *
 * So the change is applied to the newest state instead, and re-applied if
 * someone wins the race in between. Re-applying is safe because every mutation
 * in this codebase addresses records by id rather than by array position, so
 * the same `fn` against a newer state means the same thing. What it does *not*
 * mean is that the change is still valid — a booking whose slot was just taken
 * has to notice that itself, inside `fn`, which is why `bookVisit()` checks
 * availability at the point of writing rather than before the commit.
 */
export function commit(previous: State, fn: (draft: State) => void): State {
  let draft = previous;
  for (let attempt = 0; ; attempt++) {
    const base = current(previous);
    draft = migrateDispatch(structuredClone(base));
    fn(draft);
    reconcile(draft);
    draft.rev = (base.rev ?? 0) + 1;
    const outcome = writeIfCurrent(draft, base.rev ?? 0);
    if (outcome === "stale" && attempt < RETRIES) continue;
    // A failed write is still shown to this tab — the save-health banner is
    // what tells the user it did not land. A stale one that has run out of
    // retries is not persisted and not announced.
    if (outcome !== "stale") deliverUpdates(base, draft);
    return draft;
  }
}
