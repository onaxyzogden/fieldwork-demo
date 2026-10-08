import { useState } from "react";
import { Wallet } from "lucide-react";
import {
  type State,
  answerQuestion,
  approveQuote,
  dateLabel,
  declineQuote,
  genericTitle,
  money,
  providers,
} from "./model";
import { approveCharge, declineCharge } from "./decisions";
import { payQuote } from "./payments";
import { taskLabel } from "./intake";
import { findingsFor, findingState } from "./pmw";
import { assessmentLink } from "./store";
import { type CustomerTodo, customerQueue } from "./roleQueues";
import { AllCaughtUp, QueueLayer, useOneAtATime } from "./QueueLayer";
import { useSwapFocus } from "./useSwapFocus";
import QueueAside from "./QueueAside";

/**
 * What is waiting on the customer, one thing per screen (ADR 062): a quote to
 * approve, a payment, our question, an assessment. Everything it writes is
 * the same function the portal's own buttons call.
 */
type Update = (fn: (d: State) => void, msg?: string) => void;

export const QUOTE_REASONS = [
  "Too expensive",
  "Changed my mind",
  "Found someone else",
];

export default function CustomerQueue({
  s,
  update,
  accountId,
  failPayment,
  close,
}: {
  s: State;
  update: Update;
  accountId: string;
  /** Demo settings' "Customer payments fail". */
  failPayment: boolean;
  close: () => void;
}) {
  const todos = customerQueue(s, accountId, s.clock);
  const find = (key: string) => todos.find((t) => t.key === key);
  const q = useOneAtATime(
    todos.map((t) => t.key),
    (key) => !!find(key),
    (key) => key.startsWith("w:"),
  );
  const todo = q.key ? find(q.key) : undefined;
  return (
    <QueueLayer
      label="Waiting on you"
      position={q.position}
      screen={q.screen}
      close={close}
      aside={
        /* An assessment has no request behind it, so no panel. */
        todo &&
        "requestId" in todo && (
          <QueueAside s={s} role="Customer" requestId={todo.requestId} />
        )
      }
    >
      {todo ? (
        <Step
          key={q.screen}
          s={s}
          todo={todo}
          update={update}
          failPayment={failPayment}
          done={() => q.advance(true)}
          skip={() => q.advance(false)}
        />
      ) : (
        <AllCaughtUp handled={q.handled} close={close} />
      )}
    </QueueLayer>
  );
}

function Step({
  s,
  todo,
  update,
  failPayment,
  done,
  skip,
}: {
  s: State;
  todo: CustomerTodo;
  update: Update;
  failPayment: boolean;
  done: () => void;
  skip: () => void;
}) {
  const [declining, setDeclining] = useState(false);
  const swap = useSwapFocus(declining);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  /** Run a write; move on only if it went through. */
  const act = (write: (d: State) => boolean, refusal: string) => {
    let ok = false;
    update((d) => {
      ok = write(d);
    });
    if (ok) done();
    else setError(refusal);
  };

  if (todo.kind === "assessment") {
    const w = s.walkthroughs.find((x) => x.id === todo.walkthroughId)!;
    const property = s.properties.find((p) => p.id === w.propertyId);
    const pending = findingsFor(s, w.id).filter(
      (f) => findingState(s, f) === "Pending decision",
    ).length;
    return (
      <>
        <h1 tabIndex={-1}>Your assessment is ready</h1>
        <div className="dq-request">
          <strong>{property?.address}</strong>
          <span>
            {pending} item{pending === 1 ? "" : "s"} to decide
          </span>
        </div>
        <p className="onsite-hint">
          Go through what we found, one item at a time, and approve what you
          want done.
        </p>
        <div className="onsite-bar">
          {/* Leaves the queue for the assessment's own one-at-a-time flow
              (ADR 058), which is why assessments come last. Sending creates
              the link, so a sent assessment has one. */}
          {w.access && (
            <a className="primary full" href={assessmentLink(w.access.token)}>
              Review assessment
            </a>
          )}
          <div className="row job-secondary">
            <button className="text-button" onClick={skip}>
              Skip
            </button>
          </div>
        </div>
      </>
    );
  }

  const r = s.requests.find((x) => x.id === todo.requestId)!;
  const quote =
    todo.kind === "question" || todo.kind === "charge"
      ? undefined
      : s.quotes.find((x) => x.id === todo.quoteId);
  const tasks = s.tasks.filter((t) => t.requestId === r.id && !t.mergedInto);
  const summary = (
    <>
      <div className="dq-request">
        <strong>{r.address}</strong>
        <span>{r.city}</span>
      </div>
      <ul className="job-list">
        {tasks.map((t) => (
          <li key={t.id}>
            <strong>{genericTitle(t) ? taskLabel(t) : t.summary}</strong>
          </li>
        ))}
      </ul>
    </>
  );
  const message = error && (
    <span className="field-message" role="alert">
      {error}
    </span>
  );

  if (todo.kind === "question")
    return (
      <>
        <h1 tabIndex={-1}>We have a question</h1>
        {summary}
        <p className="onsite-room">{r.operatorNote}</p>
        <label className={"field" + (error ? " field-error" : "")}>
          Your reply
          <textarea
            value={reply}
            aria-invalid={!!error || undefined}
            onChange={(e) => {
              setReply(e.target.value);
              setError("");
            }}
          />
          {message}
        </label>
        <div className="onsite-bar">
          <button
            className="primary full"
            onClick={() =>
              reply.trim()
                ? act(
                    (d) => answerQuestion(d, r.id, reply),
                    "Your reply couldn’t be sent. Try again.",
                  )
                : setError("Write your reply before sending.")
            }
          >
            Send
          </button>
          <div className="row job-secondary">
            <button className="text-button" onClick={skip}>
              Skip
            </button>
          </div>
        </div>
      </>
    );

  if (todo.kind === "charge") {
    /* An additional charge for a return visit (ADR 065): approving pays it,
       and the return visit is booked straight after. */
    const c = s.charges!.find((x) => x.id === todo.chargeId)!;
    const who = providers.find((p) => p.id === c.plan.providerId)?.name;
    return (
      <>
        <h1 tabIndex={-1}>Additional charge</h1>
        {summary}
        <p className="finding-price">
          {money(c.amount)} <small>CAD</small>
        </p>
        <p className="onsite-room">{c.reason}</p>
        <p className="onsite-hint">
          For a return visit {who ? `with ${who} ` : ""}on{" "}
          {dateLabel(c.plan.start)}, booked once you approve.
        </p>
        <div className="payment-method">
          <Wallet />
          <div>
            <strong>Visa •••• 4242</strong>
            <small>Card on file</small>
          </div>
        </div>
        {message}
        <div className="onsite-bar">
          <button
            className="primary full"
            onClick={() =>
              act(
                (d) => approveCharge(d, c.id, failPayment),
                "Your payment didn’t go through. Try again, or use another card.",
              )
            }
          >
            Approve & pay {money(c.amount)}
          </button>
          <div className="row job-secondary">
            <button
              className="text-button"
              onClick={() =>
                act(
                  (d) => declineCharge(d, c.id),
                  "This charge has already been answered.",
                )
              }
            >
              Decline
            </button>
            <button className="text-button" onClick={skip}>
              Skip
            </button>
          </div>
        </div>
      </>
    );
  }

  if (todo.kind === "pay")
    return (
      <>
        <h1 tabIndex={-1}>Payment due</h1>
        {summary}
        <div className="payment-method">
          <Wallet />
          <div>
            <strong>Visa •••• 4242</strong>
            <small>Card on file</small>
          </div>
        </div>
        {message}
        <div className="onsite-bar">
          <button
            className="primary full"
            onClick={() =>
              act(
                (d) => payQuote(d, todo.quoteId, failPayment),
                "Your payment didn’t go through. Try again, or use another card.",
              )
            }
          >
            Pay {money(quote?.amount || 0)}
          </button>
          <div className="row job-secondary">
            <button className="text-button" onClick={skip}>
              Skip
            </button>
          </div>
        </div>
      </>
    );

  return (
    <>
      <h1 tabIndex={-1}>
        {quote?.type === "Estimated range" ? "Your estimate" : "Your quote"}
      </h1>
      {summary}
      <p className="finding-price">
        {money(quote?.amount || 0)}
        {quote?.type === "Estimated range"
          ? ` – ${money(quote.high)}`
          : ""}{" "}
        <small>CAD</small>
      </p>
      {quote?.notes && <p className="onsite-hint">{quote.notes}</p>}
      {message}
      <div className="onsite-bar">
        {declining ? (
          /* One tap declines; the reason is optional and goes to the
             operator revising the price. */
          <fieldset className="job-outcomes" ref={swap.picker}>
            <legend>Why not? This helps us revise it.</legend>
            <div>
              {[...QUOTE_REASONS, "No reason"].map((why) => (
                <button
                  key={why}
                  className="secondary"
                  onClick={() =>
                    act(
                      (d) =>
                        declineQuote(
                          d,
                          todo.quoteId,
                          why === "No reason" ? undefined : why,
                        ),
                      "This quote has already been answered.",
                    )
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
            <button
              className="primary full"
              onClick={() =>
                act(
                  (d) => approveQuote(d, todo.quoteId),
                  "You can’t approve this quote. Ask whoever approves work for your account.",
                )
              }
            >
              Approve · {money(quote?.amount || 0)}
            </button>
            <div className="row job-secondary">
              <button
                ref={swap.trigger}
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
