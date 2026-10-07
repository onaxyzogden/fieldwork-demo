import { useEffect, useState } from "react";
import { questionAnswers } from "./clarification";
import { respondToOffer } from "./dispatch";
import { type State, accountName, dateLabel, money } from "./model";
import { markOfferSeen, offerSeen } from "./notifications";
import { contractorQueue } from "./roleQueues";
import { AllCaughtUp, QueueLayer, useOneAtATime } from "./QueueLayer";
import { When } from "./When";

/**
 * The contractor's offers, one per screen (ADR 062): the job and the pay, then
 * Accept, Decline with a reason in one tap, or Skip. Today's jobs already run
 * one step at a time in job mode (ADR 057), so they are not here.
 */
type Update = (fn: (d: State) => void, msg?: string) => void;

const REASONS = [
  "Not available",
  "Too far",
  "Pay doesn’t work",
  "Outside my skill set",
];

export default function ContractorQueue({
  s,
  update,
  provider,
  close,
}: {
  s: State;
  update: Update;
  provider: string;
  close: () => void;
}) {
  const offers = contractorQueue(s, provider, s.clock);
  const q = useOneAtATime(offers, (id) => offers.includes(id));
  return (
    <QueueLayer
      label="Offers"
      position={q.position}
      screen={q.screen}
      close={close}
    >
      {q.key ? (
        <Offer
          key={q.screen}
          s={s}
          id={q.key}
          update={update}
          done={() => q.advance(true)}
          skip={() => q.advance(false)}
        />
      ) : (
        <AllCaughtUp handled={q.handled} close={close} />
      )}
    </QueueLayer>
  );
}

function Offer({
  s,
  id,
  update,
  done,
  skip,
}: {
  s: State;
  id: string;
  update: Update;
  done: () => void;
  skip: () => void;
}) {
  const a = s.assignments.find((x) => x.id === id)!;
  const v = s.visits.find((x) => x.id === a.visitId)!;
  const r = s.requests.find((x) => x.id === v.requestId)!;
  const tasks = s.tasks.filter((t) => v.taskIds.includes(t.id));
  /* On screen is seen (ADR 060): the operator's "not opened yet" depends on
     it. Only an unopened offer writes. */
  const seen = offerSeen(s, id);
  useEffect(() => {
    if (seen && !seen.openedAt)
      update((d) => {
        markOfferSeen(d, id);
      });
  }, [id]);
  const [declining, setDeclining] = useState(false);
  /* respondToOffer refuses only an offer that stopped being one (expired,
     withdrawn); the queue passes over it either way, so it moves on. */
  const answer = (status: "Accepted" | "Declined", reason = "") => {
    update((d) => {
      respondToOffer(d, id, status, reason);
    });
    done();
  };
  return (
    <>
      <h1 tabIndex={-1}>{tasks[0]?.summary || "New job"}</h1>
      <div className="dq-request">
        <strong>
          {accountName(r.accountId)} · {r.city}
        </strong>
        <span>{dateLabel(v.start)}</span>
        <span>
          {v.duration} minutes · {tasks.length} task
          {tasks.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="finding-price">
        {money(a.pay)} <small>CAD · your pay</small>
      </p>
      <p className="onsite-hint">
        <When
          clock={s.clock}
          at={new Date(a.expiresAt).toISOString()}
          lead="Expires in"
        />
      </p>
      <details className="job-details">
        <summary>Details</summary>
        {tasks.map((t) => (
          <div key={t.id} className="dq-detail">
            <strong>{t.summary}</strong>
            <p>“{t.description}”</p>
            {questionAnswers(t).length > 0 && (
              <dl className="task-answers">
                {questionAnswers(t).map((row) => (
                  <div key={row.key}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {t.restricted && <p>Specialist eligibility required</p>}
          </div>
        ))}
      </details>
      <div className="onsite-bar">
        {declining ? (
          /* One tap declines and moves on; the reason goes to the operator. */
          <fieldset className="job-outcomes">
            <legend>Why are you declining?</legend>
            <div>
              {[...REASONS, "No reason"].map((why) => (
                <button
                  key={why}
                  className="secondary"
                  onClick={() =>
                    answer("Declined", why === "No reason" ? "" : why)
                  }
                >
                  {why}
                </button>
              ))}
            </div>
            <button className="text-button" onClick={() => setDeclining(false)}>
              Back
            </button>
          </fieldset>
        ) : (
          <>
            <button className="primary full" onClick={() => answer("Accepted")}>
              Accept job
            </button>
            <div className="row job-secondary">
              <button
                className="text-button"
                onClick={() => setDeclining(true)}
              >
                Decline
              </button>
              <button className="text-button" onClick={skip}>
                Skip
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
