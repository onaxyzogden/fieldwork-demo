/* First, the two sheets the role workspaces brought in when they were
   imported here, in that order. The roles now load on demand, and this
   keeps the CSS in the first load and its cascade unchanged (ADR 078). */
import "./onsite.css";
import "./work.css";
/* Then the state, whose imports keep the order Workspace had (ADR 077). */
import { useWorkspaceState } from "./useWorkspaceState";
import { cancelBooking, lateFor, rescheduleVisit } from "./decisions";
import { validAddress } from "./intake";
import React, { useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Bell,
  X,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import {
  type State,
  type Task,
  type Request,
  uid,
  providers,
  money,
  dateLabel,
  log,
  slots,
  releaseHold,
  available,
  eligible,
  instantEligible,
  accounts,
  confirmed,
} from "./model";
import { payQuote } from "./payments";
import { Sidebar, DemoBar, Topbar, DemoSettings, homeOf } from "./Shell";
import { inbox, markRead } from "./notifications";
import { NotificationInbox } from "./NotificationUI";
import { replacementOptions, reoffer } from "./dispatch";
import { KEY, load, save, freshDemo } from "./store";
import { SaveWarning } from "./NotificationUI";
import { WorkspaceContext } from "./workspaceContext";
import { lazyScreen } from "./Recovery";

/* Each role loads as its own chunk, the first time it is shown (ADR 078). */
const loadOperator = () =>
  import("./OperatorWorkspace").then((m) => ({ default: m.OperatorWorkspace }));
const loadCustomer = () =>
  import("./CustomerWorkspace").then((m) => ({ default: m.CustomerWorkspace }));
const loadContractor = () =>
  import("./ContractorWorkspace").then((m) => ({
    default: m.ContractorWorkspace,
  }));
const OperatorWorkspace = lazyScreen(loadOperator);
const CustomerWorkspace = lazyScreen(loadCustomer);
const ContractorWorkspace = lazyScreen(loadContractor);

export type Role = "Customer" | "Operator" | "Contractor";
export function Workspace({
  s,
  setS,
  theme,
  setTheme,
  initialRole = "Operator",
  initialCustomer = "c2",
  compareMode = false,
  onEnterCompare,
  onExitCompare,
}: {
  s: State;
  setS: React.Dispatch<React.SetStateAction<State>>;
  theme: "light" | "dark";
  setTheme: React.Dispatch<React.SetStateAction<"light" | "dark">>;
  initialRole?: Role;
  /** The customer to view as, e.g. from an assessment's "← My bookings". */
  initialCustomer?: string;
  compareMode?: boolean;
  onEnterCompare?: () => void;
  onExitCompare?: () => void;
}) {
  const {
    Message,
    active,
    api,
    choose,
    contractor,
    customer,
    fail,
    idPrefix,
    invalidate,
    latest,
    menuTrigger,
    modal,
    notices,
    notify,
    openNotice,
    page,
    pay,
    payError,
    provider,
    quote,
    r,
    recipient,
    reschedule,
    role,
    selected,
    setActive,
    setCustomer,
    setFail,
    setModal,
    setPage,
    setPay,
    setPayError,
    setProvider,
    setRole,
    setSelected,
    setSidebar,
    setStep,
    setToast,
    sidebar,
    slot,
    startOrResumeRequest,
    tasks,
    toast,
    update,
    visits,
    workspaceRef,
  } = useWorkspaceState({
    s,
    setS,
    theme,
    initialRole,
    initialCustomer,
    compareMode,
  });
  /* Once the first role is on screen, fetch the other two while the browser
     is idle, so switching roles in the demo bar doesn't wait (ADR 078). */
  React.useEffect(() => {
    const prefetch = () => {
      for (const Screen of [
        OperatorWorkspace,
        CustomerWorkspace,
        ContractorWorkspace,
      ]) {
        Screen.preload();
      }
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 2000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div
      className={"app" + (compareMode ? " compare-column" : "")}
      data-role={role}
      ref={workspaceRef}
    >
      <Sidebar
        s={s}
        role={role}
        page={page}
        setPage={setPage}
        open={sidebar}
        setOpen={setSidebar}
        idPrefix={idPrefix}
        contractor={contractor}
        customer={customer}
        setModal={setModal}
        startOrResumeRequest={startOrResumeRequest}
      />
      <div className="shell">
        <DemoBar
          role={role}
          setRole={setRole}
          setPage={setPage}
          compareMode={compareMode}
          onEnterCompare={onEnterCompare}
          onExitCompare={onExitCompare}
        />
        <Topbar
          s={s}
          role={role}
          page={page}
          open={sidebar}
          setOpen={setSidebar}
          idPrefix={idPrefix}
          contractor={contractor}
          customer={customer}
          theme={theme}
          setTheme={setTheme}
          setModal={setModal}
          unread={notices.filter((n) => !n.read).length}
          menuTrigger={menuTrigger}
        />
        {latest && (
          <div className="incoming-notice" role="status">
            <Bell size={16} />
            {/* Opens the update itself, read, rather than the inbox it sits
                at the top of (ADR 066). */}
            <button
              onClick={() => {
                update((d) => {
                  markRead(d, latest.id);
                });
                openNotice(latest);
              }}
            >
              {latest.text}
              <small>
                {role === "Customer"
                  ? "View update"
                  : "View update · in-app simulation"}
              </small>
            </button>
          </div>
        )}
        <main
          className={
            role === "Customer" && page === "New request"
              ? "intake-main"
              : undefined
          }
        >
          <WorkspaceContext.Provider value={api}>
            {role === "Operator" && <OperatorWorkspace />}
            {role === "Customer" && <CustomerWorkspace />}
            {role === "Contractor" && <ContractorWorkspace />}
          </WorkspaceContext.Provider>
          <footer>
            <span>
              <span className="brand-mini">fieldwork.</span> Home services,
              coordinated.
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal("")}>
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row between">
              <h2>{modal}</h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal("")}
              >
                <X />
              </button>
            </div>
            {modal === "Demo settings" && (
              <DemoSettings
                role={role}
                autoReoffer={s.settings?.autoReofferDeclined || false}
                failPayment={fail}
                onToggleFailPayment={setFail}
                activeScenario={active}
                onChooseScenario={(id) => {
                  choose(id);
                  setModal("");
                }}
                onToggleAutoReoffer={(on) =>
                  update((d) => {
                    d.settings = { autoReofferDeclined: on };
                    log(
                      d,
                      on
                        ? "Automatic reoffers enabled"
                        : "Automatic reoffers disabled",
                    );
                  })
                }
                onAdvanceClock={() =>
                  update((d) => {
                    d.clock += 3 * 3600000;
                    log(d, "Demo clock advanced 3 hours");
                  }, "Clock advanced; offers checked for expiry")
                }
                onReset={() => {
                  const d = freshDemo();
                  setS(d);
                  save(d);
                  setActive("r2");
                  setCustomer("c2");
                  setStep(0);
                  setPage(homeOf(role));
                  setModal("");
                  notify("All five scenarios reset");
                }}
              />
            )}
            {modal === "Notifications" && (
              <NotificationInbox
                s={s}
                recipient={recipient}
                update={update}
                open={openNotice}
              />
            )}
            {["Instant payment", "Payment"].includes(modal) && (
              <>
                <div className="payment-method">
                  <Wallet />
                  <div>
                    <strong>Visa •••• 4242</strong>
                    <small>Card on file</small>
                  </div>
                  <Check size={16} />
                </div>
                {modal === "Instant payment" && (
                  <>
                    <p>Selected appointment: {dateLabel(slot)}</p>
                    <Message field="instant-slot" />
                  </>
                )}
                <h1>
                  {money(
                    modal === "Instant payment" ? 129 : quote?.amount || 0,
                  )}
                </h1>
                <button
                  className="primary full actions"
                  onClick={() => {
                    if (modal === "Instant payment") {
                      if (fail) {
                        notify(
                          "Your payment didn’t go through. Try again, or use another card.",
                        );
                        return;
                      }
                      const available =
                        r.status === "Draft" &&
                        validAddress(r) &&
                        eligible("yousef", tasks) &&
                        instantEligible(tasks) &&
                        slots(
                          s,
                          "yousef",
                          tasks[0].duration,
                          r.city,
                          undefined,
                          "",
                          12,
                          r.id,
                        ).some((o) => o.start === slot);
                      if (!available)
                        return invalidate(
                          "instant-slot",
                          "That slot is no longer available. Close this and choose another time.",
                        );
                      update((d) => {
                        const req = d.requests.find((q) => q.id === r.id)!;
                        req.status = "Submitted";
                        req.mode = "Instant Book";
                        const vid = uid(),
                          qid = uid();
                        d.visits.push({
                          id: vid,
                          requestId: r.id,
                          taskIds: tasks.map((t) => t.id),
                          providerId: "yousef",
                          start: slot,
                          duration: tasks[0].duration,
                          status: "Proposed",
                          travel: 8,
                        });
                        d.assignments.push({
                          id: uid(),
                          visitId: vid,
                          providerId: "yousef",
                          status: "Accepted",
                          pay: 0,
                          expiresAt: d.clock,
                        });
                        d.quotes.push({
                          id: qid,
                          requestId: r.id,
                          type: "Fixed price",
                          amount: 129,
                          high: 129,
                          status: "Approved",
                          notes:
                            "Door adjustment, labour and standard materials.",
                          payOnCompletion: false,
                        });
                        d.payments.push({
                          id: uid(),
                          quoteId: qid,
                          status: "Paid",
                          amount: 129,
                          reference: uid(),
                        });
                        releaseHold(d, r.id);
                        log(
                          d,
                          "Instant booking confirmed · demo receipt issued",
                        );
                      });
                      // Straight back to Home, same as an ordinary submit —
                      // the accordion's own visit card shows the confirmation,
                      // so there is no separate receipt screen to detour
                      // through here either.
                      setPage("My bookings");
                    } else if (quote) {
                      update(
                        (d) => {
                          payQuote(d, quote.id, fail);
                        },
                        fail
                          ? "Your payment didn’t go through. Try again, or use another card."
                          : "Payment received. Thank you.",
                      );
                      if (fail) return;
                    }
                    setToast("");
                    setModal("");
                  }}
                >
                  Pay{" "}
                  {money(
                    modal === "Instant payment" ? 129 : quote?.amount || 0,
                  )}{" "}
                  <ArrowRight size={16} />
                </button>
              </>
            )}
            {modal === "Reassign visit" &&
              (() => {
                const v = s.visits.find((v) => v.id === reschedule);
                if (!v) return null;
                const options = replacementOptions(s, v);
                const choice = options.find((o) => o.provider.id === provider);
                return (
                  <>
                    <p>
                      This reuses the existing visit; no duplicate visit is
                      created. Previous declines stay in history. Review the
                      provider, pay, and appointment before sending a
                      replacement offer.
                    </p>
                    <div className="provider-options">
                      {options.map((o) => (
                        <button
                          key={o.provider.id}
                          className={
                            "provider-card " +
                            (provider === o.provider.id ? "selected" : "")
                          }
                          onClick={() => {
                            setProvider(o.provider.id);
                            setPay(
                              o.provider.id === "yousef"
                                ? 0
                                : Math.max(o.pay, o.minimumPay),
                            );
                          }}
                        >
                          <div className="avatar">{o.provider.initials}</div>
                          <div>
                            <strong>{o.provider.name}</strong>
                            <small>{o.provider.skills}</small>
                            <small>
                              {o.sameTime
                                ? "Keeps existing appointment"
                                : "Time change required"}{" "}
                              · {dateLabel(o.start!)} · {o.travel} min travel
                            </small>
                            <small>
                              {o.provider.id === "yousef"
                                ? "Self-assigned"
                                : money(o.minimumPay) +
                                  " minimum pay for " +
                                  v.duration +
                                  " minutes"}
                            </small>
                          </div>
                          {provider === o.provider.id && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                    {!options.length && (
                      <p className="warning">
                        No eligible replacement currently has availability.
                        Adjust the visit from the request details.
                      </p>
                    )}
                    {choice && (
                      <>
                        <p className="note">
                          {choice.sameTime
                            ? "Appointment unchanged."
                            : "Operator-approved time change: " +
                              dateLabel(v.start) +
                              " → " +
                              dateLabel(choice.start!)}{" "}
                          Customer price is unchanged.
                        </p>
                        {provider !== "yousef" && (
                          <label
                            className={
                              "field" + (payError ? " field-error" : "")
                            }
                            htmlFor="reoffer-pay"
                          >
                            Replacement contractor pay (CAD)
                            <input
                              id="reoffer-pay"
                              type="number"
                              min={choice.minimumPay}
                              value={pay}
                              aria-invalid={payError || undefined}
                              onChange={(e) => {
                                if (payError) setPayError(false);
                                setPay(Number(e.target.value));
                              }}
                            />
                            {payError && (
                              <span className="field-message" role="alert">
                                Pay at least {money(choice.minimumPay)} for this
                                replacement.
                              </span>
                            )}
                          </label>
                        )}
                        <button
                          className="primary full actions"
                          onClick={() => {
                            if (
                              provider !== "yousef" &&
                              pay < choice.minimumPay
                            ) {
                              setPayError(true);
                              document.getElementById("reoffer-pay")?.focus();
                              return;
                            }
                            setPayError(false);
                            update((d) => {
                              reoffer(d, v.id, provider, choice.start!, pay);
                            });
                            setModal("");
                          }}
                        >
                          {provider === "yousef"
                            ? "Confirm Do It Myself"
                            : "Send replacement offer"}
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            {modal === "Reschedule" &&
              (() => {
                const v = s.visits.find((v) => v.id === reschedule)!;
                return (
                  <>
                    <p>
                      {role === "Customer"
                        ? "Fresh route-aware options for your provider. Contractor changes require renewed acceptance."
                        : `Times ${providers.find((p) => p.id === v.providerId)?.name || "the contractor"} has free. Moving the visit asks them to accept it again.`}
                    </p>
                    {slots(s, v.providerId, v.duration, r.city, v.id)
                      .filter((o) => o.start !== v.start)
                      .map((o) => (
                        <button
                          className="slot full actions"
                          key={o.start}
                          onClick={() => {
                            update((d) => {
                              rescheduleVisit(
                                d,
                                v.id,
                                o,
                                role === "Customer" ? "Customer" : "Operator",
                              );
                            }, "Reschedule saved");
                            setModal("");
                          }}
                        >
                          {dateLabel(o.start)} · {o.travel} min travel
                        </button>
                      ))}
                  </>
                );
              })()}
            {modal === "Cancel booking" && (
              <>
                {/* Inside a day the money is held, not refunded, and the
                    customer is told before they confirm (ADR 064). */}
                <p>
                  {visits.some(
                    (v) =>
                      v.status !== "Cancelled" &&
                      !v.execution?.finishedAt &&
                      lateFor(s, v),
                  )
                    ? "Cancel this request and all its visits? Your visit is less than 24 hours away, so a late-cancellation fee may apply. We’ll confirm it and refund the rest."
                    : "Cancel this request and all its visits? Any payment will be refunded."}
                </p>
                <button
                  className="primary full"
                  onClick={() => {
                    update((d) => {
                      cancelBooking(d, r.id);
                    }, "Booking cancelled");
                    setModal("");
                  }}
                >
                  Confirm cancellation
                </button>
              </>
            )}
            {modal === "Request information" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = new FormData(e.currentTarget).get(
                    "note",
                  ) as string;
                  update((d) => {
                    const req = d.requests.find((q) => q.id === r.id)!;
                    // One slot, not a thread: asking again replaces the pair.
                    req.operatorNote = value;
                    req.customerReply = null;
                    log(
                      d,
                      "Operator requested additional information: " + value,
                    );
                  }, "Question visible in customer portal");
                  setModal("");
                }}
              >
                <label className="field">
                  Question for the customer
                  <textarea
                    name="note"
                    required
                    placeholder="Could you share a close-up photo of the damaged area?"
                  />
                </label>
                <button className="primary">Send simulated request</button>
              </form>
            )}
            {modal === "Decline request" && (
              <>
                <p>
                  Decline this service request and cancel its proposed visits?
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    update((d) => {
                      d.requests.find((q) => q.id === r.id)!.status =
                        "Declined";
                      d.visits
                        .filter((v) => v.requestId === r.id)
                        .forEach((v) => (v.status = "Cancelled"));
                      d.assignments
                        .filter((a) => visits.some((v) => v.id === a.visitId))
                        .forEach((a) => (a.status = "Cancelled"));
                      log(d, "Operator declined service request");
                    }, "Request declined");
                    setModal("");
                  }}
                >
                  Decline request
                </button>
              </>
            )}
            {modal === "Merge tasks" && (
              <>
                <p>
                  Combine selected descriptions into one task. Original task
                  records remain linked for audit history. Assigned tasks must
                  first be removed from their visit.
                </p>
                <Message field="merge" />
                <button
                  className="primary"
                  onClick={() => {
                    if (
                      visits.some(
                        (v) =>
                          v.status !== "Cancelled" &&
                          v.taskIds.some((id) => selected.includes(id)),
                      )
                    )
                      return invalidate(
                        "merge",
                        "These tasks are already on a visit. Remove it before merging them.",
                      );
                    update((d) => {
                      const list = d.tasks.filter((t) =>
                        selected.includes(t.id),
                      );
                      const target = list[0];
                      target.description = list
                        .map((t) => t.description)
                        .join("; ");
                      target.summary = list.map((t) => t.summary).join(" + ");
                      target.duration = list.reduce(
                        (a, t) => a + t.duration,
                        0,
                      );
                      target.restricted = list.some((t) => t.restricted);
                      target.reviewed = list.every((t) => t.reviewed);
                      target.photos = list.flatMap((t) => t.photos);
                      list.slice(1).forEach((t) => (t.mergedInto = target.id));
                      log(
                        d,
                        "Operator merged task descriptions; source records retained",
                      );
                    }, "Tasks merged");
                    setSelected([]);
                    setModal("");
                  }}
                >
                  Merge descriptions
                </button>
              </>
            )}
            {modal === "Split task" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = tasks.find((t) => t.id === selected[0])!;
                  if (
                    visits.some(
                      (v) =>
                        v.status !== "Cancelled" && v.taskIds.includes(t.id),
                    )
                  )
                    return invalidate(
                      "split",
                      "This task is already on a visit. Remove it before splitting.",
                    );
                  const f = new FormData(e.currentTarget);
                  update((d) => {
                    const original = d.tasks.find((x) => x.id === t.id)!;
                    original.description = String(f.get("first"));
                    original.summary = String(f.get("first"));
                    original.duration = Math.max(
                      15,
                      Math.round(t.duration / 2),
                    );
                    d.tasks.push({
                      ...structuredClone(original),
                      id: uid(),
                      description: String(f.get("second")),
                      summary: String(f.get("second")),
                      duration: Math.max(15, t.duration - original.duration),
                    });
                    log(
                      d,
                      "Operator split task into two independently schedulable tasks",
                    );
                  }, "Task split");
                  setSelected([]);
                  setModal("");
                }}
              >
                <label className="field">
                  First task
                  <input
                    name="first"
                    required
                    defaultValue={
                      tasks.find((t) => t.id === selected[0])?.description
                    }
                  />
                </label>
                <label className="field">
                  Second task
                  <input
                    name="second"
                    required
                    placeholder="Describe the separate piece of work"
                  />
                </label>
                <Message field="split" />
                <button className="primary">Split into two tasks</button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
const compareRoles = ["Customer", "Operator", "Contractor"] as const;
/**
 * Data (`s`) is shared so an action in one column shows up in the others;
 * navigation is not, so each column gets its own Workspace instance and,
 * with it, its own independent page/selection/modal state for free.
 */
export function App() {
  /* Dark is the design's home ground, so it is what a first visit gets; the
     toggle still remembers anyone who prefers light. */
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("fieldwork-theme") === "light"
        ? "light"
        : "dark";
    } catch {
      return "dark";
    }
  });
  const [s, setS] = useState<State>(load);
  /* The customer's assessment link is a separate page, so their approval lands
     in another tab. Without this the operator would be looking at a stale
     screen until they reloaded. */
  React.useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      /* A throw here would escape the boundary — it happens in an event, not
         in render — so a state another tab wrote badly is ignored rather than
         taking this tab down with it. */
      try {
        setS(load());
      } catch (err) {
        console.error("fieldwork: ignoring an unreadable update", err);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const [compare, setCompare] = useState(false);
  /* An assessment's "← My bookings" opens the portal as that customer
     (portalLink, ADR 063). Anything else in the URL is ignored. */
  const [linkedIn] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const account = params.get("account") || "";
    return params.get("role") === "Customer" &&
      accounts.some((a) => a.id === account)
      ? { initialRole: "Customer" as const, initialCustomer: account }
      : {};
  });
  if (!compare)
    return (
      <>
        <SaveWarning />
        <Workspace
          s={s}
          setS={setS}
          theme={theme}
          setTheme={setTheme}
          {...linkedIn}
          onEnterCompare={() => setCompare(true)}
        />
      </>
    );
  return (
    <>
      <SaveWarning />
      <div className="compare-row">
        {compareRoles.map((r) => (
          <Workspace
            key={r}
            s={s}
            setS={setS}
            theme={theme}
            setTheme={setTheme}
            initialRole={r}
            compareMode
            onExitCompare={() => setCompare(false)}
          />
        ))}
      </div>
    </>
  );
}
