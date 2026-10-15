import { countdown } from "./countdown";
import { dateLabel } from "./model";

/**
 * "Expires in 1 h 40 m · Tue, Oct 6, 4:11 p.m." (ADR 063): how long first,
 * then when, muted. Under an hour the countdown takes the warning colour.
 * Once the moment has passed only the date is left.
 */
export function When({
  clock,
  at,
  lead,
}: {
  clock: number;
  at: string;
  /** "Expires in", "Starts in". */
  lead: string;
}) {
  const c = countdown(clock, at);
  return (
    <span className="when">
      {c && (
        <>
          <span className={c.soon ? "when-soon" : undefined}>
            {lead} {c.text}
            {/* The warning colour says it to the eye; this says it to the
                ear (ADR 082). */}
            {c.soon && <span className="sr-only">, soon</span>}
          </span>
          {" · "}
        </>
      )}
      <span className="when-at">{dateLabel(at)}</span>
    </span>
  );
}
