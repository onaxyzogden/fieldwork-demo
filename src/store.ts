import { type State, seed, reconcile } from "./model";
import { migrateDispatch } from "./dispatch";
import { deliverUpdates } from "./notifications";

export const KEY = "fieldwork-demo-v1";

/** The stored demo state, migrated forward, or a fresh seed. */
export function load(): State {
  try {
    return migrateDispatch(
      JSON.parse(localStorage.getItem(KEY) || "null") || seed(),
    );
  } catch {
    return migrateDispatch(seed());
  }
}

export function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
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
