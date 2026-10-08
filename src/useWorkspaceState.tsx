import { suitableProviders } from "./suitability";
import { hasLiveVisit } from "./aside";
import { callBackDue, feeUndecided, workIssue, workStatus } from "./work";
import { customerQueue } from "./roleQueues";
import {
  approveCharge,
  completeCallBack,
  declineCharge,
  heldFor,
  issueQuote,
  lateFor,
  nextDecision,
  offerVisit,
  requestCallBack,
  settleLateCancel,
  suggestLateFee,
  suggestPay,
  suggestQuote,
} from "./decisions";
import { countdown } from "./countdown";
import {
  customerQuoteText,
  customerStatusText,
  customerVisitText,
} from "./customerText";
import FollowUp, { followUpLine } from "./FollowUp";
import { getIssue } from "./clarification";
import React, { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Clock,
  CalendarDays,
  ListTodo,
  Camera,
  CheckCircle2,
  AlertCircle,
  Wallet,
} from "lucide-react";
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
  log,
  slots,
  chosenStart,
  available,
  eligible,
  scopeMatch,
  instantEligible,
  approveQuote,
  declineQuote,
  auditFor,
  accountName,
  workPayment,
  primaryContact,
  timeLabel,
  confirmed,
} from "./model";
import {
  authorizationDue,
  authorizePayment,
  capturePayment,
  outstandingFor,
  readyToPay,
  refundPayment,
} from "./payments";
import { storablePhoto, unreadableMessage } from "./photos";
import { homeOf } from "./Shell";
import { useFieldErrors } from "./fields";
import { callBackText, inbox, noticeTarget, offerSeen } from "./notifications";
import { MessageThread } from "./NotificationUI";
import { customerGlance, todaysVisits } from "./glance";
import {
  dispatchStatus,
  requestDispatch,
  replacementOptions,
  reassignmentForScope,
} from "./dispatch";
import { save, commit } from "./store";
import { WorkspaceContext, type WorkspaceApi } from "./workspaceContext";
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
  const [role, setRole] = useState<Role>(initialRole);
  const idPrefix = compareMode ? role + "-" : "";
  React.useEffect(() => {
    save(s);
  }, []);
  const [page, setPage] = useState(homeOf(initialRole));
  const [active, setActive] = useState("r2");
  const [expanded, setExpanded] = useState(true);
  const [payError, setPayError] = useState(false);
  const [contractor, setContractor] = useState("marcus");
  const [contractorVisit, setContractorVisit] = useState("");
  const [customer, setCustomer] = useState(initialCustomer);
  const [toast, setToast] = useState("");
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
  const update = (fn: (d: State) => void, msg?: string) => {
    /* commit() writes to localStorage and emits notifications, so it must not
       run inside a React state updater: StrictMode double-invokes those in
       development, which ran every write — and every notification — twice.
       Passing `s` rather than the updater's `prev` is safe now that commit()
       reads the newest state off disk itself and only falls back to what it
       is given. */
    setS(commit(s, fn));
    if (msg) {
      setToast(msg);
      setTimeout(() => setToast(""), 3500);
    }
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
  const trail = auditFor(s, r.id);
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
  /* The signed-in customer's own requests. A draft only counts once it carries
     something — an address, a description or a photo. */
  /* Only properties that have actually been walked: an empty history is not
     worth a collapsed panel telling the customer there is nothing in it. */
  const customerProperties = s.properties.filter(
    (p) =>
      p.accountId === customer &&
      s.walkthroughs.some((w) => w.propertyId === p.id),
  );
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
  /* A count with nothing behind it gets no handler, so the card never offers
     a button that would do nothing. */
  const openFirst = (ids: string[]) =>
    ids.length ? () => openRequestRow(ids[0]) : undefined;
  const hasReferral = tasks.some(
    (t) => getIssue(t.description).availability === "Referral only",
  );
  const visits = s.visits.filter((v) => v.requestId === r.id);
  const liveVisits = visits.filter((v) => v.status !== "Cancelled");
  /* Once anything is booked the visits matter most; until then the tasks. */
  const booked = hasLiveVisit(s, r.id);
  const tab = requestTab || (booked ? "Visits" : "Tasks");
  /** The Tasks tab, scrolled to: where scope is reviewed and visits split. */
  const showTasks = () => {
    setRequestTab("Tasks");
    setTimeout(() =>
      document
        .getElementById("review-tasks")
        ?.scrollIntoView({ block: "start" }),
    );
  };
  const quote = s.quotes.find(
    (q) => q.requestId === r.id && q.status !== "Superseded",
  );
  const duration = tasks
    .filter((t) => !selected.length || selected.includes(t.id))
    .reduce((a, t) => a + t.duration, 0);
  const assignPay = payTouched ? pay : suggestPay(provider, duration);
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
  const match = scopeMatch(provider, scopeTasks);
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
  const notify = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 3500);
  };
  const choose = (id: string) => {
    setShowRequestQueue(false);
    setQuoteTouched(false);
    setPayTouched(false);
    setLateFee(null);
    const req = s.requests.find((x) => x.id === id)!;
    setActive(id);
    setCustomer(req.accountId);
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
  function RouteMap() {
    return (
      <div className="route-map">
        <svg
          viewBox="0 0 700 300"
          aria-label="Illustrative Oakville route map"
          role="img"
        >
          <defs>
            <pattern
              id="grid"
              width="52"
              height="42"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-21)"
            >
              <path
                d="M 52 0 L 0 0 0 42"
                fill="none"
                stroke="var(--line)"
                strokeWidth="2"
              />
            </pattern>
          </defs>
          <rect width="700" height="300" fill="var(--panel)" />
          <rect width="700" height="300" fill="url(#grid)" />
          <path
            d="M0 258 Q190 196 310 268 T700 210 L700 300H0Z"
            fill="var(--surface-raised)"
          />
          <path
            d="M-30 180 Q190 90 340 125T730 25"
            fill="none"
            stroke="var(--line)"
            strokeWidth="11"
          />
          <path
            d="M130 179 L232 130 349 166 445 103 553 129"
            fill="none"
            stroke="var(--accent-text)"
            strokeWidth="4"
            strokeDasharray="7 5"
          />
          {[
            [130, 179],
            [349, 166],
            [553, 129],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r="16"
                fill="var(--accent-text)"
                stroke="var(--panel)"
                strokeWidth="4"
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fill="var(--bg)"
                fontSize="12"
                fontWeight="bold"
              >
                {i + 1}
              </text>
            </g>
          ))}
          <text
            x="282"
            y="75"
            fill="var(--muted)"
            fontSize="14"
            letterSpacing="4"
          >
            OAKVILLE
          </text>
          <text
            x="440"
            y="273"
            fill="var(--surface-raised)"
            fontSize="11"
            letterSpacing="3"
          >
            LAKE ONTARIO
          </text>
          <text x="30" y="35" fill="var(--muted)" fontSize="10">
            QEW
          </text>
        </svg>
        <span className="map-label">Illustrative map · simulated travel</span>
        <button
          className="map-expand"
          aria-label="Open route view"
          onClick={() => setPage("Today")}
        >
          <ArrowUpRight size={16} />
        </button>
      </div>
    );
  }
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
  /* Simulated customer price (suggestQuote in decisions.ts, shared with the
     decision queue). Contractor pay stays separate. */
  const suggestedQuote = suggestQuote(tasks);
  const amount = quoteTouched ? quoteAmount : suggestedQuote;
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
                          update((d) => {
                            const held = d.payments.find(
                              (p) =>
                                p.quoteId === quote.id &&
                                p.status === "Authorized",
                            );
                            if (held) capturePayment(d, held.id, true);
                          }, "Capture failed (simulated)")
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
  /* What the extracted role workspaces read (ADR 077). */
  const api: WorkspaceApi = {
    Message,
    RouteMap,
    assignPay,
    badge,
    cancelVisit,
    candidates,
    chargePanel,
    choose,
    chosenTime,
    clear,
    contractor,
    contractorVisit,
    createVisit,
    customer,
    customerAtAGlance,
    customerBadge,
    customerNext,
    customerProperties,
    customerToday,
    customerTodoList,
    customerTodos,
    decisionCard,
    duration,
    expanded,
    fail,
    fieldClass,
    filter,
    fulfillment,
    fulfillmentKind,
    idPrefix,
    invalid,
    invalidate,
    liveVisits,
    match,
    notify,
    openContractorJob,
    openFirst,
    openRequestRow,
    opts,
    ownRequests,
    page,
    patchTask,
    provider,
    quote,
    quotePanel,
    r,
    requestStatus,
    reveal,
    reviewing,
    s,
    scopeTasks,
    search,
    selected,
    setActive,
    setContractor,
    setCustomer,
    setExpanded,
    setFilter,
    setFulfillment,
    setModal,
    setOverride,
    setPage,
    setPay,
    setPayTouched,
    setProvider,
    setRequestTab,
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
    showTasks,
    slot,
    startOrResumeRequest,
    tab,
    taskPhotos,
    taskTitles,
    tasks,
    trail,
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
    update,
    visits,
    workspaceRef,
  };
}
