import { suitableProviders } from "./suitability";
import { hasLiveVisit } from "./aside";
import { callBackDue, workIssue, workStatus } from "./work";
import { lateFor, requestCallBack, suggestQuote } from "./decisions";
import { customerVisitText } from "./customerText";
import { getIssue } from "./clarification";
import React, { useState } from "react";
import { CalendarDays, Camera } from "lucide-react";
import {
  type State,
  type Task,
  type Request,
  type Visit,
  uid,
  classify,
  providers,
  money,
  dateLabel,
  chosenStart,
  available,
  eligible,
  accountName,
} from "./model";
import { storablePhoto, unreadableMessage } from "./photos";
import { homeOf } from "./Shell";
import { useFieldErrors } from "./fields";
import { callBackText, inbox, noticeTarget } from "./notifications";
import { MessageThread } from "./NotificationUI";
import { save, commit } from "./store";
import {
  WorkspaceContext,
  type Tone,
  type WorkspaceApi,
} from "./workspaceContext";
import type { Role } from "./Shell";

/**
 * All of `Workspace`'s state, effects and helpers (ADR 077). It returns
 * the `api` the role workspaces read through `WorkspaceContext`, and the
 * names `Workspace`'s own chrome and modals read.
 */
export function useWorkspaceState({
  s,
  setS,
  theme,
  initialRole,
  initialCustomer,
  compareMode,
}: {
  s: State;
  setS: React.Dispatch<React.SetStateAction<State>>;
  theme: "light" | "dark";
  initialRole: Role;
  initialCustomer: string;
  compareMode: boolean;
}) {
  const workspaceRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (fulfillment)
      document.querySelector<HTMLElement>("#fulfillment > button")?.focus();
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("fieldwork-theme", theme);
    } catch {}
  }, [theme]);
  const [role, setRoleNow] = useState<Role>(initialRole);
  const idPrefix = compareMode ? role + "-" : "";
  React.useEffect(() => {
    save(s);
  }, []);
  const [page, setPage] = useState(homeOf(initialRole));
  const [active, setActive] = useState("r2");
  const [expanded, setExpanded] = useState(true);
  const [payError, setPayError] = useState(false);
  const [contractor, setContractorNow] = useState("marcus");
  const [contractorVisit, setContractorVisit] = useState("");
  const [customer, setCustomerNow] = useState(initialCustomer);
  /* One toast at a time, on one timer (ADR 080). A new toast clears the old
     timer, so it is not cut short by the one before it. Errors are alerts and
     stay up longer, since they are the ones that have to be read. */
  const [toast, setToastText] = useState("");
  const [toastTone, setToastTone] = useState<Tone | undefined>();
  const toastTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const setToast = (text: string, tone?: Tone) => {
    clearTimeout(toastTimer.current);
    setToastText(text);
    setToastTone(tone);
    if (text)
      toastTimer.current = setTimeout(
        () => setToastText(""),
        tone === "error" ? 7000 : 3500,
      );
  };
  React.useEffect(() => () => clearTimeout(toastTimer.current), []);
  /* A toast is about whoever was being viewed, so switching who that is
     drops it (ADR 080). */
  const switching =
    <T,>(set: React.Dispatch<React.SetStateAction<T>>) =>
    (v: React.SetStateAction<T>) => {
      setToast("");
      set(v);
    };
  const setRole = switching(setRoleNow),
    setContractor = switching(setContractorNow),
    setCustomer = switching(setCustomerNow);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Needs Action");
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [fulfillmentKind, setFulfillmentKind] = useState<"self" | "contractor">(
    "self",
  );
  const [fulfillment, setFulfillment] = useState(false);
  /* The request page's tab (ADR 068). Empty follows the request's state,
     until the operator picks one. */
  const [requestTab, setRequestTab] = useState("");
  const [showRequestQueue, setShowRequestQueue] = useState(false);
  React.useEffect(() => {
    if (fulfillment)
      document
        .getElementById("fulfillment")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [fulfillment]);
  const [provider, setProvider] = useState("yousef");
  const [slot, setSlot] = useState("");
  const [quoteAmount, setQuoteAmount] = useState(395);
  const [quoteType, setQuoteType] = useState("Manual quote");
  /* The quote amount is suggested from duration until the operator edits it,
     so switching requests never carries the previous request's price over. */
  const [quoteTouched, setQuoteTouched] = useState(false);
  const [completion, setCompletion] = useState(false);
  const [pay, setPay] = useState(180);
  /* Contractor pay is suggested from the provider's rate over the job until
     the operator edits it, like the quote amount above. The reassign modal
     keeps setting `pay` directly. */
  const [payTouched, setPayTouched] = useState(false);
  const [modal, setModal] = useState("");
  const [reschedule, setReschedule] = useState("");
  const [fail, setFail] = useState(false);
  /* Titles typed for tasks the classifier could not name (ADR 063). */
  const [taskTitles, setTaskTitles] = useState<Record<string, string>>({});
  /* The late-cancellation fee as typed; null is the suggestion (ADR 064). */
  const [lateFee, setLateFee] = useState<number | null>(null);
  /* The customer's one-at-a-time queue is open (ADR 062). */
  const [reviewing, setReviewing] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const menuTrigger = React.useRef<HTMLButtonElement>(null);
  /* Validation that names a field says so on the field. See fields.tsx for
     why this stopped being seventeen toasts. */
  /* `fail` is renamed here: the payment simulation above already owns that
     word for "make this charge decline". */
  const {
    fail: invalidate,
    clear,
    clearAll,
    fieldClass,
    invalid,
    Message,
  } = useFieldErrors();
  React.useEffect(() => {
    if (!sidebar) return;
    const drawer = workspaceRef.current?.querySelector<HTMLElement>(".sidebar");
    const items = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>("button,a[href]") || [],
      ).filter((el) => el.getClientRects().length > 0);
    items()[0]?.focus();
    /* Reference-counted: two Workspace instances (Compare mode) can each
       open their own drawer at once, and the second must not let the
       first's close hand scrolling back before both are shut. */
    const locks = Number(document.body.dataset.drawerLocks || "0") + 1;
    document.body.dataset.drawerLocks = String(locks);
    document.body.style.overflow = "hidden";
    /* Compare mode gives each column its own scroll box (see .compare-column
       in layout.css), so body's own overflow lock above doesn't stop this
       column's content from scrolling out from under its open drawer. */
    if (compareMode && workspaceRef.current)
      workspaceRef.current.style.overflow = "hidden";
    const shell = workspaceRef.current?.querySelector<HTMLElement>(".shell");
    if (shell) shell.inert = true;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSidebar(false);
      }
      if (e.key === "Tab") {
        const list = items();
        if (e.shiftKey && document.activeElement === list[0]) {
          e.preventDefault();
          list.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
          e.preventDefault();
          list[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      const remaining = Math.max(
        0,
        Number(document.body.dataset.drawerLocks || "1") - 1,
      );
      document.body.dataset.drawerLocks = String(remaining);
      if (remaining === 0) document.body.style.overflow = "";
      if (compareMode && workspaceRef.current)
        workspaceRef.current.style.overflow = "";
      if (shell) shell.inert = false;
      menuTrigger.current?.focus();
    };
  }, [sidebar]);
  const [override, setOverride] = useState("");
  const update = (fn: (d: State) => void, msg?: string, tone?: Tone) => {
    /* commit() writes to localStorage and emits notifications, so it must not
       run inside a React state updater: StrictMode double-invokes those in
       development, which ran every write — and every notification — twice.
       Passing `s` rather than the updater's `prev` is safe now that commit()
       reads the newest state off disk itself and only falls back to what it
       is given. */
    setS(commit(s, fn));
    if (msg) setToast(msg, tone);
  };
  const recipient =
    role === "Operator"
      ? "Operator"
      : role === "Customer"
        ? "Customer:" + customer
        : "Contractor:" + contractor;
  const notices = inbox(s, recipient);
  const latest = notices.find((n) => !n.read);
  React.useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog =
      workspaceRef.current?.querySelector<HTMLElement>("[role=dialog]");
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,a[href],summary",
        ) || [],
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
      );
    focusables()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal("");
      if (e.key === "Tab") {
        const items = focusables();
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [modal]);
  const r = s.requests.find((r) => r.id === active) || s.requests[0];
  const tasks = s.tasks.filter((t) => t.requestId === r.id && !t.mergedInto);
  const ownRequests = s.requests.filter(
    (x) =>
      x.accountId === customer &&
      (x.status !== "Draft" ||
        !!x.address.trim() ||
        s.tasks.some(
          (t) =>
            t.requestId === x.id &&
            !t.mergedInto &&
            (!!t.description.trim() || t.photos.length > 0),
        )),
  );
  /* Bring something into view once the page has drawn it, and mark it for a
     moment so the eye lands on it (ADR 066). A conversation opens too. */
  const reveal = (id: string) =>
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el instanceof HTMLDetailsElement) el.open = true;
      el.scrollIntoView({ block: "center" });
      /* One mark at a time: opening another notice moves it. */
      document
        .querySelectorAll(".flash")
        .forEach((x) => x.classList.remove("flash"));
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 2000);
    }, 120);
  /* A contractor's job, opened on Your Work from anywhere else. */
  const openContractorJob = (visitId: string) => {
    setContractorVisit("");
    setTimeout(() => setContractorVisit(visitId), 0);
    setPage("Your Work");
  };
  /* A notice opens the exact thing it is about (ADR 066): the page, the
     booking, then the card, scrolled to and marked. */
  const openNotice = (n: NonNullable<State["notifications"]>[number]) => {
    const target = noticeTarget(
      n,
      role as "Operator" | "Customer" | "Contractor",
    );
    if (role === "Contractor") openContractorJob(n.visitId);
    else {
      choose(n.requestId);
      /* Visit cards and their conversations live on the Visits tab
         (ADR 068). */
      if (target === "visit" || target === "messages") setRequestTab("Visits");
      setExpanded(true);
      setPage(role === "Operator" ? "Requests" : "My bookings");
    }
    setModal("");
    const id = {
      decision: "decision",
      question: idPrefix + "question",
      visit: idPrefix + "visit-" + n.visitId,
      messages: "messages-" + n.visitId,
      quote: idPrefix + "quote",
      charge: idPrefix + "charge",
      booking: "request-" + n.requestId,
      job: "",
    }[target];
    if (id) reveal(id);
  };
  const hasReferral = tasks.some(
    (t) => getIssue(t.description).availability === "Referral only",
  );
  const visits = s.visits.filter((v) => v.requestId === r.id);
  /* Once anything is booked the visits matter most; until then the tasks. */
  const booked = hasLiveVisit(s, r.id);
  const tab = requestTab || (booked ? "Visits" : "Tasks");
  const quote = s.quotes.find(
    (q) => q.requestId === r.id && q.status !== "Superseded",
  );
  const duration = tasks
    .filter((t) => !selected.length || selected.includes(t.id))
    .reduce((a, t) => a + t.duration, 0);
  const scopeTasks = tasks.filter(
    (t) => !selected.length || selected.includes(t.id),
  );
  const candidates = suitableProviders(
    s,
    scopeTasks,
    r.city,
    r.timing,
    fulfillmentKind === "self",
    r.id,
  );
  const scopeSignature = JSON.stringify([
    r.id,
    r.address,
    r.city,
    r.timing,
    scopeTasks.map((t) => [
      t.id,
      t.description,
      t.category,
      t.reviewed,
      t.restricted,
      t.duration,
    ]),
  ]);
  React.useEffect(() => {
    if (!fulfillment || modal || page !== "Requests") return;
    const stillFits = candidates.find((c) => c.provider.id === provider);
    if (!stillFits) {
      setProvider(
        /* The provider the customer chose their time with, while that time
           still fits (ADR 072); otherwise the best route, as before. */
        candidates.find(
          (c) =>
            c.provider.id === r.preferredSlot?.providerId &&
            chosenStart(s, r, c.provider.id, duration),
        )?.provider.id ||
          candidates.find((c) => c.appointments.length)?.provider.id ||
          candidates[0]?.provider.id ||
          "",
      );
      setSlot("");
      setOverride("");
    } else if (
      slot &&
      !available(s, provider, duration, r.city, slot, undefined, r.timing, r.id)
    ) {
      setSlot("");
      setOverride("");
    }
  }, [
    scopeSignature,
    fulfillmentKind,
    provider,
    slot,
    s.clock,
    s.visits,
    fulfillment,
    modal,
    page,
  ]);
  React.useEffect(() => {
    if (!modal) {
      setSlot("");
      setOverride("");
    }
  }, [scopeSignature]);
  const fits = eligible(
    provider,
    tasks.filter((t) => !selected.length || selected.includes(t.id)),
  );
  /* The customer's chosen time comes first while it still fits; best route
     fills the rest (ADR 072). */
  const chosenTime = fits ? chosenStart(s, r, provider, duration) : undefined;
  const notify = (text: string, tone?: Tone) => setToast(text, tone);
  const choose = (id: string) => {
    setShowRequestQueue(false);
    setQuoteTouched(false);
    setPayTouched(false);
    setLateFee(null);
    const req = s.requests.find((x) => x.id === id)!;
    setActive(id);
    setCustomerNow(req.accountId);
    setSelected([]);
    setFulfillment(false);
    setRequestTab("");
    setSlot("");
    setOverride("");
    setStep(0);
    setPage(
      role === "Customer"
        ? req.status === "Draft"
          ? "New request"
          : "My bookings"
        : "Requests",
    );
  };
  const patchTask = (id: string, p: Partial<Task>) =>
    update((d) => {
      Object.assign(
        d.tasks.find((t) => t.id === id)!,
        p,
      );
    });
  const photo = async (t: Task, file?: File) => {
    if (!file) return;
    const stored = await storablePhoto(file);
    if (!stored) return invalidate("photo-" + t.id, unreadableMessage);
    clear("photo-" + t.id);
    patchTask(t.id, { photos: [...t.photos, stored] });
  };
  const newRequest = () => {
    const id = uid();
    update((d) => {
      d.requests.push({
        id,
        accountId: customer,
        name: accountName(customer),
        address: "",
        city: "Oakville",
        status: "Draft",
        mode: "Request to Book",
        timing: "Weekdays · flexible",
        notes: "",
      });
      d.tasks.push({
        id: uid(),
        requestId: id,
        description: "",
        ...classify(""),
        photos: [],
        answers: {},
      });
    });
    setActive(id);
    setStep(0);
    setPage("New request");
  };
  /* Both "New request" entry points must agree: if this customer already
     has an unfinished draft, resume it — never spawn a silent second one
     just because a different button was clicked. */
  const startOrResumeRequest = () => {
    const draft = ownRequests.filter((x) => x.status === "Draft").at(-1);
    if (draft) {
      setActive(draft.id);
      setStep(0);
      setPage("New request");
    } else {
      newRequest();
    }
  };
  const badgeTone = (status: string) =>
    /Confirmed|Accepted|Paid|Instant/.test(status)
      ? "green"
      : /Review|Declined|Expired|Failed|Cancelled/.test(status)
        ? "red"
        : "";
  const badge = (status: string) => (
    <span className={"badge " + badgeTone(status)}>{status}</span>
  );
  const taskPhotos = (t: Task) => (
    <div className="photos">
      {t.photos.map((p, i) => (
        <img key={i} src={p} alt={"Task photo " + (i + 1)} />
      ))}
      <label className="photo-add">
        <Camera size={16} /> Add photo
        <input
          type="file"
          accept="image/*"
          onChange={(e) => photo(t, e.target.files?.[0])}
        />
      </label>
      <Message field={"photo-" + t.id} />
    </div>
  );
  /* What a finished visit means for the customer, including what the
     operator decided about anything it left undone (ADR 065). */
  const finishedNote = (v: Visit) => {
    const left = Object.values(v.execution?.outcomes ?? {}).filter(
      (o) => o.outcome !== "Completed",
    );
    if (!left.length) return "Your visit is complete.";
    if (workIssue(v))
      return "Your visit has finished. We’ll be in touch about the remaining work.";
    const back = left.filter((o) => o.resolution?.kind === "Return visit");
    const closed = left.flatMap((o) =>
      o.resolution?.kind === "Closed" ? [o.resolution] : [],
    );
    const refund = closed.reduce((n, c) => n + c.refund, 0);
    return [
      "Your visit has finished.",
      back.length
        ? back.some(
            (o) =>
              o.resolution?.kind === "Return visit" && !o.resolution.visitId,
          )
          ? "The rest needs a return visit, once you approve the additional charge."
          : "A return visit is booked for the rest."
        : "",
      closed.length
        ? `${closed.length === 1 ? "One task" : `${closed.length} tasks`} won’t be done${refund ? `, and ${money(refund)} was refunded` : ""}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  };
  const visitCard = (v: Visit) => (
    <div className="visit-card" key={v.id} id={idPrefix + "visit-" + v.id}>
      <div className="row between">
        <strong>
          <CalendarDays size={16} /> {dateLabel(v.start)}
        </strong>
        {role === "Customer" ? (
          <span className={"badge " + badgeTone(workStatus(v))}>
            {customerVisitText(workStatus(v))}
          </span>
        ) : (
          badge(workStatus(v))
        )}
      </div>
      <p>
        {providers.find((p) => p.id === v.providerId)?.name} · {v.duration} min
        · {v.taskIds.length} task{v.taskIds.length !== 1 ? "s" : ""}
      </p>
      <small>
        {r.address}, {r.city}
      </small>
      {role === "Customer" && (
        <>
          <div>
            <MessageThread
              s={s}
              visit={v}
              sender={"Customer:" + customer}
              update={update}
            />
          </div>
          {v.execution?.finishedAt && <p className="note">{finishedNote(v)}</p>}
        </>
      )}
      {/* The operator reads and answers the visit's conversation here, where
          a message notice opens (ADR 068). */}
      {role === "Operator" && (
        <MessageThread s={s} visit={v} sender="Operator" update={update} />
      )}
      {/* Inside a day, a new time is ours to arrange (ADR 064): the
          customer is told when we will call, here and in their inbox. */}
      {role === "Customer" &&
        callBackDue(r) &&
        r.callBack!.visitId === v.id && (
          <p className="note">{callBackText(r.callBack!.by)}</p>
        )}
      {role === "Customer" && v.status === "Confirmed" && (
        <div className="row actions">
          {!(callBackDue(r) && r.callBack!.visitId === v.id) && (
            <button
              className="secondary"
              onClick={() => {
                if (lateFor(s, v))
                  return update((d) => {
                    requestCallBack(d, v.id);
                  });
                setReschedule(v.id);
                setModal("Reschedule");
              }}
            >
              Reschedule
            </button>
          )}
          <button
            className="text-button"
            onClick={() => setModal("Cancel booking")}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
  /* Simulated customer price (suggestQuote in decisions.ts, shared with the
     decision queue). Contractor pay stays separate. */
  const suggestedQuote = suggestQuote(tasks);
  const amount = quoteTouched ? quoteAmount : suggestedQuote;
  /* What the extracted role workspaces read (ADR 077). */
  const api: WorkspaceApi = {
    Message,
    amount,
    badge,
    badgeTone,
    booked,
    candidates,
    choose,
    chosenTime,
    clear,
    clearAll,
    completion,
    contractor,
    contractorVisit,
    customer,
    duration,
    expanded,
    fail,
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
    openContractorJob,
    override,
    ownRequests,
    page,
    patchTask,
    pay,
    payTouched,
    photo,
    provider,
    quote,
    quoteTouched,
    quoteType,
    r,
    reveal,
    reviewing,
    role,
    s,
    scopeTasks,
    search,
    selected,
    setActive,
    setCompletion,
    setContractor,
    setCustomer,
    setExpanded,
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
    setReviewing,
    setRole,
    setSearch,
    setSelected,
    setShowRequestQueue,
    setSidebar,
    setSlot,
    setStep,
    setTaskTitles,
    showRequestQueue,
    slot,
    startOrResumeRequest,
    tab,
    taskPhotos,
    taskTitles,
    tasks,
    toast,
    update,
    visitCard,
    visits,
  };
  return {
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
    toastTone,
    update,
    visits,
    workspaceRef,
  };
}
