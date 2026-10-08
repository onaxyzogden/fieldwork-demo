import { questionAnswers } from "./clarification";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { type State, type Visit, dateLabel } from "./model";
import {
  canWork,
  execute,
  saveOutcome,
  outcomes,
  needsNote,
  workStatus,
} from "./work";
import { storablePhotos, unreadableMessage } from "./photos";
import { MessageThread } from "./NotificationUI";
/**
 * The job itself: checklist, photos, outcomes and the finish sheet. The
 * operator runs it too when they do the work themselves, so it lives apart
 * from the contractor's workspace and doesn't bring that along (ADR 075).
 */
export function Sheet({
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
export type Props = {
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
  /* Which task has an exception outcome and no note yet (needsNote). */
  const [noteError, setNoteError] = useState("");

  const v = visit,
    x = v.execution,
    r = s.requests.find((r) => r.id === v.requestId)!;
  const allowed = canWork(s, v, provider);
  /* Accepted, but the customer has yet to confirm: the visit is still
     Proposed, which is the operator's word for it, not the contractor's
     (ADR 080). */
  const awaiting =
    v.status === "Proposed" &&
    s.assignments.some(
      (a) =>
        a.visitId === v.id &&
        a.providerId === provider &&
        a.status === "Accepted",
    );
  const act = (action: "way" | "start" | "finish") =>
    update((d) => {
      execute(d, v.id, provider, action);
    });
  return (
    <section className="card panel work-detail">
      <span className="badge">{awaiting ? "Accepted" : workStatus(v)}</span>
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
          {awaiting
            ? "Work controls open once the customer confirms the booking."
            : "Work controls become available after assignment acceptance and customer confirmation."}
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
            open={outcomeError === id || noteError === id ? true : undefined}
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
                <label
                  className={"field" + (noteError === id ? " field-error" : "")}
                >
                  {o?.outcome && o.outcome !== "Completed"
                    ? "What is left to do"
                    : "Task note (optional)"}
                  <textarea
                    id={"note-" + id}
                    readOnly={!allowed}
                    value={o?.note || ""}
                    aria-invalid={noteError === id || undefined}
                    onChange={(e) => {
                      if (noteError === id) setNoteError("");
                      patch({ note: e.target.value });
                    }}
                  />
                  {noteError === id && (
                    <span className="field-message" role="alert">
                      Say what is left to do, so the operator can follow it up.
                    </span>
                  )}
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
              const unnoted = v.taskIds.find((id) => needsNote(x.outcomes[id]));
              if (unnoted) {
                setNoteError(unnoted);
                document.getElementById("note-" + unnoted)?.focus();
                return;
              }
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
