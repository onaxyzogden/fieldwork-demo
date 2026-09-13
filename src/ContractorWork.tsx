import { questionAnswers } from "./clarification";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { type State, type Visit, providers, money, dateLabel } from "./model";
import {
  canWork,
  execute,
  saveOutcome,
  outcomes,
  dayKey,
  workStatus,
} from "./work";
import { respondToOffer } from "./dispatch";
import { MessageThread } from "./NotificationUI";
function Sheet({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      className="work-sheet"
      ref={ref}
      onCancel={close}
      aria-label={title}
    >
      <div className="row between">
        <h3>{title}</h3>
        <button
          className="text-button"
          aria-label="Close dialog"
          onClick={close}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
type Props = {
  s: State;
  provider: string;
  update: (fn: (s: State) => void, msg?: string) => void;
};
export function JobWork({
  s,
  provider,
  update,
  visit,
}: Props & { visit: Visit }) {
  const [finish, setFinish] = useState(false);

  const v = visit,
    x = v.execution,
    r = s.requests.find((r) => r.id === v.requestId)!;
  const allowed = canWork(s, v, provider);
  const act = (action: "way" | "start" | "finish") =>
    update((d) => {
      execute(d, v.id, provider, action);
    });
  return (
    <section className="panel work-detail">
      <span className="badge">{workStatus(v)}</span>
      <h2>
        {s.tasks.find((t) => v.taskIds.includes(t.id))?.summary}
        {v.taskIds.length > 1 && ` + ${v.taskIds.length - 1} tasks`}
      </h2>
      <p>
        {r.address}, {r.city}
      </p>
      <p>
        {dateLabel(v.start)} · {v.duration} minutes
      </p>
      {x?.eta && <p>Simulated ETA: {dateLabel(x.eta)}</p>}
      {allowed && (
        <div className="actions wrap row">
          <a
            className="secondary"
            target="_blank"
            rel="noreferrer"
            href={
              "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(r.address + ", " + r.city)
            }
          >
            Navigate ↗
          </a>
          {!x?.startedAt && (
            <>
              <button
                className="secondary"
                disabled={!!x?.onWayAt}
                onClick={() => act("way")}
              >
                On my way
              </button>
              <button className="primary" onClick={() => act("start")}>
                Start job
              </button>
            </>
          )}
        </div>
      )}
      {!allowed && !x?.finishedAt && (
        <p className="note">
          Work controls become available after assignment acceptance and
          customer confirmation.
        </p>
      )}
      <h3>{v.taskIds.length} tasks in this visit</h3>
      {x?.startedAt && (
        <div className="contractor-progress">
          <p>
            {
              v.taskIds.filter((id) => x.outcomes[id]?.outcome === "Completed")
                .length
            }{" "}
            of {v.taskIds.length} completed
          </p>
          <progress
            aria-label="Completed tasks"
            max={v.taskIds.length}
            value={
              v.taskIds.filter((id) => x.outcomes[id]?.outcome === "Completed")
                .length
            }
          />
        </div>
      )}
      {v.taskIds.map((id) => {
        const t = s.tasks.find((t) => t.id === id);
        if (!t) return null;
        const o = x?.outcomes[id];
        const patch = (p: Parameters<typeof saveOutcome>[4]) =>
          update((d) => {
            saveOutcome(d, v.id, provider, id, p);
          });
        return (
          <details key={id} className="work-task">
            <summary>
              {o?.outcome === "Completed" ? "✓ " : ""}
              {t.summary}
              <small>{o?.outcome || "View details"}</small>
            </summary>
            <p>{t.description}</p>
            <dl className="task-answers">
              {questionAnswers(t).map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="work-photos">
              {t.photos.map((p, i) => (
                <a href={p} target="_blank" rel="noreferrer" key={i}>
                  <img src={p} alt={`${t.summary} reference ${i + 1}`} />
                </a>
              ))}
            </div>
            {x?.startedAt && (
              <>
                <label className="field">
                  Task outcome
                  <select
                    disabled={!allowed}
                    value={o?.outcome || ""}
                    onChange={(e) => patch({ outcome: e.target.value })}
                  >
                    <option value="">Choose an outcome</option>
                    {outcomes.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Task note (optional)
                  <textarea
                    disabled={!allowed}
                    value={o?.note || ""}
                    onChange={(e) => patch({ note: e.target.value })}
                  />
                </label>
                {(["before", "after"] as const).map((kind) => (
                  <div key={kind}>
                    <div className="work-photos">
                      {o?.[kind].map((p, i) => (
                        <img
                          key={i}
                          src={p}
                          alt={`${kind} work photo ${i + 1}`}
                        />
                      ))}
                    </div>
                    {allowed && (
                      <label className="field">
                        Add {kind} photos (optional)
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            const images = await Promise.all(
                              files.map(
                                (f) =>
                                  new Promise<string>((resolve) => {
                                    const reader = new FileReader();
                                    reader.onload = () =>
                                      resolve(String(reader.result));
                                    reader.readAsDataURL(f);
                                  }),
                              ),
                            );
                            update((d) => {
                              const current =
                                d.visits.find((v) => v.id === visit.id)
                                  ?.execution?.outcomes[id]?.[kind] || [];
                              saveOutcome(d, v.id, provider, id, {
                                [kind]: [...current, ...images],
                              });
                            });
                          }}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </>
            )}
          </details>
        );
      })}
      <MessageThread
        s={s}
        visit={v}
        sender={provider === "yousef" ? "Operator" : provider}
        update={update}
      />
      {allowed && x?.startedAt && (
        <>
          <button
            className="primary"
            disabled={!v.taskIds.every((id) => !!x.outcomes[id]?.outcome)}
            onClick={() => setFinish(true)}
          >
            Complete job
          </button>
          {finish && (
            <Sheet title="Ready to finish?" close={() => setFinish(false)}>
              <p>
                {
                  Object.values(x.outcomes).filter(
                    (o) => o.outcome === "Completed",
                  ).length
                }{" "}
                of {v.taskIds.length} tasks completed. Unresolved tasks go to
                the operator for follow-up.
              </p>
              <button
                className="primary"
                onClick={() => {
                  act("finish");
                  setFinish(false);
                }}
              >
                Finish job
              </button>
              <button className="text-button" onClick={() => setFinish(false)}>
                Keep working
              </button>
            </Sheet>
          )}
        </>
      )}
      {x?.finishedAt && (
        <div className="note contractor-success">
          <div className="contractor-check">✓</div>
          <h3>Visit finished</h3>
          <p>
            {Object.values(x.outcomes).some((o) => o.outcome !== "Completed")
              ? "Unresolved tasks have been flagged for operator follow-up."
              : "Job completed. Nice work."}{" "}
            Notifications are simulated. No payment has been processed.
          </p>
        </div>
      )}
    </section>
  );
}
export default function ContractorWork({
  s,
  provider,
  update,
  openVisit,
}: Props & { openVisit?: string }) {
  const mine = s.assignments.filter((a) => a.providerId === provider);
  const today = dayKey(s.clock);
  const active = mine.some(
    (a) =>
      a.status === "Accepted" &&
      s.visits.some(
        (v) =>
          v.id === a.visitId &&
          v.execution?.startedAt &&
          !v.execution.finishedAt,
      ),
  );
  const [tab, setTab] = useState(
    active
      ? "Today"
      : mine.some((a) => a.status === "Offered")
        ? "Offers"
        : mine.some(
              (a) =>
                a.status === "Accepted" &&
                s.visits.some(
                  (v) => v.id === a.visitId && dayKey(v.start) === today,
                ),
            )
          ? "Today"
          : "Upcoming",
  );
  const [selected, setSelected] = useState("");
  useEffect(() => {
    if (openVisit) {
      const assignment =
        mine.find(
          (a) =>
            a.visitId === openVisit &&
            ["Accepted", "Offered"].includes(a.status),
        ) || mine.find((a) => a.visitId === openVisit);
      if (assignment) setSelected(assignment.id);
    }
  }, [openVisit, provider]);
  const [decline, setDecline] = useState(false);
  const [reason, setReason] = useState("");
  const [accepted, setAccepted] = useState(false);
  const a = mine.find((a) => a.id === selected),
    v = s.visits.find((v) => v.id === a?.visitId),
    r = s.requests.find((r) => r.id === v?.requestId);
  const nextAssignment = mine
    .filter(
      (a) =>
        a.status === "Accepted" &&
        a.id !== selected &&
        s.visits.some(
          (v) =>
            v.id === a.visitId &&
            v.status === "Confirmed" &&
            !v.execution?.finishedAt &&
            dayKey(v.start) === today,
        ),
    )
    .sort((a, b) =>
      s.visits
        .find((v) => v.id === a.visitId)!
        .start.localeCompare(s.visits.find((v) => v.id === b.visitId)!.start),
    )[0];
  const respond = (status: "Accepted" | "Declined") => {
    update((d) => {
      const offer = d.assignments.find((a) => a.id === selected);
      if (
        respondToOffer(d, selected, status, reason) &&
        offer &&
        status === "Declined"
      )
        offer.declineReason = reason;
    });
    setDecline(false);
    setAccepted(status === "Accepted");
  };
  const assignments = mine
    .filter((a) => {
      const v = s.visits.find((v) => v.id === a.visitId);
      return (
        v &&
        (tab === "Offers"
          ? a.status === "Offered"
          : a.status === "Accepted" &&
            (tab === "Today"
              ? dayKey(v.start) === today ||
                (!!v.execution?.startedAt && !v.execution.finishedAt)
              : dayKey(v.start) > today))
      );
    })
    .sort(
      (a, b) =>
        +new Date(s.visits.find((v) => v.id === a.visitId)!.start) -
        +new Date(s.visits.find((v) => v.id === b.visitId)!.start),
    );
  return (
    <div className="contractor-wrap">
      <h1>Your Work</h1>
      <p>What’s next, all in one place.</p>
      <div className="segmented">
        {["Offers", "Today", "Upcoming"].map((t) => (
          <button
            key={t}
            className={tab === t ? "chosen" : ""}
            onClick={() => {
              setTab(t);
              setSelected("");
              setAccepted(false);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {a && v && r ? (
        <>
          <button
            className="text-button"
            onClick={() => {
              setSelected("");
              setAccepted(false);
            }}
          >
            ← Back to your work
          </button>
          {accepted && a.status === "Accepted" && (
            <section className="note contractor-success">
              <div className="contractor-check">✓</div>
              <h2>Job accepted!</h2>
              <p>
                {v.status === "Confirmed"
                  ? "Your appointment is confirmed."
                  : "Customer confirmation is pending quote/payment requirements."}
              </p>
              <button className="secondary" onClick={() => setAccepted(false)}>
                View job
              </button>
            </section>
          )}
          {!(accepted && a.status === "Accepted") &&
            (a.status === "Offered" ? (
              <section className="panel">
                <h2>
                  {s.tasks.find((t) => v.taskIds.includes(t.id))?.summary}
                </h2>
                <p>
                  {r.city} · {dateLabel(v.start)}
                </p>
                <p>
                  {v.duration} minutes · {v.taskIds.length} tasks
                </p>
                <h3 className="contractor-pay">Your pay: {money(a.pay)} CAD</h3>
                <p>
                  Offer expires {dateLabel(new Date(a.expiresAt).toISOString())}
                </p>
                {v.taskIds.map((id) => {
                  const t = s.tasks.find((t) => t.id === id)!;
                  return (
                    <details className="work-task" key={id}>
                      <summary>{t.summary}</summary>
                      <p>{t.description}</p>
                      <dl className="task-answers">
                        {questionAnswers(t).map((row) => (
                          <div key={row.key}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                      <p>
                        {t.restricted ? "Specialist eligibility required" : ""}
                      </p>
                      <div className="work-photos">
                        {t.photos.map((p, i) => (
                          <a href={p} target="_blank" rel="noreferrer" key={i}>
                            <img src={p} alt={`Task reference ${i + 1}`} />
                          </a>
                        ))}
                      </div>
                    </details>
                  );
                })}
                <MessageThread
                  s={s}
                  visit={v}
                  sender={provider}
                  update={update}
                />
                <div className="row actions">
                  <button
                    className="primary grow contractor-accept"
                    onClick={() => respond("Accepted")}
                  >
                    Accept job
                  </button>
                  <button
                    className="secondary grow"
                    onClick={() => setDecline(true)}
                  >
                    Decline
                  </button>
                </div>
                {decline && (
                  <Sheet
                    title="Why are you declining?"
                    close={() => setDecline(false)}
                  >
                    <label className="field">
                      Reason (optional)
                      <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      >
                        <option value="">Prefer not to say</option>
                        {[
                          "Not available",
                          "Too far",
                          "Pay doesn’t work",
                          "Outside my skill set",
                          "Other",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="primary"
                      onClick={() => respond("Declined")}
                    >
                      Decline job
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setDecline(false)}
                    >
                      Cancel
                    </button>
                  </Sheet>
                )}
              </section>
            ) : a.status === "Accepted" ? (
              <>
                <JobWork s={s} provider={provider} update={update} visit={v} />
                {v.execution?.finishedAt && (
                  <button
                    className="primary"
                    onClick={() => {
                      setSelected(nextAssignment?.id || "");
                      setTab("Today");
                    }}
                  >
                    {nextAssignment ? "Next job" : "Done for today"}
                  </button>
                )}
              </>
            ) : (
              <p className="note">
                This offer is {a.status.toLowerCase()}. The operator will
                coordinate the next step.
              </p>
            ))}
        </>
      ) : (
        <>
          {assignments
            .filter(
              (a) =>
                !s.visits.find((v) => v.id === a.visitId)?.execution
                  ?.finishedAt,
            )
            .map((a) => {
              const v = s.visits.find((v) => v.id === a.visitId)!,
                r = s.requests.find((r) => r.id === v.requestId)!;
              return (
                <section className="panel contractor-offer-card" key={a.id}>
                  {s.tasks.find(
                    (t) => v.taskIds.includes(t.id) && t.photos.length,
                  )?.photos[0] && (
                    <img
                      className="contractor-job-thumb"
                      src={
                        s.tasks.find(
                          (t) => v.taskIds.includes(t.id) && t.photos.length,
                        )!.photos[0]
                      }
                      alt="Job reference"
                    />
                  )}
                  <span className="badge">
                    {a.status === "Offered" ? "New offer" : workStatus(v)}
                  </span>
                  <h2>
                    {s.tasks.find((t) => v.taskIds.includes(t.id))?.summary}
                  </h2>
                  <p>
                    {r.city} · {dateLabel(v.start)}
                  </p>
                  <p>
                    {v.taskIds.length} tasks · {v.duration} minutes ·{" "}
                    {s.tasks
                      .filter((t) => v.taskIds.includes(t.id))
                      .reduce((n, t) => n + t.photos.length, 0)}{" "}
                    photos
                  </p>
                  <h3 className="contractor-pay">Your pay: {money(a.pay)}</h3>
                  <button className="primary" onClick={() => setSelected(a.id)}>
                    View job
                  </button>
                </section>
              );
            })}
          {!assignments.some(
            (a) =>
              !s.visits.find((v) => v.id === a.visitId)?.execution?.finishedAt,
          ) && (
            <section className="panel">
              <h2>
                {tab === "Today"
                  ? "You’re done for today."
                  : "You’re all caught up."}
              </h2>
              <p>
                {tab === "Offers"
                  ? "New offers will appear here."
                  : "Check your upcoming work for the next appointment."}
              </p>
            </section>
          )}
          <details className="panel">
            <summary>Past offers & completed work</summary>
            {mine
              .filter((a) => a.status !== "Offered")
              .map((a) => (
                <button
                  className="queue-item"
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                >
                  {
                    s.tasks.find((t) =>
                      s.visits
                        .find((v) => v.id === a.visitId)
                        ?.taskIds.includes(t.id),
                    )?.summary
                  }{" "}
                  · {a.status}
                  {a.declineReason && ` · ${a.declineReason}`}
                </button>
              ))}
          </details>
        </>
      )}
    </div>
  );
}
