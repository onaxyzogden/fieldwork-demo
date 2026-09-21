import React, { useEffect, useRef, useState } from "react";
import {
  MapPin,
  ListChecks,
  CalendarDays,
  Mail,
  Home,
  Check,
} from "lucide-react";
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
  validStreet,
  validPostal,
  cities,
  upcomingDays,
  dayParts,
  dayLabel,
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
    screen = done ? "done" : r.intakeScreen || "address";
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
  /* Per-field validation state for the address step. Two independently
     triggerable errors, each with its own message and its own focus target —
     not one "form is invalid" flag. */
  const [addressError, setAddressError] = useState<{
    street?: string;
    postal?: string;
  }>({});
  const [descriptionError, setDescriptionError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    editor = useRef<HTMLTextAreaElement>(null),
    streetRef = useRef<HTMLInputElement>(null),
    postalRef = useRef<HTMLInputElement>(null);
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
  /**
   * Continue out of the address step. The button is never disabled: it always
   * clicks, and if something blocks it we mark that field, say why beside it,
   * and put the caret there.
   */
  const advanceAddress = () => {
    const errs: { street?: string; postal?: string } = {};
    if (!validStreet(r)) errs.street = "Add the street number and name.";
    if (!validPostal(r))
      errs.postal = "Enter a Canadian postal code, for example L6J 4S7.";
    setAddressError(errs);
    if (errs.street) return streetRef.current?.focus();
    if (errs.postal) return postalRef.current?.focus();
    patchRequest({ intakeScreen: "tasks" });
  };
  /** Reopen an earlier step without discarding anything entered after it. */
  const goto = (to: "address" | "tasks" | "booking") =>
    patchRequest({ intakeScreen: to, editingTaskId: null });
  const togglePreferredDay = (date: string) => {
    const current = r.preferredSlots || [];
    patchRequest({
      preferredSlots: current.some((p) => p.date === date)
        ? current.filter((p) => p.date !== date)
        : [...current, { date, times: [] }],
    });
  };
  const togglePreferredTime = (date: string, part: string) => {
    const current = r.preferredSlots || [];
    patchRequest({
      preferredSlots: current.map((p) =>
        p.date === date
          ? {
              ...p,
              times: p.times.includes(part)
                ? p.times.filter((x) => x !== part)
                : [...p.times, part],
            }
          : p,
      ),
    });
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
      {i === 0 && <span className="time-recommendation">Recommended</span>}
      <strong>
        {new Date(o.start).toLocaleDateString("en-CA", {
          timeZone: "America/Toronto",
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </strong>
      <span>
        {new Date(o.start).toLocaleTimeString("en-CA", {
          timeZone: "America/Toronto",
          hour: "numeric",
          minute: "2-digit",
        })}{" "}
        –{" "}
        {new Date(+new Date(o.start) + o.duration * 60000).toLocaleTimeString(
          "en-CA",
          { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" },
        )}
      </span>
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
      {/* Same stepper motif as the customer status track, not a second one. */}
      <nav className="intake-steps" aria-label="Request progress">
        {["Address", "Tasks", "Timing"].map((label, i) => {
          // On the receipt every step is behind you, so none is still "active".
          const at =
            screen === "address"
              ? 0
              : screen === "tasks"
                ? 1
                : screen === "done"
                  ? 3
                  : 2;
          return (
            <span
              key={label}
              className={i < at ? "done" : i === at ? "active" : ""}
              aria-current={i === at ? "step" : undefined}
            >
              {label}
            </span>
          );
        })}
      </nav>
      {/* Completed steps collapse to a summary row with an Edit that reopens
          them without discarding anything entered since. */}
      {screen !== "address" && screen !== "done" && (
        <div className="step-summary">
          <span>
            <Check size={16} className="step-summary-check" />
            <strong>{r.address}</strong>
            <small>{r.city}</small>
          </span>
          <button className="text-button" onClick={() => goto("address")}>
            Edit
          </button>
        </div>
      )}
      {screen === "booking" && (
        <div className="step-summary">
          <span>
            <Check size={16} className="step-summary-check" />
            <strong>
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </strong>
            <small>{tasks.map(taskLabel).join(" · ")}</small>
          </span>
          <button className="text-button" onClick={() => goto("tasks")}>
            Edit
          </button>
        </div>
      )}
      {screen === "address" && (
        <>
          <header className="customer-heading">
            <h1>Where should we come?</h1>
            <p>One address for everything on your list.</p>
          </header>
          <section className="customer-address-section">
            <label
              className={"field" + (addressError.street ? " field-error" : "")}
            >
              Service address
              <input
                ref={streetRef}
                autoComplete="street-address"
                value={r.address}
                aria-invalid={!!addressError.street || undefined}
                aria-describedby={
                  addressError.street ? "address-street-error" : undefined
                }
                placeholder="Street number and street name"
                onChange={(e) => {
                  patchRequest({ address: e.target.value });
                  if (addressError.street)
                    setAddressError((x) => ({ ...x, street: undefined }));
                }}
              />
              {addressError.street && (
                <span
                  className="field-message"
                  id="address-street-error"
                  role="alert"
                >
                  {addressError.street}
                </span>
              )}
            </label>
            <div className="address-pair">
              <label className="field">
                Municipality
                <select
                  value={r.city}
                  onChange={(e) => patchRequest({ city: e.target.value })}
                >
                  {cities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label
                className={
                  "field" + (addressError.postal ? " field-error" : "")
                }
              >
                Postal code
                <input
                  ref={postalRef}
                  autoComplete="postal-code"
                  value={r.postalCode || ""}
                  aria-invalid={!!addressError.postal || undefined}
                  aria-describedby={
                    addressError.postal ? "address-postal-error" : undefined
                  }
                  placeholder="L6J 4S7"
                  onChange={(e) => {
                    patchRequest({ postalCode: e.target.value });
                    if (addressError.postal)
                      setAddressError((x) => ({ ...x, postal: undefined }));
                  }}
                />
                {addressError.postal && (
                  <span
                    className="field-message"
                    id="address-postal-error"
                    role="alert"
                  >
                    {addressError.postal}
                  </span>
                )}
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
            {validAddress(r) && (
              <div className="customer-location-preview">
                <MapPin size={32} />
                <strong>
                  {r.address}
                  <br />
                  {r.city}
                </strong>
                <small>Illustrative location · simulated, not geocoded</small>
              </div>
            )}
          </section>
          <div className="intake-bottom">
            <button className="primary full" onClick={advanceAddress}>
              Continue →
            </button>
          </div>
        </>
      )}
      {screen === "tasks" && (
        <>
          <header className="customer-heading">
            <h1>What do you need taken care of?</h1>
            <p>
              Add each task separately. Be as detailed as you like — photos help
              a lot.
            </p>
          </header>
          <section className="task-composer" aria-label="Your tasks">
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
                      <span className="task-number" aria-hidden="true">
                        {all.indexOf(t) + 1}
                      </span>
                      <span>
                        <strong>{taskLabel(t)}</strong>
                        <small>
                          {t.photos.length} photos ·{" "}
                          {t.entryStage === "done"
                            ? "Details saved"
                            : "Details to finish"}
                        </small>
                      </span>
                    </button>
                    {t.entryStage === "done" && (
                      <span
                        className={
                          "badge " +
                          (t.reviewed ? "badge-success" : "badge-urgent")
                        }
                      >
                        {t.reviewed ? "Reviewed" : "Needs review"}
                      </span>
                    )}
                    <details className="task-menu">
                      <summary aria-label={"Actions for " + taskLabel(t)}>
                        •••
                      </summary>
                      {/* Two edits, not one. Fixing a typo in the description
                          must not cost you every clarifying answer. */}
                      <button
                        className="secondary"
                        onClick={() => {
                          patchTask(t.id, { entryStage: "details" });
                          open(t);
                        }}
                      >
                        Edit answers
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          patchTask(t.id, { entryStage: "description" });
                          open(t);
                        }}
                      >
                        Edit description
                      </button>
                      <button
                        className="text-button"
                        aria-label={"Remove " + taskLabel(t)}
                        onClick={() => remove(t)}
                      >
                        Remove
                      </button>
                    </details>
                    <p className="task-description-preview">{t.description}</p>
                    {photos(t)}
                  </div>
                ))}
            </div>
            {editing && (
              <div
                className={
                  "active-task customer-task-card" +
                  (descriptionError ? " field-error" : "")
                }
                key={editing.id}
              >
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
                  aria-invalid={!!descriptionError || undefined}
                  aria-describedby={
                    descriptionError ? "task-description-error" : undefined
                  }
                  onChange={(e) => {
                    if (descriptionError) setDescriptionError("");
                    patchTask(editing.id, {
                      description: e.target.value,
                      ...classify(e.target.value),
                      entryStage: "description",
                    });
                  }}
                />
                {descriptionError && (
                  <span
                    className="field-message"
                    id="task-description-error"
                    role="alert"
                  >
                    {descriptionError}
                  </span>
                )}
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
                    onClick={() => {
                      if (!editing.description.trim()) {
                        setDescriptionError(
                          "Describe what you need done before saving.",
                        );
                        editor.current?.focus();
                        return;
                      }
                      setDescriptionError("");
                      patchTask(editing.id, { entryStage: "details" });
                    }}
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
            <h1>When works for you?</h1>
            <p>
              Optional — tell us your preference, or send the request and we’ll
              find a time.
            </p>
          </header>
          {/* Stated preference. A flat list of the next 10 days rather than a
              calendar modal: the same data, far less to build and to use. This
              is a wish, not a booking, and submitting with nothing chosen is a
              perfectly good answer. */}
          <section className="customer-timing-section">
            <h3>Days that suit you</h3>
            <div className="day-chips">
              {upcomingDays(s.clock).map((d) => {
                const picked = r.preferredSlots?.some((p) => p.date === d.date);
                return (
                  <button
                    key={d.date}
                    className={"day-chip" + (picked ? " selected" : "")}
                    aria-pressed={picked}
                    onClick={() => togglePreferredDay(d.date)}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {r.preferredSlots?.map((p) => (
              <div className="day-parts" key={p.date}>
                <small>{dayLabel(p.date)}</small>
                <div className="day-chips">
                  {dayParts.map((part) => (
                    <button
                      key={part}
                      className={
                        "day-chip" + (p.times.includes(part) ? " selected" : "")
                      }
                      aria-pressed={p.times.includes(part)}
                      aria-label={`${part} on ${p.date}`}
                      onClick={() => togglePreferredTime(p.date, part)}
                    >
                      {part}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <label className="field">
              Timing constraints (optional)
              <textarea
                value={r.timingConstraints || ""}
                placeholder="Baby is napping from 3–4pm. Please do not arrive during those times."
                onChange={(e) =>
                  patchRequest({ timingConstraints: e.target.value })
                }
              />
            </label>
          </section>
          <section className="customer-timing-section">
            <h3>{referral ? "Referral review" : "Available appointments"}</h3>
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
                        See more times
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
                  onClick={() => {
                    if (!selectionValid)
                      return notify(
                        "Choose an appointment time before booking.",
                      );
                    if (!validAddress(r)) return goto("address");
                    pay(selected!.start);
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
        <section className="intake-receipt">
          <div className="receipt-check" aria-hidden="true">
            ✓
          </div>
          <h1>
            {r.status === "Confirmed"
              ? "Your visit is booked."
              : "We’ve got your request."}
          </h1>
          <p>
            {r.status === "Confirmed"
              ? "Your appointment is confirmed."
              : referral
                ? "Your request has been received for referral review. No appointment is booked."
                : "Your request has been received. We’ll review the details and confirm the appointment."}
          </p>
          <section className="card customer-receipt-summary">
            <h3>Your Request Summary</h3>
            <dl className="task-answers">
              <div>
                <dt>
                  <ListChecks size={20} /> Tasks
                </dt>
                <dd>
                  {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                </dd>
              </div>
              <div>
                <dt>
                  <CalendarDays size={20} />
                  {visit ? "Confirmed appointment" : "Preferred time"}
                </dt>
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
                <dt>
                  <MapPin size={20} />
                  Service address
                </dt>
                <dd>
                  {r.address}
                  {r.unit ? ", " + r.unit : ""}, {r.city} {r.postalCode}
                </dd>
              </div>
            </dl>
          </section>
          <div className="card customer-notice">
            <Mail size={24} />
            <p>
              Updates appear in this demo. Notifications are simulated in-app;
              no email or text is sent.
            </p>
          </div>
          <button className="primary full" onClick={view}>
            View My Request
          </button>
          <button className="customer-home-link" onClick={view}>
            <Home size={20} />
            Back to Home
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
