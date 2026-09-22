import { type State, seed, reconcile } from "./model";
import { migrateDispatch } from "./dispatch";
import { deliverUpdates } from "./notifications";

export const KEY = "fieldwork-demo-v1";

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
  if (raw === null) return migrateDispatch(seed());
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new UnusableState("Saved state is not valid JSON.");
  }
  if (parsed === null) return migrateDispatch(seed());
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

/**
 * Every write goes through one pipeline — clone, migrate, mutate, reconcile,
 * deliver notifications, persist — so the guest assessment link and the
 * workspace cannot drift into two different ideas of what a write means.
 */
export function commit(previous: State, fn: (draft: State) => void): State {
  const draft = migrateDispatch(structuredClone(previous));
  fn(draft);
  reconcile(draft);
  deliverUpdates(previous, draft);
  save(draft);
  return draft;
}
