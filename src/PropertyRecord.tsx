import { type State, money, dateLabel } from "./model";
import { findingEvidence, findingState, propertyRecord } from "./pmw";
import { assessmentLink } from "./store";
import { customerAssessmentText } from "./customerText";

/**
 * A property's maintenance history, assembled on read from records that already
 * exist — walkthroughs, findings, the tasks they became, and the visits that
 * carried them out. Nothing here is stored, so it cannot disagree with the work.
 */
export default function PropertyRecord({
  s,
  propertyId,
  links = false,
  current,
}: {
  s: State;
  propertyId: string;
  /** The operator's copy: a link in place of each assessment's status. The
   *  customer's copy shows the status in their words and a link beside it
   *  (ADR 063). */
  links?: boolean;
  /** The assessment this record is shown on, which needs no link to itself. */
  current?: string;
}) {
  const record = propertyRecord(s, propertyId);
  if (!record.walkthroughs.length) return null;
  const groups = [
    ["Deferred for later", record.deferred],
    ["Awaiting assessment", record.furtherAssessment],
    ["Approved and in progress", record.inFlight],
    ["Completed", record.completed],
  ] as const;
  return (
    <div className="property-record">
      <p className="note">
        {record.walkthroughs.length} walkthrough
        {record.walkthroughs.length === 1 ? "" : "s"} on record · last{" "}
        {dateLabel(
          record.lastWalkthrough.sentAt || record.lastWalkthrough.date,
        )}
      </p>
      {groups.map(([label, findings]) =>
        findings.length ? (
          <section key={label}>
            <div className="panel-title">
              <h3>{label}</h3>
              <span className="count">{findings.length}</span>
            </div>
            {findings.map((f) => {
              const evidence = findingEvidence(s, f);
              return (
                <div className="record-item" key={f.id}>
                  <div className="row between">
                    <strong>
                      {String(f.number).padStart(2, "0")} ·{" "}
                      {f.title || "Untitled finding"}
                    </strong>
                    <span className="badge">{findingState(s, f)}</span>
                  </div>
                  <small>
                    {f.area ? f.area + " · " : ""}
                    {f.pricing === "Quoted"
                      ? money(f.price || 0)
                      : "Not yet priced"}
                    {evidence.finishedAt
                      ? " · completed " + dateLabel(evidence.finishedAt)
                      : ""}
                  </small>
                  {evidence.note && <p className="note">{evidence.note}</p>}
                  {evidence.after.length > 0 && (
                    <div className="photos">
                      {evidence.after.map((src, i) => (
                        <img key={i} src={src} alt="Completed work" />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ) : null,
      )}
      <section>
        <div className="panel-title">
          <h3>Assessments</h3>
        </div>
        {record.walkthroughs.map((w) => (
          <div className="row between record-item" key={w.id}>
            <small>
              {w.assessmentId} · {dateLabel(w.sentAt || w.date)}
            </small>
            {links && w.status !== "Draft" && w.access?.token ? (
              <a
                className="link"
                href={assessmentLink(w.access.token)}
                target="_blank"
              >
                Open assessment
              </a>
            ) : links ? (
              <span className="badge">{w.status}</span>
            ) : (
              <span className="row record-links">
                <span className="badge">
                  {customerAssessmentText(w.status)}
                </span>
                {w.status !== "Draft" && w.access && w.id !== current && (
                  <a className="link" href={assessmentLink(w.access.token)}>
                    Open assessment
                  </a>
                )}
              </span>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
