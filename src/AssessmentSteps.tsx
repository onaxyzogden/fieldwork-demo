import { useState } from "react";
import { ClipboardCheck, Clock, CreditCard } from "lucide-react";
import { type Contact, type Finding, type State, money } from "./model";
import {
  assessmentTotals,
  findingState,
  money2,
  quotable,
  undecided,
} from "./pmw";

/**
 * The customer's assessment, one decision at a time (ADR 058).
 *
 * Who is approving (organisations only, since an individual is one person),
 * then one finding per screen — the photo, what was seen, the work and its
 * price, and two answers — then a review that ends on one button. Nothing
 * here decides anything the data does not: approving a finding is decide(),
 * submitting is approveAssessment(), and both refuse on their own.
 */

export function WhoStep({
  people,
  chosen,
  error,
  choose,
}: {
  people: Contact[];
  chosen: string;
  error: string;
  choose: (c: Contact) => void;
}) {
  return (
    <section className="pmw-step">
      <h2>Who is approving?</h2>
      <p className="note">
        Tap your name. Approvals are recorded against the person who made them.
      </p>
      <div className="pmw-who">
        {people.map((c) => (
          <button
            key={c.id}
            aria-pressed={chosen === c.id}
            onClick={() => choose(c)}
          >
            <strong>{c.name}</strong>
            {c.role && <small>{c.role}</small>}
          </button>
        ))}
      </div>
      {error && (
        <span className="field-message" role="alert">
          {error}
        </span>
      )}
    </section>
  );
}

export function FindingStep({
  finding: f,
  at,
  of,
  error,
  decide,
  requestAssessment,
  next,
  back,
}: {
  finding: Finding;
  at: number;
  of: number;
  error: string;
  decide: (decision: "Approved" | "Not Now") => void;
  requestAssessment: () => void;
  next: () => void;
  back?: () => void;
}) {
  const number = String(f.number).padStart(2, "0");
  const far = f.pricing === "Further Assessment Required";
  return (
    <section className="pmw-step">
      <span className="eyebrow">
        Item {at + 1} of {of}
      </span>
      <h2>{f.title || "Untitled finding"}</h2>
      {f.area && <small className="pmw-muted">{f.area}</small>}
      {!!f.photos.length && (
        <div className="photos pmw-photos">
          {f.photos.map((src, i) => (
            <img key={i} src={src} alt={`Finding ${number} condition`} />
          ))}
        </div>
      )}
      {f.observed && (
        <p>
          <strong>What we saw.</strong> {f.observed}
        </p>
      )}
      {f.proposed && (
        <p>
          <strong>What we would do.</strong> {f.proposed}
        </p>
      )}
      {f.customerNotes && <p className="note">{f.customerNotes}</p>}

      {/* Further assessment is a pricing classification, so it gets a way to
          ask — never an approve control beside a price that does not exist
          yet (ADR 019). */}
      {far ? (
        <>
          <p className="note">
            <ClipboardCheck size={16} /> Assessment required before pricing. We
            can see there is an issue here, but not enough to price the repair
            responsibly from a walkthrough.
          </p>
          <div className="onsite-bar">
            {f.followUpRequestedAt ? (
              <>
                <p className="note">
                  <Clock size={16} /> Assessment requested. The operator will
                  follow up.
                </p>
                <button className="primary full" onClick={next}>
                  Next
                </button>
              </>
            ) : (
              <button
                className="primary full"
                onClick={() => {
                  requestAssessment();
                  next();
                }}
              >
                Request an assessment
              </button>
            )}
            <div className="row pmw-secondary">
              {back && (
                <button className="text-button" onClick={back}>
                  Back
                </button>
              )}
              {!f.followUpRequestedAt && (
                <button className="text-button" onClick={next}>
                  Skip
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <strong className="finding-price">
            {money(f.price || 0)} <small>+ applicable tax</small>
          </strong>
          {error && (
            <span className="field-message" role="alert">
              {error}
            </span>
          )}
          <div className="onsite-bar">
            <button
              className="primary full"
              aria-pressed={f.decision === "Approved"}
              onClick={() => decide("Approved")}
            >
              Approve · {money(f.price || 0)}
            </button>
            <div className="row pmw-secondary">
              {back && (
                <button className="text-button" onClick={back}>
                  Back
                </button>
              )}
              <button
                className={
                  "text-button" + (f.decision === "Not Now" ? " chosen" : "")
                }
                aria-pressed={f.decision === "Not Now"}
                onClick={() => decide("Not Now")}
              >
                Not now
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function ReviewStep({
  s,
  walkthroughId,
  approver,
  changeApprover,
  editingName,
  name,
  setName,
  card,
  addCard,
  removeCard,
  error,
  open,
  requestAssessment,
  approve,
}: {
  s: State;
  walkthroughId: string;
  /** "Sarah Lin" or "Maya Okonkwo, Property Manager". */
  approver: string;
  changeApprover: () => void;
  /** An individual correcting the name on their own approval. */
  editingName: boolean;
  name: string;
  setName: (name: string) => void;
  card?: { brand: string; last4: string };
  addCard: () => void;
  removeCard: () => void;
  error: string;
  open: (index: number) => void;
  requestAssessment: (findingId: string) => void;
  approve: () => void;
}) {
  const totals = assessmentTotals(s, walkthroughId);
  const left = undecided(s, walkthroughId).filter(quotable).length;
  return (
    <section className="pmw-step">
      <h2>Your approval</h2>
      <p className="note">
        There is no obligation to proceed. Approve what you want done; the rest
        stays on your property record.
      </p>
      <ul className="pmw-review">
        {totals.findings.map((f, i) => {
          const far = f.pricing === "Further Assessment Required";
          return (
            <li key={f.id}>
              <button className="text-button" onClick={() => open(i)}>
                <strong>{f.title || "Untitled finding"}</strong>
                <small>
                  {far
                    ? f.followUpRequestedAt
                      ? "Assessment requested"
                      : "Needs a closer look"
                    : findingState(s, f)}
                </small>
              </button>
              {far ? (
                !f.followUpRequestedAt && (
                  <button
                    className="text-button"
                    onClick={() => requestAssessment(f.id)}
                  >
                    Request an assessment
                  </button>
                )
              ) : (
                <span className={f.decision === "Approved" ? "" : "pmw-muted"}>
                  {money(f.price || 0)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="pmw-totals">
        <div className="row between">
          <span>Approved work</span>
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
      </div>

      <div className="pmw-line">
        {editingName ? (
          <label className="field">
            Approving as
            <input
              value={name}
              placeholder="Your name"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        ) : (
          <>
            <span>
              Approving as <strong>{approver}</strong>
            </span>
            <button className="text-button" onClick={changeApprover}>
              Change
            </button>
          </>
        )}
      </div>
      <div className="pmw-line">
        {card ? (
          <>
            <span>
              <CreditCard size={16} /> {card.brand} ···· {card.last4}
            </span>
            <button className="text-button" onClick={removeCard}>
              Change
            </button>
          </>
        ) : (
          <button className="secondary full" onClick={addCard}>
            <CreditCard size={16} /> Add payment method
          </button>
        )}
      </div>
      {left > 0 && (
        <p className="note">
          {left === 1
            ? "1 item you haven’t decided will be kept as “Not now”."
            : `${left} items you haven’t decided will be kept as “Not now”.`}{" "}
          They stay on your property record, and can be raised again at your
          next visit.
        </p>
      )}
      {error && (
        <span className="field-message" role="alert">
          {error}
        </span>
      )}
      <div className="onsite-bar">
        <button className="primary full" onClick={approve}>
          Approve {totals.approved.length} item
          {totals.approved.length === 1 ? "" : "s"} · {money2(totals.total)}
        </button>
        <p className="pmw-fine">
          By approving, you confirm you are authorized to approve maintenance
          work at this property. Your card is authorized, not charged, before
          work is scheduled.
        </p>
      </div>
    </section>
  );
}
