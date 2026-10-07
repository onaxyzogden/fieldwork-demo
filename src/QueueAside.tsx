import { type AsideRole, asideFor } from "./aside";
import { type AuditEntry, type State, dateLabel, isChange } from "./model";
import "./work.css";

/**
 * A request's trail as a list, changes worded as changes. The request page's
 * History tab and the operator's side panel read it the same way.
 */
export function AuditList({ trail }: { trail: AuditEntry[] }) {
  return (
    <ul className="audit">
      {trail.map((e) => (
        <li key={e.id}>
          <span>{dateLabel(e.at)}</span>{" "}
          {isChange(e) ? (
            <>
              <strong>{e.actor}</strong> changed {e.field}
              {e.from ? ` from ${e.from}` : ""} to {e.to}
            </>
          ) : (
            e.text
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The desktop side panel beside a queue item (ADR 068): what the request is,
 * read-only, so the decision beside it never needs the request page to make
 * sense. Hidden below desktop width, where the queue keeps its one column.
 */
export default function QueueAside({
  s,
  role,
  requestId,
  visitId,
}: {
  s: State;
  role: AsideRole;
  requestId: string;
  visitId?: string;
}) {
  const a = asideFor(s, role, requestId, visitId);
  if (!a) return null;
  return (
    <aside className="onsite-aside" aria-label="Details">
      <h2>{a.title}</h2>
      <p>{a.where}</p>
      {a.when && <p className="muted">Visit · {dateLabel(a.when)}</p>}
      <h3>Tasks</h3>
      <ul className="aside-tasks">
        {a.tasks.map((t) => (
          <li key={t.id}>
            <strong>{t.summary}</strong>
            {t.answers.length > 0 && (
              <dl className="task-answers">
                {t.answers.map((row) => (
                  <div key={row.key}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {t.photos.length > 0 && (
              <div className="work-photos">
                {t.photos.map((p, i) => (
                  <img key={i} src={p} alt={`${t.summary}, photo ${i + 1}`} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {a.notes && (
        <>
          <h3>Notes</h3>
          <p>{a.notes}</p>
        </>
      )}
      {a.history.length > 0 && (
        <>
          <h3>Recent</h3>
          <AuditList trail={a.history} />
        </>
      )}
    </aside>
  );
}
