import { useState } from "react";
import {
  type Decision,
  bookReturnVisit,
  closeTask,
  refundLeft,
  requestExtraCharge,
  returnOptions,
  returnPay,
  tellCustomerLate,
} from "./decisions";
import {
  type State,
  dateLabel,
  money,
  providers,
  sentence,
  timeLabel,
  uid,
} from "./model";
import { useFieldErrors } from "./fields";
import "./onsite.css";

/**
 * Deciding what happens to work a visit left undone (ADR 065): each task gets
 * a return visit or is closed as not done, and a late arrival gets the
 * customer told. One component for the operator's queue and the request
 * page's decision card, so the two cannot offer different choices.
 */
type Update = (fn: (d: State) => void, msg?: string) => void;
type FollowUpDecision = Extract<Decision, { kind: "follow-up" }>;
type Action = { label: string; run: () => void };

/** What happened, in one line: for the queue's screen and the request
 *  page's card alike. */
export function followUpLine(s: State, d: FollowUpDecision) {
  const v = s.visits.find((x) => x.id === d.visitId);
  const who =
    providers.find((p) => p.id === v?.providerId)?.name || "The contractor";
  return sentence(
    d.tasks.length
      ? `${who} could not finish ${d.tasks.length === 1 ? "one task" : `${d.tasks.length} tasks`} on ${v ? dateLabel(v.start) : "the visit"}`
      : `${who} is arriving around ${d.eta ? timeLabel(d.eta) : "later"}, after the ${v ? timeLabel(v.start) : ""} start`,
  );
}

export default function FollowUp({
  s,
  update,
  requestId,
  d,
  done,
  secondary = [],
  layout,
}: {
  s: State;
  update: Update;
  requestId: string;
  d: FollowUpDecision;
  /** After a write went through. */
  done: () => void;
  /** Buttons beside the main one, after the component's own. */
  secondary?: Action[];
  /** The queue's bottom bar, or the decision card's row of buttons. */
  layout: "queue" | "card";
}) {
  const [actions, setActions] = useState(() =>
    Object.fromEntries(d.tasks.map((t) => [t.taskId, t.action])),
  );
  const [refunds, setRefunds] = useState(() =>
    Object.fromEntries(d.tasks.map((t) => [t.taskId, t.refund])),
  );
  const [who, setWho] = useState<"offer" | "self">(
    d.offer || !d.self ? "offer" : "self",
  );
  /* The contractor's pay as typed; null is the suggestion for the reason. */
  const [pay, setPay] = useState<number | null>(null);
  const [charging, setCharging] = useState(false);
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [refused, setRefused] = useState("");
  const [opKey] = useState(uid);
  const { fail, clear, fieldClass, invalid, Message } = useFieldErrors();

  const name = (id?: string) => providers.find((p) => p.id === id)?.name;
  const task = (id: string) => s.tasks.find((t) => t.id === id);
  const back = d.tasks.filter((t) => actions[t.taskId] === "return");
  const closing = d.tasks.filter((t) => actions[t.taskId] === "close");
  const backIds = back.map((t) => t.taskId);
  const options = backIds.length ? returnOptions(s, requestId, backIds) : {};
  const choice =
    who === "self"
      ? (options.self ?? options.offer)
      : (options.offer ?? options.self);
  const self = choice?.providerId === "yousef";
  const suggested = choice ? returnPay(s, choice.providerId, backIds) : 0;
  const offered = self ? 0 : (pay ?? suggested);
  const paidCharge = d.charge?.status === "Approved" ? d.charge : undefined;
  const refundTotal = closing.reduce((n, t) => n + (refunds[t.taskId] || 0), 0);

  const run = () => {
    setRefused("");
    if (!d.tasks.length) {
      let ok = false;
      update((x) => {
        ok = tellCustomerLate(x, d.visitId);
      });
      return ok ? done() : setRefused("The customer has already been told.");
    }
    let bad = false;
    for (const t of closing)
      if (!Number.isFinite(refunds[t.taskId]) || refunds[t.taskId] < 0)
        bad = !fail("refund-" + t.taskId, "Enter a refund of $0 or more.");
    if (refundTotal > refundLeft(s, requestId))
      bad = !fail(
        "refund-" + closing[0].taskId,
        `That is more than the ${money(refundLeft(s, requestId))} left to refund.`,
      );
    if (back.length) {
      if (!choice)
        return setRefused(
          "Nobody is free for a return visit in the next two weeks. Open the request to arrange it.",
        );
      if (!self && !(offered >= 0))
        bad = !fail("pay", "Enter pay of $0 or more.");
      if (charging && !paidCharge) {
        if (!(amount >= 1))
          bad = !fail("amount", "Enter a charge of at least $1.");
        if (!reason.trim())
          bad = !fail("reason", "Say what the charge is for.");
      }
    }
    if (bad) return;
    let ok = true;
    update((x) => {
      if (back.length && choice) {
        const plan = { ...choice, pay: offered };
        ok =
          charging && !paidCharge
            ? !!requestExtraCharge(x, requestId, {
                amount,
                reason,
                taskIds: backIds,
                plan: {
                  ...plan,
                  duration: backIds.reduce(
                    (n, id) => n + (task(id)?.duration ?? 0),
                    0,
                  ),
                },
              })
            : !!bookReturnVisit(
                x,
                requestId,
                backIds,
                { ...plan, opKey },
                paidCharge?.id,
              );
        if (!ok) return;
      }
      for (const t of closing)
        ok = closeTask(x, t.taskId, refunds[t.taskId]) && ok;
    });
    if (ok) done();
    else setRefused("That time was just taken. The next free one is shown.");
  };

  const label = !d.tasks.length
    ? `Tell the customer · arriving around ${d.eta ? timeLabel(d.eta) : "soon"}`
    : back.length
      ? charging && !paidCharge
        ? `Send ${money(amount || 0)} charge for approval`
        : `Book return visit · ${self ? "Do it myself" : name(choice?.providerId) || "—"}${choice ? ` · ${dateLabel(choice.start)}` : ""}`
      : `Close as not done${refundTotal ? ` · refund ${money(refundTotal)}` : ""}`;

  const buttons = (
    <>
      <button
        className={"primary" + (layout === "queue" ? " full" : "")}
        onClick={run}
      >
        {label}
      </button>
      {layout === "queue" ? (
        <div className="row job-secondary">
          {secondary.map((b) => (
            <button key={b.label} className="text-button" onClick={b.run}>
              {b.label}
            </button>
          ))}
        </div>
      ) : (
        secondary.map((b) => (
          <button key={b.label} className="secondary" onClick={b.run}>
            {b.label}
          </button>
        ))
      )}
    </>
  );

  return (
    <>
      {d.tasks.length > 0 && (
        <ul className="job-list follow-list">
          {d.tasks.map((t) => (
            <li key={t.taskId}>
              <strong>{task(t.taskId)?.summary}</strong>
              <small className="dq-muted"> · {t.outcome}</small>
              {t.note && <p className="dq-reason">“{t.note}”</p>}
              <div
                className="follow-choice"
                role="group"
                aria-label={`What happens to ${task(t.taskId)?.summary}`}
              >
                {(["return", "close"] as const).map((a) => (
                  <button
                    key={a}
                    className={
                      "time-pill" + (actions[t.taskId] === a ? " selected" : "")
                    }
                    aria-pressed={actions[t.taskId] === a}
                    onClick={() => {
                      setActions({ ...actions, [t.taskId]: a });
                      setRefused("");
                    }}
                  >
                    {a === "return" ? "Return visit" : "Close as not done"}
                  </button>
                ))}
              </div>
              {actions[t.taskId] === "close" && (
                <label className={fieldClass("refund-" + t.taskId)}>
                  Refund (CAD)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={
                      Number.isFinite(refunds[t.taskId])
                        ? refunds[t.taskId]
                        : ""
                    }
                    {...invalid("refund-" + t.taskId)}
                    onChange={(e) => {
                      clear("refund-" + t.taskId);
                      setRefunds({
                        ...refunds,
                        [t.taskId]: Number(e.target.value),
                      });
                    }}
                  />
                  <Message field={"refund-" + t.taskId} />
                </label>
              )}
            </li>
          ))}
        </ul>
      )}
      {back.length > 0 && (
        <section className="follow-return" aria-label="Return visit">
          {options.offer && options.self && (
            <div
              className="follow-choice"
              role="group"
              aria-label="Who goes back"
            >
              {(["offer", "self"] as const).map((w) => {
                const o = options[w]!;
                return (
                  <button
                    key={w}
                    className={"time-pill" + (who === w ? " selected" : "")}
                    aria-pressed={who === w}
                    onClick={() => {
                      setWho(w);
                      setPay(null);
                    }}
                  >
                    {w === "self" ? "Do it myself" : name(o.providerId)} ·{" "}
                    {dateLabel(o.start)}
                  </button>
                );
              })}
            </div>
          )}
          {choice && !self && (
            <label className={fieldClass("pay")}>
              {name(choice.providerId)}’s pay (CAD)
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={Number.isFinite(offered) ? offered : ""}
                {...invalid("pay")}
                onChange={(e) => {
                  clear("pay");
                  setPay(Number(e.target.value));
                }}
              />
              <Message field="pay" />
            </label>
          )}
          {paidCharge ? (
            <p className="onsite-hint">
              The customer has paid the {money(paidCharge.amount)} charge for
              this return visit.
            </p>
          ) : (
            <>
              {d.charge?.status === "Declined" && (
                <p className="onsite-hint">
                  The customer declined the {money(d.charge.amount)} charge.
                  Close the task, or come back at no charge.
                </p>
              )}
              <label className="row actions">
                <input
                  type="checkbox"
                  checked={charging}
                  onChange={(e) => setCharging(e.target.checked)}
                />
                Scope changed: charge the customer
              </label>
              {charging && (
                <>
                  <label className={fieldClass("amount")}>
                    Additional charge (CAD)
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={amount || ""}
                      {...invalid("amount")}
                      onChange={(e) => {
                        clear("amount");
                        setAmount(Number(e.target.value));
                      }}
                    />
                    <Message field="amount" />
                  </label>
                  <label className={fieldClass("reason")}>
                    What it is for
                    <input
                      value={reason}
                      placeholder="Replacement hinge and second trip"
                      {...invalid("reason")}
                      onChange={(e) => {
                        clear("reason");
                        setReason(e.target.value);
                      }}
                    />
                    <Message field="reason" />
                  </label>
                  <p className="onsite-hint">
                    The customer approves and pays it first. The return visit is
                    offered once they do.
                  </p>
                </>
              )}
            </>
          )}
        </section>
      )}
      {back.length > 0 && closing.length > 0 && (
        <p className="onsite-hint">
          Also closes {closing.length} task{closing.length === 1 ? "" : "s"} as
          not done{refundTotal ? `, refunding ${money(refundTotal)}` : ""}.
        </p>
      )}
      {refused && (
        <span className="field-message" role="alert">
          {refused}
        </span>
      )}
      {layout === "queue" ? (
        <div className="onsite-bar">{buttons}</div>
      ) : (
        <div className="row actions wrap op-decision-actions">{buttons}</div>
      )}
    </>
  );
}
