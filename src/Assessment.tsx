import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Clock, Printer } from "lucide-react";
import {
  type State,
  type Finding,
  money,
  dateLabel,
  accountName,
  accounts,
  contactsFor,
  mayApprove,
} from "./model";
import {
  approveAssessment,
  assessmentTotals,
  decide,
  findingEvidence,
  findingState,
  money2,
  quotable,
  requestAssessment,
  byToken,
  recordOpen,
} from "./pmw";
import { forgetPaymentMethod, storePaymentMethod } from "./payments";
import { FindingStep, ReviewStep, WhoStep } from "./AssessmentSteps";
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
import "./onsite.css";
import "./assessment.css";

/** The five steps the printed template names, shown as live progress. */
const TRACK = [
  "Review findings",
  "Approve work",
  "Payment method",
  "Scheduled",
  "Completed",
];

export default function Assessment({
  token,
  legacyId,
}: {
  token: string;
  /** An old `?id=PMW-0001` link. Recognised only so it can be refused clearly. */
  legacyId?: string;
}) {
  const [s, setS] = useState<State>(load);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [approverId, setApproverId] = useState("");
  /* Where the customer is in the one-at-a-time flow: a finding's index, the
     review, or null for "wherever is next" (see `resume` below). */
  const [flowStep, setFlowStep] = useState<number | "review" | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [editingName, setEditingName] = useState(false);
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

  const lookup = byToken(s, token);
  const w = lookup.ok ? lookup.walkthrough : undefined;

  /* Recorded once per mount, not per render. This is the only thing on this
     page the operator genuinely could not learn before: whether the assessment
     they sent was ever opened. */
  const logged = useRef(false);
  useEffect(() => {
    if (!w || logged.current) return;
    logged.current = true;
    update((d) => {
      recordOpen(d, w.id);
    });
  }, [w?.id]);

  if (!w || w.status === "Draft") {
    /* Why, not just no. "Ask for a fresh one" and "this was withdrawn" are
       different things to say to whoever is holding the link, and a blank page
       is neither. */
    const [heading, detail] = legacyId
      ? [
          "This link is an old one",
          "Assessment links now carry a one-off reference rather than the assessment number. Ask whoever sent it for a fresh link.",
        ]
      : !lookup.ok && lookup.reason === "expired"
        ? [
            "This link has expired",
            "Assessment links stop working after a set period. Ask whoever sent it for a fresh one — the assessment itself is still there.",
          ]
        : !lookup.ok && lookup.reason === "revoked"
          ? [
              "This link has been withdrawn",
              "Whoever sent this assessment has withdrawn the link. Get in touch with them if you still need to see it.",
            ]
          : [
              "Assessment not found",
              "This link does not match an assessment that has been sent. Check the link with whoever sent it.",
            ];
    return (
      <main className="assessment">
        <header className="assessment-head">
          <strong className="brand-mini">PMW</strong>
          <h1>{heading}</h1>
          <p>{detail}</p>
        </header>
      </main>
    );
  }

  const property = s.properties.find((p) => p.id === w.propertyId);
  /* An individual signs their own name and that identifies them. An
     organization has several people who could approve, so the role is part of
     the record rather than a nicety. */
  const org =
    accounts.find((a) => a.id === property?.accountId)?.type === "organization";
  /* An organization has several people who could be approving, and the rule is
     checked against a contact rather than a typed name — so the page has to
     ask which one. An individual has exactly one, so there is nothing to ask. */
  const people = contactsFor(property?.accountId || "").filter(
    (c) => !c.inactiveAt,
  );
  const approver = org ? approverId : people[0]?.id;
  const approverContact = people.find((c) => c.id === approver);
  const totals = assessmentTotals(s, w.id);
  /* An individual signs as themselves unless they correct it; an
     organisation's approver is whoever they tapped, with that contact's role. */
  const signedName = (editingName ? name : "") || approverContact?.name || "";
  const signedRole = org ? approverContact?.role || role : "";
  const card = (s.paymentMethods ?? []).find(
    (m) => m.accountId === property?.accountId,
  );
  /* The first finding still waiting for an answer, else the review. Further
     assessment items are shown on the way past but never hold the customer
     back, since they have nothing to approve. */
  const firstPending = totals.findings.findIndex(
    (f) => f.decision === "Pending" && quotable(f),
  );
  const at = flowStep ?? (firstPending >= 0 ? firstPending : "review");
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

  const refusal: Record<string, string> = {
    "nothing approved": "Approve at least one item before continuing.",
    approver: org
      ? "Choose someone with authority to approve work for this account."
      : "This assessment can only be approved by the account holder.",
    name: "Enter the name authorizing this work.",
    payment: "Add a payment method to continue.",
    closed: "This assessment has already been approved.",
  };
  const approve = () => {
    const by = {
      name: signedName,
      role: signedRole,
      contactId: approver || undefined,
    };
    /* Asked of a copy first, so the reason can be shown without writing
       anything; the real write runs only when the copy says it would land. */
    const trial = approveAssessment(structuredClone(s), w.id, by);
    if (!trial.ok) return setError(refusal[trial.reason]);
    setError("");
    update((d) => {
      approveAssessment(d, w.id, by);
    });
  };
  const decideFinding = (f: Finding, decision: "Approved" | "Not Now") => {
    const trial = structuredClone(s);
    if (!decide(trial, f.id, decision, approver)) {
      setError(
        org && !approverId
          ? "Choose who is approving first."
          : "That contact is not authorized to approve work for this account. Ask whoever manages it to grant approval, or choose someone who has it.",
      );
      return;
    }
    setError("");
    update((d) => {
      decide(d, f.id, decision, approver);
    });
    const i = totals.findings.indexOf(f);
    setFlowStep(i + 1 < totals.findings.length ? i + 1 : "review");
  };
  const askForAssessment = (id: string) =>
    update((d) => {
      requestAssessment(d, id);
    });

  if (!request)
    return (
      <>
        <SaveWarning />
        <main className="assessment pmw-flow">
          <header className="pmw-flow-head">
            <div>
              <strong className="brand-mini">PMW</strong>{" "}
              <small>
                {property?.address}, {property?.city}
              </small>
            </div>
            <button className="text-button" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </button>
          </header>
          {org && (!approverId || choosing) ? (
            <WhoStep
              people={people}
              chosen={approverId}
              error={error}
              choose={(c) => {
                if (!mayApprove(s, property?.accountId || "", c.id))
                  return setError(
                    `${c.name} can’t approve work for this account. Ask whoever manages it to grant approval, or choose someone who can.`,
                  );
                setError("");
                setApproverId(c.id);
                setRole(c.role || "");
                setChoosing(false);
              }}
            />
          ) : at === "review" ? (
            <ReviewStep
              s={s}
              walkthroughId={w.id}
              approver={
                signedName + (org && signedRole ? `, ${signedRole}` : "")
              }
              changeApprover={() => {
                if (org) return setChoosing(true);
                setName(signedName);
                setEditingName(true);
              }}
              editingName={editingName}
              name={name}
              setName={setName}
              card={card}
              addCard={() =>
                update((d) => {
                  storePaymentMethod(d, property?.accountId || "", {
                    brand: "Visa",
                    last4: "4242",
                  });
                })
              }
              removeCard={() =>
                update((d) => {
                  forgetPaymentMethod(d, property?.accountId || "");
                })
              }
              error={error}
              open={(i) => {
                setError("");
                setFlowStep(i);
              }}
              requestAssessment={askForAssessment}
              approve={approve}
            />
          ) : (
            <FindingStep
              key={totals.findings[at]?.id}
              finding={totals.findings[at]}
              at={at}
              of={totals.findings.length}
              error={error}
              decide={(d) => decideFinding(totals.findings[at], d)}
              requestAssessment={() => askForAssessment(totals.findings[at].id)}
              next={() =>
                setFlowStep(at + 1 < totals.findings.length ? at + 1 : "review")
              }
              back={at > 0 ? () => setFlowStep(at - 1) : undefined}
            />
          )}
        </main>
        <AssessmentPrint s={s} walkthroughId={w.id} />
      </>
    );

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
            Prepared for {accountName(property?.accountId || "")} ·{" "}
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
                if (!decide(d, f.id, decision, approver) && decision === "Approved")
                  setError(
                    org && !approverId
                      ? "Choose who is approving, below."
                      : "That contact is not authorized to approve work for this account. Ask whoever manages it to grant approval, or choose someone who has it.",
                  );
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
