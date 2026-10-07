/**
 * How long until something, the way a person says it (ADR 063): "2 days",
 * "1 h 40 m", "25 min". Null once it has passed — a countdown that has run out says
 * nothing rather than "0 min" or a negative.
 *
 * Measured against the demo clock, not the wall clock, so "Advance clock" in
 * Demo settings moves every countdown with it.
 */
export function countdown(clock: number, at: string | number) {
  const minutes = Math.ceil((+new Date(at) - clock) / 60000);
  if (!(minutes > 0)) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const days = Math.floor(h / 24);
  return {
    text: days
      ? `${days} day${days === 1 ? "" : "s"}`
      : h
        ? m
          ? `${h} h ${m} m`
          : `${h} h`
        : `${m} min`,
    /** Under an hour: shown in the warning colour. */
    soon: minutes < 60,
  };
}
