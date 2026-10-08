import { AuditList } from "./QueueAside";
import { bucket, callBackDue, feeUndecided, workIssue } from "./work";
import {
  reviewTask,
  completeCallBack,
  heldFor,
  issueQuote,
  nextDecision,
  offerVisit,
  settleLateCancel,
  suggestLateFee,
  suggestPay,
} from "./decisions";
import { suggestTitle } from "./pmw";
import { dayLabel } from "./intake";
import { getIssue } from "./clarification";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  MapPin,
  Clock,
  Search,
  ShieldCheck,
  AlertCircle,
  ListTodo,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import {
  type Request,
  providers,
  money,
  dateLabel,
  log,
  chosenStart,
  available,
  eligible,
  genericTitle,
  materialsResponsibilities,
  type MaterialsResponsibility,
  confirmed,
  type Visit,
  uid,
  slots,
  scopeMatch,
  instantEligible,
  auditFor,
  workPayment,
  primaryContact,
  timeLabel,
} from "./model";
import { unreachable, offerSeen } from "./notifications";
import { TaskAnswers } from "./RequestFields";
import { useWorkspace } from "./workspaceContext";
import { countdown } from "./countdown";
import FollowUp, { followUpLine } from "./FollowUp";
import React from "react";
import { flushSync } from "react-dom";
import {
  authorizationDue,
  authorizePayment,
  capturePayment,
  outstandingFor,
  refundPayment,
} from "./payments";
import {
  dispatchStatus,
  requestDispatch,
  replacementOptions,
  reassignmentForScope,
} from "./dispatch";
import { commit } from "./store";

/** The operator's Requests page: the queue, a request's detail and fulfillment (ADR 077). */
export function OperatorRequests() {
  const {
    Message,
    amount,
    badge,
    booked,
    candidates,
    choose,
    chosenTime,
    clear,
    clearAll,
    completion,
    contractor,
    customer,
    duration,
    fieldClass,
    filter,
    fits,
    fulfillment,
    fulfillmentKind,
    idPrefix,
    invalid,
    invalidate,
    lateFee,
    notify,
    override,
    patchTask,
    pay,
    payTouched,
    provider,
    quote,
    quoteTouched,
    quoteType,
    r,
    s,
    scopeTasks,
    search,
    selected,
    setCompletion,
    setContractor,
    setFilter,
    setFulfillment,
    setFulfillmentKind,
    setLateFee,
    setModal,
    setOverride,
    setPage,
    setPay,
    setPayTouched,
    setProvider,
    setQuoteAmount,
    setQuoteTouched,
    setQuoteType,
    setRequestTab,
    setReschedule,
    setRole,
    setSearch,
    setSelected,
    setShowRequestQueue,
    setSlot,
    setTaskTitles,
    showRequestQueue,
    slot,
    tab,
    taskPhotos,
    taskTitles,
    tasks,
    toast,
    update,
    visitCard,
    visits,
  } = useWorkspace();
  /* A request chosen from the list takes focus at its heading, and "All
     requests" hands it back to the search (ADR 080). */
  const detailHeading = React.useRef<HTMLHeadingElement>(null);
  const searchBox = React.useRef<HTMLInputElement>(null);
  const browseButton = React.useRef<HTMLButtonElement>(null);
  const focusDetail = React.useRef(false);
  /* On a narrow screen the list sits above the request, so the request's
     card is scrolled up to meet the reader rather than left below the fold. */
  const showDetail = () => {
    const h = detailHeading.current;
    if (!h) return;
    const b = browseButton.current;
    if (b && getComputedStyle(b).display !== "none")
      h.closest("section")?.scrollIntoView?.({ block: "start" });
    h.focus({ preventScroll: true });
  };
  React.useEffect(() => {
    if (!focusDetail.current) return;
    focusDetail.current = false;
    showDetail();
  }, [r.id]);
  const trail = auditFor(s, r.id);
  const shown = s.requests.filter(
    (q) =>
      (filter === "All requests" || bucket(s, q.id) === filter) &&
      (
        q.name +
        q.city +
        s.tasks
          .filter((t) => t.requestId === q.id)
          .map((t) => t.description)
          .join()
      )
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const payMethod = (s.paymentMethods ?? []).find(
    (m) => m.accountId === r.accountId,
  );
  const payments = s.payments.filter((p) =>
    s.quotes.some((q) => q.id === p.quoteId && q.requestId === r.id),
  );
  const owed = outstandingFor(s, r.id);
  const visitAt = s.visits.find(
    (v) => v.requestId === r.id && v.status !== "Cancelled",
  )?.start;
  const liveVisits = visits.filter((v) => v.status !== "Cancelled");
  /** The Tasks tab, scrolled to: where scope is reviewed and visits split. */
  const showTasks = () => {
    setRequestTab("Tasks");
    setTimeout(() =>
      document
        .getElementById("review-tasks")
        ?.scrollIntoView({ block: "start" }),
    );
  };
  const assignPay = payTouched ? pay : suggestPay(provider, duration);
  const match = scopeMatch(provider, scopeTasks);
  const routed = fits
    ? slots(s, provider, duration, r.city, undefined, r.timing, 3, r.id)
    : [];
  const recommended = chosenTime
    ? [
        {
          start: chosenTime,
          travel:
            providers.find((p) => p.id === provider)?.city === r.city ? 8 : 24,
          score: 0,
        },
        ...routed.filter((o) => o.start !== chosenTime),
      ]
    : routed;
  const opts =
    override &&
    eligible(
      provider,
      tasks.filter((t) => !selected.length || selected.includes(t.id)),
    ) &&
    available(
      s,
      provider,
      duration,
      r.city,
      override,
      undefined,
      r.timing,
      r.id,
    )
      ? [
          {
            start: override,
            travel:
              providers.find((p) => p.id === provider)?.city === r.city
                ? 8
                : 24,
            score: 0,
          },
          ...recommended.filter((o) => o.start !== override),
        ]
      : recommended;
  const createVisit = () => {
    const ids = selected.length ? selected : tasks.map((t) => t.id);
    const existing = reassignmentForScope(s, r.id, ids);
    if (existing) {
      beginReassign(existing, provider === "yousef");
      return;
    }
    const chosen = tasks.filter((t) => ids.includes(t.id));
    if (chosen.some((t) => !t.reviewed))
      return invalidate(
        "tasks",
        "Review all selected tasks before scheduling.",
      );
    if (!eligible(provider, chosen))
      return invalidate(
        "provider",
        "This provider lacks the required skills or restricted-work eligibility for the selected tasks.",
      );
    if (
      s.visits.some(
        (v) =>
          v.status !== "Cancelled" && v.taskIds.some((id) => ids.includes(id)),
      )
    )
      return invalidate(
        "tasks",
        "These tasks already belong to a visit. Remove that visit before regrouping.",
      );
    const sl = opts.find((o) => o.start === slot) || opts[0];
    if (!sl)
      return invalidate(
        "slot",
        "No appointment fits. Try a shorter visit or another provider.",
      );
    if (provider !== "yousef" && assignPay < suggestPay(provider, duration))
      return invalidate(
        "pay",
        `Below this contractor's rate for the job. The offer needs at least ${money(suggestPay(provider, duration))}.`,
      );
    clearAll();
    /* One key per press, so a double tap or a re-applied commit produces one
       visit rather than two. */
    const opKey = uid();
    let booked: Visit | null = null;
    update((d) => {
      booked = offerVisit(d, {
        requestId: r.id,
        taskIds: ids,
        providerId: provider,
        start: sl.start,
        travel: sl.travel,
        duration,
        pay: assignPay,
        opKey,
      });
    });
    /* The slot can go between the customer seeing it and the write landing,
       which is exactly what bookVisit (inside offerVisit) refuses. The success
       message is sent after the fact rather than passed to update(), so a
       refused booking does not get a "Visit created" toast over the top of its
       own error. */
    if (!booked)
      return invalidate(
        "slot",
        "That time was taken while you were choosing. Pick another appointment.",
      );
    notify(
      provider === "yousef" ? "Visit created" : "Offer sent to contractor",
    );
    setSelected([]);
  };
  const beginReassign = (v: Visit, self = false) => {
    const options = replacementOptions(s, v);
    const choice = options.find((o) =>
      self ? o.provider.id === "yousef" : o.provider.id !== "yousef",
    );
    /* Stays a toast on purpose: this refuses to open the reassignment panel at
       all, so there is no field on screen for the message to sit beside. */
    if (self && !choice)
      return notify(
        "Yousef cannot currently cover this visit's scope and availability. Review the tasks or choose another eligible provider.",
        "error",
      );
    setReschedule(v.id);
    setProvider(choice?.provider.id || "");
    const oldPay =
      s.assignments.filter((a) => a.visitId === v.id).at(-1)?.pay || 0;
    setPay(
      choice?.provider.id === "yousef"
        ? 0
        : Math.max(oldPay, choice?.minimumPay || 0),
    );
    setModal("Reassign visit");
  };
  const cancelVisit = (v: Visit) =>
    update((d) => {
      d.visits.find((x) => x.id === v.id)!.status = "Cancelled";
      d.assignments
        .filter(
          (a) =>
            a.visitId === v.id && ["Offered", "Accepted"].includes(a.status),
        )
        .forEach((a) => (a.status = "Cancelled"));
      log(d, "Visit cancelled · tasks available for regrouping");
    }, "Visit removed; tasks available");
  /* One status line, not two. Whatever the operator must act on supersedes the
     stored request status: a work issue first, then dispatch state. */
  const requestStatus = (id: string) => {
    const issue = s.visits.find(
      (v) => v.requestId === id && v.status !== "Cancelled" && workIssue(v),
    );
    return (
      (issue && workIssue(issue)) ||
      requestDispatch(s, id) ||
      s.requests.find((x) => x.id === id)!.status
    );
  };
  const sendQuote = () =>
    update((d) => {
      issueQuote(d, r.id, {
        type: quoteType,
        amount,
        payOnCompletion: completion,
      });
    }, "Quote ready in customer portal");
  const quoteFields = () => (
    <>
      <div className="row wrap">
        <label className="mini-field">
          Pricing path
          <select
            value={quoteType}
            onChange={(e) => setQuoteType(e.target.value)}
          >
            <option>Manual quote</option>
            <option>Fixed price</option>
            <option>Estimated range</option>
          </select>
        </label>
        <label className="mini-field">
          Amount (CAD)
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => {
              setQuoteTouched(true);
              setQuoteAmount(Math.max(1, +e.target.value));
            }}
          />
        </label>
      </div>
      <label className="row actions">
        <input
          type="checkbox"
          checked={completion}
          onChange={(e) => setCompletion(e.target.checked)}
        />{" "}
        Pay on completion
      </label>
      <p>Customer charges and contractor compensation stay separate.</p>
    </>
  );
  /* The single dispatch decision. Exactly one state is live at a time, so
     "who does this job now?" is asked in one place on the screen instead of
     five, and the answer never depends on which task checkboxes are ticked. */
  const decisionCard = () => {
    const live = visits.filter((v) => v.status !== "Cancelled");
    const acceptedBy = (v: Visit) =>
      s.assignments.some(
        (a) =>
          a.visitId === v.id &&
          a.providerId === v.providerId &&
          a.status === "Accepted",
      );
    const named = (id?: string) =>
      providers.find((p) => p.id === id)?.name || "The contractor";
    const stalled = live.find((v) =>
      dispatchStatus(s, v).includes("Needs reassignment"),
    );
    const unreviewed = tasks.filter((t) => !t.reviewed);
    const loose = tasks.filter(
      (t) => !live.some((v) => v.taskIds.includes(t.id)),
    );
    const awaiting = live.find((v) => !acceptedBy(v));
    const plural = (n: number) => (n === 1 ? "" : "s");
    let tone = "new";
    let Icon = ListTodo;
    let title = "";
    let body = "";
    let actions: React.ReactNode = null;
    let extra: React.ReactNode = null;
    const ask = (className: string) => (
      <button
        className={className}
        onClick={() => setModal("Request information")}
      >
        {r.operatorNote ? "Ask something else" : "Need More Info"}
      </button>
    );
    let closed = false;
    /* The follow-up's own decision (ADR 065): unfinished work or a late
       arrival, before anything else on a live request. */
    const followUp = nextDecision(s, r.id);
    const charge = s.charges?.find(
      (c) => c.requestId === r.id && c.status === "Sent",
    );
    if (feeUndecided(r)) {
      /* The cancelled request's last decision (ADR 064): the money is held
         until the fee is settled, so the card says how much and asks. */
      const held = heldFor(s, r.id);
      const fee = lateFee ?? suggestLateFee(s, r.id);
      closed = true;
      tone = "issue";
      Icon = AlertCircle;
      title = "Late cancellation";
      body = `${r.name} cancelled less than 24 hours before the visit. ${
        held ? `${money(held)} paid is held` : "Nothing was paid"
      } until you decide the fee.`;
      extra = (
        <>
          <label className={fieldClass("lateFee")}>
            Late-cancellation fee (CAD)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={Number.isFinite(fee) ? fee : ""}
              {...invalid("lateFee")}
              onChange={(e) => {
                clear("lateFee");
                setLateFee(Number(e.target.value));
              }}
            />
            <Message field="lateFee" />
          </label>
          <div className="row actions wrap op-decision-actions">
            <button
              className="primary"
              onClick={() => {
                if (!Number.isFinite(fee) || fee < 1)
                  return invalidate(
                    "lateFee",
                    "Enter a fee of at least $1, or waive it.",
                  );
                update((d) => {
                  settleLateCancel(d, r.id, fee);
                }, "Fee charged");
              }}
            >
              Charge fee · {money(fee || 0)}
            </button>
            <button
              className="secondary"
              onClick={() =>
                update((d) => {
                  settleLateCancel(d, r.id, 0);
                }, "Fee waived · refunded in full")
              }
            >
              Waive fee
            </button>
          </div>
        </>
      );
    } else if (callBackDue(r)) {
      /* Promised a call by a time (ADR 064): the card is the call sheet. */
      const v = s.visits.find((x) => x.id === r.callBack!.visitId);
      const phone = primaryContact(r.accountId)?.phone;
      tone = "issue";
      Icon = Clock;
      title = `Call back by ${timeLabel(r.callBack!.by)}`;
      body = `${r.name} wants to change ${v ? dateLabel(v.start) : "their visit"}, less than 24 hours away${phone ? ` · ${phone}` : ""}.`;
      actions = (
        <>
          {v && v.status !== "Cancelled" && (
            <button
              className="primary"
              onClick={() => {
                setReschedule(v.id);
                setModal("Reschedule");
              }}
            >
              Reschedule visit <ArrowRight size={16} />
            </button>
          )}
          <button
            className="secondary"
            onClick={() =>
              update((d) => {
                completeCallBack(d, r.id);
              }, "Call logged")
            }
          >
            Called, no change
          </button>
        </>
      );
    } else if (followUp?.kind === "follow-up") {
      closed = true;
      tone = "issue";
      Icon = AlertCircle;
      title = followUp.tasks.length ? "Unfinished work" : "Running late";
      body = followUpLine(s, followUp);
      extra = (
        <FollowUp
          key={followUp.visitId + followUp.tasks.map((t) => t.taskId).join()}
          s={s}
          update={update}
          requestId={r.id}
          d={followUp}
          done={() =>
            notify(
              followUp.tasks.length ? "Follow-up handled" : "Customer told",
            )
          }
          layout="card"
        />
      );
    } else if (charge) {
      /* An additional charge with the customer: nothing to do but wait. */
      closed = true;
      Icon = Clock;
      title = "Waiting on approval";
      body = `${r.name} has a ${money(charge.amount)} charge to approve: ${charge.reason}. The return visit is offered once they do.`;
    } else if (["Cancelled", "Declined", "Completed"].includes(r.status)) {
      closed = true;
      tone = "complete";
      Icon = CheckCircle2;
      title = "Request " + r.status.toLowerCase();
      body = "No dispatch decision is left on this request.";
    } else if (r.status === "Confirmed") {
      closed = true;
      tone = "complete";
      Icon = CheckCircle2;
      title = "Confirmed";
      body = live
        .map((v) => `${named(v.providerId)} · ${dateLabel(v.start)}`)
        .join(" · ");
    } else if (stalled) {
      const expired = dispatchStatus(s, stalled).startsWith("Offer expired");
      const previous = s.assignments
        .filter(
          (a) =>
            a.visitId === stalled.id &&
            ["Declined", "Expired"].includes(a.status),
        )
        .at(-1);
      tone = "issue";
      Icon = AlertCircle;
      title = expired ? "Offer expired" : "Contractor declined";
      body = `${named(previous?.providerId)} ${expired ? "did not answer in time" : "declined this job"}. Choose who covers it.`;
      actions = (
        <>
          <button className="primary" onClick={() => beginReassign(stalled)}>
            Offer to another contractor <ArrowRight size={16} />
          </button>
          <button
            className="secondary"
            onClick={() => beginReassign(stalled, true)}
          >
            Do it myself
          </button>
        </>
      );
    } else if (unreviewed.length) {
      title = "Scope needs review";
      body = `${unreviewed.length} task${plural(unreviewed.length)} still need${unreviewed.length === 1 ? "s" : ""} your review before this job can be assigned.`;
      actions = (
        <button className="primary" onClick={showTasks}>
          Review tasks <ArrowRight size={16} />
        </button>
      );
    } else if (loose.length) {
      title = live.length ? "Assign the remaining tasks" : "Assign this job";
      body = `${loose.length} task${plural(loose.length)} · ${loose.reduce((n, t) => n + t.duration, 0)} min · not on a visit yet.`;
      actions = (
        <>
          <button
            className="primary"
            onClick={() => {
              setSelected([]);
              setFulfillmentKind("contractor");
              setProvider("");
              setSlot("");
              setFulfillment(true);
            }}
          >
            Offer to a contractor <ArrowRight size={16} />
          </button>
          <button
            className="secondary"
            onClick={() => {
              setSelected([]);
              setFulfillmentKind("self");
              setProvider("yousef");
              setSlot("");
              setFulfillment(true);
            }}
          >
            Do it myself
          </button>
        </>
      );
    } else if (awaiting) {
      tone = "";
      Icon = Clock;
      title = "Offer sent";
      body = `Waiting on ${named(awaiting.providerId)} to accept · ${dateLabel(awaiting.start)}`;
      /* The one delivery fact that changes what the operator does next:
         wait, or chase (ADR 060). */
      const offer = s.assignments.find(
        (a) =>
          a.visitId === awaiting.id &&
          a.providerId === awaiting.providerId &&
          a.status === "Offered",
      );
      const seen = offer && offerSeen(s, offer.id);
      const expires = offer && countdown(s.clock, offer.expiresAt);
      if (seen)
        extra = (
          <p className="op-decision-seen">
            {seen.openedAt
              ? `Opened ${dateLabel(seen.openedAt)}`
              : `Sent ${dateLabel(seen.sentAt)} · not opened yet`}
            {/* How long the contractor has left to answer (ADR 063). */}
            {expires && (
              <span className={expires.soon ? "when-soon" : undefined}>
                {" "}
                · expires in {expires.text}
              </span>
            )}
          </p>
        );
    } else if (!quote) {
      tone = "quote";
      Icon = Wallet;
      title = "Send the quote";
      body =
        "Every task is assigned and accepted. The customer approves the price before the visit is confirmed.";
      extra = (
        <p className="op-decision-amount">
          <strong>{money(amount)} CAD</strong>{" "}
          <small>
            {quoteTouched ? "your amount" : "suggested · simulated pricing"}
          </small>
        </p>
      );
      actions = (
        <>
          <button className="primary" onClick={sendQuote}>
            Send quote <ArrowUpRight size={16} />
          </button>
          <details>
            <summary>Adjust</summary>
            {quoteFields()}
          </details>
        </>
      );
    } else {
      const paid = s.payments.some(
        (p) => p.quoteId === quote.id && workPayment(p) && p.status === "Paid",
      );
      tone = quote.status === "Declined" ? "issue" : "quote";
      Icon = quote.status === "Declined" ? AlertCircle : Wallet;
      title =
        quote.status === "Declined"
          ? "Quote declined"
          : quote.status === "Approved"
            ? paid || quote.payOnCompletion
              ? "Quote approved"
              : "Awaiting payment"
            : "Quote sent";
      body =
        `${money(quote.amount)} · ` +
        (quote.status === "Declined"
          ? `the customer declined this price${quote.declineReason ? ` · ${quote.declineReason}` : ""}. Revise it and send again.`
          : quote.status === "Approved"
            ? paid || quote.payOnCompletion
              ? "approved; the visit confirms once the remaining conditions are met."
              : "approved; waiting on the simulated payment."
            : "waiting for the customer to approve.");
      if (["Sent", "Declined"].includes(quote.status))
        actions = (
          <details>
            <summary>Revise the quote</summary>
            {quoteFields()}
            <button className="secondary actions" onClick={sendQuote}>
              Send revised quote <ArrowUpRight size={16} />
            </button>
          </details>
        );
    }
    return (
      <section
        className={"card panel op-decision " + (tone ? "op-tone-" + tone : "")}
        id="decision"
      >
        <div className="op-decision-head">
          <span className="op-status-icon">
            <Icon size={24} />
          </span>
          <div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        </div>
        {extra}
        {!closed && (
          <div className="row actions wrap op-decision-actions">
            {actions}
            {/* Asking is part of scoping; once booked it is the
                exception, so it steps back into More actions (ADR 068). */}
            {!booked && ask("secondary")}
            <details>
              <summary>More actions</summary>
              {booked && ask("text-button")}
              <button
                className="text-button"
                onClick={() => setModal("Decline request")}
              >
                Decline request
              </button>
              <label className={fieldClass("mode", "mini-field")}>
                Booking mode
                <select
                  value={r.mode}
                  {...invalid("mode")}
                  onChange={(e) => {
                    if (
                      e.target.value === "Instant Book" &&
                      !instantEligible(tasks)
                    )
                      return invalidate(
                        "mode",
                        "This scope requires Request to Book — it contains work that cannot be booked instantly.",
                      );
                    clear("mode");
                    update((d) => {
                      const req = d.requests.find((q) => q.id === r.id)!;
                      const was = req.mode;
                      req.mode = e.target.value;
                      log(d, "Operator changed booking mode", {
                        actor: "Operator",
                        requestId: r.id,
                        entity: "request",
                        entityId: r.id,
                        field: "mode",
                        from: was,
                        to: req.mode,
                      });
                    });
                  }}
                >
                  <option>Request to Book</option>
                  <option>Instant Book</option>
                </select>
                <Message field="mode" />
              </label>
            </details>
            {/* The money side, where the operator can actually act on it.
                One notice for the whole panel rather than a marker beside each
                state: an "Authorized" badge reads like a hold on a real card,
                and saying so once is enough to stop that. */}
            {quote && quote.status === "Approved" && (
              <section className="card panel">
                <div className="panel-title">
                  <h3>Payment</h3>
                </div>
                <p className="note">
                  Simulated throughout. No card is stored, no hold is placed and
                  no money moves — these states model the sequence a real
                  provider would produce.
                </p>
                <p>
                  {payMethod
                    ? `Method on file · ${payMethod.brand} ···· ${payMethod.last4}`
                    : "No method on file. The visit cannot be confirmed until there is one."}
                </p>
                {payments.length === 0 ? (
                  <p>
                    Nothing authorized yet.{" "}
                    {visitAt
                      ? authorizationDue(s, visitAt)
                        ? "The hold is due now."
                        : "The hold is placed closer to the appointment."
                      : ""}
                  </p>
                ) : (
                  <ul className="audit">
                    {payments.map((p) => (
                      <li key={p.id}>
                        <strong>{p.status}</strong> · {money(p.amount)}
                        {p.refunded ? ` · ${money(p.refunded)} returned` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="row actions">
                  {payMethod && !payments.length && (
                    <button
                      className="secondary"
                      onClick={() => {
                        const key = uid();
                        update((d) => {
                          authorizePayment(d, quote.id, key);
                        }, "Hold placed (simulated)");
                      }}
                    >
                      Authorize
                    </button>
                  )}
                  {payments.some((p) => p.status === "Authorized") && (
                    <>
                      <button
                        className="secondary"
                        onClick={() =>
                          update((d) => {
                            const held = d.payments.find(
                              (p) =>
                                p.quoteId === quote.id &&
                                p.status === "Authorized",
                            );
                            if (held) capturePayment(d, held.id);
                          }, "Captured (simulated)")
                        }
                      >
                        Capture
                      </button>
                      <button
                        className="text-button"
                        onClick={() =>
                          update(
                            (d) => {
                              const held = d.payments.find(
                                (p) =>
                                  p.quoteId === quote.id &&
                                  p.status === "Authorized",
                              );
                              if (held) capturePayment(d, held.id, true);
                            },
                            "Capture failed (simulated)",
                            "error",
                          )
                        }
                      >
                        Simulate a failed capture
                      </button>
                    </>
                  )}
                  {payments.some((p) =>
                    ["Paid", "Partially Refunded"].includes(p.status),
                  ) && (
                    <button
                      className="text-button"
                      onClick={() =>
                        update((d) => {
                          const taken = d.payments.find(
                            (p) =>
                              p.quoteId === quote.id &&
                              ["Paid", "Partially Refunded"].includes(p.status),
                          );
                          if (taken)
                            refundPayment(
                              d,
                              taken.id,
                              Math.round(taken.amount / 2),
                            );
                        }, "Refunded half (simulated)")
                      }
                    >
                      Refund half
                    </button>
                  )}
                </div>
                {owed > 0 && (
                  <p className="warning">
                    <AlertCircle size={16} /> {money(owed)} outstanding — the
                    work was done and the capture did not go through.
                  </p>
                )}
              </section>
            )}
          </div>
        )}
      </section>
    );
  };
  return (
    <>
      <div
        className={
          "heading operator-request-heading " + (fulfillment ? "is-hidden" : "")
        }
      >
        <div>
          <div className="eyebrow">INTAKE & FULFILLMENT</div>
          <h1>Service requests</h1>
          <p>The right work. The right person. The right time.</p>
        </div>
        {/* Counts the list as filtered, so it matches what is shown. */}
        <span className="badge">
          {shown.length} request{shown.length === 1 ? "" : "s"}
        </span>
      </div>
      <div
        className={
          "requests-layout operator-concept " +
          (fulfillment ? "focused-fulfillment" : "")
        }
      >
        {!fulfillment && (
          <button
            ref={browseButton}
            className="secondary mobile-request-browser"
            aria-expanded={showRequestQueue}
            onClick={() => setShowRequestQueue(!showRequestQueue)}
          >
            {showRequestQueue ? "Close request list" : "Browse requests"}
          </button>
        )}
        <section
          className={"panel queue " + (showRequestQueue ? "queue-open" : "")}
        >
          <label className="search">
            <Search size={16} />
            <input
              ref={searchBox}
              placeholder="Search requests…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter requests"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "All requests",
              "Needs Action",
              "Waiting",
              "Scheduled",
              "Draft",
              "History",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          {shown.map((q) => (
            <button
              key={q.id}
              className={"queue-item " + (q.id === r.id ? "selected" : "")}
              onClick={() => {
                if (q.id === r.id) showDetail();
                else focusDetail.current = true;
                choose(q.id);
              }}
            >
              <div className="row between">
                <strong>{q.name}</strong>
                <small>{q.id.toUpperCase()}</small>
              </div>
              <p>
                <span>
                  <MapPin size={16} />
                  {q.city} ·{" "}
                  {
                    s.tasks.filter((t) => t.requestId === q.id && !t.mergedInto)
                      .length
                  }{" "}
                  tasks
                </span>
                {badge(requestStatus(q.id))}
              </p>
            </button>
          ))}
        </section>
        <div className="detail">
          <div className="operator-detail-header">
            <button
              className="secondary"
              onClick={() => {
                flushSync(() => setShowRequestQueue(true));
                searchBox.current?.focus();
              }}
            >
              ← All requests
            </button>
            <strong>Request Details</strong>
          </div>
          <section className="card panel operator-summary">
            <div className="panel-title">
              <div>
                <span className="eyebrow">
                  SERVICE REQUEST / {r.id.toUpperCase()}
                </span>
                <h2 ref={detailHeading} tabIndex={-1}>
                  {r.address || r.name}
                </h2>
                <p>
                  <MapPin size={16} /> {r.city} · {r.name}
                </p>
              </div>
              {badge(requestStatus(r.id))}
            </div>
            <div className="detail-meta">
              <span>
                <Clock size={16} />
                {r.timing}
              </span>
              <span>{badge(r.mode)}</span>
            </div>
            <p>
              {tasks.length} task{tasks.length === 1 ? "" : "s"} ·{" "}
              {tasks.reduce((n, t) => n + t.duration, 0)} minutes estimated ·{" "}
              {tasks.reduce((n, t) => n + t.photos.length, 0)} photos
            </p>
            <a
              className="text-button"
              target="_blank"
              rel="noreferrer"
              href={
                "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(r.address + ", " + r.city)
              }
            >
              {r.address}, {r.city} · Open in Maps ↗
            </a>
          </section>
          {decisionCard()}
          {/* A bounce is the one delivery state the operator can act
              on: reach that person another way (ADR 060). */}
          {unreachable(s, r.id).map((u) => (
            <p className="warning" key={u.name + u.channel}>
              <AlertCircle size={16} />
              {u.channel === "sms"
                ? `Couldn’t text ${u.name}: ${u.reason.toLowerCase()}. Call or email them about this request.`
                : `Couldn’t email ${u.name}: ${u.reason.toLowerCase()}. Call or text them about this request.`}
            </p>
          ))}
          {r.operatorNote && (
            /* Single Q&A slot: waiting, then answered. Asking again
               replaces it rather than growing a history. */
            <section
              id={idPrefix + "question"}
              className={
                "card operator-note " +
                (r.customerReply ? "answered" : "waiting")
              }
            >
              <span className="eyebrow">
                {r.customerReply ? "CUSTOMER ANSWERED" : "WAITING ON CUSTOMER"}
              </span>
              <p>{r.operatorNote}</p>
              {r.customerReply ? (
                <p className="operator-note-reply">
                  <strong>Reply:</strong> {r.customerReply}
                </p>
              ) : (
                <button
                  className="text-button"
                  onClick={() =>
                    update((d) => {
                      const req = d.requests.find((x) => x.id === r.id)!;
                      req.operatorNote = null;
                      req.customerReply = null;
                    }, "Question withdrawn")
                  }
                >
                  Cancel question
                </button>
              )}
            </section>
          )}
          {/* Everything but the decision, one part at a time (ADR 068).
              The part that matters opens first: the tasks until the
              work is booked, then its visits. */}
          <div className="request-tabs">
            <div
              className="segmented"
              role="group"
              aria-label="Request details"
            >
              {(
                [
                  ["Tasks", tasks.length],
                  ["Visits", liveVisits.length],
                  ["Notes"],
                  ["History", trail.length],
                ] as [string, number?][]
              ).map(([name, n]) => (
                <button
                  key={name}
                  className={tab === name ? "chosen" : ""}
                  aria-pressed={tab === name}
                  onClick={() => setRequestTab(name)}
                >
                  {name}
                  {n !== undefined && <span className="count">{n}</span>}
                </button>
              ))}
            </div>
            {tab === "Tasks" && (
              <section className="card panel" id="review-tasks">
                <div className="panel-title">
                  <h3>
                    Tasks <span className="count">{tasks.length}</span>
                  </h3>
                  <small>Select tasks to group into a separate visit</small>
                </div>
                {tasks.map((t) => (
                  <details className="task-review" key={t.id}>
                    <summary>
                      <span className="task-number">
                        {tasks.indexOf(t) + 1}
                      </span>{" "}
                      {t.summary} · {t.duration} min
                      {!t.reviewed ? " · Needs review" : ""}
                    </summary>
                    <div className="row between">
                      <label className="row">
                        <input
                          type="checkbox"
                          checked={selected.includes(t.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, t.id]
                                : selected.filter((x) => x !== t.id),
                            )
                          }
                        />
                        <strong>{t.summary}</strong>
                      </label>
                      <span className="badge">{t.duration} min</span>
                    </div>
                    <p>“{t.description}”</p>
                    <TaskAnswers task={t} />
                    {t.restricted && (
                      <p className="warning">
                        <AlertCircle size={16} /> Potential regulated work ·
                        operator review and eligible specialist required
                      </p>
                    )}
                    {/* Set where the scope is decided. "Materials
                          required" as a visit outcome is a stall until
                          somebody has said whose materials they are. */}
                    <label className="field">
                      Materials
                      <select
                        value={t.materials || "To be confirmed"}
                        onChange={(e) =>
                          update((d) => {
                            const task = d.tasks.find((x) => x.id === t.id)!;
                            const was = task.materials;
                            task.materials = e.target
                              .value as MaterialsResponsibility;
                            log(d, `Materials set for ${t.summary}`, {
                              actor: "Operator",
                              requestId: r.id,
                              entity: "task",
                              entityId: t.id,
                              field: "materials",
                              ...(was ? { from: was } : {}),
                              to: task.materials,
                            });
                          }, "Materials responsibility set")
                        }
                      >
                        {materialsResponsibilities.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    {taskPhotos(t)}
                    {/* A task the classifier could not name gets a
                          title here, prefilled from the customer's own
                          words (ADR 063). It heads the contractor's offer. */}
                    {!t.reviewed && genericTitle(t) && (
                      <label className="field">
                        Title
                        <input
                          value={
                            taskTitles[t.id] ?? suggestTitle(t.description)
                          }
                          onChange={(e) =>
                            setTaskTitles({
                              ...taskTitles,
                              [t.id]: e.target.value,
                            })
                          }
                        />
                      </label>
                    )}
                    {!t.reviewed && (
                      <button
                        className="secondary actions"
                        onClick={() =>
                          update((d) => {
                            reviewTask(d, t.id, taskTitles[t.id]);
                          }, "Review recorded")
                        }
                      >
                        Mark reviewed
                      </button>
                    )}
                    {/* Explainability and scope authoring stay reachable
                          but out of the triage path. */}
                    <details className="note">
                      <summary>Why this classification?</summary>
                      <div className="reason">
                        <ShieldCheck size={16} />
                        <span>
                          {t.reason}
                          <small>
                            Confidence {Math.round(t.confidence * 100)}% ·{" "}
                            {t.category}
                          </small>
                        </span>
                      </div>
                    </details>
                    <details className="note">
                      <summary>Adjust scope</summary>
                      <p>
                        Reclassifying to restricted work clears the review flag
                        and returns this request to Needs Review.
                      </p>
                      <div className="row wrap actions">
                        <label className="mini-field">
                          Classification
                          <select
                            aria-label={"Classification for " + t.summary}
                            value={t.category}
                            onChange={(e) =>
                              update((d) => {
                                const task = d.tasks.find(
                                  (x) => x.id === t.id,
                                )!;
                                log(
                                  d,
                                  `Classification corrected: ${task.category} → ${e.target.value} · original: ${task.description}`,
                                );
                                task.category = e.target.value;
                                task.restricted =
                                  task.restricted ||
                                  e.target.value.includes("Electrical");
                                task.reviewed = !task.restricted;
                              }, "Correction recorded")
                            }
                          >
                            <option>{t.category}</option>
                            {[
                              "Handyman / Doors / Adjustment",
                              "Handyman / Walls / Drywall",
                              "Installation / Shelving",
                              "Assembly / Furniture",
                              "Electrical / Restricted work",
                            ]
                              .filter((x) => x !== t.category)
                              .map((x) => (
                                <option key={x}>{x}</option>
                              ))}
                          </select>
                        </label>
                        <label
                          className={fieldClass(
                            "duration-" + t.id,
                            "mini-field",
                          )}
                        >
                          Duration (min)
                          <input
                            type="number"
                            min="15"
                            max="480"
                            value={t.duration}
                            {...invalid("duration-" + t.id)}
                            onChange={(e) => {
                              if (
                                visits.some(
                                  (v) =>
                                    v.status !== "Cancelled" &&
                                    v.taskIds.includes(t.id),
                                )
                              )
                                return invalidate(
                                  "duration-" + t.id,
                                  "Remove the visit before changing this duration, so availability can be recalculated.",
                                );
                              clear("duration-" + t.id);
                              patchTask(t.id, {
                                duration: Math.max(15, Number(e.target.value)),
                              });
                            }}
                          />
                          <Message field={"duration-" + t.id} />
                        </label>
                        <button
                          className="text-button"
                          onClick={() => {
                            setSelected([t.id]);
                            setModal("Split task");
                          }}
                        >
                          Split task
                        </button>
                      </div>
                    </details>
                  </details>
                ))}
                {selected.length > 1 && (
                  <button
                    className="secondary"
                    onClick={() => setModal("Merge tasks")}
                  >
                    Merge selected task descriptions
                  </button>
                )}
              </section>
            )}
            {tab === "Visits" && (
              <section className="card panel" aria-label="Visits">
                {liveVisits.length === 0 && (
                  <p>No visits yet. Booked and offered visits show here.</p>
                )}
                {visits
                  .filter((v) => v.status !== "Cancelled")
                  .map((v) => (
                    <div key={v.id}>
                      {visitCard(v)}
                      {s.assignments
                        .filter((a) => a.visitId === v.id)
                        .map((a) => (
                          <div className="assignment-row" key={a.id}>
                            <span>
                              {
                                providers.find((p) => p.id === a.providerId)
                                  ?.name
                              }{" "}
                              ·{" "}
                              {a.providerId === "yousef"
                                ? "Self-assigned"
                                : money(a.pay)}
                            </span>
                            {badge(a.status)}
                            {a.status === "Offered" && (
                              <button
                                className="text-button"
                                onClick={() => {
                                  setContractor(a.providerId);
                                  setRole("Contractor");
                                  setPage("Your Work");
                                }}
                              >
                                Open contractor view <ArrowUpRight size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      <button
                        className="text-button"
                        onClick={() => cancelVisit(v)}
                      >
                        Remove visit / regroup tasks
                      </button>
                    </div>
                  ))}
              </section>
            )}
            {tab === "Notes" && (
              <section className="card panel operator-notes">
                <h3>Notes from customer</h3>
                <p>
                  {r.notes || "No additional access or parking notes supplied."}
                </p>
                {!!r.preferredSlots?.length || r.timingConstraints ? (
                  <>
                    <h3>Stated preference</h3>
                    <p>
                      {r.preferredSlots
                        ?.map(
                          (p) =>
                            `${dayLabel(p.date)}${p.times.length ? ` (${p.times.join(", ")})` : ""}`,
                        )
                        .join(" · ") || "No specific day"}
                      {r.timingConstraints ? ` — ${r.timingConstraints}` : ""}
                    </p>
                  </>
                ) : null}
              </section>
            )}
            {tab === "History" && (
              <section className="card panel" aria-label="History">
                {trail.length === 0 ? (
                  <p>Nothing recorded against this request yet.</p>
                ) : (
                  <AuditList trail={trail} />
                )}
              </section>
            )}
          </div>
          {fulfillment && (
            <>
              {" "}
              <section className="card panel" id="fulfillment">
                <button
                  className="secondary"
                  onClick={() => {
                    setFulfillment(false);
                    requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLElement>("#decision button")
                        ?.focus(),
                    );
                  }}
                >
                  ← Back to request
                </button>
                <div className="panel-title">
                  <h2>
                    {fulfillmentKind === "self"
                      ? "Do It Myself"
                      : "Assign Contractor"}
                  </h2>
                  <span className="badge">
                    {selected.length || tasks.length} tasks · {duration} min
                  </span>
                </div>
                <div className="fulfillment-request-summary">
                  <MapPin size={24} />
                  <strong>
                    {r.address}, {r.city}
                  </strong>
                  <p>{scopeTasks.map((t) => t.summary).join(" · ")}</p>
                  <p>{r.timing}</p>
                </div>
                <Message field="tasks" />
                <Message field="provider" />
                <div className="provider-options">
                  {candidates.map((c) => {
                    const theirs = chosenStart(s, r, c.provider.id, duration);
                    return (
                      <button
                        key={c.provider.id}
                        aria-pressed={provider === c.provider.id}
                        className={
                          "provider-card " +
                          (provider === c.provider.id ? "selected" : "")
                        }
                        onClick={() => {
                          clear("provider");
                          clear("pay");
                          setProvider(c.provider.id);
                          // Each contractor's own rate, not the last one's.
                          setPayTouched(false);
                          setSlot("");
                          setOverride("");
                        }}
                      >
                        <div className="avatar">{c.provider.initials}</div>
                        <div>
                          <strong>{c.provider.name}</strong>
                          <small>
                            {c.provider.city} · {money(c.provider.rate)}
                            /hr
                          </small>
                          <small>
                            {c.match.checks.map((x) => x.title).join(" · ")}
                          </small>
                          <small>
                            {/* Agrees with the list below, which puts
                              the customer's time first (ADR 072). */}
                            {theirs
                              ? `Customer’s choice: ${dateLabel(theirs)} · ${c.provider.city === r.city ? 8 : 24} min simulated travel`
                              : c.appointments.length
                                ? `First fitting time: ${dateLabel(c.appointments[0].start)} · ${c.appointments[0].travel} min simulated travel`
                                : "No fitting time found"}
                          </small>
                        </div>
                        {provider === c.provider.id && <Check size={16} />}
                      </button>
                    );
                  })}
                </div>
                {!candidates.length && (
                  <div className="warning">
                    <strong>
                      {scopeTasks.some(
                        (t) =>
                          getIssue(t.description).availability ===
                          "Referral only",
                      )
                        ? "Referral-only scope: no bookable provider"
                        : scopeTasks.some((t) => !t.reviewed)
                          ? "Review these tasks before choosing a provider"
                          : "No provider covers all selected tasks"}
                    </strong>
                    <p>
                      Expand the task rows to review scope or select tasks for
                      separate visits.
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setFulfillment(false);
                        showTasks();
                      }}
                    >
                      Review tasks / split visit
                    </button>
                  </div>
                )}
                {match.eligible && (
                  <details className="note">
                    <summary>Why this provider?</summary>
                    <ul>
                      {match.checks.map((c) => (
                        <li key={c.taskId}>
                          <strong>{c.title}</strong> — {c.reason}.{" "}
                          <small>{c.category}</small>
                        </li>
                      ))}
                    </ul>
                    <p>
                      {candidates.find((c) => c.provider.id === provider)
                        ?.appointments.length
                        ? "Fitting times below account for combined duration, working hours, existing visits, travel and buffers."
                        : "Scope fits, but no appointment fits the current duration and timing preference. Review timing or split the visit."}
                    </p>
                    <p>Customer price and contractor pay remain separate.</p>
                  </details>
                )}
                <h4>
                  Recommended appointments{" "}
                  <span className="muted">· simulated routing</span>
                </h4>
                <Message field="slot" />
                <div className="slot-grid">
                  {opts.map((o, i) => (
                    <button
                      key={o.start}
                      className={
                        "slot " +
                        ((slot || opts[0]?.start) === o.start ? "selected" : "")
                      }
                      onClick={() => {
                        clear("slot");
                        setSlot(o.start);
                      }}
                    >
                      {o.start === chosenTime ? (
                        <span className="eyebrow">CUSTOMER’S CHOICE</span>
                      ) : (
                        i === 0 && (
                          <span className="eyebrow">BEST ROUTE FIT</span>
                        )
                      )}
                      <strong>{dateLabel(o.start)}</strong>
                      <small>+{o.travel} min driving · 15 min buffer</small>
                      <small>
                        {duration} min work · fits provider schedule and
                        customer preference
                      </small>
                    </button>
                  ))}
                </div>
                {!!opts.length && (
                  <details className="note">
                    <summary>Why this time?</summary>
                    <p>
                      {(slot || opts[0]?.start) === chosenTime &&
                        "The customer chose this time when they booked. "}
                      {duration} minutes of work fits this provider’s weekday
                      working hours. Simulated travel allowance:{" "}
                      {opts.find((o) => o.start === (slot || opts[0]?.start))
                        ?.travel ?? opts[0]?.travel}{" "}
                      minutes, plus a 15-minute buffer. Checked against this
                      provider’s existing visits and the customer’s timing
                      preference.
                    </p>
                  </details>
                )}
                {!opts.length && (
                  <p className="warning">
                    No available window fits these tasks. Split the visit or
                    change provider.
                  </p>
                )}
                <label className="mini-field actions">
                  Override proposed time
                  <input
                    type="datetime-local"
                    onChange={(e) => {
                      const x = new Date(e.target.value);
                      if (!Number.isFinite(+x)) return;
                      if (
                        available(
                          s,
                          provider,
                          duration,
                          r.city,
                          x.toISOString(),
                          undefined,
                          r.timing,
                          r.id,
                        )
                      ) {
                        setOverride(x.toISOString());
                        setSlot(x.toISOString());
                        notify(
                          "Valid override selected; travel and buffers checked.",
                        );
                      } else
                        notify(
                          "That time conflicts with working hours, preferences, or an existing visit.",
                          "error",
                        );
                    }}
                  />
                </label>
                {provider !== "yousef" && (
                  <label className="mini-field">
                    Contractor pay (CAD)
                    <input
                      type="number"
                      min="0"
                      value={assignPay}
                      {...invalid("pay")}
                      onChange={(e) => {
                        clear("pay");
                        setPayTouched(true);
                        setPay(Math.max(0, +e.target.value));
                      }}
                    />
                    <Message field="pay" />
                  </label>
                )}
                <div className="note">
                  <strong>Customer price & confirmation</strong>
                  <p>
                    {s.quotes
                      .filter(
                        (q) =>
                          q.requestId === r.id && q.status !== "Superseded",
                      )
                      .map((q) => `${q.type}: ${money(q.amount)} · ${q.status}`)
                      .join("; ") ||
                      "No quote sent yet. Send it from the request once this visit is assigned."}
                  </p>
                  <p>
                    An offer does not confirm the customer appointment.
                    Acceptance, approved scope, quote approval and applicable
                    payment conditions still apply.
                  </p>
                </div>
                <button
                  className="primary actions"
                  onClick={() => {
                    if (!match.eligible)
                      return invalidate(
                        "provider",
                        "This provider is not eligible for every selected task.",
                      );
                    if (!opts.length)
                      return invalidate(
                        "slot",
                        "No appointment fits this scope. Adjust the tasks or choose another provider.",
                      );
                    createVisit();
                  }}
                >
                  {provider === "yousef"
                    ? "Create visit"
                    : "Create visit & send offer"}
                  <ArrowRight size={16} />
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
