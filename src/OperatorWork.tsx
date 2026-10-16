import { plural } from "./plural";
import {
  ClipboardList,
  CircleAlert,
  Clock3,
  Wallet,
  CheckCircle2,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  type State,
  providers,
  dateLabel,
  money,
  timeLabel,
} from "./model";
import {
  bucket,
  callBackDue,
  dayKey,
  feeUndecided,
  workIssue,
  workStatus,
} from "./work";
import { Glance } from "./GlanceCard";
import { glanceDate, todaysVisits, visitDayState } from "./glance";
import { requestDispatch } from "./dispatch";
import { JobWork } from "./JobWork";
import DecisionQueue from "./DecisionQueue";
import { decisionQueue, heldFor, unfinished } from "./decisions";
type Props = {
  s: State;
  open: (id: string) => void;
  update: (fn: (s: State) => void, msg?: string) => void;
};
export function OperatorHome({
  s,
  open,
  update,
  today,
}: Props & { today: () => void }) {
  const [view, setView] = useState<"attention" | "all">("attention");
  const [working, setWorking] = useState(false);
  const decisions = decisionQueue(s).length;
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
  /* Today's booked visits: the "Scheduled visits" count and the strip
     below are this one list, so they cannot disagree (ADR 066). */
  const visits = todaysVisits(s, s.clock, (v) =>
    ["Confirmed", "In Progress", "Completed"].includes(v.status),
  );
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
      /* A change inside 24 hours (ADR 064) outranks everything on the row:
         money is held, or someone is waiting by the phone. */
      const late = feeUndecided(r);
      const call = callBackDue(r) ? r.callBack : undefined;
      /* An additional charge with the customer (ADR 065). */
      const charge = s.charges?.find(
        (c) => c.requestId === r.id && c.status === "Sent",
      );
      const title = late
        ? "Late cancellation"
        : call
          ? `Call back by ${timeLabel(call.by)}`
          : charge
            ? "Waiting on approval"
            : issue
              ? issue.execution?.finishedAt
                ? "Unfinished work"
                : "Job running late"
              : dispatch.includes("Needs reassignment")
                ? dispatch.startsWith("Offer expired")
                  ? "Offer expired"
                  : "Contractor declined"
                : dispatch ||
                  (r.status === "Submitted"
                    ? "New request"
                    : quote?.status === "Declined"
                      ? "Quote declined"
                      : r.status === "Awaiting Quote Approval"
                        ? "Quote awaiting approval"
                        : /* The system's word, shown in sentence case. */
                          r.status.charAt(0) + r.status.slice(1).toLowerCase());
      const tone =
        late || call || issue || dispatch.includes("Needs reassignment")
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
                : `${plural(Math.floor(age / 1440), "day")} ago`;
      const moving = call && s.visits.find((v) => v.id === call.visitId);
      const undone = unfinished(s, r.id).length;
      const detail = late
        ? `${money(heldFor(s, r.id))} held · decide the fee`
        : moving
          ? `Wants a new time for ${dateLabel(moving.start)}`
          : charge
            ? `${money(charge.amount)} additional charge · ${charge.reason}`
            : issue?.execution?.finishedAt
              ? `${undone} task${undone === 1 ? "" : "s"} left undone · return or close`
              : issue?.execution?.eta
                ? `${Math.max(0, Math.round((+new Date(issue.execution.eta) - +new Date(issue.start)) / 60000))} min behind · simulated ETA`
                : dispatch.includes("Needs reassignment")
                  ? "Needs reassignment"
                  : quote?.status === "Declined"
                    ? `${money(quote.amount)} · declined · revise the quote`
                    : quote && r.status === "Awaiting Quote Approval"
                      ? `${money(quote.amount)} · ${taskList.length} task${taskList.length === 1 ? "" : "s"} · waiting for customer`
                      : `${taskList.length} task${taskList.length === 1 ? "" : "s"} · Est. ${taskList.reduce((n, t) => n + t.duration, 0)} min`;
      return (
        <button
          className={
            "op-request-bento op-tone-" +
            tone +
            /* Accent marks the rows that are the operator's to act on
               (ADR 092); the rest sit neutral, as in the request list. */
            (bucket(s, r.id) === "Needs Action" ? "" : " quiet")
          }
          key={r.id}
          onClick={() => open(r.id)}
        >
          <span className="op-status-icon">
            <Icon size={24} aria-hidden="true" />
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
          <ChevronRight aria-hidden="true" size={20} className="op-card-chevron" />
        </button>
      );
    });
  return (
    <div className="op-home">
      {/* The page names itself, as the sidebar does (ADR 092). */}
      <header className="role-greeting">
        <h1>Home</h1>
      </header>
      {/* One way to Today: "All of today" on the strip below (ADR 092). */}
      <Glance
        date={glanceDate(s.clock)}
        metrics={[
          {
            label: "Scheduled visits",
            value: visits.length,
          },
          {
            label: "Active contractors",
            value: new Set(
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
            ).size,
          },
          {
            label: "Needs action",
            value: needs.length,
            onClick: () => {
              setView("attention");
              document
                .querySelector(".op-attention-list")
                ?.scrollIntoView({ block: "start" });
            },
          },
        ]}
      />
      {/* The list stays for looking; this is for getting through it, one
          request and one suggested action at a time (ADR 059). */}
      {decisions > 0 && (
        <button className="primary full" onClick={() => setWorking(true)}>
          Work through {decisions} decision{decisions === 1 ? "" : "s"}
        </button>
      )}
      {working && (
        <DecisionQueue
          s={s}
          update={update}
          open={open}
          close={() => setWorking(false)}
        />
      )}
      {/* Visit day, live (ADR 066): who is where, a row each. */}
      {visits.length > 0 && (
        <section className="card panel op-today" aria-label="Today’s visits">
          <div className="row between">
            <h2>Today</h2>
            <button className="text-button" onClick={today}>
              All of today
            </button>
          </div>
          {visits.map((v) => {
            const state = visitDayState(v);
            return (
              <button
                key={v.id}
                className="op-today-row"
                onClick={() => open(v.requestId)}
              >
                <span className="op-today-time">{timeLabel(v.start)}</span>
                <span className="op-today-who">
                  <strong>
                    {s.requests.find((r) => r.id === v.requestId)?.name}
                  </strong>
                  <small>
                    {providers.find((p) => p.id === v.providerId)?.name}
                  </small>
                </span>
                <span
                  className={
                    "badge" +
                    (state === "Done"
                      ? " green"
                      : ["Running late", "Unfinished"].includes(state)
                        ? ""
                        : " quiet")
                  }
                >
                  {state}
                </span>
              </button>
            );
          })}
        </section>
      )}
      <div className="op-view-switch" role="group" aria-label="Request view">
        <button
          aria-pressed={view === "attention"}
          onClick={() => setView("attention")}
        >
          Needs action <span>{needs.length}</span>
        </button>
        <button aria-pressed={view === "all"} onClick={() => setView("all")}>
          All requests
        </button>
      </div>
      <section
        className="op-attention-list"
        aria-label={
          view === "attention"
            ? "Requests needing action"
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
            <CheckCircle2 aria-hidden="true" />
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

/** A date key as the heading says it: "Monday, October 19". */
const longDay = (key: string) =>
  new Date(key + "T12:00:00Z").toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

export function OperatorToday({
  s,
  open,
  update,
  mapView,
  requests,
}: Props & {
  mapView: (stops: number, route: boolean) => ReactNode;
  requests: () => void;
}) {
  const [provider, setProvider] = useState("all");
  const [day, setDay] = useState(dayKey(s.clock));
  const [selected, setSelected] = useState("");
  const [map, setMap] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const toHeading = useRef(false);
  /* When the control that was pressed goes away, focus goes where the
     person looks next (ADR 092): the new day's heading, or the progress. */
  useEffect(() => {
    if (toHeading.current) heading.current?.focus();
    toHeading.current = false;
  }, [day]);
  useEffect(() => {
    if (!selected) return;
    panel.current?.scrollIntoView?.({ block: "start" });
    panel.current?.focus();
  }, [selected]);
  const name = providers.find((p) => p.id === provider)?.name;
  const visits = s.visits
    .filter(
      (v) =>
        v.status !== "Cancelled" &&
        dayKey(v.start) === day &&
        (provider === "all" || v.providerId === provider),
    )
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const v = visits.find((v) => v.id === selected);
  const next = s.visits
    .filter(
      (v) =>
        v.status !== "Cancelled" &&
        dayKey(v.start) > day &&
        (provider === "all" || v.providerId === provider),
    )
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return (
    <>
      <div className="heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>
            {day === dayKey(s.clock) ? "Today" : longDay(day)}
          </h1>
        </div>
      </div>
      <section className="card panel operator-day">
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
        </div>
        {visits.length > 0 && (
          <>
            <div
              className="op-view-switch"
              role="group"
              aria-label="Today view"
            >
              <button aria-pressed={!map} onClick={() => setMap(false)}>
                Timeline
              </button>
              <button aria-pressed={map} onClick={() => setMap(true)}>
                Map
              </button>
            </div>
            {/* The facts every visit shares, said once (ADR 092). */}
            <p>
              {plural(visits.length, "visit")} ·{" "}
              {provider === "all"
                ? plural(new Set(visits.map((v) => v.providerId)).size, "provider")
                : name}{" "}
              · 15 min buffer between visits
            </p>
          </>
        )}
        {map && visits.length > 0 && (
          <section className="operator-route-card">
            <h2 className="look-h3">
              {provider === "all" ? "Provider locations" : `${name}’s route`}
            </h2>
            {mapView(visits.length, provider !== "all")}
            <p>
              Illustrative map · simulated travel.{" "}
              {provider === "all"
                ? "Visits belong to separate provider routes."
                : "Visit order is listed below."}
            </p>
            {visits.map((v) => {
              const r = s.requests.find((r) => r.id === v.requestId)!;
              return (
                <a
                  key={v.id}
                  className="secondary"
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${r.address} · Open in Maps, opens in a new tab`}
                  href={
                    "https://www.google.com/maps/search/?api=1&query=" +
                    encodeURIComponent(r.address + ", " + r.city)
                  }
                >
                  {r.address} · Open in Maps ↗
                </a>
              );
            })}
          </section>
        )}
        <div className="operator-timeline">
          {!map &&
            visits.map((v) => {
              const r = s.requests.find((r) => r.id === v.requestId)!;
              const status = workStatus(v);
              return (
                <div className="work-task operator-timeline-entry" key={v.id}>
                  <time className="operator-time" dateTime={v.start}>
                    {new Date(v.start).toLocaleTimeString("en-CA", {
                      timeZone: "America/Toronto",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                  <span className="operator-timeline-dot" aria-hidden="true">
                    {v.status === "Completed"
                      ? "✓"
                      : v.execution?.startedAt
                        ? "▶"
                        : "●"}
                  </span>
                  {/* Accent only where the visit is the operator's to act
                      on (ADR 092). */}
                  <span
                    className={
                      "badge" +
                      (status === "Completed"
                        ? " green"
                        : status === "Issue"
                          ? ""
                          : " quiet")
                    }
                  >
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </span>
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
                  <small>{v.travel} min travel</small>
                  <div className="actions row">
                    {/* A proposed visit has no work to follow yet. */}
                    {["Confirmed", "In Progress", "Completed"].includes(
                      v.status,
                    ) && (
                      <button
                        className="secondary"
                        id={"progress-" + v.id}
                        onClick={() => setSelected(v.id)}
                      >
                        View progress
                      </button>
                    )}
                    <button className="text-button" onClick={() => open(r.id)}>
                      Open request
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
        {/* Both totals count the same visits: the ones listed. */}
        {visits.length > 0 && (
          <div className="operator-day-totals">
            <div>
              <Clock3 aria-hidden="true" size={20} />
              <strong>
                {Math.round(
                  (visits.reduce((n, v) => n + v.duration, 0) / 60) * 10,
                ) / 10}{" "}
                hrs
              </strong>
              <span>Work time</span>
            </div>
            <div>
              <CalendarDays aria-hidden="true" size={20} />
              <strong>{visits.reduce((n, v) => n + v.travel, 0)} min</strong>
              <span>Simulated travel</span>
            </div>
          </div>
        )}
        {!visits.length && (
          <div>
            <p>
              No visits on this date. Choose another date, or plan a visit from{" "}
              <button className="text-button" onClick={requests}>
                Requests
              </button>
              .
            </p>
            {next && (
              <button
                className="secondary"
                onClick={() => {
                  toHeading.current = true;
                  setDay(dayKey(next.start));
                }}
              >
                Next scheduled day
              </button>
            )}
          </div>
        )}
      </section>
      {v && (
        <section
          ref={panel}
          tabIndex={-1}
          aria-label="Visit progress"
          className="operator-progress"
        >
          <button
            className="text-button"
            onClick={() => {
              /* Back to the button that opened it, if it is still shown. */
              (
                document.getElementById("progress-" + v.id) ?? heading.current
              )?.focus();
              setSelected("");
            }}
          >
            Close progress
          </button>
          <JobWork s={s} provider="yousef" update={update} visit={v} />
        </section>
      )}
    </>
  );
}
