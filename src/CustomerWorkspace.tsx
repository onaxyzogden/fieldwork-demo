import PropertyRecord from "./PropertyRecord";
import { bucket } from "./work";
import CustomerQueue from "./CustomerQueue";
import { customerTodoLabel, customerQueue } from "./roleQueues";
import {
  customerProgressText,
  customerQuoteText,
  customerStatusText,
} from "./customerText";
import { dayLabel, taskLabel } from "./intake";
import {
  ArrowRight,
  Plus,
  MapPin,
  CalendarDays,
  ChevronDown,
  Wrench,
  Check,
} from "lucide-react";
import {
  type Request,
  type Visit,
  providers,
  money,
  dateLabel,
  log,
  accounts,
  answerQuestion,
  genericTitle,
  quoted,
  confirmed,
  approveQuote,
  declineQuote,
  workPayment,
} from "./model";
import { LATE_CANCEL_TEXT } from "./notifications";
import { Glance, GlanceLead } from "./GlanceCard";
import {
  glanceDate,
  visitDayLine,
  visitDayState,
  customerGlance,
  todaysVisits,
} from "./glance";
import { lazyScreen } from "./Recovery";
import { NoteReply, TaskAnswers, ClarificationFields } from "./RequestFields";
import { useWorkspace } from "./workspaceContext";
import { approveCharge, declineCharge } from "./decisions";
import { readyToPay } from "./payments";

/* Loaded when first opened, not with the app (ADR 074). */
const CustomerIntake = lazyScreen(() => import("./CustomerIntake"));

export function CustomerWorkspace() {
  const {
    Message,
    badge,
    badgeTone,
    booked,
    completion,
    customer,
    expanded,
    fail,
    idPrefix,
    invalidate,
    notify,
    ownRequests,
    page,
    pay,
    photo,
    quote,
    r,
    reveal,
    reviewing,
    role,
    s,
    setActive,
    setCustomer,
    setExpanded,
    setModal,
    setPage,
    setReviewing,
    setSlot,
    setStep,
    startOrResumeRequest,
    taskPhotos,
    tasks,
    update,
    visitCard,
    visits,
  } = useWorkspace();
  /* The signed-in customer's own requests. A draft only counts once it carries
     something — an address, a description or a photo. */
  /* Only properties that have actually been walked: an empty history is not
     worth a collapsed panel telling the customer there is nothing in it. */
  const customerProperties = s.properties.filter(
    (p) =>
      p.accountId === customer &&
      s.walkthroughs.some((w) => w.propertyId === p.id),
  );
  const customerAtAGlance = customerGlance(s, customer, +s.clock);
  const customerTodoList = customerQueue(s, customer, s.clock);
  const customerTodos = customerTodoList.length;
  const customerNext = customerAtAGlance.next;
  /* Open a request's row in the accordion below and bring it into view. The
     row is already on this screen, so this expands rather than navigates. */
  const customerToday = todaysVisits(
    s,
    s.clock,
    (v) => s.requests.find((x) => x.id === v.requestId)?.accountId === customer,
  );
  const openRequestRow = (id: string) => {
    setActive(id);
    setExpanded(true);
    requestAnimationFrame(() =>
      document
        .getElementById("request-" + id)
        ?.closest(".request-accordion-item")
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  };
  /* A count with nothing behind it gets no handler, so the card never offers
     a button that would do nothing. */
  const openFirst = (ids: string[]) =>
    ids.length ? () => openRequestRow(ids[0]) : undefined;
  /* The customer's own status badge never shows the raw dispatch/operator
     status string — "Awaiting Provider Acceptance" is jargon to the one
     person with no stake in that state machine, and it clashed with the
     plain-language note rendered right below it. Colour still keys off the
     real status via badgeTone(); only the words change (customerText.ts). */
  const customerBadge = (status: string) => (
    <span className={"badge " + badgeTone(status)}>
      {customerStatusText(status)}
    </span>
  );
  /* An additional charge for a return visit (ADR 065), beside the quote it
     adds to; approving pays it and books the return visit. */
  const chargePanel = () => {
    const c = s.charges?.find(
      (x) => x.requestId === r.id && x.status === "Sent",
    );
    if (!c) return null;
    const who = providers.find((p) => p.id === c.plan.providerId)?.name;
    return (
      <div className="card panel quote" id={idPrefix + "charge"}>
        <div className="row between">
          <span className="eyebrow">ADDITIONAL CHARGE</span>
          <span className={"badge " + badgeTone(c.status)}>
            {customerQuoteText(c.status)}
          </span>
        </div>
        <h2>
          {money(c.amount)}
          <small> CAD</small>
        </h2>
        <p>{c.reason}</p>
        <small>
          For a return visit{who ? ` with ${who}` : ""} on{" "}
          {dateLabel(c.plan.start)}, booked once you approve.
        </small>
        <div className="row actions">
          <button
            className="primary"
            onClick={() => {
              let ok = false;
              update((d) => {
                ok = approveCharge(d, c.id, fail);
              });
              if (ok) notify("Charge approved · return visit booked");
              else
                invalidate(
                  "charge",
                  "Your payment didn’t go through. Try again, or use another card.",
                );
            }}
          >
            Approve & pay {money(c.amount)}
          </button>
          <button
            className="text-button"
            onClick={() =>
              update((d) => {
                declineCharge(d, c.id);
              }, "Charge declined")
            }
          >
            Decline
          </button>
        </div>
        <Message field="charge" />
      </div>
    );
  };
  const quotePanel = () =>
    quote ? (
      <div className="card panel quote" id={idPrefix + "quote"}>
        <div className="row between">
          {/* The pricing path is how the operator priced it; to the customer
              it is a quote, or an estimate when it is a range. */}
          <span className="eyebrow">
            {quote.type === "Estimated range" ? "YOUR ESTIMATE" : "YOUR QUOTE"}
          </span>
          <span className={"badge " + badgeTone(quote.status)}>
            {customerQuoteText(quote.status)}
          </span>
        </div>
        <h2>
          {money(quote.amount)}
          {quote.type === "Estimated range" ? " – " + money(quote.high) : ""}
          <small> CAD</small>
        </h2>
        <p>
          {quote.notes ||
            "Labour and standard materials included. Additional work requires your approval."}
        </p>
        <small>
          {s.payments.some(
            (p) =>
              p.quoteId === quote.id && workPayment(p) && p.status === "Paid",
          )
            ? "Payment received"
            : quote.payOnCompletion
              ? "Payment due on completion"
              : "Payment due after approval"}
        </small>
        {role === "Customer" && quote.status === "Sent" && (
          <div className="row actions">
            <button
              className="primary"
              onClick={() =>
                update((d) => {
                  approveQuote(d, quote.id);
                  log(d, "Customer approved quote");
                }, "Quote approved")
              }
            >
              Approve quote <Check size={16} />
            </button>
            <button
              className="secondary"
              onClick={() =>
                update((d) => {
                  declineQuote(d, quote.id);
                }, "Quote declined")
              }
            >
              Decline
            </button>
          </div>
        )}
        {/* Pay on completion means after the work, not on approval
            (readyToPay, ADR 063). */}
        {role === "Customer" && readyToPay(s, quote) && (
          <button
            className="primary actions"
            onClick={() => setModal("Payment")}
          >
            {quote.payOnCompletion ? "Pay now" : "Continue to payment"}{" "}
            <ArrowRight size={16} />
          </button>
        )}
        {s.payments
          .filter((p) => p.quoteId === quote.id)
          .map((p) => (
            <p key={p.id}>
              {badge(p.status)}{" "}
              <small>
                {/* Receipts taken before ADR 061 carry a "demo_" prefix. */}
                Receipt {p.reference.replace(/^demo_/, "").toUpperCase()}
              </small>
            </p>
          ))}
      </div>
    ) : null;
  return (
    <div className="customer-wrap">
      {/* The prototype has to simulate several people to be testable at
          all. Tappable pills, the same visual idiom as every other chip
          here, rather than a separate control type. The roster is the
          customer list itself, so someone with no requests yet is still
          selectable — identity does not depend on owning a row. */}
      <div className="identity-switch" role="group" aria-label="Viewing as">
        <span className="eyebrow">VIEWING AS</span>
        {accounts.map((c) => (
          <button
            key={c.id}
            className="badge"
            aria-pressed={customer === c.id}
            onClick={() => {
              setCustomer(c.id);
              const own = s.requests.find((x) => x.accountId === c.id);
              if (own) setActive(own.id);
              setStep(0);
              setPage("My bookings");
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
      {page === "New request" ? (
        <CustomerIntake
          key={r.id}
          s={s}
          r={r}
          update={update}
          notify={notify}
          photos={taskPhotos}
          questions={(t, change, attempted) => (
            <ClarificationFields
              task={t}
              onChange={change}
              attempted={attempted}
            />
          )}
          pay={(start) => {
            setSlot(start);
            setModal("Instant payment");
          }}
          view={() => setPage("My bookings")}
        />
      ) : (
        <>
          <div className="heading role-greeting customer-portal-heading">
            <div>
              <h1>Home, handled.</h1>
              <p>Your requests and upcoming visits.</p>
            </div>
          </div>
          {/* Visit day, live (ADR 066): one line per visit today,
              opening that visit. */}
          {customerToday.length > 0 && (
            <section className="card panel visit-day" aria-label="Today">
              {customerToday.map((v) => (
                <button
                  key={v.id}
                  className={
                    "visit-day-line" +
                    (visitDayState(v) === "Running late" ? " is-late" : "")
                  }
                  onClick={() => {
                    setActive(v.requestId);
                    setExpanded(true);
                    reveal(idPrefix + "visit-" + v.id);
                  }}
                >
                  <CalendarDays size={20} />
                  <span>{visitDayLine(v, s.clock)}</span>
                </button>
              ))}
            </section>
          )}
          {/* Each number opens the first thing it counted, so a
              count and what it points at cannot disagree. A bucket
              with nothing in it gets no onClick rather than a button
              that does nothing — the ADR 034 defect. */}
          <Glance
            date={glanceDate(+s.clock)}
            lead={
              customerNext ? (
                <GlanceLead
                  when={dateLabel(customerNext.visit.start)}
                  what={
                    providers.find(
                      (p) => p.id === customerNext.visit.providerId,
                    )?.name || "Your provider"
                  }
                  where={customerNext.address}
                  onClick={() => openRequestRow(customerNext.requestId)}
                />
              ) : (
                <GlanceLead when="NEXT VISIT" what="Nothing scheduled yet." />
              )
            }
            metrics={[
              {
                label: "Waiting on you",
                value: customerAtAGlance.waiting,
                urgent: customerAtAGlance.waiting > 0,
                onClick: openFirst(customerAtAGlance.waitingIds),
              },
              {
                label: "Upcoming visits",
                value: customerAtAGlance.upcoming,
                onClick: openFirst(customerAtAGlance.scheduledIds),
              },
              {
                label: "In progress",
                value: customerAtAGlance.inProgress,
                onClick: openFirst(customerAtAGlance.inProgressIds),
              },
            ]}
          />
          {/* Everything waiting on them, one thing at a time (ADR
              062). The number is the glance's own "Waiting on you". */}
          {customerTodos > 0 && (
            <button className="primary full" onClick={() => setReviewing(true)}>
              {/* One thing is named, not counted (ADR 070). */}
              {customerTodos === 1
                ? customerTodoLabel(s, customerTodoList[0])
                : `Review ${customerTodos} things waiting on you`}
            </button>
          )}
          {reviewing && (
            <CustomerQueue
              s={s}
              update={update}
              accountId={customer}
              failPayment={fail}
              close={() => setReviewing(false)}
            />
          )}
          {/* Accordion, not a tab strip into a separate detail screen.
              Everything about a request opens inline underneath its own
              row, so nothing about it lives on another page. */}
          <div className="request-accordion">
            {ownRequests.length === 0 && (
              <p className="note">
                No requests yet. Start one and it will appear here.
              </p>
            )}
            {ownRequests.map((x) => {
              const open = r.id === x.id && expanded;
              const count = s.tasks.filter(
                (t) => t.requestId === x.id && !t.mergedInto,
              ).length;
              const title =
                x.status === "Draft"
                  ? "Draft · " +
                    (s.tasks
                      .find(
                        (t) =>
                          t.requestId === x.id &&
                          !t.mergedInto &&
                          t.description.trim(),
                      )
                      ?.description.slice(0, 60) ||
                      x.address ||
                      "Photos added")
                  : x.address || "Request · " + x.id.toUpperCase();
              return (
                <section className="card request-accordion-item" key={x.id}>
                  <button
                    className="accordion-head"
                    aria-expanded={open}
                    aria-controls={"request-" + x.id}
                    onClick={() => {
                      if (r.id === x.id) setExpanded(!expanded);
                      else {
                        setActive(x.id);
                        setExpanded(true);
                      }
                    }}
                  >
                    <span className="accordion-head-text">
                      <strong>{title}</strong>
                      <small>
                        <MapPin size={16} />
                        {x.city} · {count} {count === 1 ? "task" : "tasks"}
                      </small>
                    </span>
                    {customerBadge(x.status)}
                    <ChevronDown
                      size={20}
                      className={open ? "chevron open" : "chevron"}
                    />
                  </button>
                  {!open ? null : (
                    <div id={"request-" + x.id}>
                      {r.status === "Draft" ? (
                        /* Their own unfinished work, so it gives way
                           to whatever is waiting on them (ADR 070). */
                        <button
                          className={customerTodos ? "secondary" : "primary"}
                          onClick={() => {
                            setPage("New request");
                            setStep(0);
                          }}
                        >
                          Continue request <ArrowRight size={16} />
                        </button>
                      ) : ["Cancelled", "Declined"].includes(r.status) ? (
                        /* A cancelled/declined request is not a
                           pipeline paused mid-step — the tracker
                           only ever shows forward progress, so it
                           has no honest way to represent "stopped."
                           Say so directly instead. */
                        <p className="note">
                          {r.lateCancel
                            ? r.lateCancel.fee === undefined
                              ? LATE_CANCEL_TEXT
                              : r.lateCancel.fee
                                ? `This request was cancelled less than 24 hours before the visit. Late-cancellation fee: ${money(r.lateCancel.fee)}. Anything else you paid has been refunded.`
                                : "This request was cancelled. No late-cancellation fee applies, and anything you paid has been refunded in full."
                            : `This request was ${r.status.toLowerCase()}.`}
                        </p>
                      ) : (
                        <div className="status-track">
                          {/* Three steps, not four. "Provider coordinated" was
                    internal handoff the customer could not act on; it
                    survives as the prose note below, not as a step.
                    Text only, no icon — colour carries the state. */}
                          {[
                            {
                              label: "Received",
                              done: true,
                            },
                            {
                              label: "Quote",
                              done: quote?.status === "Approved",
                              active: quoted(s, r.id),
                            },
                            {
                              label: "Confirmed",
                              done: confirmed(s, r.id),
                            },
                          ].map((x) => (
                            <div
                              className={
                                "status-step " +
                                (x.done ? "done" : x.active ? "active" : "")
                              }
                              key={x.label}
                            >
                              {x.label}
                            </div>
                          ))}
                        </div>
                      )}
                      {![
                        "Confirmed",
                        "Cancelled",
                        "Declined",
                        "Draft",
                      ].includes(r.status) && (
                        /* One contextual line, chosen from derived
                           state — not a log (ADR 070). */
                        <p className="note">{customerProgressText(s, r)}</p>
                      )}
                      {!!r.preferredSlots?.length || r.timingConstraints ? (
                        /* The customer's own stated preference, always visible to
                 them and never quietly dropped. */
                        <p className="note">
                          Your preference:{" "}
                          {r.preferredSlots
                            ?.map(
                              (p) =>
                                `${dayLabel(p.date)}${p.times.length ? ` (${p.times.join(", ")})` : ""}`,
                            )
                            .join(" · ") || "no specific day"}
                          {r.timingConstraints
                            ? ` — ${r.timingConstraints}`
                            : ""}
                        </p>
                      ) : null}
                      {r.notes && <p className="note">{r.notes}</p>}
                      {r.operatorNote && (
                        /* One question, one reply. Not a thread: see §7.3 — a new
                 question replaces this pair rather than appending. */
                        <div
                          id={idPrefix + "question"}
                          className={
                            "card operator-note " +
                            (r.customerReply ? "answered" : "waiting")
                          }
                        >
                          <span className="eyebrow">
                            {r.customerReply
                              ? "WE ASKED"
                              : "WE HAVE A QUESTION"}
                          </span>
                          <p>{r.operatorNote}</p>
                          {r.customerReply ? (
                            <p className="operator-note-reply">
                              <strong>Your reply:</strong> {r.customerReply}
                            </p>
                          ) : (
                            <NoteReply
                              onSend={(reply) =>
                                update((d) => {
                                  answerQuestion(d, r.id, reply);
                                }, "Reply sent")
                              }
                            />
                          )}
                        </div>
                      )}
                      {tasks.map((t) => (
                        <div className="portal-task" key={t.id}>
                          <span className="portal-task-icon">
                            <Wrench size={16} />
                          </span>
                          <div className="portal-task-body">
                            {/* A generic title says nothing; their
                                own words do (ADR 070). */}
                            {genericTitle(t) ? (
                              <>
                                <h4>{taskLabel(t)}</h4>
                                {taskLabel(t).endsWith("…") && (
                                  <p>{t.description}</p>
                                )}
                              </>
                            ) : (
                              <>
                                <h4>{t.summary}</h4>
                                <p>{t.description}</p>
                              </>
                            )}
                            <TaskAnswers task={t} />
                            {taskPhotos(t)}
                          </div>
                        </div>
                      ))}
                      {quotePanel()}
                      {chargePanel()}
                      {visits.map(visitCard)}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          {/* The primary action sits after the list, not before it —
              reviewing what already exists comes first; starting
              something new is the trailing action. */}
          <button
            className={
              /* One primary on the page (ADR 070): it gives way to
                 the review button, and to a draft's Continue, which
                 this button would only resume anyway. */
              (customerTodos || ownRequests.some((x) => x.status === "Draft")
                ? "secondary"
                : "primary") + " full new-request-trailing"
            }
            onClick={startOrResumeRequest}
          >
            <Plus size={16} /> New request
          </button>
          {/* Collapsed and below the bookings: the walkthrough history
              is a reference, not the thing the customer came for. */}
          {customerProperties.map((p) => (
            <details className="card panel" key={p.id}>
              <summary>
                <strong>Maintenance record · {p.address}</strong>
              </summary>
              <PropertyRecord s={s} propertyId={p.id} />
            </details>
          ))}
        </>
      )}
    </div>
  );
}
