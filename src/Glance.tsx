import { CalendarDays, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export type GlanceMetric = {
  label: string;
  value: ReactNode;
  /** Renders in the danger colour: the count that means somebody is waiting. */
  urgent?: boolean;
  /** Omitted where there is nowhere to go — a number that looks clickable and
   *  does nothing is the defect ADR 034 exists to stop. */
  onClick?: () => void;
};

/**
 * "Today at a glance", shared by all three roles.
 *
 * It was the operator's alone and hand-built inside OperatorHome. One component
 * is what keeps the three identical; three copies of the markup would have
 * drifted by the next round of feedback.
 *
 * `lead` is the next thing in the diary, and is optional: the operator's card
 * does not carry one, because its date chip and "Scheduled visits" already
 * answer what is next for someone whose whole screen is the schedule.
 */
export function Glance({
  date,
  onDate,
  lead,
  metrics,
}: {
  date: string;
  onDate?: () => void;
  lead?: ReactNode;
  metrics: GlanceMetric[];
}) {
  return (
    <section className="op-glance">
      <div className="op-glance-heading">
        <h2>Today at a glance</h2>
        {onDate ? (
          <button className="op-date" onClick={onDate}>
            <CalendarDays size={16} />
            {date}
            <ChevronRight size={16} />
          </button>
        ) : (
          <span className="op-date">
            <CalendarDays size={16} />
            {date}
          </span>
        )}
      </div>
      {lead && <div className="op-glance-lead">{lead}</div>}
      <div className="op-metrics">
        {metrics.map((m) =>
          m.onClick ? (
            <button
              key={m.label}
              className={m.urgent ? "op-pending" : ""}
              onClick={m.onClick}
            >
              <strong>{m.value}</strong>
              <span>{m.label}</span>
            </button>
          ) : (
            <div key={m.label} className={m.urgent ? "op-pending" : ""}>
              <strong>{m.value}</strong>
              <span>{m.label}</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

/**
 * The card's lead line: when, what, where. A button when there is something to
 * open, a plain block when there is not — the empty state has nothing behind
 * it, and a control with no effect is the ADR 034 defect.
 */
export function GlanceLead({
  when,
  what,
  where,
  onClick,
}: {
  when: string;
  what: string;
  where?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="eyebrow">{when}</span>
      <strong>{what}</strong>
      {where && <small>{where}</small>}
    </>
  );
  return onClick ? (
    <button className="op-glance-lead-open" onClick={onClick}>
      {body}
      <ChevronRight size={16} />
    </button>
  ) : (
    body
  );
}
