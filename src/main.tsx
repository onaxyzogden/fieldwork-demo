import { suitableProviders } from "./suitability";
import Blueprint from "./Blueprint";
import ContractorWork, { JobWork } from "./ContractorWork";
import { OperatorHome, OperatorToday } from "./OperatorWork";
import { bucket, workIssue, workStatus } from "./work";
import CustomerIntake from "./CustomerIntake";
import { validAddress } from "./intake";
import {
  getIssue,
  matchIssues,
  answerKey,
  inferredAnswers,
  questionAnswers,
  needsClarificationReview,
  reportedConcern,
} from "./clarification";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Plus,
  Check,
  MapPin,
  Clock,
  CalendarDays,
  LayoutDashboard,
  ListTodo,
  Users,
  Settings,
  ChevronRight,
  Search,
  Bell,
  MoreHorizontal,
  Wrench,
  X,
  Camera,
  RotateCcw,
  ShieldCheck,
  Navigation,
  Layers,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Wallet,
  Sun,
  Moon,
  Menu,
} from "lucide-react";
import {
  type State,
  type Task,
  type Request,
  type Visit,
  seed,
  uid,
  classify,
  providers,
  money,
  dateLabel,
  log,
  reconcile,
  slots,
  available,
  eligible,
  scopeMatch,
  torontoParts,
  instantEligible,
} from "./model";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./style.css";
import "./light.css";
import "./typography.css";
import "./work.css";
import "./blue-theme.css";
import "./customer-concept.css";
import "./operator-concept.css";
import "./contractor-concept.css";
import { deliverUpdates, inbox } from "./notifications";
import { NotificationInbox, MessageThread } from "./NotificationUI";
import {
  migrateDispatch,
  dispatchStatus,
  requestDispatch,
  replacementOptions,
  reoffer,
  respondToOffer,
} from "./dispatch";
const KEY = "fieldwork-demo-v1";
function TaskAnswers({ task }: { task: Task }) {
  const rows = questionAnswers(task);
  const policy = getIssue(task.description);
  return (
    <>
      {policy.availability === "Referral only" && (
        <p className="warning">
          Referral only: this service is not bookable through the demo. The
          operator can review the request and advise on the next step.
        </p>
      )}
      {reportedConcern(task) && (
        <p className="warning">
          Reported condition needs operator attention. Review the customer’s
          answers before scheduling.
        </p>
      )}
      {rows.length > 0 && (
        <dl className="task-answers">
          {rows.map((row) => (
            <div key={row.key}>
              <dt>
                {row.label}
                {row.inferred ? " · From your description" : ""}
              </dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
function ClarificationFields({
  task,
  onChange,
}: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const issue = getIssue(task.description);
  const inferred = inferredAnswers(task.description);
  const setAnswer = (key: string, value: string) => {
    const answers = { ...task.answers, [key]: value };
    onChange({
      issueId: issue.id,
      answers,
      ...(issue.id === "tv" && answers["tv:cables"] === "New electrical outlet"
        ? { restricted: true }
        : {}),
      ...(needsClarificationReview({ ...task, answers })
        ? { reviewed: false }
        : {}),
    });
  };
  const multiple = matchIssues(task.description).filter(
    (i) =>
      i.id !== issue.id &&
      !(
        ["outlet", "wiring"].includes(i.id) &&
        ["outlet", "wiring", "tv"].includes(issue.id)
      ),
  );
  return (
    <>
      {issue.availability === "Referral only" && (
        <p className="warning">
          We can record this for referral review, but this service is not
          available for booking through the platform.
        </p>
      )}
      {issue.availability !== "Referral only" &&
        (task.restricted || issue.review) && (
          <p className="warning">
            Yousef will review the scope and arrange the right provider before
            an appointment is confirmed.
          </p>
        )}
      {multiple.length > 0 && (
        <p className="note">
          This may describe more than one problem: {issue.title} and{" "}
          {multiple.map((i) => i.title).join(", ")}. If these are separate jobs,
          use Back and add each as its own task.
        </p>
      )}
      {issue.questions.map((q) => {
        const key = answerKey(issue, q);
        const field = (
          <label className="field" key={key}>
            {q.label}
            {key in inferred && !(key in task.answers) && (
              <small>From your description — please check this answer.</small>
            )}
            {q.options ? (
              <select
                value={task.answers[key] ?? inferred[key] ?? ""}
                onChange={(e) => setAnswer(key, e.target.value)}
              >
                <option value="">Choose an answer…</option>
                {q.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                value={task.answers[key] || ""}
                placeholder="Add details, or enter Not sure"
                onChange={(e) => setAnswer(key, e.target.value)}
              />
            )}
          </label>
        );
        return key in inferred && !(key in task.answers) ? (
          <details className="inferred-answer" key={key}>
            <summary>{inferred[key]} · From your description · Edit</summary>
            {field}
          </details>
        ) : (
          field
        );
      })}
      {["sink-drain", "bath-drain", "toilet-block"].includes(issue.id) &&
        /cleaner|chemical|drano|liquid.plumr/i.test(
          task.answers[issue.id + ":tried"] || "",
        ) && (
          <label className="field">
            Which product was used, and when?
            <input
              value={task.answers[issue.id + ":product"] || ""}
              onChange={(e) => setAnswer(issue.id + ":product", e.target.value)}
            />
          </label>
        )}
      <label className="field">
        Anything else we should know? (optional)
        <textarea
          value={task.answers["intake:details"] || ""}
          onChange={(e) => setAnswer("intake:details", e.target.value)}
        />
      </label>
      {reportedConcern(task) && (
        <p className="warning">
          We’ll flag this condition for operator attention. This prototype does
          not dispatch emergency assistance.
        </p>
      )}
    </>
  );
}
function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("fieldwork-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });
  React.useEffect(() => {
    if (fulfillment)
      document.querySelector<HTMLElement>("#fulfillment > button")?.focus();
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("fieldwork-theme", theme);
    } catch {}
  }, [theme]);
  const [s, setS] = useState<State>(() => {
    try {
      return migrateDispatch(
        JSON.parse(localStorage.getItem(KEY) || "null") || seed(),
      );
    } catch {
      return migrateDispatch(seed());
    }
  });
  const [role, setRole] = useState("Operator");
  React.useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }, []);
  const [page, setPage] = useState("Home");
  const [active, setActive] = useState("r2");
  const [contractor, setContractor] = useState("marcus");
  const [contractorVisit, setContractorVisit] = useState("");
  const [customer, setCustomer] = useState("c2");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Needs Action");
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [fulfillmentKind, setFulfillmentKind] = useState<"self" | "contractor">(
    "self",
  );
  const [fulfillment, setFulfillment] = useState(false);
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
  const [completion, setCompletion] = useState(false);
  const [pay, setPay] = useState(180);
  const [modal, setModal] = useState("");
  const [reschedule, setReschedule] = useState("");
  const [fail, setFail] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const menuTrigger = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (!sidebar) return;
    const drawer = document.querySelector<HTMLElement>(".sidebar");
    const items = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>("button,a[href]") || [],
      ).filter((el) => el.getClientRects().length > 0);
    items()[0]?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const shell = document.querySelector<HTMLElement>(".shell");
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
      document.body.style.overflow = oldOverflow;
      if (shell) shell.inert = false;
      menuTrigger.current?.focus();
    };
  }, [sidebar]);
  const [override, setOverride] = useState("");
  const [routeDay, setRouteDay] = useState("");
  const routeVisits = s.visits
    .filter(
      (v) =>
        v.providerId === provider &&
        v.status !== "Cancelled" &&
        (!routeDay ||
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Toronto",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(v.start)) === routeDay),
    )
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const attentionRequests = s.requests.filter(
    (r) =>
      !["Draft", "Confirmed", "Cancelled", "Declined", "Completed"].includes(
        r.status,
      ),
  );
  const update = (fn: (d: State) => void, msg?: string) => {
    setS((prev) => {
      const d = migrateDispatch(structuredClone(prev));
      fn(d);
      reconcile(d);
      deliverUpdates(prev, d);
      try {
        localStorage.setItem(KEY, JSON.stringify(d));
      } catch {}
      return d;
    });
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
  React.useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
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
  const hasReferral = tasks.some(
    (t) => getIssue(t.description).availability === "Referral only",
  );
  const visits = s.visits.filter((v) => v.requestId === r.id);
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
        candidates.find((c) => c.appointments.length)?.provider.id ||
          candidates[0]?.provider.id ||
          "",
      );
      setSlot("");
      setOverride("");
    } else if (
      slot &&
      !available(s, provider, duration, r.city, slot, undefined, r.timing)
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
  const recommended = eligible(
    provider,
    tasks.filter((t) => !selected.length || selected.includes(t.id)),
  )
    ? slots(s, provider, duration, r.city, undefined, r.timing)
    : [];
  const opts =
    override &&
    eligible(
      provider,
      tasks.filter((t) => !selected.length || selected.includes(t.id)),
    ) &&
    available(s, provider, duration, r.city, override, undefined, r.timing)
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
    const req = s.requests.find((x) => x.id === id)!;
    setActive(id);
    setCustomer(req.customerId);
    setSelected([]);
    setFulfillment(false);
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
    const chosen = tasks.filter((t) => ids.includes(t.id));
    if (chosen.some((t) => !t.reviewed))
      return notify("Review all selected tasks before scheduling.");
    if (!eligible(provider, chosen))
      return notify(
        "Choose a provider with the required skills and restricted-work eligibility.",
      );
    if (
      s.visits.some(
        (v) =>
          v.status !== "Cancelled" && v.taskIds.some((id) => ids.includes(id)),
      )
    )
      return notify(
        "These tasks already belong to a visit. Remove that visit before regrouping.",
      );
    const sl = opts.find((o) => o.start === slot) || opts[0];
    if (!sl)
      return notify(
        "No appointment fits. Try a shorter visit or another provider.",
      );
    update(
      (d) => {
        const id = uid();
        d.visits.push({
          id,
          requestId: r.id,
          taskIds: ids,
          providerId: provider,
          start: sl.start,
          duration,
          status: "Proposed",
          travel: sl.travel,
        });
        d.assignments.push({
          id: uid(),
          visitId: id,
          providerId: provider,
          status: provider === "yousef" ? "Accepted" : "Offered",
          pay: provider === "yousef" ? 0 : pay,
          expiresAt: d.clock + 7200000,
        });
        log(
          d,
          `${r.name} · visit created for ${providers.find((p) => p.id === provider)?.name}${provider === "yousef" ? "" : " · offer sent"}`,
        );
      },
      provider === "yousef" ? "Visit created" : "Offer sent to contractor",
    );
    setSelected([]);
  };
  const respond = (id: string, status: "Accepted" | "Declined") =>
    update((d) => {
      respondToOffer(d, id, status);
    });
  const beginReassign = (v: Visit, self = false) => {
    const options = replacementOptions(s, v);
    const choice = options.find((o) =>
      self ? o.provider.id === "yousef" : o.provider.id !== "yousef",
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
  const dispatchPanel = (v: Visit) => {
    const status = dispatchStatus(s, v);
    if (!status) return null;
    return (
      <div
        className="dispatch-alert"
        key={"dispatch-" + v.id}
        id={"dispatch-" + v.id}
      >
        <div className="row between wrap">
          <strong>
            <AlertCircle size={17} /> {status}
          </strong>
          <small>
            Visit {v.id.toUpperCase()} · {dateLabel(v.start)}
          </small>
        </div>
        <p>
          {s.requests.find((r) => r.id === v.requestId)?.name} ·{" "}
          {s.assignments
            .filter((a) => a.visitId === v.id && a.status === "Declined")
            .map((a) => providers.find((p) => p.id === a.providerId)?.name)
            .join(", ") || "Previous contractor"}
          {status.includes("Needs reassignment")
            ? " — choose the next provider."
            : ` — replacement offered to ${providers.find((p) => p.id === v.providerId)?.name}; awaiting response.`}
        </p>
        {status.includes("Needs reassignment") && (
          <div className="row actions wrap">
            <button className="primary" onClick={() => beginReassign(v)}>
              Offer to another contractor <ArrowRight size={15} />
            </button>
            <button
              className="secondary"
              disabled={
                !replacementOptions(s, v).some(
                  (o) => o.provider.id === "yousef",
                )
              }
              onClick={() => beginReassign(v, true)}
            >
              Do It Myself
            </button>
          </div>
        )}
      </div>
    );
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
  const photo = (t: Task, file?: File) => {
    if (!file) return;
    if (file.size > 1500000)
      return notify("Choose an image smaller than 1.5 MB for this local demo.");
    const reader = new FileReader();
    reader.onload = () =>
      patchTask(t.id, { photos: [...t.photos, String(reader.result)] });
    reader.readAsDataURL(file);
  };
  const newRequest = () => {
    const id = uid();
    update((d) => {
      d.requests.push({
        id,
        customerId: customer,
        name:
          s.requests.find((r) => r.customerId === customer)?.name ||
          "Sarah Mitchell",
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
  const badge = (status: string) => (
    <span
      className={
        "badge " +
        (/Confirmed|Accepted|Paid|Instant/.test(status)
          ? "green"
          : /Review|Declined|Expired|Failed/.test(status)
            ? "red"
            : "")
      }
    >
      {status}
    </span>
  );
  const taskPhotos = (t: Task) => (
    <div className="photos">
      {t.photos.map((p, i) => (
        <img key={i} src={p} alt={"Task photo " + (i + 1)} />
      ))}
      <label className="photo-add">
        <Camera size={15} /> Add photo
        <input
          type="file"
          accept="image/*"
          onChange={(e) => photo(t, e.target.files?.[0])}
        />
      </label>
    </div>
  );
  const visitCard = (v: Visit) => (
    <div className="visit-card" key={v.id} id={"visit-" + v.id}>
      <div className="row between">
        <strong>
          <CalendarDays size={16} /> {dateLabel(v.start)}
        </strong>
        {badge(workStatus(v))}
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
          {v.execution?.finishedAt && (
            <p className="note">
              {workIssue(v)
                ? "Your visit has finished. The operator will review the remaining work."
                : "Your visit is complete."}
            </p>
          )}
        </>
      )}
      {role === "Customer" && v.status === "Confirmed" && (
        <div className="row actions">
          <button
            className="secondary"
            onClick={() => {
              if (+new Date(v.start) - s.clock < 86400000) {
                update(
                  (d) => log(d, "Customer requested a change within 24 hours"),
                  "Change request sent to operator",
                );
                return;
              }
              setReschedule(v.id);
              setModal("Reschedule");
            }}
          >
            Reschedule
          </button>
          <button
            className="text-button"
            onClick={() => {
              if (+new Date(v.start) - s.clock < 86400000)
                return update(
                  (d) =>
                    log(d, "Customer requested cancellation within 24 hours"),
                  "Cancellation request sent to operator",
                );
              setModal("Cancel booking");
            }}
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
                stroke="#38413b"
                strokeWidth="2"
              />
            </pattern>
          </defs>
          <rect width="700" height="300" fill="#222d28" />
          <rect width="700" height="300" fill="url(#grid)" />
          <path
            d="M0 258 Q190 196 310 268 T700 210 L700 300H0Z"
            fill="#243b3d"
          />
          <path
            d="M-30 180 Q190 90 340 125T730 25"
            fill="none"
            stroke="#505245"
            strokeWidth="11"
          />
          <path
            d="M130 179 L232 130 349 166 445 103 553 129"
            fill="none"
            stroke="#e4b367"
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
                fill="#e9b669"
                stroke="#202723"
                strokeWidth="4"
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fill="#20231f"
                fontSize="12"
                fontWeight="bold"
              >
                {i + 1}
              </text>
            </g>
          ))}
          <text x="282" y="75" fill="#9aa99e" fontSize="14" letterSpacing="4">
            OAKVILLE
          </text>
          <text x="440" y="273" fill="#789397" fontSize="11" letterSpacing="3">
            LAKE ONTARIO
          </text>
          <text x="30" y="35" fill="#a5b0a8" fontSize="10">
            QEW
          </text>
        </svg>
        <span className="map-label">Illustrative map · simulated travel</span>
        <button
          className="map-expand"
          aria-label="Open route view"
          onClick={() => setPage("Today")}
        >
          <ArrowUpRight size={18} />
        </button>
      </div>
    );
  }
  const quotePanel = () =>
    quote ? (
      <div className="panel quote">
        <div className="row between">
          <span className="eyebrow">YOUR {quote.type.toUpperCase()}</span>
          {badge(quote.status)}
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
          {s.payments.some((p) => p.quoteId === quote.id && p.status === "Paid")
            ? "Payment received"
            : quote.payOnCompletion
              ? "Payment due on completion"
              : "Demo payment due after approval"}{" "}
          · No real charge
        </small>
        {role === "Customer" && quote.status === "Sent" && (
          <div className="row actions">
            <button
              className="primary"
              onClick={() =>
                update((d) => {
                  d.quotes.find((q) => q.id === quote.id)!.status = "Approved";
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
                  d.quotes.find((q) => q.id === quote.id)!.status = "Declined";
                  log(d, "Customer declined quote");
                }, "Quote declined")
              }
            >
              Decline
            </button>
          </div>
        )}
        {role === "Customer" &&
          quote.status === "Approved" &&
          !s.payments.some(
            (p) => p.quoteId === quote.id && p.status === "Paid",
          ) && (
            <button
              className="primary actions"
              onClick={() => setModal("Demo payment")}
            >
              {quote.payOnCompletion
                ? "Simulate completion & pay"
                : "Continue to demo payment"}{" "}
              <ArrowRight size={16} />
            </button>
          )}
        {s.payments
          .filter((p) => p.quoteId === quote.id)
          .map((p) => (
            <p key={p.id}>
              {badge(p.status)} <small>{p.reference}</small>
            </p>
          ))}
      </div>
    ) : null;
  return (
    <div className="app" data-role={role}>
      {sidebar && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside
        id="workspace-navigation"
        role={sidebar ? "dialog" : undefined}
        aria-modal={sidebar || undefined}
        aria-label="Workspace navigation"
        className={"sidebar " + (sidebar ? "open" : "")}
      >
        {sidebar && (
          <button
            className="text-button drawer-close"
            onClick={() => setSidebar(false)}
          >
            Close navigation ×
          </button>
        )}
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">
            <Wrench size={21} />
          </span>
          fieldwork<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <div className="avatar amber">YH</div>
          <div>
            <strong>Yousef’s workspace</strong>
            <small>Halton & Greater Toronto</small>
          </div>
          <span className="online" />
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {(role === "Operator"
            ? [
                [LayoutDashboard, "Home"],
                [ListTodo, "Requests"],
                [Navigation, "Today"],
                [MoreHorizontal, "More"],
              ]
            : role === "Customer"
              ? [
                  [Plus, "New request"],
                  [CalendarDays, "My bookings"],
                ]
              : [[Briefcase, "Your Work"]]
          ).map(([Icon, label]: any) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              onClick={() => {
                if (label === "New request" && r.status !== "Draft")
                  newRequest();
                else setPage(label);
                setSidebar(false);
              }}
            >
              <Icon size={18} />
              {label}
              {label === "Requests" && (
                <span className="nav-count">
                  {s.requests.filter((r) => r.status !== "Draft").length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="service-zone">
            <span className="online" /> Service area active
            <small>Oakville · Burlington · Milton</small>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setSidebar(false);
              setModal("Demo settings");
            }}
          >
            <Settings size={16} /> Demo settings
          </button>
          <div className="profile">
            <div className="avatar">
              {role === "Operator"
                ? "YH"
                : role === "Customer"
                  ? "SM"
                  : providers.find((p) => p.id === contractor)?.initials}
            </div>
            <div>
              <strong>
                {role === "Operator"
                  ? "Yousef Haddad"
                  : role === "Customer"
                    ? "Customer portal"
                    : providers.find((p) => p.id === contractor)?.name}
              </strong>
              <small>{role} view</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="shell">
        <div className="demo-bar">
          <span>
            <span className="demo-dot" /> INTERACTIVE PROTOTYPE{" "}
            <span className="demo-extra">
              · All data and transactions are simulated
            </span>
          </span>
          <div className="role-switch">
            {["Customer", "Operator", "Contractor"].map((x) => (
              <button
                key={x}
                className={role === x ? "chosen" : ""}
                onClick={() => {
                  setRole(x);
                  setPage(
                    x === "Operator"
                      ? "Home"
                      : x === "Customer"
                        ? "My bookings"
                        : "Your Work",
                  );
                }}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
        <header className="topbar">
          <div className="row">
            <button
              className="mobile-menu icon-button"
              ref={menuTrigger}
              aria-label="Open navigation"
              aria-expanded={sidebar}
              aria-controls="workspace-navigation"
              onClick={() => setSidebar(!sidebar)}
            >
              <Menu />
            </button>
            <span>{role}</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="row">
            <span className="top-date">
              {new Date(s.clock).toLocaleDateString("en-CA", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
            <button
              className="icon-button"
              aria-label={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
              title={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label={`View notifications (${notices.filter((n) => !n.read).length} unread)`}
              onClick={() => setModal("Notifications")}
            >
              <Bell size={18} />
              {!!notices.filter((n) => !n.read).length && (
                <span className="notification-count">
                  {notices.filter((n) => !n.read).length}
                </span>
              )}
            </button>
            <div className="avatar small">
              {role === "Operator"
                ? "YH"
                : role === "Customer"
                  ? "SM"
                  : providers.find((p) => p.id === contractor)?.initials}
            </div>
          </div>
        </header>
        {notices.find((n) => !n.read) && (
          <div className="incoming-notice" role="status">
            <Bell size={18} />
            <button onClick={() => setModal("Notifications")}>
              {notices.find((n) => !n.read)!.text}
              <small>View update · in-app simulation</small>
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
          {role === "Operator" && page === "Home" && (
            <OperatorHome
              s={s}
              open={(id) => {
                choose(id);
                setPage("Requests");
              }}
              today={() => setPage("Today")}
            />
          )}
          {role === "Operator" && page === "More" && (
            <section className="panel">
              <h1>More</h1>
              {["Contractors", "Activity"].map((x) => (
                <button
                  className="queue-item"
                  key={x}
                  onClick={() => setPage(x)}
                >
                  {x} →
                </button>
              ))}
              <button
                className="queue-item"
                onClick={() => {
                  setSidebar(false);
                  setModal("Demo settings");
                }}
              >
                Demo settings →
              </button>
            </section>
          )}
          {role === "Operator" && page === "Requests" && (
            <>
              <div
                className={
                  "heading operator-request-heading " +
                  (fulfillment ? "is-hidden" : "")
                }
              >
                <div>
                  <div className="eyebrow">INTAKE & FULFILLMENT</div>
                  <h1>Service requests</h1>
                  <p>The right work. The right person. The right time.</p>
                </div>
                <span className="badge">{s.requests.length} requests</span>
              </div>
              <div
                className={
                  "requests-layout operator-concept " +
                  (fulfillment ? "focused-fulfillment" : "")
                }
              >
                {!fulfillment && (
                  <button
                    className="secondary mobile-request-browser"
                    aria-expanded={showRequestQueue}
                    onClick={() => setShowRequestQueue(!showRequestQueue)}
                  >
                    {showRequestQueue
                      ? "Close request list"
                      : "Browse requests"}
                  </button>
                )}
                <section
                  className={
                    "panel queue " + (showRequestQueue ? "queue-open" : "")
                  }
                >
                  <label className="search">
                    <Search size={16} />
                    <input
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
                      "History",
                      "Needs reassignment",
                      "Submitted",
                      "Needs Review",
                      "Awaiting Provider Acceptance",
                      "Awaiting Quote Approval",
                      "Confirmed",
                      "Draft",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  {s.requests
                    .filter(
                      (q) =>
                        (filter === "All requests" ||
                          q.status === filter ||
                          bucket(s, q.id) === filter ||
                          (filter === "Needs reassignment" &&
                            requestDispatch(s, q.id).includes(
                              "Needs reassignment",
                            ))) &&
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
                    )
                    .map((q) => (
                      <button
                        key={q.id}
                        className={
                          "queue-item " + (q.id === r.id ? "selected" : "")
                        }
                        onClick={() => choose(q.id)}
                      >
                        <div className="row between">
                          <strong>{q.name}</strong>
                          <small>{q.id.toUpperCase()}</small>
                        </div>
                        <p>
                          <MapPin size={12} />
                          {q.city} ·{" "}
                          {
                            s.tasks.filter(
                              (t) => t.requestId === q.id && !t.mergedInto,
                            ).length
                          }{" "}
                          tasks
                        </p>
                        {badge(q.status)}
                        {s.visits.some(
                          (v) => v.requestId === q.id && workIssue(v),
                        ) && badge("Issue · Operator follow-up")}
                        {requestDispatch(s, q.id) && (
                          <div className="actions">
                            {badge(requestDispatch(s, q.id))}
                          </div>
                        )}
                      </button>
                    ))}
                </section>
                <div className="detail">
                  <div className="operator-detail-header">
                    <button
                      className="secondary"
                      onClick={() => setPage("Home")}
                    >
                      ← Back to Home
                    </button>
                    <strong>Request Details</strong>
                  </div>
                  <section className="panel operator-summary">
                    <div className="panel-title">
                      <div>
                        <span className="eyebrow">
                          SERVICE REQUEST / {r.id.toUpperCase()}
                        </span>
                        <h2>{r.address || r.name}</h2>
                        <p>
                          <MapPin size={14} /> {r.city} · {r.name}
                        </p>
                      </div>
                      <div className="status-stack">
                        {badge(r.status)}
                        {requestDispatch(s, r.id) &&
                          badge(requestDispatch(s, r.id))}
                      </div>
                    </div>
                    <div className="detail-meta">
                      <span>
                        <Clock size={15} />
                        {r.timing}
                      </span>
                      <span>{badge(r.mode)}</span>
                    </div>
                    <p>
                      {tasks.length} tasks ·{" "}
                      {tasks.reduce((n, t) => n + t.duration, 0)} minutes
                      estimated ·{" "}
                      {tasks.reduce((n, t) => n + t.photos.length, 0)} photos
                    </p>
                    {visits
                      .filter((v) => v.execution || v.status === "Confirmed")
                      .map((v) => (
                        <JobWork
                          key={v.id}
                          s={s}
                          provider="yousef"
                          update={update}
                          visit={v}
                        />
                      ))}
                    {r.notes && <p className="note">{r.notes}</p>}
                  </section>
                  <section className="operator-location-card">
                    <MapPin size={36} />
                    <strong>
                      {r.address}, {r.city}
                    </strong>
                    <a
                      className="secondary"
                      target="_blank"
                      rel="noreferrer"
                      href={
                        "https://www.google.com/maps/search/?api=1&query=" +
                        encodeURIComponent(r.address + ", " + r.city)
                      }
                    >
                      Open in Maps ↗
                    </a>
                    <small>
                      Illustrative location · simulated, not geocoded
                    </small>
                  </section>
                  <section className="panel operator-photo-gallery">
                    <h3>
                      Photos ({tasks.reduce((n, t) => n + t.photos.length, 0)})
                    </h3>
                    <div className="operator-thumbnails">
                      {tasks
                        .flatMap((t) =>
                          t.photos.map((photo, i) => ({
                            photo,
                            title: t.summary,
                            index: i,
                          })),
                        )
                        .slice(0, 3)
                        .map((p, i) => (
                          <figure key={i}>
                            <img
                              src={p.photo}
                              alt={p.title + " photo " + (p.index + 1)}
                            />
                            <figcaption>{p.title}</figcaption>
                          </figure>
                        ))}
                    </div>
                    <details>
                      <summary>View all task photos</summary>
                      <div className="operator-thumbnails">
                        {tasks
                          .flatMap((t) =>
                            t.photos.map((photo, i) => ({
                              photo,
                              title: t.summary,
                              index: i,
                            })),
                          )
                          .map((p, i) => (
                            <figure key={i}>
                              <a
                                href={p.photo}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={
                                  "Open " + p.title + " photo " + (p.index + 1)
                                }
                              >
                                <img
                                  src={p.photo}
                                  alt={p.title + " photo " + (p.index + 1)}
                                />
                              </a>
                              <figcaption>{p.title}</figcaption>
                            </figure>
                          ))}
                      </div>
                    </details>
                    {!tasks.some((t) => t.photos.length > 0) && (
                      <p>No customer photos yet. Add photos within a task.</p>
                    )}
                  </section>
                  <section className="panel operator-estimate">
                    <h3>Estimated visit</h3>
                    <p>
                      <Clock size={20} />{" "}
                      {tasks.reduce((n, t) => n + t.duration, 0)} minutes ·{" "}
                      {tasks.length} separate tasks
                    </p>
                  </section>
                  <section className="panel operator-notes">
                    <h3>Notes from customer</h3>
                    <p>
                      {r.notes ||
                        "No additional access or parking notes supplied."}
                    </p>
                  </section>
                  <section className="panel operator-action-panel">
                    {" "}
                    <div className="row actions wrap operator-primary-actions">
                      <button
                        className="primary"
                        onClick={() => {
                          setFulfillmentKind("self");
                          if (fulfillmentKind !== "self") {
                            setProvider("yousef");
                            setSlot("");
                          }
                          setFulfillment(true);
                        }}
                      >
                        Do It Myself
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          setFulfillmentKind("contractor");
                          if (fulfillmentKind !== "contractor") {
                            setProvider("");
                            setSlot("");
                          }
                          setFulfillment(true);
                        }}
                      >
                        Assign Contractor
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          setModal("Request information");
                        }}
                      >
                        Need More Info
                      </button>
                      <details>
                        <summary>More actions</summary>
                        <button
                          className="text-button"
                          onClick={() => setModal("Decline request")}
                        >
                          Decline request
                        </button>
                        <select
                          aria-label="Booking mode"
                          value={r.mode}
                          onChange={(e) => {
                            if (
                              e.target.value === "Instant Book" &&
                              !instantEligible(tasks)
                            )
                              return notify(
                                "This scope requires Request to Book.",
                              );
                            update((d) => {
                              d.requests.find((q) => q.id === r.id)!.mode =
                                e.target.value;
                              log(d, "Operator changed booking mode");
                            });
                          }}
                        >
                          <option>Request to Book</option>
                          <option>Instant Book</option>
                        </select>
                      </details>
                    </div>
                  </section>
                  <section className="panel" id="review-tasks">
                    <div className="panel-title">
                      <h3>
                        Tasks <span className="count">{tasks.length}</span>
                      </h3>
                      <small>Select tasks to group into a visit</small>
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
                        <div className="reason">
                          <ShieldCheck size={15} />
                          <span>
                            {t.reason}
                            <small>
                              Confidence {Math.round(t.confidence * 100)}% ·{" "}
                              {t.category}
                            </small>
                          </span>
                        </div>
                        {t.restricted && (
                          <p className="warning">
                            <AlertCircle size={15} /> Potential regulated work ·
                            operator review and eligible specialist required
                          </p>
                        )}
                        {taskPhotos(t)}
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
                          <label className="mini-field">
                            Duration (min)
                            <input
                              type="number"
                              min="15"
                              max="480"
                              value={t.duration}
                              onChange={(e) => {
                                if (
                                  visits.some(
                                    (v) =>
                                      v.status !== "Cancelled" &&
                                      v.taskIds.includes(t.id),
                                  )
                                )
                                  return notify(
                                    "Remove the visit before changing task duration so we can recalculate availability.",
                                  );
                                patchTask(t.id, {
                                  duration: Math.max(
                                    15,
                                    Number(e.target.value),
                                  ),
                                });
                              }}
                            />
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
                          {!t.reviewed && (
                            <button
                              className="secondary"
                              onClick={() =>
                                update((d) => {
                                  d.tasks.find((x) => x.id === t.id)!.reviewed =
                                    true;
                                  log(
                                    d,
                                    "Operator reviewed task; compliance flag retained",
                                  );
                                }, "Review recorded")
                              }
                            >
                              Mark reviewed
                            </button>
                          )}
                        </div>
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
                  {fulfillment && (
                    <>
                      {" "}
                      <section className="panel" id="fulfillment">
                        <button
                          className="secondary"
                          onClick={() => {
                            setFulfillment(false);
                            requestAnimationFrame(() =>
                              document
                                .querySelector<HTMLElement>(
                                  ".operator-primary-actions > button",
                                )
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
                            {selected.length || tasks.length} tasks · {duration}{" "}
                            min
                          </span>
                        </div>
                        <div className="fulfillment-request-summary">
                          <MapPin size={24} />
                          <strong>
                            {r.address}, {r.city}
                          </strong>
                          <p>{scopeTasks.map((t) => t.summary).join(" · ")}</p>
                          <p>{r.timing}</p>
                          {requestDispatch(s, r.id) &&
                            badge(requestDispatch(s, r.id))}
                        </div>
                        <div className="segmented">
                          <button
                            className={
                              fulfillmentKind === "self" ? "chosen" : ""
                            }
                            onClick={() => {
                              setFulfillmentKind("self");
                              setProvider("yousef");
                              setSlot("");
                            }}
                          >
                            Do It Myself
                          </button>
                          <button
                            className={
                              fulfillmentKind === "contractor" ? "chosen" : ""
                            }
                            onClick={() => {
                              setFulfillmentKind("contractor");
                              setProvider("");
                              setSlot("");
                            }}
                          >
                            Assign Contractor
                          </button>
                        </div>
                        <div className="provider-options">
                          {candidates.map((c) => (
                            <button
                              key={c.provider.id}
                              aria-pressed={provider === c.provider.id}
                              className={
                                "provider-card " +
                                (provider === c.provider.id ? "selected" : "")
                              }
                              onClick={() => {
                                setProvider(c.provider.id);
                                setSlot("");
                                setOverride("");
                              }}
                            >
                              <div className="avatar">
                                {c.provider.initials}
                              </div>
                              <div>
                                <strong>{c.provider.name}</strong>
                                <small>
                                  {c.provider.city} · {money(c.provider.rate)}
                                  /hr
                                </small>
                                <small>
                                  {c.match.checks
                                    .map((x) => x.title)
                                    .join(" · ")}
                                </small>
                                <small>
                                  {c.appointments.length
                                    ? `First fitting time: ${dateLabel(c.appointments[0].start)} · ${c.appointments[0].travel} min simulated travel`
                                    : "No fitting time found"}
                                </small>
                              </div>
                              {provider === c.provider.id && (
                                <Check size={17} />
                              )}
                            </button>
                          ))}
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
                              Expand the task rows to review scope or select
                              tasks for separate visits.
                            </p>
                            <button
                              className="secondary"
                              onClick={() => {
                                setFulfillment(false);
                                document
                                  .getElementById("review-tasks")
                                  ?.scrollIntoView({ block: "start" });
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
                              {candidates.find(
                                (c) => c.provider.id === provider,
                              )?.appointments.length
                                ? "Fitting times below account for combined duration, working hours, existing visits, travel and buffers."
                                : "Scope fits, but no appointment fits the current duration and timing preference. Review timing or split the visit."}
                            </p>
                            <p>
                              Customer price and contractor pay remain separate.
                            </p>
                          </details>
                        )}
                        <h4>
                          Recommended appointments{" "}
                          <span className="muted">· simulated routing</span>
                        </h4>
                        <div className="slot-grid">
                          {opts.map((o, i) => (
                            <button
                              key={o.start}
                              className={
                                "slot " +
                                ((slot || opts[0]?.start) === o.start
                                  ? "selected"
                                  : "")
                              }
                              onClick={() => setSlot(o.start)}
                            >
                              {i === 0 && (
                                <span className="eyebrow">BEST ROUTE FIT</span>
                              )}
                              <strong>{dateLabel(o.start)}</strong>
                              <small>
                                +{o.travel} min driving · 15 min buffer
                              </small>
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
                              {duration} minutes of work fits this provider’s
                              weekday working hours. Simulated travel allowance:{" "}
                              {opts.find(
                                (o) => o.start === (slot || opts[0]?.start),
                              )?.travel ?? opts[0]?.travel}{" "}
                              minutes, plus a 15-minute buffer. Checked against
                              this provider’s existing visits and the customer’s
                              timing preference.
                            </p>
                          </details>
                        )}
                        {!opts.length && (
                          <p className="warning">
                            No available window fits these tasks. Split the
                            visit or change provider.
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
                              value={pay}
                              onChange={(e) =>
                                setPay(Math.max(0, +e.target.value))
                              }
                            />
                          </label>
                        )}
                        <div className="note">
                          <strong>Customer price & confirmation</strong>
                          <p>
                            {s.quotes
                              .filter(
                                (q) =>
                                  q.requestId === r.id &&
                                  q.status !== "Superseded",
                              )
                              .map(
                                (q) =>
                                  `${q.type}: ${money(q.amount)} · ${q.status}`,
                              )
                              .join("; ") ||
                              "No quote sent yet. Set pricing in Customer pricing & quotes below."}
                          </p>
                          <p>
                            An offer does not confirm the customer appointment.
                            Acceptance, approved scope, quote approval and
                            applicable payment conditions still apply.
                          </p>
                        </div>
                        <button
                          className="primary actions"
                          disabled={!match.eligible || !opts.length}
                          onClick={createVisit}
                        >
                          {provider === "yousef"
                            ? "Create visit"
                            : "Create visit & send offer"}
                          <ArrowRight size={16} />
                        </button>
                      </section>
                    </>
                  )}
                  {visits.filter((v) => v.status !== "Cancelled").length >
                    0 && (
                    <section className="panel">
                      <h3>Visits & assignment history</h3>
                      {visits
                        .filter((v) => v.status !== "Cancelled")
                        .map((v) => (
                          <div key={v.id}>
                            {dispatchPanel(v)}
                            {visitCard(v)}
                            {s.assignments
                              .filter((a) => a.visitId === v.id)
                              .map((a) => (
                                <div className="assignment-row" key={a.id}>
                                  <span>
                                    {
                                      providers.find(
                                        (p) => p.id === a.providerId,
                                      )?.name
                                    }{" "}
                                    ·{" "}
                                    {a.providerId === "yousef"
                                      ? "Self-assigned"
                                      : money(a.pay)}
                                  </span>
                                  {badge(a.status)}
                                  {["Declined", "Expired"].includes(a.status) &&
                                    !s.assignments.some(
                                      (current) =>
                                        current.visitId === v.id &&
                                        ["Offered", "Accepted"].includes(
                                          current.status,
                                        ),
                                    ) && (
                                      <button
                                        className="secondary"
                                        onClick={() => {
                                          beginReassign(v);
                                        }}
                                      >
                                        Reassign
                                      </button>
                                    )}
                                  {a.status === "Offered" && (
                                    <button
                                      className="text-button"
                                      onClick={() => {
                                        setContractor(a.providerId);
                                        setRole("Contractor");
                                        setPage("Your Work");
                                      }}
                                    >
                                      Open contractor view{" "}
                                      <ArrowUpRight size={14} />
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
                  <details className="panel operator-pricing">
                    <summary>Customer pricing & quotes</summary>
                    <p>
                      Customer charges and contractor compensation are separate.
                    </p>
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
                          value={quoteAmount}
                          onChange={(e) =>
                            setQuoteAmount(Math.max(1, +e.target.value))
                          }
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
                    <button
                      className="primary actions"
                      onClick={() =>
                        update((d) => {
                          d.quotes
                            .filter((q) => q.requestId === r.id)
                            .forEach((q) => (q.status = "Superseded"));
                          d.quotes.push({
                            id: uid(),
                            requestId: r.id,
                            type: quoteType,
                            amount: quoteAmount,
                            high: Math.round(quoteAmount * 1.25),
                            status: "Sent",
                            notes:
                              quoteType === "Estimated range"
                                ? "Final price depends on site conditions. Any additional work requires your approval."
                                : "Labour and standard materials included. Quote valid for 7 days.",
                            payOnCompletion: completion,
                          });
                          log(
                            d,
                            `Quote sent to ${r.name} · ${money(quoteAmount)}`,
                          );
                        }, "Quote ready in customer portal")
                      }
                    >
                      Send quote <ArrowUpRight size={16} />
                    </button>
                    {quotePanel()}
                  </details>
                </div>
              </div>
            </>
          )}
          {role === "Operator" && page === "Today" && (
            <OperatorToday
              s={s}
              mapView={<RouteMap />}
              update={update}
              open={(id) => {
                choose(id);
                setPage("Requests");
              }}
            />
          )}
          {role === "Operator" && page === "Contractors" && (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">YOUR TRUSTED NETWORK</div>
                  <h1>Good people. Great work.</h1>
                  <p>
                    Invite-only roster · illustrative availability and
                    eligibility
                  </p>
                </div>
              </div>
              <div className="roster">
                {providers.map((p) => (
                  <section className="panel" key={p.id}>
                    <div className="avatar large">{p.initials}</div>
                    <h2>{p.name}</h2>
                    <p>{p.role}</p>
                    <p>
                      <MapPin size={15} />
                      {p.city} · Halton / GTA
                    </p>
                    <p>{p.skills}</p>
                    <h3>
                      {money(p.rate)}
                      <small> / hour</small>
                    </h3>
                    <span className="badge green">Active · Weekdays 9–5</span>
                    <p>
                      {p.eligible
                        ? "Restricted work eligibility marked by operator; credentials not verified by software."
                        : "General handyman scope only."}
                    </p>
                  </section>
                ))}
              </div>
            </>
          )}
          {role === "Operator" && page === "Activity" && (
            <>
              <div className="heading">
                <div>
                  <h1>Activity history</h1>
                  <p>
                    A shared record of decisions and simulated notifications.
                  </p>
                </div>
              </div>
              <section className="panel">
                {s.events.map((e) => (
                  <div className="event" key={e.id}>
                    <span className="event-dot" />
                    <div>
                      <strong>{e.text}</strong>
                      <small>{dateLabel(e.at)}</small>
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}
          {role === "Customer" && (
            <div className="customer-wrap">
              <div className="account-row">
                <span className="eyebrow">CUSTOMER PORTAL</span>
                <select
                  aria-label="Demo customer"
                  value={customer}
                  onChange={(e) => {
                    setCustomer(e.target.value);
                    setActive(
                      s.requests.find((r) => r.customerId === e.target.value)!
                        .id,
                    );
                    setStep(0);
                  }}
                >
                  {s.requests
                    .filter(
                      (r, i, a) =>
                        a.findIndex((x) => x.customerId === r.customerId) === i,
                    )
                    .map((r) => (
                      <option value={r.customerId} key={r.customerId}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>
              {page === "New request" ? (
                <CustomerIntake
                  key={r.id}
                  s={s}
                  r={r}
                  update={update}
                  notify={notify}
                  photos={taskPhotos}
                  questions={(t, change) => (
                    <ClarificationFields task={t} onChange={change} />
                  )}
                  pay={(start) => {
                    setSlot(start);
                    setModal("Instant payment");
                  }}
                  view={() => setPage("My bookings")}
                />
              ) : (
                <>
                  <div className="heading customer-portal-heading">
                    <div>
                      <h1>Home, handled.</h1>
                      <p>Your requests and upcoming visits.</p>
                    </div>
                    <button className="primary" onClick={newRequest}>
                      <Plus size={17} /> New request
                    </button>
                  </div>
                  <div className="portal-tabs">
                    {s.requests
                      .filter(
                        (x) =>
                          x.customerId === customer &&
                          (x.status !== "Draft" ||
                            !!x.address.trim() ||
                            s.tasks.some(
                              (t) =>
                                t.requestId === x.id &&
                                !t.mergedInto &&
                                (!!t.description.trim() || t.photos.length > 0),
                            )),
                      )
                      .map((x) => (
                        <button
                          key={x.id}
                          className={r.id === x.id ? "selected" : ""}
                          onClick={() => setActive(x.id)}
                        >
                          {x.status === "Draft"
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
                            : x.address || "Request · " + x.id.toUpperCase()}
                        </button>
                      ))}
                  </div>
                  <section className="panel">
                    <div className="row between">
                      <span className="eyebrow">
                        REQUEST {r.id.toUpperCase()}
                      </span>
                      {badge(r.status)}
                    </div>
                    <h2>{r.address || "Your next home project"}</h2>
                    <p>
                      <MapPin size={15} />
                      {r.city} · {tasks.length} tasks
                    </p>
                    {r.status === "Draft" ? (
                      <button
                        className="primary"
                        onClick={() => {
                          setPage("New request");
                          setStep(0);
                        }}
                      >
                        Continue request <ArrowRight size={16} />
                      </button>
                    ) : (
                      <div className="status-track">
                        {[
                          "Request received",
                          "Provider coordinated",
                          "Quote approved",
                          "Visit confirmed",
                        ].map((x, i) => (
                          <div
                            className={
                              i === 0 ||
                              (i === 1 &&
                                visits.some((v) =>
                                  s.assignments.some(
                                    (a) =>
                                      a.visitId === v.id &&
                                      a.status === "Accepted",
                                  ),
                                )) ||
                              (i === 2 && quote?.status === "Approved") ||
                              (i === 3 && r.status === "Confirmed")
                                ? "complete"
                                : ""
                            }
                            key={x}
                          >
                            <CheckCircle2 size={18} />
                            <span>{x}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!["Confirmed", "Cancelled", "Draft"].includes(
                      r.status,
                    ) && (
                      <p className="note">
                        {r.status === "Needs Review"
                          ? "Your request needs a closer look. We’ll coordinate a suitable provider."
                          : "Your appointment is not confirmed until provider acceptance, quote approval, and any required payment are complete."}
                      </p>
                    )}
                    {r.notes && <p className="note">{r.notes}</p>}
                    {r.notes.startsWith("Information requested:") && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const reply = String(
                            new FormData(e.currentTarget).get("reply"),
                          );
                          update((d) => {
                            d.requests.find((x) => x.id === r.id)!.notes +=
                              " | Customer response: " + reply;
                            log(
                              d,
                              "Customer replied to information request: " +
                                reply,
                            );
                          }, "Response shared with Yousef");
                        }}
                      >
                        <label className="field">
                          Your response
                          <textarea
                            name="reply"
                            required
                            placeholder="Add the requested details…"
                          />
                        </label>
                        <button className="secondary">Send response</button>
                      </form>
                    )}
                    {tasks.map((t) => (
                      <div className="portal-task" key={t.id}>
                        <h4>
                          <Wrench size={15} />
                          {t.summary}
                        </h4>
                        <p>{t.description}</p>
                        <TaskAnswers task={t} />
                        {taskPhotos(t)}
                      </div>
                    ))}
                  </section>
                  {quotePanel()}
                  {visits.map(visitCard)}
                </>
              )}
            </div>
          )}
          {role === "Contractor" && (
            <>
              <label className="field">
                Demo contractor
                <select
                  value={contractor}
                  onChange={(e) => setContractor(e.target.value)}
                >
                  {providers
                    .filter((p) => p.id !== "yousef")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <ContractorWork
                key={contractor}
                s={s}
                provider={contractor}
                openVisit={contractorVisit}
                update={update}
              />
            </>
          )}
          <footer>
            <span>
              <span className="brand-mini">fieldwork.</span> Home services,
              coordinated.
            </span>
            <span>Local prototype · CAD · America/Toronto</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
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
              <>
                <details className="sample-scenarios">
                  <summary>Sample scenarios</summary>
                  <div className="scenario-strip">
                    <p>
                      Open a fictional sample request. Existing demo changes are
                      preserved.
                    </p>
                    {[
                      "01 Door adjustment",
                      "02 Four-task visit",
                      "03 Delegate a job",
                      "04 Needs review",
                      "05 Decline & reassign",
                    ].map((x, i) => (
                      <button
                        className={active === "r" + (i + 1) ? "selected" : ""}
                        key={x}
                        onClick={() => {
                          choose("r" + (i + 1));
                          setModal("");
                        }}
                      >
                        {x}
                      </button>
                    ))}
                  </div>
                </details>

                <a className="secondary" href="?view=blueprint">
                  Developer blueprint →
                </a>
                {role === "Operator" && (
                  <div className="dispatch-setting">
                    <label className="row">
                      <input
                        type="checkbox"
                        checked={s.settings?.autoReofferDeclined || false}
                        onChange={(e) =>
                          update((d) => {
                            d.settings = {
                              autoReofferDeclined: e.target.checked,
                            };
                            log(
                              d,
                              e.target.checked
                                ? "Automatic reoffers enabled"
                                : "Automatic reoffers disabled",
                            );
                          })
                        }
                      />{" "}
                      Automatically reoffer declined jobs
                    </label>
                    <p>
                      Offer to the next eligible contractor at the same time and
                      pay. You’ll be notified of the outcome. If no match fits,
                      you choose the next step. Existing declines and expired
                      offers remain manual.
                    </p>
                  </div>
                )}
                <p>
                  Mock data is stored in this browser. No real payments or
                  notifications are sent.
                </p>
                <p>
                  Demo policies: 24-hour change cutoff, sequential two-hour
                  offers, weekday 9–5 availability, 15-minute setup/overrun
                  buffer.
                </p>
                <button
                  className="secondary full"
                  onClick={() =>
                    update((d) => {
                      d.clock += 3 * 3600000;
                      log(d, "Demo clock advanced 3 hours");
                    }, "Clock advanced; offers checked for expiry")
                  }
                >
                  Advance clock 3 hours
                </button>
                <button
                  className="secondary full actions"
                  onClick={() => {
                    const d = migrateDispatch(seed());
                    setS(d);
                    localStorage.setItem(KEY, JSON.stringify(d));
                    setActive("r2");
                    setCustomer("c2");
                    setStep(0);
                    setPage(
                      role === "Operator"
                        ? "Home"
                        : role === "Customer"
                          ? "My bookings"
                          : "Your Work",
                    );
                    setModal("");
                    notify("All five scenarios reset");
                  }}
                >
                  <RotateCcw size={16} /> Reset all demo data
                </button>
              </>
            )}
            {modal === "Notifications" && (
              <NotificationInbox
                s={s}
                recipient={recipient}
                update={update}
                open={(requestId, visitId) => {
                  if (role === "Contractor") {
                    setContractorVisit("");
                    setTimeout(() => setContractorVisit(visitId), 0);
                    setPage("Your Work");
                  } else {
                    choose(requestId);
                    setPage(role === "Operator" ? "Requests" : "My bookings");
                  }
                  setModal("");
                  setTimeout(() => {
                    const thread = document.getElementById(
                      "messages-" + visitId,
                    );
                    if (thread instanceof HTMLDetailsElement) {
                      thread.open = true;
                      thread.scrollIntoView({ block: "center" });
                    }
                  }, 100);
                }}
              />
            )}
            {["Instant payment", "Demo payment"].includes(modal) && (
              <>
                <p>Simulated checkout · no card information or real charge.</p>
                <div className="payment-method">
                  <Wallet />
                  <div>
                    <strong>Demo payment method</strong>
                    <small>Test card •••• 4242</small>
                  </div>
                  <Check size={18} />
                </div>
                {modal === "Instant payment" && (
                  <p>Selected appointment: {dateLabel(slot)}</p>
                )}
                <h1>
                  {money(
                    modal === "Instant payment" ? 129 : quote?.amount || 0,
                  )}
                </h1>
                <label className="row">
                  <input
                    type="checkbox"
                    checked={fail}
                    onChange={(e) => setFail(e.target.checked)}
                  />{" "}
                  Simulate a failed payment
                </label>
                <button
                  className="primary full actions"
                  onClick={() => {
                    if (modal === "Instant payment") {
                      if (fail) {
                        notify(
                          "Demo payment failed. Uncheck failure and retry.",
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
                        ).some((o) => o.start === slot);
                      if (!available)
                        return notify(
                          "That slot is no longer available. Choose another time.",
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
                          reference: "demo_" + uid(),
                        });
                        log(
                          d,
                          "Instant booking confirmed · demo receipt issued",
                        );
                      });
                      setStep(5);
                    } else if (quote) {
                      update(
                        (d) => {
                          d.payments.push({
                            id: uid(),
                            quoteId: quote.id,
                            status: fail ? "Failed" : "Paid",
                            amount: quote.amount,
                            reference: "demo_" + uid(),
                          });
                          log(
                            d,
                            fail
                              ? "Demo payment failed"
                              : "Demo payment received · receipt issued",
                          );
                        },
                        fail
                          ? "Payment failed; retry available"
                          : "Demo payment successful",
                      );
                      if (fail) return;
                    }
                    setToast("");
                    setModal("");
                  }}
                >
                  Simulate payment <ArrowRight size={16} />
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
                      Previous declines stay in history. Review the provider,
                      pay, and appointment before sending a replacement offer.
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
                          {provider === o.provider.id && <Check size={17} />}
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
                          <label className="field">
                            Replacement contractor pay (CAD)
                            <input
                              type="number"
                              min={choice.minimumPay}
                              value={pay}
                              onChange={(e) => setPay(Number(e.target.value))}
                            />
                          </label>
                        )}
                        <button
                          className="primary full actions"
                          disabled={
                            provider !== "yousef" && pay < choice.minimumPay
                          }
                          onClick={() => {
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
                      Fresh route-aware options for your provider. Contractor
                      changes require renewed acceptance.
                    </p>
                    {slots(s, v.providerId, v.duration, r.city, v.id)
                      .filter((o) => o.start !== v.start)
                      .map((o) => (
                        <button
                          className="slot full actions"
                          key={o.start}
                          onClick={() => {
                            update((d) => {
                              const visit = d.visits.find(
                                (x) => x.id === v.id,
                              )!;
                              visit.start = o.start;
                              visit.travel = o.travel;
                              if (v.providerId !== "yousef") {
                                d.assignments
                                  .filter(
                                    (a) =>
                                      a.visitId === v.id &&
                                      a.status === "Accepted",
                                  )
                                  .forEach((a) => (a.status = "Reassigned"));
                                d.assignments.push({
                                  id: uid(),
                                  visitId: v.id,
                                  providerId: v.providerId,
                                  status: "Offered",
                                  pay:
                                    s.assignments.find(
                                      (a) => a.visitId === v.id,
                                    )?.pay || 0,
                                  expiresAt: d.clock + 7200000,
                                });
                              }
                              log(
                                d,
                                "Customer rescheduled visit · provider notified",
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
                <p>
                  Cancel this request and all its visits? Any paid demo
                  transactions will be marked refunded.
                </p>
                <button
                  className="primary full"
                  onClick={() => {
                    update((d) => {
                      d.requests.find((q) => q.id === r.id)!.status =
                        "Cancelled";
                      d.visits
                        .filter((v) => v.requestId === r.id)
                        .forEach((v) => (v.status = "Cancelled"));
                      d.assignments
                        .filter((a) => visits.some((v) => v.id === a.visitId))
                        .forEach((a) => (a.status = "Cancelled"));
                      d.payments
                        .filter(
                          (p) =>
                            s.quotes.some(
                              (q) => q.id === p.quoteId && q.requestId === r.id,
                            ) && p.status === "Paid",
                        )
                        .forEach((p) => (p.status = "Refunded"));
                      log(
                        d,
                        "Customer cancelled booking · simulated refund issued",
                      );
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
                    d.requests.find((q) => q.id === r.id)!.notes =
                      "Information requested: " + value;
                    log(
                      d,
                      "Operator requested additional information: " + value,
                    );
                  }, "Request visible in customer portal");
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
                      return notify(
                        "Remove the existing visit before merging.",
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
                    return notify(
                      "Remove the existing visit before splitting.",
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
                <button className="primary">Split into two tasks</button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).get("view") === "blueprint" ? (
      <Blueprint />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
