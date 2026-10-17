import { useEffect, useRef } from "react";
import { type State, money, dateLabel } from "./model";
import {
  findingEvidence,
  findingState,
  linkState,
  propertyRecord,
} from "./pmw";
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
  onAskFreshLink,
}: {
  s: State;
  propertyId: string;
  /** The operator's copy: a link in place of each assessment's status. The
   *  customer's copy shows the status in their words and a link beside it
   *  (ADR 063). */
  links?: boolean;
  /** The assessment this record is shown on, which needs no link to itself. */
  current?: string;
  /** The customer's copy only: ask for a fresh link to an assessment they can
   *  no longer open (ADR 098). */
  onAskFreshLink?: (walkthroughId: string) => void;
}) {
  const deadLink = (w: State["walkthroughs"][number]) => {
    const state = linkState(s, w);
    return w.status === "Sent" && (state === "revoked" || state === "expired");
  };
  /* Once the ask is recorded, focus goes to what the record now says, as the
     button it replaced is gone (ADR 098). */
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (!asked.current) return;
    const badge = document.getElementById(`link-${asked.current}`);
    asked.current = null;
    badge?.focus();
  });
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
              linkState(s, w) === "live" ? (
                <a
                  className="link"
                  href={assessmentLink(w.access.token)}
                  target="_blank"
                  rel="noopener"
                >
                  Open assessment
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                /* A link that no longer works is not offered (ADR 095). */
                <span className="muted">
                  {linkState(s, w) === "revoked"
                    ? "Link withdrawn"
                    : "Link expired"}
                </span>
              )
            ) : links ? (
              <span className="badge">{w.status}</span>
            ) : (
              <span className="row record-links">
                {/* A link that no longer works is not offered, and an
                    assessment the customer cannot open is not awaiting them
                    (ADR 096). */}
                <span className="badge" id={`link-${w.id}`} tabIndex={-1}>
                  {w.status === "Sent" && !w.access
                    ? "No link yet"
                    : deadLink(w) && w.access?.freshLinkRequestedAt
                    ? "Fresh link requested"
                    : w.status === "Sent" && linkState(s, w) === "revoked"
                    ? "Link withdrawn"
                    : w.status === "Sent" && linkState(s, w) === "expired"
                      ? "Link expired"
                      : customerAssessmentText(w.status)}
                </span>
                {w.status !== "Draft" &&
                  linkState(s, w) === "live" &&
                  w.id !== current && (
                    <a className="link" href={assessmentLink(w.access!.token)}>
                      Open assessment
                    </a>
                  )}
                {/* The customer's own move while the link is dead: ask for
                    another, once. Focus goes to what it now says (ADR 098). */}
                {onAskFreshLink &&
                  deadLink(w) &&
                  !w.access?.freshLinkRequestedAt && (
                    <button
                      className="text-button"
                      onClick={() => {
                        asked.current = w.id;
                        onAskFreshLink(w.id);
                      }}
                    >
                      Ask for a fresh link
                    </button>
                  )}
              </span>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
