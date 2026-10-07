import { Fragment, useState } from "react";
import {
  type Availability as Hours,
  type State,
  type Weekday,
  BLOCKS,
  WEEK,
  dateLabel,
  hoursLabel,
  hoursOf,
  spanLabel,
} from "./model";
import { outsideHours, setAvailability } from "./dispatch";
import { dayLabel } from "./intake";
import { useFieldErrors } from "./fields";
import { dayKey } from "./work";

/**
 * When a contractor takes work (ADR 067): blocks for each day of the week,
 * and single days off. Offers only come inside these hours; saving withdraws
 * open offers outside them and lists accepted jobs that no longer fit.
 */
type Update = (fn: (d: State) => void, msg?: string) => void;

const DAY_NAMES: Record<Weekday, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

export default function Availability({
  s,
  update,
  provider,
  openJob,
}: {
  s: State;
  update: Update;
  provider: string;
  /** Opens an accepted job on Your Work, by visit id. */
  openJob: (visitId: string) => void;
}) {
  const saved = hoursOf(s, provider);
  const [hours, setHours] = useState<Hours>(() => structuredClone(saved));
  const [day, setDay] = useState("");
  const [result, setResult] = useState("");
  const { fail, clear, fieldClass, invalid, Message } = useFieldErrors();
  const today = dayKey(s.clock);
  const outside = outsideHours(s, provider);

  const toggle = (d: Weekday, block: string) => {
    const on = hours.days[d].includes(block as never);
    setHours({
      ...hours,
      days: {
        ...hours.days,
        /* Kept in the order of the day, whatever order they were tapped in. */
        [d]: BLOCKS.map(([b]) => b).filter((b) =>
          b === block ? !on : hours.days[d].includes(b),
        ),
      },
    });
    setResult("");
  };
  const addDay = () => {
    if (!(day >= today)) return fail("off", "Pick a date from today on.");
    if (hours.off.includes(day)) return fail("off", "That day is already off.");
    setHours({ ...hours, off: [...hours.off, day].sort() });
    setDay("");
    setResult("");
  };
  const save = () => {
    if (JSON.stringify(hours) === JSON.stringify(saved))
      return setResult("Nothing has changed.");
    let withdrawn = 0;
    update((d) => {
      withdrawn = setAvailability(d, provider, hours).withdrawn.length;
    }, "Hours saved");
    setResult(
      withdrawn
        ? `${withdrawn} offer${withdrawn === 1 ? "" : "s"} withdrawn and sent back to the operator.`
        : "Saved. New offers will come inside these hours.",
    );
  };

  return (
    <div className="contractor-wrap">
      <div className="heading role-greeting">
        <div>
          <h1>Availability</h1>
          <p>When you take work. Offers only come inside these hours.</p>
        </div>
      </div>
      <section className="card panel" aria-labelledby="hours-week">
        <h2 id="hours-week">Each week</h2>
        <p className="muted">
          {BLOCKS.map(([b, from, to]) => `${b} ${spanLabel(from, to)}`).join(
            " · ",
          )}
        </p>
        {WEEK.map((d) => (
          <div
            className="hours-row"
            key={d}
            role="group"
            aria-label={DAY_NAMES[d]}
          >
            <strong>{d}</strong>
            <div className="time-pills">
              {BLOCKS.map(([b]) => (
                <button
                  key={b}
                  className={
                    "time-pill" + (hours.days[d].includes(b) ? " selected" : "")
                  }
                  aria-pressed={hours.days[d].includes(b)}
                  onClick={() => toggle(d, b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        ))}
        {/* A group of days and its hours never breaks across lines; the
            line breaks between groups instead. */}
        <p className="muted hours-now">
          Now:{" "}
          {hoursLabel(hours)
            .split(" · ")
            .map((g, i) => (
              <Fragment key={g}>
                {i > 0 && " · "}
                <span>{g}</span>
              </Fragment>
            ))}
        </p>
      </section>
      <section className="card panel" aria-labelledby="hours-off">
        <h2 id="hours-off">Days off</h2>
        <div className="hours-add">
          <label className={fieldClass("off")}>
            Date
            <input
              type="date"
              min={today}
              value={day}
              {...invalid("off")}
              onChange={(e) => {
                clear("off");
                setDay(e.target.value);
              }}
            />
            <Message field="off" />
          </label>
          <button className="secondary" onClick={addDay}>
            Add day off
          </button>
        </div>
        {hours.off.some((d) => d >= today) ? (
          <ul className="hours-off">
            {hours.off
              .filter((d) => d >= today)
              .map((d) => (
                <li key={d}>
                  {dayLabel(d)}
                  <button
                    className="text-button"
                    onClick={() => {
                      setHours({
                        ...hours,
                        off: hours.off.filter((x) => x !== d),
                      });
                      setResult("");
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <p className="muted">No days off coming up.</p>
        )}
      </section>
      <button className="primary full" onClick={save}>
        Save hours
      </button>
      {result && (
        <p className="hours-result" role="status">
          {result}
        </p>
      )}
      {outside.length > 0 && (
        <section className="card panel" aria-labelledby="hours-outside">
          <h2 id="hours-outside">Outside your new hours</h2>
          <p className="muted">
            These jobs stay booked. Talk to the operator if you can’t make one.
          </p>
          {outside.map((a) => {
            const v = s.visits.find((v) => v.id === a.visitId)!;
            return (
              <button
                key={a.id}
                className="queue-item"
                onClick={() => openJob(v.id)}
              >
                {s.tasks.find((t) => v.taskIds.includes(t.id))?.summary ||
                  "Job"}{" "}
                · {dateLabel(v.start)}
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}
