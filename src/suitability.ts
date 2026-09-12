import { providers, scopeMatch, slots, type State, type Task } from "./model";
export function suitableProviders(
  s: State,
  tasks: Task[],
  city: string,
  timing: string,
  self = false,
) {
  const duration = tasks
    .filter((t) => !t.mergedInto)
    .reduce((n, t) => n + t.duration, 0);
  return providers
    .filter((p) => (self ? p.id === "yousef" : p.id !== "yousef"))
    .map((p) => ({
      provider: p,
      match: scopeMatch(p.id, tasks),
    }))
    .filter((p) => p.match.eligible)
    .map((p) => ({
      ...p,
      appointments: slots(s, p.provider.id, duration, city, undefined, timing),
    }))
    .sort(
      (a, b) =>
        (a.appointments.length ? 0 : 1) - (b.appointments.length ? 0 : 1) ||
        (a.appointments[0]?.travel ?? Infinity) -
          (b.appointments[0]?.travel ?? Infinity) ||
        a.provider.id.localeCompare(b.provider.id),
    );
}
