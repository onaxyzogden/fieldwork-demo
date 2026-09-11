import React, { useEffect, useRef, useState } from "react";
import {
  type State,
  type Request,
  type Task,
  uid,
  classify,
  instantEligible,
  dateLabel,
  log,
} from "./model";
import { getIssue } from "./clarification";
import {
  entryTasks,
  taskLabel,
  validAddress,
  missingQuestions,
  completeEntry,
  intakeOptions,
  preferenceSignature,
} from "./intake";
type Props = {
  s: State;
  r: Request;
  update: (fn: (d: State) => void, msg?: string) => void;
  notify: (text: string) => void;
  photos: (t: Task) => React.ReactNode;
  questions: (t: Task, change: (p: Partial<Task>) => void) => React.ReactNode;
  pay: (start: string) => void;
  view: () => void;
};
export default function CustomerIntake({
  s,
  r,
  update,
  notify,
  photos,
  questions,
  pay,
  view,
}: Props) {
  const tasks = entryTasks(s, r.id),
    all = s.tasks.filter((t) => t.requestId === r.id && !t.mergedInto);
  const done = r.status !== "Draft",
    screen = done ? "done" : r.intakeScreen || "tasks";
  const editing =
    r.editingTaskId === null
      ? undefined
      : all.find((t) => t.id === r.editingTaskId) ||
        all.find((t) => t.entryStage !== "done");
  const referral = tasks.some(
    (t) => getIssue(t.description).availability === "Referral only",
  );
  const options = intakeOptions(s, r),
    signature = preferenceSignature(r, tasks),
    selected = r.preferredSlot;
  const selectionValid =
    !!selected &&
    selected.signature === signature &&
    options.some(
      (o) =>
        o.start === selected.start &&
        o.providerId === selected.providerId &&
        o.duration === selected.duration,
    );
  const instant = instantEligible(tasks) && options.length > 0;
  const [removed, setRemoved] = useState<{ task: Task; index: number } | null>(
      null,
    ),
    [more, setMore] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    editor = useRef<HTMLTextAreaElement>(null);
  const patchRequest = (patch: Partial<Request>) =>
    update((d) =>
      Object.assign(
        d.requests.find((x) => x.id === r.id)!,
        patch,
      ),
    );
  const patchTask = (id: string, patch: Partial<Task>) =>
    update((d) =>
      Object.assign(
        d.tasks.find((t) => t.id === id)!,
        patch,
      ),
    );
  useEffect(() => {
    if (selected && !selectionValid && !done)
      patchRequest({ preferredSlot: undefined, timing: "Weekdays · flexible" });
  }, [signature, selectionValid, done]);
  useEffect(() => {
    if (more) dialog.current?.showModal();
    else dialog.current?.close();
  }, [more]);
  useEffect(() => {
    if (screen === "tasks" && editing?.entryStage !== "details")
      editor.current?.focus();
  }, [editing?.id, screen]);
  const choose = (o: (typeof options)[number]) => {
    patchRequest({
      preferredSlot: {
        start: o.start,
        providerId: o.providerId,
        duration: o.duration,
        signature,
      },
      timing: dateLabel(o.start),
    });
    setMore(false);
  };
  const open = (t: Task) =>
    patchRequest({ editingTaskId: t.id, intakeScreen: "tasks" });
  const add = () => {
    const empty = all.find((t) => !t.description.trim());
    if (empty) {
      open(empty);
      return;
    }
    const id = uid();
    update((d) => {
      d.tasks.push({
        id,
        requestId: r.id,
        description: "",
        ...classify(""),
        photos: [],
        answers: {},
        entryStage: "description",
      });
      d.requests.find((x) => x.id === r.id)!.editingTaskId = id;
    });
  };
  const remove = (t: Task) => {
    setRemoved({
      task: structuredClone(t),
      index: s.tasks.findIndex((x) => x.id === t.id),
    });
    update((d) => {
      d.tasks = d.tasks.filter((x) => x.id !== t.id);
      const req = d.requests.find((x) => x.id === r.id)!;
      req.editingTaskId = null;
      req.preferredSlot = undefined;
    });
  };
  const complete = (t: Task, uncertain = false) => {
    if (!uncertain && missingQuestions(t).length) {
      notify("Answer the remaining questions, or mark them Not sure.");
      return;
    }
    update((d) => {
      completeEntry(
        d.tasks.find((x) => x.id === t.id)!,
        uncertain,
      );
      d.requests.find((x) => x.id === r.id)!.editingTaskId = null;
    });
  };
  const advance = () => {
    const photoOnly = all.find((t) => !t.description.trim() && t.photos.length);
    if (photoOnly) {
      open(photoOnly);
      notify("Describe the task for these photos before continuing.");
      return;
    }
    if (!tasks.length) {
      notify("Add a task before continuing.");
      if (!all.length) add();
      return;
    }
    const unfinished = tasks.find(
      (t) => t.entryStage !== "done" || missingQuestions(t).length,
    );
    if (unfinished) {
      update((d) => {
        d.tasks.find((t) => t.id === unfinished.id)!.entryStage = "details";
        d.requests.find((x) => x.id === r.id)!.editingTaskId = unfinished.id;
      });
      notify("Finish these details before choosing a time.");
      return;
    }
    update((d) => {
      d.tasks = d.tasks.filter(
        (t) => t.requestId !== r.id || !!t.description.trim(),
      );
      Object.assign(
        d.requests.find((x) => x.id === r.id)!,
        { intakeScreen: "booking", editingTaskId: null },
      );
    });
  };
  const submit = () => {
    if (!validAddress(r)) {
      notify(
        "Enter a street address, municipality, and valid Canadian postal code.",
      );
      return;
    }
    if (tasks.some((t) => t.entryStage !== "done")) {
      patchRequest({ intakeScreen: "tasks" });
      return;
    }
    if (selected && !selectionValid) {
      notify("That time no longer fits. Choose another preference.");
      return;
    }
    update((d) => {
      const req = d.requests.find((x) => x.id === r.id)!;
      req.status =
        tasks.some((t) => !t.reviewed) || referral
          ? "Needs Review"
          : "Submitted";
      req.mode = "Request to Book";
      if (!selectionValid) req.preferredSlot = undefined;
      log(
        d,
        `${req.name} submitted ${tasks.length} separate tasks · ${referral ? "referral review" : "appointment not confirmed"}`,
      );
    });
  };
  const timeLabel = (o: { start: string; duration: number }) =>
    `${dateLabel(o.start)} – ${new Date(+new Date(o.start) + o.duration * 60000).toLocaleTimeString("en-CA", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" })}`;
  const slotButton = (o: (typeof options)[number], i: number) => (
    <button
      key={o.start}
      className={
        "slot " +
        (selectionValid && selected?.start === o.start ? "selected" : "")
      }
      aria-pressed={selectionValid && selected?.start === o.start}
      onClick={() => choose(o)}
    >
      <strong>{timeLabel(o)}</strong>
      <small>
        {i === 0 ? "Recommended · " : ""}
        {o.duration} min visit ·{" "}
        {instant ? "Available appointment" : "Preferred time—not confirmed"}
      </small>
    </button>
  );
  const visit = s.visits.find(
    (v) => v.requestId === r.id && v.status === "Confirmed",
  );
  return (
    <div className="customer-intake">
      <nav className="intake-steps" aria-label="Request progress">
        {["Tasks", "Where and when", "Done"].map((label, i) => (
          <span
            key={label}
            aria-current={
              i === (screen === "tasks" ? 0 : screen === "booking" ? 1 : 2)
                ? "step"
                : undefined
            }
          >
            {i + 1} · {label}
          </span>
        ))}
      </nav>
      {screen === "tasks" && (
        <>
          <header className="customer-heading">
            <h1>What do you need taken care of?</h1>
            <p>Add each task separately.</p>
          </header>
          <section className="panel task-composer" aria-label="Your tasks">
            {tasks.length > 0 && (
              <p className="task-count">
                {tasks.length} {tasks.length === 1 ? "thing" : "things"} to take
                care of
              </p>
            )}
            <div className="compact-tasks">
              {all
                .filter((t) => t.id !== editing?.id && t.description.trim())
                .map((t) => (
                  <div className="compact-task" key={t.id}>
                    <button className="task-open" onClick={() => open(t)}>
                      <span aria-hidden="true">
                        {t.entryStage === "done" ? "✓" : "✎"}
                      </span>
                      <span>
                        <strong>{taskLabel(t)}</strong>
                        <small>
                          {t.photos.length} photos ·{" "}
                          {t.entryStage === "done"
                            ? "Details saved · Edit"
                            : "Details to finish"}
                        </small>
                      </span>
                    </button>
                    <button
                      className="text-button"
                      aria-label={"Remove " + taskLabel(t)}
                      onClick={() => remove(t)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
            </div>
            {editing && (
              <div className="active-task" key={editing.id}>
                <div className="row between">
                  <label htmlFor={"task-description-" + editing.id}>
                    {tasks.length === 0 ? "First task" : "Describe this task"}
                  </label>
                  <button
                    className="text-button"
                    onClick={() => remove(editing)}
                  >
                    Remove task
                  </button>
                </div>
                <textarea
                  ref={editor}
                  id={"task-description-" + editing.id}
                  value={editing.description}
                  placeholder="Describe what you need done…"
                  onChange={(e) =>
                    patchTask(editing.id, {
                      description: e.target.value,
                      ...classify(e.target.value),
                      entryStage: "description",
                    })
                  }
                />
                {photos(editing)}
                {editing.entryStage === "details" ? (
                  <div className="task-details">
                    <h3>A few useful details</h3>
                    {questions(editing, (p) =>
                      patchTask(editing.id, { ...p, entryStage: "details" }),
                    )}
                    <div className="intake-actions">
                      <button
                        className="primary"
                        onClick={() => complete(editing)}
                      >
                        Done with this task
                      </button>
                      {missingQuestions(editing).length > 0 && (
                        <button
                          className="secondary"
                          onClick={() => complete(editing, true)}
                        >
                          Mark remaining Not sure
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    className="secondary"
                    disabled={!editing.description.trim()}
                    onClick={() =>
                      patchTask(editing.id, { entryStage: "details" })
                    }
                  >
                    Save task
                  </button>
                )}
              </div>
            )}
            {removed && (
              <div role="status" className="note">
                Task removed.{" "}
                <button
                  className="text-button"
                  onClick={() => {
                    update((d) => {
                      d.tasks.splice(
                        Math.min(removed.index, d.tasks.length),
                        0,
                        removed.task,
                      );
                      d.requests.find((x) => x.id === r.id)!.editingTaskId =
                        removed.task.id;
                    });
                    setRemoved(null);
                  }}
                >
                  Undo
                </button>
              </div>
            )}
            <button className="add-task" onClick={add}>
              + Add another task
            </button>
            <small>
              Saved details are ready for review; they do not mean the work is
              approved.
            </small>
          </section>
          <div className="intake-bottom">
            <button className="primary full" onClick={advance}>
              Continue with {tasks.length}{" "}
              {tasks.length === 1 ? "task" : "tasks"} →
            </button>
          </div>
        </>
      )}
      {screen === "booking" && (
        <>
          <header className="customer-heading">
            <h1>Where and when?</h1>
            <p>One address for everything on your list.</p>
          </header>
          <section className="panel">
            <div className="row between">
              <strong>
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"} requested
              </strong>
              <button
                className="text-button"
                onClick={() =>
                  patchRequest({ intakeScreen: "tasks", editingTaskId: null })
                }
              >
                Edit tasks
              </button>
            </div>
            <h3>Where should we come?</h3>
            <label className="field">
              Service address
              <input
                autoComplete="street-address"
                value={r.address}
                placeholder="Street number and street name"
                onChange={(e) => patchRequest({ address: e.target.value })}
              />
            </label>
            <div className="address-pair">
              <label className="field">
                Municipality
                <select
                  value={r.city}
                  onChange={(e) => patchRequest({ city: e.target.value })}
                >
                  {["Oakville", "Burlington", "Milton", "Mississauga"].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="field">
                Postal code
                <input
                  autoComplete="postal-code"
                  value={r.postalCode || ""}
                  placeholder="L6J 4S7"
                  onChange={(e) => patchRequest({ postalCode: e.target.value })}
                />
              </label>
            </div>
            <details>
              <summary>Unit and access notes (optional)</summary>
              <label className="field">
                Unit
                <input
                  value={r.unit || ""}
                  onChange={(e) => patchRequest({ unit: e.target.value })}
                />
              </label>
              <label className="field">
                Access and parking notes
                <textarea
                  value={r.notes}
                  onChange={(e) => patchRequest({ notes: e.target.value })}
                />
              </label>
            </details>
            <h3>{referral ? "Referral review" : "What works for you?"}</h3>
            {referral ? (
              <p className="warning">
                This includes a service we do not book through the platform.
                Send it for operator review; no appointment or referral is
                promised.
              </p>
            ) : !validAddress(r) ? (
              <p>Add your service address to see timing options.</p>
            ) : (
              <>
                <span className="badge">
                  {instant ? "Instant Book" : "Request to Book"}
                </span>
                {!instant && (
                  <p>
                    Choose a preference. We’ll review the details and confirm
                    the appointment separately.
                  </p>
                )}
                {selectionValid && (
                  <p role="status">
                    <strong>
                      {instant ? "Selected appointment" : "Preferred time"}:
                    </strong>{" "}
                    {timeLabel(selected!)}
                  </p>
                )}
                {options.length > 0 ? (
                  <>
                    <div className="intake-times">
                      {options.slice(0, 3).map(slotButton)}
                    </div>
                    {options.length > 3 && (
                      <button
                        className="secondary full"
                        onClick={() => setMore(true)}
                      >
                        More times
                      </button>
                    )}
                    {!instant && (
                      <button
                        className="text-button"
                        onClick={() =>
                          patchRequest({
                            preferredSlot: undefined,
                            timing: "Weekdays · flexible",
                          })
                        }
                      >
                        Keep my timing flexible
                      </button>
                    )}
                  </>
                ) : (
                  <p>
                    {tasks.reduce((n, t) => n + t.duration, 0) > 405
                      ? "This work may need multiple visits. The operator will coordinate the split and timing."
                      : "The scope or provider availability needs review. Tell us your general preference."}
                  </p>
                )}
                {!instant && !selectionValid && (
                  <label className="field">
                    General time preference
                    <select
                      value={
                        [
                          "Weekdays · flexible",
                          "Weekdays · 9 AM–12 PM",
                          "Weekdays · 1–5 PM",
                          "Any day · flexible",
                        ].includes(r.timing)
                          ? r.timing
                          : "Weekdays · flexible"
                      }
                      onChange={(e) =>
                        patchRequest({
                          timing: e.target.value,
                          preferredSlot: undefined,
                        })
                      }
                    >
                      {[
                        "Weekdays · flexible",
                        "Weekdays · 9 AM–12 PM",
                        "Weekdays · 1–5 PM",
                        "Any day · flexible",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
          </section>
          <div className="intake-bottom">
            {instant ? (
              <>
                <p>
                  Door adjustment · fixed price <strong>$129 CAD</strong>
                </p>
                <button
                  className="primary full"
                  disabled={!selectionValid}
                  onClick={() => {
                    if (validAddress(r) && selectionValid) pay(selected!.start);
                  }}
                >
                  Book & pay $129
                </button>
              </>
            ) : (
              <button className="primary full" onClick={submit}>
                {referral ? "Send for referral review" : "Send request"}
              </button>
            )}
          </div>
        </>
      )}
      {screen === "done" && (
        <section className="panel intake-receipt">
          <div className="receipt-check" aria-hidden="true">
            ✓
          </div>
          <h1>
            {r.status === "Confirmed"
              ? "Your visit is booked."
              : "We’ve got it."}
          </h1>
          <p>
            {r.status === "Confirmed"
              ? "Your appointment is confirmed."
              : referral
                ? "Your request has been received for referral review. No appointment is booked."
                : "Your request has been received. We’ll review the details and confirm the appointment."}
          </p>
          <dl className="task-answers">
            <div>
              <dt>Tasks</dt>
              <dd>
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
              </dd>
            </div>
            <div>
              <dt>{visit ? "Confirmed appointment" : "Preferred time"}</dt>
              <dd>
                {visit
                  ? timeLabel(visit)
                  : referral
                    ? "Referral review only"
                    : r.preferredSlot
                      ? timeLabel(r.preferredSlot)
                      : r.timing}
              </dd>
            </div>
            <div>
              <dt>Service address</dt>
              <dd>
                {r.address}
                {r.unit ? ", " + r.unit : ""}, {r.city} {r.postalCode}
              </dd>
            </div>
          </dl>
          <button className="primary full" onClick={view}>
            View request
          </button>
        </section>
      )}
      <dialog
        aria-label="More times"
        ref={dialog}
        className="more-times-dialog"
        onCancel={() => setMore(false)}
        onClose={() => setMore(false)}
      >
        <div className="row between">
          <h2>More times</h2>
          <button className="text-button" onClick={() => setMore(false)}>
            Close
          </button>
        </div>
        <p>
          {instant ? "Available appointments" : "Preferred times—not confirmed"}
        </p>
        <div className="intake-times">{options.map(slotButton)}</div>
      </dialog>
    </div>
  );
}
