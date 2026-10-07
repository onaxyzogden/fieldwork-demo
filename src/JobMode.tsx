import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, MessageSquare } from "lucide-react";
import { questionAnswers } from "./clarification";
import { type State, type Visit, dateLabel } from "./model";
import {
  canWork,
  execute,
  needsNote,
  openTasks,
  outcomes,
  saveOutcome,
} from "./work";
import { storablePhoto, unreadableMessage } from "./photos";
import { MessageThread } from "./NotificationUI";
import { When } from "./When";
import "./onsite.css";

/**
 * Today's job, as it is done: one thing on the screen at a time.
 *
 * Arrival (on my way, start), then one task per screen — a before photo, an
 * after photo, and one tap for "Done as described" — then finish. Anything
 * other than done asks for a few words, because the operator has to follow it
 * up and an outcome alone does not say what is left (needsNote() in work.ts,
 * which finishing also enforces). Tasks come in order; "Skip for now" leaves
 * one open, and the finish screen lists whatever is.
 *
 * The same full-screen layer as the walkthrough capture (onsite.css), so the
 * glance card and tabs are not competing with the job.
 */
type Update = (fn: (d: State) => void, msg?: string) => void;
const EXCEPTIONS = outcomes.filter((o) => o !== "Completed");

export default function JobMode({
  s,
  provider,
  visit: v,
  update,
  exit,
  next,
  nextLabel,
}: {
  s: State;
  provider: string;
  visit: Visit;
  update: Update;
  /** Back to the list of work, leaving the job as it is. */
  exit: () => void;
  /** After finishing: the next job today, or the end of the day. */
  next: () => void;
  nextLabel: string;
}) {
  const x = v.execution;
  const ref = useRef<HTMLDivElement>(null);
  /* Where the working screens start: the first task still open, or the
     finish screen when there is none. */
  const firstOpen = () => {
    const open = openTasks(v)[0];
    return open ? v.taskIds.indexOf(open) : v.taskIds.length;
  };
  const [at, setAt] = useState(firstOpen);
  const [messages, setMessages] = useState(false);
  const go = (i: number) => {
    setAt(i);
    ref.current?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    if (ref.current?.contains(document.activeElement)) return;
    ref.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [at, !!x?.startedAt, !!x?.finishedAt]);
  useEffect(() => {
    if (!messages) return;
    const thread = document.getElementById(
      "messages-" + v.id,
    ) as HTMLDetailsElement | null;
    if (thread) {
      thread.open = true;
      thread.scrollIntoView({ block: "start" });
    }
  }, [messages, v.id]);

  const received = (v.messages || []).filter(
    (m) => m.sender !== provider,
  ).length;
  const head = (label: string) => (
    <header className="onsite-head">
      <span>{label}</span>
      <span className="row">
        <button
          className="text-button"
          aria-expanded={messages}
          onClick={() => setMessages(!messages)}
        >
          <MessageSquare size={16} /> Messages
          {received ? ` · ${received}` : ""}
        </button>
        {/* Always a way out: a running job is where the work screen
            reopens anyway, so leaving it loses nothing. */}
        <button className="text-button" onClick={exit}>
          Close
        </button>
      </span>
    </header>
  );
  const thread = messages && (
    <MessageThread s={s} visit={v} sender={provider} update={update} />
  );

  return (
    <div
      className="onsite"
      role="dialog"
      aria-modal="true"
      aria-label="Job"
      ref={ref}
    >
      {x?.finishedAt ? (
        <Finished
          s={s}
          visit={v}
          head={head("Job finished")}
          thread={thread}
          next={next}
          nextLabel={nextLabel}
        />
      ) : !x?.startedAt ? (
        <Arrival
          s={s}
          visit={v}
          provider={provider}
          update={update}
          head={head("Today’s job")}
          thread={thread}
          started={() => go(0)}
        />
      ) : at < v.taskIds.length ? (
        <TaskStep
          key={v.taskIds[at]}
          s={s}
          visit={v}
          provider={provider}
          update={update}
          at={at}
          head={head(`Task ${at + 1} of ${v.taskIds.length}`)}
          thread={thread}
          back={at ? () => go(at - 1) : undefined}
          advance={() => go(at + 1)}
        />
      ) : (
        <FinishStep
          s={s}
          visit={v}
          provider={provider}
          update={update}
          head={head("Finish")}
          thread={thread}
          open={go}
        />
      )}
    </div>
  );
}

function Arrival({
  s,
  visit: v,
  provider,
  update,
  head,
  thread,
  started,
}: {
  s: State;
  visit: Visit;
  provider: string;
  update: Update;
  head: ReactNode;
  thread: ReactNode;
  started: () => void;
}) {
  const x = v.execution;
  const r = s.requests.find((r) => r.id === v.requestId);
  const tasks = s.tasks.filter((t) => v.taskIds.includes(t.id));
  const allowed = canWork(s, v, provider);
  const act = (action: "way" | "start") =>
    update((d) => {
      execute(d, v.id, provider, action);
    });
  return (
    <div className="onsite-body">
      {head}
      <h1 tabIndex={-1}>{r?.address}</h1>
      <p className="onsite-hint">
        {r?.city} · <When clock={s.clock} at={v.start} lead="Starts in" /> ·{" "}
        {v.duration} minutes
        {x?.eta ? ` · ETA ${dateLabel(x.eta)}` : ""}
      </p>
      <ul className="job-list">
        {tasks.map((t) => (
          <li key={t.id}>{t.summary}</li>
        ))}
      </ul>
      {thread}
      {allowed ? (
        <div className="onsite-bar">
          {!x?.onWayAt ? (
            <button className="primary full" onClick={() => act("way")}>
              On my way
            </button>
          ) : (
            <button
              className="primary full"
              onClick={() => {
                act("start");
                started();
              }}
            >
              Start job
            </button>
          )}
          <div className="row job-secondary">
            <a
              className="secondary grow"
              target="_blank"
              rel="noreferrer"
              href={
                "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(`${r?.address}, ${r?.city}`)
              }
            >
              Navigate ↗
            </a>
            {!x?.onWayAt && (
              <button
                className="text-button"
                onClick={() => {
                  act("start");
                  started();
                }}
              >
                Already here? Start
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="note">
          Work controls become available after the customer confirms.
        </p>
      )}
    </div>
  );
}

function TaskStep({
  s,
  visit: v,
  provider,
  update,
  at,
  head,
  thread,
  back,
  advance,
}: {
  s: State;
  visit: Visit;
  provider: string;
  update: Update;
  at: number;
  head: ReactNode;
  thread: ReactNode;
  back?: () => void;
  advance: () => void;
}) {
  const id = v.taskIds[at];
  const t = s.tasks.find((t) => t.id === id);
  const o = v.execution?.outcomes[id];
  const [different, setDifferent] = useState(
    !!o?.outcome && o.outcome !== "Completed",
  );
  const [picked, setPicked] = useState(
    o?.outcome && o.outcome !== "Completed" ? o.outcome : "",
  );
  const [note, setNote] = useState(o?.note || "");
  const [errors, setErrors] = useState<{ pick?: boolean; note?: boolean }>({});
  const [rejected, setRejected] = useState("");
  const answers = t ? questionAnswers(t) : [];

  const save = (patch: Parameters<typeof saveOutcome>[4]) =>
    update((d) => {
      saveOutcome(d, v.id, provider, id, patch);
    });
  const shoot = async (kind: "before" | "after", file?: File) => {
    if (!file) return;
    const stored = await storablePhoto(file);
    setRejected(stored ? "" : kind);
    if (!stored) return;
    update((d) => {
      const current =
        d.visits.find((x) => x.id === v.id)?.execution?.outcomes[id]?.[kind] ||
        [];
      saveOutcome(d, v.id, provider, id, { [kind]: [...current, stored] });
    });
  };
  const done = () => {
    save({ outcome: "Completed" });
    advance();
  };
  const saveDifferent = () => {
    const missing = {
      pick: !picked,
      note: needsNote({
        outcome: picked || "x",
        note,
        before: [],
        after: [],
      }),
    };
    setErrors(missing);
    if (missing.pick || missing.note) return;
    save({ outcome: picked, note: note.trim() });
    advance();
  };

  return (
    <div className="onsite-body">
      {head}
      <h1 tabIndex={-1}>{t?.summary}</h1>
      {t?.description && <p className="onsite-hint">{t.description}</p>}
      {(!!answers.length || !!t?.photos.length) && (
        <details className="job-details">
          <summary>Details from the customer</summary>
          {!!answers.length && (
            <dl className="task-answers">
              {answers.map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {!!t?.photos.length && (
            <div className="photos">
              {t.photos.map((p, i) => (
                <img key={i} src={p} alt={`${t.summary} reference ${i + 1}`} />
              ))}
            </div>
          )}
        </details>
      )}
      {thread}

      <div className="job-shots">
        {(["before", "after"] as const).map((kind) => (
          <div key={kind}>
            <label
              className={
                "secondary onsite-shoot" +
                (rejected === kind ? " field-error" : "")
              }
            >
              <Camera size={20} />
              {kind === "before" ? "Before" : "After"}
              {o?.[kind].length ? ` · ${o[kind].length}` : ""}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={async (e) => {
                  await shoot(kind, e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {!!o?.[kind].length && (
              <div className="photos">
                {o[kind].map((p, i) => (
                  <img key={i} src={p} alt={`${kind} photo ${i + 1}`} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {rejected && (
        <span className="field-message" role="alert">
          {unreadableMessage}
        </span>
      )}

      {different ? (
        <>
          <fieldset
            className={"job-outcomes" + (errors.pick ? " field-error" : "")}
          >
            <legend>What happened?</legend>
            <div>
              {EXCEPTIONS.map((e) => (
                <button
                  key={e}
                  aria-pressed={picked === e}
                  onClick={() => {
                    setPicked(e);
                    setErrors({ ...errors, pick: false });
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
            {errors.pick && (
              <span className="field-message" role="alert">
                Choose what happened.
              </span>
            )}
          </fieldset>
          <label className={"field" + (errors.note ? " field-error" : "")}>
            What is left to do
            <textarea
              value={note}
              rows={3}
              placeholder="A few words for the operator. Tap the mic to talk."
              aria-invalid={errors.note || undefined}
              onChange={(e) => {
                setNote(e.target.value);
                setErrors({ ...errors, note: false });
              }}
            />
            {errors.note && (
              <span className="field-message" role="alert">
                Say what is left to do, so the operator can follow it up.
              </span>
            )}
          </label>
          <div className="onsite-bar">
            <button className="primary full" onClick={saveDifferent}>
              Save &amp; next
            </button>
            <div className="row job-secondary">
              <button
                className="text-button"
                onClick={() => setDifferent(false)}
              >
                It was done after all
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="onsite-bar">
          <button
            className="primary full"
            aria-pressed={o?.outcome === "Completed" || undefined}
            onClick={done}
          >
            Done as described
          </button>
          <div className="row job-secondary">
            {back && (
              <button className="text-button" onClick={back}>
                Back
              </button>
            )}
            <button
              className="text-button grow"
              onClick={() => setDifferent(true)}
            >
              Something’s different
            </button>
            {!o?.outcome && (
              <button className="text-button" onClick={advance}>
                Skip for now
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FinishStep({
  s,
  visit: v,
  provider,
  update,
  head,
  thread,
  open,
}: {
  s: State;
  visit: Visit;
  provider: string;
  update: Update;
  head: ReactNode;
  thread: ReactNode;
  open: (i: number) => void;
}) {
  const x = v.execution;
  const left = openTasks(v);
  const done = v.taskIds.filter(
    (id) => x?.outcomes[id]?.outcome === "Completed",
  ).length;
  return (
    <div className="onsite-body">
      {head}
      <h1 tabIndex={-1}>
        {done} of {v.taskIds.length} done
      </h1>
      <ul className="job-list job-summary">
        {v.taskIds.map((id, i) => {
          const t = s.tasks.find((t) => t.id === id);
          const outcome = x?.outcomes[id]?.outcome;
          return (
            <li key={id}>
              <button className="text-button" onClick={() => open(i)}>
                <strong>{t?.summary}</strong>
                <small>{outcome || "Not done yet"}</small>
              </button>
            </li>
          );
        })}
      </ul>
      {thread}
      <div className="onsite-bar">
        {left.length ? (
          <button
            className="primary full"
            onClick={() => open(v.taskIds.indexOf(left[0]))}
          >
            Do the next open task
          </button>
        ) : (
          <>
            {done < v.taskIds.length && (
              <p className="onsite-hint">
                Anything not done as described goes to the operator.
              </p>
            )}
            <button
              className="primary full"
              onClick={() =>
                update((d) => {
                  execute(d, v.id, provider, "finish");
                })
              }
            >
              Finish job
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Finished({
  visit: v,
  head,
  thread,
  next,
  nextLabel,
}: {
  s: State;
  visit: Visit;
  head: ReactNode;
  thread: ReactNode;
  next: () => void;
  nextLabel: string;
}) {
  const unresolved = Object.values(v.execution?.outcomes || {}).some(
    (o) => o.outcome !== "Completed",
  );
  return (
    <div className="onsite-body">
      {head}
      <h1 tabIndex={-1}>{unresolved ? "Job finished" : "Job done"}</h1>
      <p className="onsite-hint">
        {unresolved
          ? "Unresolved tasks have gone to the operator for follow-up."
          : "Nice work."}{" "}
        Notifications are simulated. No payment has been processed.
      </p>
      {thread}
      <div className="onsite-bar">
        <button className="primary full" onClick={next}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
