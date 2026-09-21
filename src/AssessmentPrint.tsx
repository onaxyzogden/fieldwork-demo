import { type State, money, dateLabel, customerName } from "./model";
import { assessmentTotals, findingState, money2, quotable } from "./pmw";

const STEPS = [
  "Review findings",
  "Approve selected work",
  "Secure payment method",
  "Schedule & complete",
  "Receipt & record",
];

/**
 * The printable assessment.
 *
 * Rendered from the same records and the same derived helpers as the screen,
 * always present and hidden until print, so the document cannot drift from what
 * the customer was shown. There is deliberately no second data path here — the
 * assessment id and finding numbers are the ones on screen, not copies.
 */
export default function AssessmentPrint({
  s,
  walkthroughId,
}: {
  s: State;
  walkthroughId: string;
}) {
  const w = s.walkthroughs.find((x) => x.id === walkthroughId);
  if (!w) return null;
  const property = s.properties.find((p) => p.id === w.propertyId);
  const totals = assessmentTotals(s, w.id);
  return (
    <div className="pmw-print" aria-hidden="true">
      <header className="pmw-print-head">
        <div>
          <strong>PMW</strong>
          <span>Property Maintenance Walkthrough</span>
          <small>Identify. Approve. Maintain.</small>
        </div>
        <h1>Property maintenance assessment</h1>
      </header>
      <dl className="pmw-print-meta">
        <div>
          <dt>Prepared for</dt>
          <dd>{customerName(property?.customerId || "")}</dd>
        </div>
        <div>
          <dt>Property</dt>
          <dd>
            {property?.address}, {property?.city}
          </dd>
        </div>
        <div>
          <dt>Walkthrough date</dt>
          <dd>{dateLabel(w.sentAt || w.date)}</dd>
        </div>
        <div>
          <dt>Assessment ID</dt>
          <dd>{w.assessmentId}</dd>
        </div>
      </dl>
      <p>
        This walkthrough documents visible maintenance items observed at the
        property. There is no obligation to proceed. Each finding can be
        approved individually, deferred for later, or flagged for further
        assessment.
      </p>

      {totals.findings.map((f) => (
        <section className="pmw-print-finding" key={f.id}>
          <div className="pmw-print-photo">
            {f.photos[0] ? (
              <img src={f.photos[0]} alt="" />
            ) : (
              <span>No photo</span>
            )}
          </div>
          <div>
            <h2>
              {String(f.number).padStart(2, "0")} ·{" "}
              {f.title || "Untitled finding"}
            </h2>
            {f.area && (
              <p>
                <strong>Location:</strong> {f.area}
              </p>
            )}
            <h3>Observed</h3>
            <p>{f.observed}</p>
            <h3>Proposed work</h3>
            <p>{f.proposed}</p>
            <div className="pmw-print-decision">
              <span>
                {quotable(f) ? `${money(f.price || 0)} + applicable tax` : "—"}
              </span>
              <span>{findingState(s, f)}</span>
            </div>
          </div>
        </section>
      ))}

      <h2>Work summary</h2>
      <table className="pmw-print-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Maintenance / repair</th>
            <th>Status</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {totals.findings.map((f) => (
            <tr key={f.id}>
              <td>{String(f.number).padStart(2, "0")}</td>
              <td>{f.title || "Untitled finding"}</td>
              <td>{findingState(s, f)}</td>
              <td>{quotable(f) ? money(f.price || 0) : "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Approved work subtotal</td>
            <td>{money(totals.subtotal)}</td>
          </tr>
          <tr>
            <td colSpan={3}>Applicable tax</td>
            <td>{money2(totals.tax)}</td>
          </tr>
          <tr>
            <td colSpan={3}>Approved total</td>
            <td>{money2(totals.total)}</td>
          </tr>
        </tfoot>
      </table>

      <h2>Approval &amp; payment</h2>
      <p>
        The customer authorizes the items selected in this assessment according
        to the corresponding scope and approved pricing. Any material change or
        additional work outside the approved scope requires customer approval
        before additional charges are incurred.
      </p>
      <dl className="pmw-print-meta">
        <div>
          <dt>Approved items</dt>
          <dd>{totals.approved.length}</dd>
        </div>
        <div>
          <dt>Approved amount</dt>
          <dd>{money(totals.subtotal)} + applicable tax</dd>
        </div>
        <div>
          <dt>Authorized by</dt>
          <dd>{w.authorization?.name || "—"}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>
            {w.authorization ? dateLabel(w.authorization.agreedAt) : "—"}
          </dd>
        </div>
      </dl>
      <p>
        A valid payment method must be on file before approved work is
        scheduled. Card details are never recorded on this document; payment
        credentials are handled by the payment provider.
      </p>
      <ol className="pmw-print-steps">
        {STEPS.map((label, i) => (
          <li key={label}>
            <strong>{i + 1}</strong>
            {label}
          </li>
        ))}
      </ol>
      <p>
        <strong>Digital record.</strong> The assessment ID and item numbers on
        this document match the digital PMW record exactly. Approved findings
        move into scheduling and job progress; deferred findings remain attached
        to the property as part of its maintenance history.
      </p>
    </div>
  );
}
