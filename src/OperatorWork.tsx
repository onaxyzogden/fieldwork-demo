import { useState, type ReactNode } from "react";
import { type State, providers, dateLabel } from "./model";
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
    (v) => dayKey(v.start) === dayKey(s.clock) && v.status !== "Cancelled",
  );
  const cards = (list: typeof needs) =>
    list.map((r) => (
      <button className="queue-item" key={r.id} onClick={() => open(r.id)}>
        <strong>
          {s.visits.find((v) => v.requestId === r.id && workIssue(v))
            ? "Job needs follow-up"
            : requestDispatch(s, r.id) || r.status}
        </strong>
        <p>
          {r.name} · {r.city} ·{" "}
          {s.tasks.filter((t) => t.requestId === r.id && !t.mergedInto).length}{" "}
          tasks
        </p>
        <span>
          {bucket(s, r.id) === "Waiting"
            ? "View progress"
            : requestDispatch(s, r.id).includes("Needs reassignment")
              ? "Reassign →"
              : "Review →"}
        </span>
      </button>
    ));
  return (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">YOUR NEXT DECISION</span>
          <h1>Needs your attention</h1>
          <p>Review, assign, and keep today moving.</p>
        </div>
      </div>
      <section className="panel">
        <h2>{needs.length} items need you</h2>
        {cards(needs)}
        {!needs.length && <p>You’re all caught up.</p>}
      </section>
      <details className="panel">
        <summary>Waiting · {waiting.length} requests</summary>
        <p>No action needed while a response is pending.</p>
        {cards(waiting)}
      </details>
      <section className="panel">
        <h2>Today</h2>
        <p>
          {visits.length} visits ·{" "}
          {new Set(visits.map((v) => v.providerId)).size} providers ·{" "}
          {visits.reduce((n, v) => n + v.duration, 0) / 60} hours of work ·{" "}
          {visits.reduce((n, v) => n + v.travel, 0)} min driving
        </p>
        <button className="primary" onClick={today}>
          View Today
        </button>
      </section>
    </>
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
