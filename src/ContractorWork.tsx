import { questionAnswers } from "./clarification";
import { useState, useRef, useEffect, type ReactNode } from "react";
import {
  type State,
  type Visit,
  providers,
  money,
  dateLabel,
  accountName,
} from "./model";
import {
  canWork,
  execute,
  saveOutcome,
  outcomes,
  dayKey,
  workStatus,
} from "./work";
import { respondToOffer } from "./dispatch";
import { storablePhotos, unreadableMessage } from "./photos";
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
  /* Which task is blocking Complete job, if any. Per-task, so the message and
     the focus target are the specific thing at fault. */
  const [outcomeError, setOutcomeError] = useState("");
  /* Which task's photo field rejected a file, so the message sits on that
     field rather than in a toast that leaves before it is read. */
  const [photoError, setPhotoError] = useState("");

  const v = visit,
    x = v.execution,
    r = s.requests.find((r) => r.id === v.requestId)!;
  const allowed = canWork(s, v, provider);
  const act = (action: "way" | "start" | "finish") =>
    update((d) => {
      execute(d, v.id, provider, action);
    });
  return (
    <section className="card panel work-detail">
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
          {/* One primary at a time: the badge above already says "On the
              Way" once pressed, so the button doesn't repeat it — it just
              disappears and Start job takes over as the primary. */}
          {!x?.startedAt && (
            <>
              {!x?.onWayAt && (
                <button className="primary" onClick={() => act("way")}>
                  On my way
                </button>
              )}
              <button
                className={x?.onWayAt ? "primary" : "secondary"}
                onClick={() => act("start")}
              >
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
          <details
            key={id}
            className="work-task"
            open={outcomeError === id ? true : undefined}
          >
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
                {!allowed ? (
                  <div className="field">
                    <span>Task outcome</span>
                    <strong>{o?.outcome || "Not recorded"}</strong>
                  </div>
                ) : (
                  <label
                    className={
                      "field" + (outcomeError === t.id ? " field-error" : "")
                    }
                    htmlFor={"outcome-" + t.id}
                  >
                    Task outcome
                    <select
                      id={"outcome-" + t.id}
                      value={o?.outcome || ""}
                      aria-invalid={outcomeError === t.id || undefined}
                      onChange={(e) => {
                        if (outcomeError === t.id) setOutcomeError("");
                        patch({ outcome: e.target.value });
                      }}
                    >
                      <option value="">Choose an outcome</option>
                      {outcomes.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    {outcomeError === t.id && (
                      <span className="field-message" role="alert">
                        Choose an outcome for this task before completing the
                        job.
                      </span>
                    )}
                  </label>
                )}
                <label className="field">
                  Task note (optional)
                  <textarea
                    readOnly={!allowed}
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
                      <label
                        className={
                          "field" + (photoError === id ? " field-error" : "")
                        }
                      >
                        Add {kind} photos (optional)
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            const { photos: images, rejected } =
                              await storablePhotos(files);
                            setPhotoError(rejected ? id : "");
                            if (!images.length) return;
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
                        {photoError === id && (
                          <span className="field-message" role="alert">
                            {unreadableMessage}
                          </span>
                        )}
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
            onClick={() => {
              const pending = v.taskIds.find((id) => !x.outcomes[id]?.outcome);
              if (pending) {
                setOutcomeError(pending);
                document.getElementById("outcome-" + pending)?.focus();
                return;
              }
              setOutcomeError("");
              setFinish(true);
            }}
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
      {/* No "Visit finished" heading here — the badge at the top of this
          card already says Completed (or Issue); this block adds the
          outcome detail the badge can't carry, not a second announcement
          of the same fact. */}
      {x?.finishedAt && (
        <div className="note contractor-success">
          <div className="contractor-check">✓</div>
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
  /* What the screen opens to: the thing that actually needs the contractor's
     attention right now, not a remembered tab. A running job wins outright;
     next, a single unambiguous offer is opened directly rather than making
     "View job" a mandatory extra click. Multiple offers or nothing urgent
     fall back to a list. Computed once at mount — after that, tabs and
     selection are the contractor's own navigation, not re-derived out from
     under them. */
  const runningAssignment = mine.find(
    (a) =>
      a.status === "Accepted" &&
      s.visits.some(
        (v) =>
          v.id === a.visitId &&
          v.execution?.startedAt &&
          !v.execution.finishedAt,
      ),
  );
  const offeredAssignments = mine.filter((a) => a.status === "Offered");
  const scheduledToday = mine.some(
    (a) =>
      a.status === "Accepted" &&
      s.visits.some((v) => v.id === a.visitId && dayKey(v.start) === today),
  );
  const [tab, setTab] = useState(
    runningAssignment
      ? "Today"
      : offeredAssignments.length
        ? "Offers"
        : scheduledToday
          ? "Today"
          : "Upcoming",
  );
  const [selected, setSelected] = useState(
    runningAssignment?.id ||
      (offeredAssignments.length === 1 ? offeredAssignments[0].id : ""),
  );
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
    // respondToOffer() already records declineReason on the assignment
    // draft it mutates — writing it again here was dead duplication.
    update(
      (d) => {
        respondToOffer(d, selected, status, reason);
      },
      status === "Accepted" ? "Job accepted" : "Offer declined",
    );
    setDecline(false);
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
              : // Today claims anything in progress regardless of its
                // scheduled date (an overrunning job shouldn't vanish); this
                // exclusion is what keeps that same visit from also showing
                // here if it was started ahead of its scheduled date.
                dayKey(v.start) > today &&
                !(v.execution?.startedAt && !v.execution.finishedAt)))
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
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {a && v && r ? (
        <>
          <button className="text-button" onClick={() => setSelected("")}>
            ← Back to your work
          </button>
          {/* Accepting used to swap in a full-screen "Job accepted!" receipt
              behind a View job click. It now drops straight into the job
              below (which already says "confirmation pending" via its own
              allowed-gate note when applicable) and the confirmation rides
              the ordinary toast instead — one fewer screen between deciding
              and doing the work. */}
          {a.status === "Offered" ? (
            <section className="card panel">
              <h2>{s.tasks.find((t) => v.taskIds.includes(t.id))?.summary}</h2>
              <p>
                {accountName(r.accountId)} · {r.city} · {dateLabel(v.start)}
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
          )}
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
                <section
                  className="card panel contractor-offer-card"
                  key={a.id}
                >
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
                    {accountName(r.accountId)} · {r.city} ·{" "}
                    {dateLabel(v.start)}
                  </p>
                  {/* Accepted-but-not-yet-startable visits (planning ahead,
                      before the day-of execution controls unlock) still
                      deserve the address — a contractor should be able to
                      see where tomorrow's job is without opening it. An
                      unaccepted offer stays city-only, matching the accept
                      decision it's meant to inform. */}
                  {a.status === "Accepted" && (
                    <a
                      className="text-button"
                      target="_blank"
                      rel="noreferrer"
                      href={
                        "https://www.google.com/maps/search/?api=1&query=" +
                        encodeURIComponent(r.address + ", " + r.city)
                      }
                    >
                      {r.address}, {r.city} · Navigate ↗
                    </a>
                  )}
                  <ul className="contractor-task-list">
                    {s.tasks
                      .filter((t) => v.taskIds.includes(t.id))
                      .map((t) => (
                        <li key={t.id}>{t.summary}</li>
                      ))}
                  </ul>
                  <p>
                    {v.duration} minutes ·{" "}
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
            <section className="card panel">
              <h2>
                {tab === "Today"
                  ? "You’re done for today."
                  : tab === "Offers"
                    ? "You’re all caught up."
                    : "Nothing scheduled yet."}
              </h2>
              <p>
                {tab === "Offers"
                  ? "New offers will appear here."
                  : tab === "Today"
                    ? "Check Upcoming for your next appointment."
                    : "New appointments will appear here once one is scheduled."}
              </p>
            </section>
          )}
          <details className="card panel">
            <summary>Past offers & completed work</summary>
            {mine
              .filter(
                (a) =>
                  ["Declined", "Expired"].includes(a.status) ||
                  (a.status === "Accepted" &&
                    !!s.visits.find((v) => v.id === a.visitId)?.execution
                      ?.finishedAt),
              )
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
