import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { questionAnswers } from "./clarification";
import { reoffer } from "./dispatch";
import {
  type Decision,
  approveScope,
  decisionQueue,
  issueQuote,
  nextDecision,
  offerVisit,
} from "./decisions";
import {
  type State,
  accountName,
  dateLabel,
  money,
  providers,
  uid,
} from "./model";
import { useFieldErrors } from "./fields";
import { bucket } from "./work";
import "./onsite.css";

/**
 * The operator's decisions, one request at a time (ADR 059).
 *
 * The requests that need the operator, urgent first then oldest
 * (decisionQueue), each on one screen with the app's own suggestion on one
 * button. Pressing it does what the request page would and moves on; Skip
 * moves on without it; anything the suggestion does not cover leaves for the
 * request page, where the full controls are.
 *
 * The order is fixed when the queue opens, as in walkthrough pricing, so the
 * list does not reshuffle under the operator's thumb. A request acted on goes
 * to the back: if it now needs something else (a quote once the work is
 * accepted) it comes round again, and if it is waiting on someone else it is
 * passed over without a screen.
 */
type Update = (fn: (d: State) => void, msg?: string) => void;

export default function DecisionQueue({
  s,
  update,
  open,
  close,
}: {
  s: State;
  update: Update;
  /** Leave the queue for the request page. */
  open: (id: string) => void;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState(() =>
    decisionQueue(s).map((q) => q.requestId),
  );
  const [at, setAt] = useState(0);
  const [seen, setSeen] = useState(0);
  const [handled, setHandled] = useState(0);

  /* Live, not frozen: what a request needs is read again on every screen, so
     an offer accepted in another tab, or a reply from the customer, is never
     shown as a decision that no longer exists. */
  const live = (id: string) =>
    bucket(s, id) === "Needs Action" ? nextDecision(s, id) : null;
  let cur = at;
  while (cur < order.length && !live(order[cur])) cur++;
  const requestId = order[cur];
  const decision = requestId ? live(requestId) : null;
  const left = order.slice(cur).filter((id) => live(id)).length;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    ref.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [cur, seen]);

  const advance = (acted: boolean) => {
    if (acted) {
      setOrder([...order, requestId]);
      setHandled(handled + 1);
    }
    setSeen(seen + 1);
    setAt(cur + 1);
  };

  return (
    <div
      className="onsite"
      role="dialog"
      aria-modal="true"
      aria-label="Decisions"
      ref={ref}
    >
      <div className="onsite-body">
        <header className="onsite-head">
          <span>
            {decision ? `Decision ${seen + 1} of ${seen + left}` : "Decisions"}
          </span>
          <button className="text-button" onClick={close}>
            Close
          </button>
        </header>
        {decision ? (
          <Step
            key={`${seen}-${requestId}`}
            s={s}
            requestId={requestId}
            decision={decision}
            update={update}
            open={() => open(requestId)}
            done={() => advance(true)}
            skip={() => advance(false)}
          />
        ) : (
          <>
            <h1 tabIndex={-1}>All caught up</h1>
            <p className="onsite-hint dq-done">
              <CheckCircle2 size={20} />
              {handled} decision{handled === 1 ? "" : "s"} handled. Anything new
              will show on Home.
            </p>
            <div className="onsite-bar">
              <button className="primary full" onClick={close}>
                Back to Home
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const nameOf = (id?: string) => providers.find((p) => p.id === id)?.name || id;

function Step({
  s,
  requestId,
  decision: d,
  update,
  open,
  done,
  skip,
}: {
  s: State;
  requestId: string;
  decision: Decision;
  update: Update;
  open: () => void;
  done: () => void;
  skip: () => void;
}) {
  const r = s.requests.find((x) => x.id === requestId)!;
  const tasks = s.tasks.filter(
    (t) => t.requestId === requestId && !t.mergedInto,
  );
  /* One key per screen, so a double press books one visit (bookVisit's
     opKey), and a fresh one for the next request. */
  const [opKey] = useState(uid);
  const quoting = d.kind === "quote" || d.kind === "revise";
  const [amount, setAmount] = useState(quoting ? d.amount : 0);
  /* A revision is a new price, so its box starts open; a first quote starts
     on the suggestion, one press away. */
  const [adjusting, setAdjusting] = useState(d.kind === "revise");
  const [refused, setRefused] = useState("");
  const { fail, fieldClass, invalid, clear, Message } = useFieldErrors();

  /** Run a write; move on only if it went through. */
  const act = (write: (x: State) => boolean, refusal: string) => {
    let ok = false;
    update((x) => {
      ok = write(x);
    });
    if (ok) done();
    else setRefused(refusal);
  };

  const unsure = d.kind === "review" ? d.taskIds : [];
  const heading = {
    "follow-up": "Follow up the job",
    reassign:
      d.kind === "reassign" && d.expired
        ? "Offer expired"
        : "Contractor declined",
    review: "Check the scope",
    assign: "Book the work",
    quote: "Send the quote",
    revise: "Quote declined",
  }[d.kind];

  let why = "";
  let primary: { label: string; run: () => void };
  const secondary: { label: string; run: () => void }[] = [];
  if (d.kind === "follow-up") {
    why = d.issue;
    primary = { label: "Open request", run: open };
  } else if (d.kind === "reassign") {
    why = d.previousProviderId
      ? `${nameOf(d.previousProviderId)} ${d.expired ? "did not answer in time" : "declined"}.`
      : "The offer needs a new contractor.";
    const give = (o: { providerId: string; start: string; pay: number }) =>
      act(
        (x) => reoffer(x, d.visitId, o.providerId, o.start, o.pay),
        "That time is no longer free. Change opens every option.",
      );
    const self = d.self;
    if (d.offer) {
      const o = d.offer;
      primary = {
        label: `Re-offer to ${nameOf(o.providerId)} · ${dateLabel(o.start)} · ${money(o.pay)}`,
        run: () => give(o),
      };
      if (self)
        secondary.push({ label: "Do it myself", run: () => give(self) });
      secondary.push({ label: "Change", run: open });
    } else {
      why += " No other contractor has a time for it.";
      primary = self
        ? {
            label: `Do it myself · ${dateLabel(self.start)}`,
            run: () => give(self),
          }
        : { label: "Open request", run: open };
      if (self) secondary.push({ label: "Change", run: open });
    }
  } else if (d.kind === "review") {
    why =
      unsure.length === 1
        ? "One task was not clear enough to book without a look."
        : `${unsure.length} tasks were not clear enough to book without a look.`;
    primary = {
      label: "Scope looks right",
      run: () => act((x) => approveScope(x, requestId) > 0, ""),
    };
    secondary.push({ label: "Adjust", run: open });
  } else if (d.kind === "assign") {
    const offer = (o: NonNullable<typeof d.offer>) =>
      act(
        (x) =>
          !!offerVisit(x, {
            requestId,
            taskIds: d.taskIds,
            providerId: o.providerId,
            start: o.start,
            travel: o.travel,
            duration: d.duration,
            pay: o.pay,
            opKey: opKey + o.providerId,
          }),
        "That time was just taken. The next free one is shown.",
      );
    const self = d.self;
    if (d.offer) {
      const o = d.offer;
      primary = {
        label: `Offer to ${nameOf(o.providerId)} · ${dateLabel(o.start)} · ${money(o.pay)}`,
        run: () => offer(o),
      };
      if (self)
        secondary.push({ label: "Do it myself", run: () => offer(self) });
      secondary.push({ label: "Change", run: open });
    } else {
      why = "No contractor can take every task on this request.";
      primary = self
        ? {
            label: `Do it myself · ${dateLabel(self.start)}`,
            run: () => offer(self),
          }
        : { label: "Open request", run: open };
      if (self) secondary.push({ label: "Change", run: open });
    }
  } else {
    const send = () => {
      if (!Number.isFinite(amount) || amount < 1) {
        setAdjusting(true);
        fail("amount", "Enter a price of at least $1.");
        return;
      }
      act(
        (x) =>
          issueQuote(x, requestId, {
            type: "Manual quote",
            amount,
            payOnCompletion: false,
          }),
        "",
      );
    };
    if (d.kind === "revise") {
      const declined = s.quotes.find((q) => q.id === d.quoteId);
      why = `The customer declined ${money(declined?.amount ?? d.amount)}${
        declined?.declineReason ? ` · ${declined.declineReason}` : ""
      }.`;
    }
    primary = {
      label: `${d.kind === "revise" ? "Send revised quote" : "Send quote"} · ${money(amount || 0)}`,
      run: send,
    };
    if (!adjusting)
      secondary.push({ label: "Adjust", run: () => setAdjusting(true) });
  }

  return (
    <>
      <h1 tabIndex={-1}>{heading}</h1>
      <div className="dq-request">
        <strong>{accountName(r.accountId)}</strong>
        <span>
          {r.address || r.name}, {r.city}
        </span>
      </div>
      {why && <p className="onsite-hint">{why}</p>}
      <ul className="job-list">
        {tasks.map((t) => (
          <li key={t.id}>
            <strong>{t.summary}</strong>
            <small className="dq-muted">
              {" "}
              · {t.duration} min
              {unsure.includes(t.id) ? " · Needs review" : ""}
            </small>
            {/* What the operator is judging: the customer's own words, not
                the classifier's reason, which the request page keeps under
                "Why this classification?". */}
            {unsure.includes(t.id) && (
              <p className="dq-reason">“{t.description}”</p>
            )}
            {unsure.includes(t.id) && t.restricted && (
              <p className="warning">
                <AlertCircle size={16} /> Potential regulated work · eligible
                specialist required
              </p>
            )}
          </li>
        ))}
      </ul>
      <details className="job-details">
        <summary>Details</summary>
        {r.notes && <p>{r.notes}</p>}
        {tasks.map((t) => (
          <div key={t.id} className="dq-detail">
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
            {t.photos.length > 0 && (
              <div className="photos">
                {t.photos.map((src, i) => (
                  <img key={i} src={src} alt={`${t.summary} photo ${i + 1}`} />
                ))}
              </div>
            )}
          </div>
        ))}
      </details>
      {quoting && adjusting && (
        <label className={fieldClass("amount")}>
          Price
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={Number.isFinite(amount) ? amount : ""}
            {...invalid("amount")}
            onChange={(e) => {
              clear("amount");
              setAmount(Number(e.target.value));
            }}
          />
          <Message field="amount" />
        </label>
      )}
      {refused && (
        <span className="field-message" role="alert">
          {refused}
        </span>
      )}
      <div className="onsite-bar">
        <button className="primary full" onClick={primary.run}>
          {primary.label}
        </button>
        <div className="row job-secondary">
          {secondary.map((b) => (
            <button key={b.label} className="text-button" onClick={b.run}>
              {b.label}
            </button>
          ))}
          <button className="text-button" onClick={skip}>
            Skip
          </button>
        </div>
      </div>
    </>
  );
}
