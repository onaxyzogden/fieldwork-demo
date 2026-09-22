import React, { useEffect, useRef, useState } from "react";
import { MapPin, Check, Plus } from "lucide-react";
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
import { getIssue, answerKey } from "./clarification";
import {
  entryTasks,
  taskLabel,
  validAddress,
  validStreet,
  validPostal,
  cities,
  upcomingDays,
  dayParts,
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
  questions: (
    t: Task,
    change: (p: Partial<Task>) => void,
    attempted: boolean,
  ) => React.ReactNode;
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
  // Once submitted this component is never shown again — submit() and the
  // instant-payment handler both navigate straight back to Home, matching
  // the shared design reference, which has no confirmation screen of its own.
  const screen = r.intakeScreen || "address";
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
    [more, setMore] = useState(false),
    /* The booking button refuses when no time is chosen. The reason belongs
       beside the times, not in a toast that leaves before it is read. */
    [noTime, setNoTime] = useState(false);
  /* Per-field validation state for the address step. Two independently
     triggerable errors, each with its own message and its own focus target —
     not one "form is invalid" flag. */
  const [addressError, setAddressError] = useState<{
    street?: string;
    postal?: string;
  }>({});
  /* Every task renders as its own card in whichever stage it's currently in —
     describe, clarify, or done — rather than one "active" editor plus a
     collapsed preview list. Both of these are keyed per task because more
     than one can theoretically be mid-entry at once. */
  const [descriptionErrors, setDescriptionErrors] = useState<
    Record<string, string>
  >({});
  const [answersAttempted, setAnswersAttempted] = useState<
    Record<string, boolean>
  >({});
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
    if (selected && !selectionValid && r.status === "Draft")
      patchRequest({ preferredSlot: undefined, timing: "Weekdays · flexible" });
  }, [signature, selectionValid, r.status]);
  useEffect(() => {
    if (more) dialog.current?.showModal();
    else dialog.current?.close();
  }, [more]);
  useEffect(() => {
    const t = all.find((t) => t.id === r.editingTaskId);
    if (screen === "tasks" && t && t.entryStage !== "details")
      editor.current?.focus();
  }, [r.editingTaskId, screen]);
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
  /* Two edits, not one. Fixing a typo in the description must not cost you
     every clarifying answer, so reopening at "description" keeps the
     answers, and reopening at "details" keeps the description. */
  const reopen = (t: Task, stage: "description" | "details") =>
    update((d) => {
      d.tasks.find((x) => x.id === t.id)!.entryStage = stage;
      d.requests.find((x) => x.id === r.id)!.editingTaskId = t.id;
    });
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
  /**
   * Every question also carries its own inline "Not sure" button (see
   * ClarificationFields), so by the time this runs, a question is only ever
   * missing because it was genuinely skipped — mark it and focus it, rather
   * than one global notification that doesn't say which one.
   */
  const complete = (t: Task) => {
    const missing = missingQuestions(t);
    if (missing.length) {
      setAnswersAttempted((x) => ({ ...x, [t.id]: true }));
      const issue = getIssue(t.description);
      document
        .getElementById("q-" + t.id + "-" + answerKey(issue, missing[0]))
        ?.focus();
      return;
    }
    setAnswersAttempted((x) => ({ ...x, [t.id]: false }));
    update((d) => {
      completeEntry(d.tasks.find((x) => x.id === t.id)!);
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
    // Straight back to Home, expanded — there is no confirmation screen of
    // its own here; the accordion already shows exactly what's true now.
    view();
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
      onClick={() => {
        setNoTime(false);
        choose(o);
      }}
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
  return (
    <div className="customer-intake">
      {/* Same stepper motif as the customer status track, not a second one. */}
      <nav className="intake-steps" aria-label="Request progress">
        {["Address", "Tasks", "Timing"].map((label, i) => {
          const at = screen === "address" ? 0 : screen === "tasks" ? 1 : 2;
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
          them without discarding anything entered since. The checkmark is a
          solid filled circle, the same treatment for every collapsed step. */}
      {screen !== "address" && (
        <div className="step-summary">
          <span>
            <span className="step-summary-check">
              <Check size={16} strokeWidth={3} />
            </span>
            <span className="step-summary-text">
              <strong>{r.address}</strong>
              <small>{r.city}</small>
            </span>
          </span>
          <button className="text-button" onClick={() => goto("address")}>
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
      {screen === "address" && (
        /* A step not yet reached: named, muted, non-interactive. */
        <div className="step-upcoming">
          <span className="step-upcoming-ring" />
          <strong>What needs doing?</strong>
        </div>
      )}
      {screen === "booking" && (
        <div className="step-summary">
          <span>
            <span className="step-summary-check">
              <Check size={16} strokeWidth={3} />
            </span>
            <span className="step-summary-text">
              <strong>
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
              </strong>
              <small>{tasks.map(taskLabel).join(" · ")}</small>
            </span>
          </span>
          <button className="text-button" onClick={() => goto("tasks")}>
            Edit
          </button>
        </div>
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
            {/* Every task is its own card in whichever stage it's currently
                in. No separate collapsed-preview list and expanded editor —
                what you see is what's actually there. */}
            {all.map((t) => {
              const issue = getIssue(t.description);
              const isFocusTarget = t.id === r.editingTaskId;
              return (
                <div
                  className={
                    "card task-card" +
                    (descriptionErrors[t.id] ? " field-error" : "")
                  }
                  key={t.id}
                >
                  {(!t.entryStage || t.entryStage === "description") && (
                    <>
                      <label
                        className="field"
                        htmlFor={"task-description-" + t.id}
                      >
                        Describe the problem
                        <textarea
                          ref={isFocusTarget ? editor : undefined}
                          id={"task-description-" + t.id}
                          value={t.description}
                          placeholder="e.g. Bedroom door is sticking against the frame"
                          aria-invalid={!!descriptionErrors[t.id] || undefined}
                          aria-describedby={
                            descriptionErrors[t.id]
                              ? "task-description-error-" + t.id
                              : undefined
                          }
                          onChange={(e) => {
                            if (descriptionErrors[t.id])
                              setDescriptionErrors((x) => ({
                                ...x,
                                [t.id]: "",
                              }));
                            patchTask(t.id, {
                              description: e.target.value,
                              ...classify(e.target.value),
                              entryStage: "description",
                            });
                          }}
                        />
                        {descriptionErrors[t.id] && (
                          <span
                            className="field-message"
                            id={"task-description-error-" + t.id}
                            role="alert"
                          >
                            {descriptionErrors[t.id]}
                          </span>
                        )}
                      </label>
                      {photos(t)}
                      <div className="task-card-actions">
                        {all.length > 1 && (
                          <button
                            className="text-button"
                            onClick={() => remove(t)}
                          >
                            Remove
                          </button>
                        )}
                        <button
                          className="secondary"
                          onClick={() => {
                            if (!t.description.trim()) {
                              setDescriptionErrors((x) => ({
                                ...x,
                                [t.id]:
                                  "Describe the problem before continuing.",
                              }));
                              if (isFocusTarget) editor.current?.focus();
                              return;
                            }
                            setDescriptionErrors((x) => ({ ...x, [t.id]: "" }));
                            patchTask(t.id, { entryStage: "details" });
                          }}
                        >
                          Continue
                        </button>
                      </div>
                    </>
                  )}
                  {t.entryStage === "details" && (
                    <>
                      <strong>{issue.title}</strong>
                      {questions(
                        t,
                        (p) => patchTask(t.id, { ...p, entryStage: "details" }),
                        !!answersAttempted[t.id],
                      )}
                      <button className="secondary" onClick={() => complete(t)}>
                        Save answers
                      </button>
                    </>
                  )}
                  {t.entryStage === "done" && (
                    <div className="task-card-done">
                      <div className="task-card-done-text">
                        <strong>{issue.title}</strong>
                        <small>{t.description}</small>
                        {photos(t)}
                      </div>
                      <div className="task-card-done-actions">
                        <span
                          className={
                            "badge " +
                            (t.reviewed ? "badge-success" : "badge-urgent")
                          }
                        >
                          {t.reviewed ? "Reviewed" : "Needs review"}
                        </span>
                        <button
                          className="text-button"
                          onClick={() => reopen(t, "details")}
                        >
                          Edit answers
                        </button>
                        <button
                          className="text-button"
                          onClick={() => reopen(t, "description")}
                        >
                          Edit description
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
            <button className="secondary" onClick={add}>
              <Plus size={16} className="icon-inline" />
              Add another task
            </button>
            <small>
              Saved details are ready for review; they do not mean the work is
              approved.
            </small>
          </section>
          <div className="intake-bottom">
            <button className="primary full" onClick={advance}>
              Continue
            </button>
          </div>
        </>
      )}
      {screen !== "booking" && (
        <div className="step-upcoming">
          <span className="step-upcoming-ring" />
          <strong>When works for you?</strong>
        </div>
      )}
      {screen === "booking" && (
        <>
          <header className="customer-heading">
            <h1>When works for you?</h1>
            <p>
              Optional — select any dates and times that work. We’ll do our best
              to match.
            </p>
          </header>
          {/* Stated preference. A vertical list of the next 10 days rather than
              a calendar modal: the same data, far less to build and to use. This
              is a wish, not a booking, and submitting with nothing chosen is a
              perfectly good answer. */}
          <section className="customer-timing-section">
            <h3>Days that suit you</h3>
            {/* Each row expands in place to its own Morning/Afternoon/Evening
                toggles the moment it's picked — not a separate summary block
                collecting every selected day's toggles afterward. */}
            <div className="date-list">
              {upcomingDays(s.clock).map((d) => {
                const slot = r.preferredSlots?.find((p) => p.date === d.date);
                return (
                  <div key={d.date}>
                    <button
                      className={"date-chip" + (slot ? " selected" : "")}
                      aria-pressed={!!slot}
                      onClick={() => togglePreferredDay(d.date)}
                    >
                      {d.label}
                      {slot && <Check size={16} />}
                    </button>
                    {slot && (
                      <div className="time-pills">
                        {dayParts.map((part) => (
                          <button
                            key={part}
                            className={
                              "time-pill" +
                              (slot.times.includes(part) ? " selected" : "")
                            }
                            aria-pressed={slot.times.includes(part)}
                            aria-label={`${part} on ${d.date}`}
                            onClick={() => togglePreferredTime(d.date, part)}
                          >
                            {part}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <label className="field">
              Timing constraints
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
                    if (!selectionValid) return setNoTime(true);
                    if (!validAddress(r)) return goto("address");
                    pay(selected!.start);
                  }}
                >
                  Book & pay $129
                </button>
              </>
            ) : (
              <button className="primary full" onClick={submit}>
                {referral ? "Send for referral review" : "Submit request"}
              </button>
            )}
          </div>
        </>
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
        {noTime && (
          <span className="field-message" role="alert">
            Choose an appointment time before booking.
          </span>
        )}
      </dialog>
    </div>
  );
}
