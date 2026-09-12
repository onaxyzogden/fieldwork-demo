import {
  ClipboardList,
  CircleAlert,
  Clock3,
  Wallet,
  CheckCircle2,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { type State, providers, dateLabel, money, torontoParts } from "./model";
import { bucket, dayKey, workIssue, workStatus } from "./work";
import { requestDispatch } from "./dispatch";
import { JobWork } from "./ContractorWork";
type Props = {
  s: State;
  open: (id: string) => void;
  update: (fn: (s: State) => void, msg?: string) => void;
};
export function OperatorHome({
  s,
  open,
  today,
}: {
  s: State;
  open: (id: string) => void;
  today: () => void;
}) {
  const [view, setView] = useState<"attention" | "all">("attention");
  const needs = s.requests
    .filter((r) => bucket(s, r.id) === "Needs Action")
    .sort(
      (a, b) =>
        Number(
          !!(
            requestDispatch(s, b.id) ||
            s.visits.some((v) => v.requestId === b.id && workIssue(v))
          ),
        ) -
        Number(
          !!(
            requestDispatch(s, a.id) ||
            s.visits.some((v) => v.requestId === a.id && workIssue(v))
          ),
        ),
    );
  const waiting = s.requests.filter((r) => bucket(s, r.id) === "Waiting");
  const visits = s.visits.filter(
    (v) =>
      dayKey(v.start) === dayKey(s.clock) &&
      ["Confirmed", "In Progress", "Completed"].includes(v.status),
  );
  const hour = Number(torontoParts(new Date(s.clock)).hour);
  const greeting =
    hour < 12
      ? "Good morning!"
      : hour < 18
        ? "Good afternoon!"
        : "Good evening!";
  const cards = (list: typeof needs) =>
    list.map((r) => {
      const dispatch = requestDispatch(s, r.id);
      const issue = s.visits.find(
        (v) => v.requestId === r.id && v.status !== "Cancelled" && workIssue(v),
      );
      const taskList = s.tasks.filter(
        (t) => t.requestId === r.id && !t.mergedInto,
      );
      const quote = s.quotes.find(
        (q) => q.requestId === r.id && q.status !== "Superseded",
      );
      const title = issue
        ? issue.execution?.finishedAt
          ? "Work needs follow-up"
          : "Job running late"
        : dispatch.includes("Needs reassignment")
          ? dispatch.startsWith("Offer expired")
            ? "Offer expired"
            : "Contractor declined"
          : dispatch ||
            (r.status === "Submitted"
              ? "New request"
              : r.status === "Awaiting Quote Approval"
                ? "Quote awaiting approval"
                : r.status);
      const tone =
        issue || dispatch.includes("Needs reassignment")
          ? "issue"
          : r.status === "Awaiting Quote Approval"
            ? "quote"
            : r.status === "Completed"
              ? "complete"
              : r.status === "Submitted" || r.status === "Needs Review"
                ? "new"
                : "scheduled";
      const Icon =
        tone === "issue"
          ? issue && !issue.execution?.finishedAt
            ? Clock3
            : CircleAlert
          : tone === "quote"
            ? Wallet
            : tone === "complete"
              ? CheckCircle2
              : ClipboardList;
      const notice = s.notifications
        ?.filter((n) => n.requestId === r.id)
        .sort((a, b) => b.at.localeCompare(a.at))[0];
      const age = notice
        ? Math.max(0, Math.floor((s.clock - +new Date(notice.at)) / 60000))
        : null;
      const ageText =
        age === null
          ? ""
          : age < 1
            ? "Just now"
            : age < 60
              ? `${age} min ago`
              : age < 1440
                ? `${Math.floor(age / 60)} hr ago`
                : `${Math.floor(age / 1440)} days ago`;
      const detail = issue?.execution?.finishedAt
        ? "Unresolved tasks · operator follow-up"
        : issue?.execution?.eta
          ? `${Math.max(0, Math.round((+new Date(issue.execution.eta) - +new Date(issue.start)) / 60000))} min behind · simulated ETA`
          : dispatch.includes("Needs reassignment")
            ? "Needs reassignment"
            : quote && r.status === "Awaiting Quote Approval"
              ? `${money(quote.amount)} · ${taskList.length} task${taskList.length === 1 ? "" : "s"} · waiting for customer`
              : `${taskList.length} task${taskList.length === 1 ? "" : "s"} · Est. ${taskList.reduce((n, t) => n + t.duration, 0)} min`;
      return (
        <button
          className={"op-request-bento op-tone-" + tone}
          key={r.id}
          onClick={() => open(r.id)}
        >
          <span className="op-status-icon">
            <Icon size={23} />
          </span>
          <span className="op-card-copy">
            <span className="op-card-top">
              <strong>{title}</strong>
              {ageText && <small>{ageText}</small>}
            </span>
            <span>
              {r.address || r.name}, {r.city}
            </span>
            <span className="op-card-detail">{detail}</span>
          </span>
          <ChevronRight size={20} className="op-card-chevron" />
        </button>
      );
    });
  return (
    <div className="op-home">
      <header className="op-greeting">
        <h1>{greeting}</h1>
        <p>Here’s what needs your attention.</p>
      </header>
      <section className="op-glance">
        <div className="op-glance-heading">
          <h2>Today at a glance</h2>
          <button className="op-date" onClick={today}>
            <CalendarDays size={16} />
            {new Date(s.clock).toLocaleDateString("en-CA", {
              timeZone: "America/Toronto",
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="op-metrics">
          <button onClick={today}>
            <strong>{visits.length}</strong>
            <span>Scheduled visits</span>
          </button>
          <button onClick={today}>
            <strong>
              {
                new Set(
                  visits
                    .filter(
                      (v) =>
                        v.providerId !== "yousef" &&
                        s.assignments.some(
                          (a) =>
                            a.visitId === v.id &&
                            a.providerId === v.providerId &&
                            a.status === "Accepted",
                        ),
                    )
                    .map((v) => v.providerId),
                ).size
              }
            </strong>
            <span>Active contractors</span>
          </button>
          <button className="op-pending" onClick={() => setView("attention")}>
            <strong>{needs.length}</strong>
            <span>Pending decisions</span>
          </button>
        </div>
      </section>
      <div className="op-view-switch" role="group" aria-label="Request view">
        <button
          aria-pressed={view === "attention"}
          onClick={() => setView("attention")}
        >
          Needs Attention <span>{needs.length}</span>
        </button>
        <button aria-pressed={view === "all"} onClick={() => setView("all")}>
          All Requests
        </button>
      </div>
      <section
        className="op-attention-list"
        aria-label={
          view === "attention"
            ? "Requests needing attention"
            : "All submitted requests"
        }
      >
        {cards(
          view === "attention"
            ? needs
            : s.requests.filter((r) => r.status !== "Draft"),
        )}
        {view === "attention" && !needs.length && (
          <div className="op-empty">
            <CheckCircle2 />
            <h2>You’re all caught up.</h2>
            <p>New requests and issues will appear here.</p>
          </div>
        )}
      </section>
      {view === "attention" && waiting.length > 0 && (
        <details className="op-waiting">
          <summary>
            Waiting for a response <span>{waiting.length}</span>
          </summary>
          <p>These requests don’t need a decision from you yet.</p>
          <div className="op-attention-list">{cards(waiting)}</div>
        </details>
      )}
    </div>
  );
}

export function OperatorToday({
  s,
  open,
  update,
  mapView,
}: Props & { mapView: ReactNode }) {
  const [provider, setProvider] = useState("all");
  const [day, setDay] = useState(dayKey(s.clock));
  const [selected, setSelected] = useState("");
  const [map, setMap] = useState(false);
  const visits = s.visits
    .filter(
      (v) =>
        v.status !== "Cancelled" &&
        dayKey(v.start) === day &&
        (provider === "all" || v.providerId === provider),
    )
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const v = visits.find((v) => v.id === selected);
  return (
    <>
      <h1>Today</h1>
      <p>What’s happening, in appointment order.</p>
      <section className="panel">
        <div className="work-toolbar">
          <label className="field">
            Provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="all">All providers</option>
              {providers.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Date
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <button className="secondary" onClick={() => setMap(!map)}>
            {map ? "Timeline" : "Map"}
          </button>
        </div>
        {map && mapView}
        <p>
          {visits.length} visits ·{" "}
          {visits.reduce((n, v) => n + v.duration, 0) / 60} work hours ·{" "}
          {visits.reduce((n, v) => n + v.travel, 0)} min driving
        </p>
        {visits.map((v) => {
          const r = s.requests.find((r) => r.id === v.requestId)!;
          return (
            <div className="work-task" key={v.id}>
              <span className="badge">{workStatus(v)}</span>
              <h3>{dateLabel(v.start)}</h3>
              <p>
                {s.tasks.find((t) => v.taskIds.includes(t.id))?.summary} ·{" "}
                {providers.find((p) => p.id === v.providerId)?.name}
              </p>
              <p>
                {r.address}, {r.city}
              </p>
              {v.execution?.startedAt && (
                <p>Started {dateLabel(v.execution.startedAt)}</p>
              )}
              {v.execution?.eta && !v.execution.startedAt && (
                <p>Simulated ETA {dateLabel(v.execution.eta)}</p>
              )}
              <small>{v.travel} min travel · 15 min buffer</small>
              <div className="actions row">
                <button className="secondary" onClick={() => setSelected(v.id)}>
                  View progress
                </button>
                <button className="text-button" onClick={() => open(r.id)}>
                  Open request
                </button>
                {map && (
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={
                      "https://www.google.com/maps/search/?api=1&query=" +
                      encodeURIComponent(r.address + ", " + r.city)
                    }
                  >
                    Open map ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {!visits.length && (
          <div>
            <p>
              No visits for this date. Choose another date or plan a visit from
              Requests.
            </p>
            {s.visits
              .filter((v) => v.status !== "Cancelled" && dayKey(v.start) >= day)
              .sort((a, b) => a.start.localeCompare(b.start))[0] && (
              <button
                className="secondary"
                onClick={() =>
                  setDay(
                    dayKey(
                      s.visits
                        .filter(
                          (v) =>
                            v.status !== "Cancelled" && dayKey(v.start) >= day,
                        )
                        .sort((a, b) => a.start.localeCompare(b.start))[0]
                        .start,
                    ),
                  )
                }
              >
                Next scheduled day
              </button>
            )}
          </div>
        )}
      </section>
      {v && (
        <>
          <button className="text-button" onClick={() => setSelected("")}>
            Close progress
          </button>
          <JobWork s={s} provider="yousef" update={update} visit={v} />
        </>
      )}
    </>
  );
}
