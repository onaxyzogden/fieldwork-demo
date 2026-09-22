import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Printer,
  Wallet,
} from "lucide-react";
import {
  type State,
  type Finding,
  money,
  dateLabel,
  customerName,
  uid,
} from "./model";
import {
  assessmentTotals,
  convertApproved,
  decide,
  findingEvidence,
  findingState,
  money2,
  quotable,
  requestAssessment,
} from "./pmw";
import { KEY, load, commit } from "./store";
import { SaveWarning } from "./NotificationUI";
import AssessmentPrint from "./AssessmentPrint";
import PropertyRecord from "./PropertyRecord";
import "./tokens.css";
import "./base.css";
import "./layout.css";
import "./responsive.css";
import "./typography.css";
import "./work.css";
import "./primitives.css";
import "./customer-concept.css";
import "./cards.css";
import "./assessment.css";

/** The five steps the printed template names, shown as live progress. */
const TRACK = [
  "Review findings",
  "Approve work",
  "Payment method",
  "Scheduled",
  "Completed",
];

export default function Assessment({ assessmentId }: { assessmentId: string }) {
  const [s, setS] = useState<State>(load);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [authority, setAuthority] = useState(false);
  const [method, setMethod] = useState(false);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      /* Outside render, so a throw here would escape the boundary. An
         unreadable write from the operator's tab leaves this page as it was. */
      try {
        setS(load());
      } catch (err) {
        console.error("fieldwork: ignoring an unreadable update", err);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const update = (fn: (d: State) => void) => setS((prev) => commit(prev, fn));

  const w = s.walkthroughs.find((x) => x.assessmentId === assessmentId);
  if (!w || w.status === "Draft")
    return (
      <main className="assessment">
        <header className="assessment-head">
          <strong className="brand-mini">PMW</strong>
          <h1>Assessment not found</h1>
          <p>
            This link does not match an assessment that has been sent. Check the
            link with whoever sent it.
          </p>
        </header>
      </main>
    );

  const property = s.properties.find((p) => p.id === w.propertyId);
  const totals = assessmentTotals(s, w.id);
  const request = s.requests.find((r) => r.walkthroughId === w.id);
  const quote = s.quotes.find((q) => q.requestId === request?.id);
  const paid = s.payments.some(
    (p) => p.quoteId === quote?.id && p.status === "Paid",
  );
  const visit = s.visits.find(
    (v) => v.requestId === request?.id && v.status !== "Cancelled",
  );
  const done =
    !!request &&
    s.tasks
      .filter((t) => t.requestId === request.id)
      .every((t) => t.status === "Completed");
  /* The first step not yet reached: everything before it is done, it is the
     one in progress. Reviewing the findings counts as reached on arrival. */
  const step = !request ? 1 : !paid ? 2 : !visit ? 3 : !done ? 4 : TRACK.length;

  const submit = () => {
    if (!totals.approved.length)
      return setError("Approve at least one item before continuing.");
    if (!name.trim()) return setError("Enter the name authorizing this work.");
    if (!authority)
      return setError("Confirm you are authorized to approve this work.");
    if (!method)
      return setError("Add the simulated payment method to continue.");
    setError("");
    update((d) => {
      const target = d.walkthroughs.find((x) => x.id === w.id)!;
      target.authorization = {
        name: name.trim(),
        agreedAt: new Date(d.clock).toISOString(),
      };
      const created = convertApproved(d, w.id);
      const q = d.quotes.find((q) => q.requestId === created?.id);
      if (q)
        d.payments.push({
          id: uid(),
          quoteId: q.id,
          status: "Paid",
          amount: q.amount,
          reference: "demo_" + uid(),
        });
    });
  };

  return (
    <>
      <SaveWarning />
      <main className="assessment">
        <header className="assessment-head">
          <div className="row between">
            <div>
              <strong className="brand-mini">PMW</strong>
              <small>Property Maintenance Walkthrough</small>
            </div>
            <button className="text-button" onClick={() => window.print()}>
              <Printer size={16} /> Print / Save PDF
            </button>
          </div>
          <span className="eyebrow">ASSESSMENT {w.assessmentId}</span>
          <h1>
            {property?.address}, {property?.city}
          </h1>
          <p>
            Prepared for {customerName(property?.customerId || "")} ·{" "}
            {dateLabel(w.sentAt || w.date)} · {totals.findings.length} finding
            {totals.findings.length === 1 ? "" : "s"}
          </p>
          <p className="note">
            This walkthrough records visible maintenance items. There is no
            obligation to proceed — approve what you want done, defer the rest.
          </p>
        </header>

        {request && (
          <section className="card panel">
            <div className="status-track">
              {TRACK.map((label, i) => (
                <div
                  className={
                    "status-step " +
                    (i < step ? "done" : i === step ? "active" : "")
                  }
                  key={label}
                >
                  {label}
                </div>
              ))}
            </div>
            <p className="note">
              {done
                ? "This work is complete. The record below is kept against the property."
                : visit
                  ? `Scheduled for ${dateLabel(visit.start)}.`
                  : "Approved. The operator will schedule these items."}
            </p>
          </section>
        )}

        {totals.findings.map((f) => (
          <FindingReview
            key={f.id}
            s={s}
            finding={f}
            locked={!!request || w.status === "Converted"}
            onDecide={(decision) =>
              update((d) => {
                decide(d, f.id, decision);
              })
            }
            onAssessment={() =>
              update((d) => {
                requestAssessment(d, f.id);
              })
            }
          />
        ))}

        <section className="card panel assessment-summary">
          <div className="panel-title">
            <h3>Work summary</h3>
          </div>
          <table className="assessment-table">
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
          </table>
          <div className="row between">
            <span>Approved work subtotal</span>
            <strong>{money(totals.subtotal)}</strong>
          </div>
          <div className="row between">
            <span>Applicable tax</span>
            <strong>{money2(totals.tax)}</strong>
          </div>
          <div className="row between assessment-total">
            <span>Approved total</span>
            <strong>{money2(totals.total)}</strong>
          </div>
        </section>

        {!request && (
          <section className="card panel">
            <div className="panel-title">
              <h3>Approval &amp; payment</h3>
            </div>
            <p>
              Approving authorizes the selected items at the prices shown. Any
              work outside that scope needs your approval before it is carried
              out.
            </p>
            <label className="field">
              Authorized by
              <input
                value={name}
                placeholder="Your name"
                aria-invalid={!!error && !name.trim() ? true : undefined}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="assessment-check">
              <input
                type="checkbox"
                checked={authority}
                onChange={(e) => setAuthority(e.target.checked)}
              />
              I am authorized to approve maintenance work at this property.
            </label>
            <button
              className={"payment-method " + (method ? "chosen" : "")}
              onClick={() => setMethod(!method)}
            >
              <Wallet />
              <div>
                <strong>
                  {method ? "Payment method on file" : "Add payment method"}
                </strong>
                <small>Simulated · test card •••• 4242, no real charge</small>
              </div>
              {method ? <Check size={16} /> : null}
            </button>
            <p className="note">
              A payment method is authorized, not charged, before work is
              scheduled. Card details are never entered on this page.
            </p>
            {error && (
              <span className="field-message" role="alert">
                {error}
              </span>
            )}
            <button className="primary full" onClick={submit}>
              Approve {totals.approved.length} item
              {totals.approved.length === 1 ? "" : "s"} · {money2(totals.total)}
            </button>
          </section>
        )}

        {done && (
          <section className="card panel">
            <div className="panel-title">
              <h3>Keep this record</h3>
            </div>
            <p>
              Create a Fieldwork account to keep this property's history,
              receipts and deferred items in one place. Nothing here depends on
              it.
            </p>
            <button className="secondary">Create an account later</button>
          </section>
        )}

        {request && property && (
          <details className="card panel">
            <summary>
              <strong>This property's maintenance record</strong>
            </summary>
            <PropertyRecord s={s} propertyId={property.id} />
          </details>
        )}

        <footer className="assessment-foot">
          <p className="note">
            Interactive prototype · this link is a demo URL, not a secured
            private link. All data and transactions are simulated.
          </p>
        </footer>
      </main>
      <AssessmentPrint s={s} walkthroughId={w.id} />
    </>
  );
}

function FindingReview({
  s,
  finding: f,
  locked,
  onDecide,
  onAssessment,
}: {
  s: State;
  finding: Finding;
  locked: boolean;
  onDecide: (decision: "Approved" | "Not Now") => void;
  onAssessment: () => void;
}) {
  const number = String(f.number).padStart(2, "0");
  const state = findingState(s, f);
  const evidence = findingEvidence(s, f);
  const far = f.pricing === "Further Assessment Required";
  return (
    <section className="card panel finding">
      <div className="panel-title">
        <h3>
          {number} · {f.title || "Untitled finding"}
        </h3>
        <span className={"badge " + (f.decision === "Approved" ? "green" : "")}>
          {state}
        </span>
      </div>
      {f.area && <small>{f.area}</small>}
      <div className="photos">
        {f.photos.map((src, i) => (
          <img key={i} src={src} alt={`Finding ${number} condition`} />
        ))}
      </div>
      <p>
        <strong>Observed.</strong> {f.observed}
      </p>
      <p>
        <strong>Proposed work.</strong> {f.proposed}
      </p>
      {f.customerNotes && <p className="note">{f.customerNotes}</p>}
      {evidence.after.length > 0 && (
        <>
          <p>
            <strong>Completed.</strong> {evidence.note}
          </p>
          <div className="photos">
            {evidence.after.map((src, i) => (
              <img key={i} src={src} alt={`Finding ${number} after the work`} />
            ))}
          </div>
        </>
      )}
      {/* Further assessment is a pricing classification, so it gets a status and
          a way to ask — never an approve control beside a price that does not
          exist yet. */}
      {far ? (
        <div className="finding-decision">
          <span className="badge neutral">
            <ClipboardCheck size={16} /> Assessment required before pricing
          </span>
          <p className="note">
            We can see there is an issue here, but not enough to price the
            repair responsibly from a walkthrough.
          </p>
          {f.followUpRequestedAt ? (
            <p className="note">
              <Clock size={16} /> Assessment requested. The operator will follow
              up.
            </p>
          ) : (
            <button className="secondary" onClick={onAssessment}>
              Request an assessment
            </button>
          )}
        </div>
      ) : (
        <div className="finding-decision">
          <strong className="finding-price">
            {money(f.price || 0)} + applicable tax
          </strong>
          {locked ? (
            <span className="badge">{state}</span>
          ) : (
            <div className="row actions">
              <button
                className={f.decision === "Approved" ? "primary" : "secondary"}
                onClick={() => onDecide("Approved")}
              >
                {f.decision === "Approved" ? <CheckCircle2 size={16} /> : null}{" "}
                Approve
              </button>
              <button
                className={f.decision === "Not Now" ? "chosen" : "text-button"}
                onClick={() => onDecide("Not Now")}
              >
                Not now
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
