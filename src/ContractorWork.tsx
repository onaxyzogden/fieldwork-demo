import { plural } from "./plural";
import { questionAnswers } from "./clarification";
import { useState, useEffect } from "react";
import {
  type Assignment,
  type State,
  type Visit,
  money,
  dateLabel,
  accountName,
} from "./model";
import { dayKey, workStatus } from "./work";
import { respondToOffer, tripLabel } from "./dispatch";
import { MessageThread } from "./NotificationUI";
import { markOfferSeen, offerSeen } from "./notifications";
import JobMode from "./JobMode";
import { When } from "./When";
import { countdown } from "./countdown";
import ContractorQueue from "./ContractorQueue";
import { Glance, GlanceLead } from "./GlanceCard";
import {
  contractorGlance,
  glanceDate,
  tabWork,
  type ContractorTab,
} from "./glance";
import { JobWork, type Props } from "./JobWork";
import { REASONS, payLabel } from "./ContractorQueue";
import { useSwapFocus } from "./useSwapFocus";
export default function ContractorWork({
  s,
  provider,
  update,
  openVisit,
  openAvailability,
}: Props & {
  openVisit?: string;
  /** Goes to the Availability page (ADR 067). */
  openAvailability: () => void;
}) {
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
  /* An offer open on this screen has been seen, however it was opened: the
     bell, a card, the glance, or the page opening on the only offer. The
     operator's "not opened yet" depends on it (ADR 060). Only an unopened
     one writes. */
  const seen = offerSeen(s, selected);
  useEffect(() => {
    if (
      seen &&
      !seen.openedAt &&
      mine.some((a) => a.id === selected && a.status === "Offered")
    )
      update((d) => {
        markOfferSeen(d, selected);
      });
  }, [selected, !!seen, !!seen?.openedAt]);
  const [decline, setDecline] = useState(false);
  const swap = useSwapFocus(decline);
  /* The offers, one at a time (ADR 062). */
  const [reviewing, setReviewing] = useState(false);
  /* Today's job, or one already running whatever its date, opens in job mode:
     the whole screen, one step at a time. Other accepted jobs keep the page,
     since there is nothing to do on them yet but read. */
  const todaysJob = (v: Visit) =>
    dayKey(v.start) === today ||
    (!!v.execution?.startedAt && !v.execution.finishedAt);
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
  const respond = (status: "Accepted" | "Declined", reason = "") => {
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
  /* The same filter the glance counts, rather than a copy of it: a count that
     promises a list has to be the list. */
  const assignments = tabWork(s, provider, tab as ContractorTab, +s.clock);
  const glance = contractorGlance(s, provider, +s.clock);
  const nextVisit = glance.next?.visit;
  const nextRequest = s.requests.find((r) => r.id === nextVisit?.requestId);
  /* What is behind the contractor, newest first: their order, not the order
     the offers were made in (ADR 089). */
  const past = mine
    .flatMap((a) => {
      const v = s.visits.find((v) => v.id === a.visitId);
      return v &&
        (["Declined", "Expired"].includes(a.status) ||
          (a.status === "Accepted" && !!v.execution?.finishedAt))
        ? [{ a, v }]
        : [];
    })
    .sort((x, y) => y.v.start.localeCompare(x.v.start));
  return (
    <div className="contractor-wrap">
      <div className="heading role-greeting">
        <div>
          {/* The page key stays "Your Work"; the page names itself in
              sentence case, with no slogan under it (ADR 089). */}
          <h1>Your work</h1>
        </div>
      </div>
      <Glance
        date={glanceDate(+s.clock)}
        onDate={() => setTab("Today")}
        lead={
          nextVisit ? (
            <GlanceLead
              when={(() => {
                // How long until the next job, then when (ADR 063).
                const c = countdown(s.clock, nextVisit.start);
                return c
                  ? `Starts in ${c.text} · ${dateLabel(nextVisit.start)}`
                  : dateLabel(nextVisit.start);
              })()}
              what={
                s.tasks.find((t) => nextVisit.taskIds.includes(t.id))
                  ?.summary || "Scheduled job"
              }
              where={`${nextRequest?.city ?? ""} · ${money(glance.next!.assignment.pay)}`}
              onClick={() => {
                /* The tab the job is actually under, so the row it opens is
                   one the list is showing. */
                setTab(
                  dayKey(nextVisit.start) === dayKey(+s.clock)
                    ? "Today"
                    : "Upcoming",
                );
                setSelected(glance.next!.assignment.id);
              }}
            />
          ) : (
            <GlanceLead when="Next job" what="Nothing accepted yet." />
          )
        }
        metrics={[
          /* An offer is work on the way, not an error, so it is not drawn
             in the danger colour (ADR 089). */
          {
            label: "New offers",
            value: glance.offers,
            onClick: () => setTab("Offers"),
          },
          {
            label: "Today’s jobs",
            value: glance.today,
            onClick: () => setTab("Today"),
          },
          {
            label: "Upcoming jobs",
            value: glance.upcoming,
            onClick: () => setTab("Upcoming"),
          },
        ]}
      />
      {/* The same count as the Offers tab, because it is the same list. While
          an offer is open below, its Accept is the screen's one primary
          action, so this steps aside (ADR 089). */}
      {glance.offers > 0 && a?.status !== "Offered" && (
        <button className="primary full" onClick={() => setReviewing(true)}>
          Review {glance.offers} offer{glance.offers === 1 ? "" : "s"}
        </button>
      )}
      {reviewing && (
        <ContractorQueue
          s={s}
          update={update}
          provider={provider}
          close={() => setReviewing(false)}
        />
      )}
      <div className="segmented">
        {["Offers", "Today", "Upcoming"].map((t) => (
          <button
            key={t}
            className={tab === t ? "chosen" : ""}
            aria-pressed={tab === t}
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
                {v.duration} minutes · {plural(v.taskIds.length, "task")}
              </p>
              {/* How far it is, beside what it pays (ADR 066). */}
              <p className="muted">
                {tripLabel(v.providerId, r.city, v.travel)}
              </p>
              <h3 className="contractor-pay">{payLabel(a.pay)}</h3>
              <p>
                <When
                  clock={s.clock}
                  at={new Date(a.expiresAt).toISOString()}
                  lead="Expires in"
                />
              </p>
              {v.taskIds.map((id) => {
                const t = s.tasks.find((t) => t.id === id)!;
                return (
                  <details className="work-task" key={id}>
                    {/* One task is the job the h2 already names, so its
                        disclosure is labelled for what it holds (ADR 089). */}
                    <summary>
                      {v.taskIds.length === 1 ? "Task details" : t.summary}
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
                    {t.restricted && <p>Specialist eligibility required</p>}
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
              {decline ? (
                /* The queue's one-tap reasons, here too (ADR 083): one tap
                   declines, and the reason goes to the operator. */
                <fieldset className="job-outcomes" ref={swap.picker}>
                  <legend>Why are you declining?</legend>
                  <div>
                    {[...REASONS, "No reason"].map((why) => (
                      <button
                        key={why}
                        className="secondary"
                        onClick={() =>
                          respond("Declined", why === "No reason" ? "" : why)
                        }
                      >
                        {why}
                      </button>
                    ))}
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setDecline(false)}
                  >
                    Back
                  </button>
                </fieldset>
              ) : (
                <div className="row actions">
                  <button
                    className="primary grow"
                    onClick={() => respond("Accepted")}
                  >
                    Accept job
                  </button>
                  <button
                    ref={swap.trigger}
                    className="secondary grow"
                    onClick={() => setDecline(true)}
                  >
                    Decline
                  </button>
                </div>
              )}
            </section>
          ) : a.status === "Accepted" && todaysJob(v) ? (
            <JobMode
              s={s}
              provider={provider}
              visit={v}
              update={update}
              exit={() => setSelected("")}
              next={() => {
                setSelected(nextAssignment?.id || "");
                setTab("Today");
              }}
              nextLabel={nextAssignment ? "Next job" : "Done for today"}
            />
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
              {/* "Not available" means the hours were wrong, so the place
                  to fix them is one tap away (ADR 067). */}
              {a.declineReason === "Not available" && (
                <>
                  {" "}
                  <button className="text-button" onClick={openAvailability}>
                    Update your availability
                  </button>
                </>
              )}
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
                    <When clock={s.clock} at={v.start} lead="Starts in" />
                  </p>
                  <p className="muted">
                    {tripLabel(v.providerId, r.city, v.travel)}
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
                  {/* The h2 is the first task, so one task needs no list
                      repeating it (ADR 089). */}
                  {v.taskIds.length > 1 && (
                    <ul className="contractor-task-list">
                      {s.tasks
                        .filter((t) => v.taskIds.includes(t.id))
                        .map((t) => (
                          <li key={t.id}>{t.summary}</li>
                        ))}
                    </ul>
                  )}
                  <p>
                    {v.duration} minutes
                    {photoCount(s, v.taskIds)}
                  </p>
                  <h3 className="contractor-pay">{payLabel(a.pay)}</h3>
                  {/* Secondary: a filled button on every card is decoration,
                      and the primary is the page's own (ADR 089). */}
                  <button
                    className="secondary"
                    onClick={() => setSelected(a.id)}
                  >
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
              {/* Done only when there was something to finish: today's list
                  keeps its finished jobs, so an empty one means no jobs
                  (ADR 089). */}
              <h2>
                {tab === "Today"
                  ? assignments.length
                    ? "You’re done for today."
                    : "No jobs today."
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
          {past.length > 0 && (
            <details className="card panel">
              <summary>Past offers & completed work</summary>
              {past.map(({ a, v }) => (
                <button
                  className="queue-item"
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                >
                  {s.tasks.find((t) => v.taskIds.includes(t.id))?.summary} ·{" "}
                  {pastStatus(a)}
                  {a.declineReason && ` · ${a.declineReason}`}
                </button>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  );
}

/** One word for where a past job ended. A finished job is still "Accepted"
 *  underneath, which is the system's word, not the contractor's (ADR 089). */
const pastStatus = (a: Assignment) =>
  a.status === "Accepted" ? "Completed" : a.status;

/** " · 3 photos", or nothing when there are none (ADR 083). */
const photoCount = (s: State, taskIds: string[]) => {
  const n = s.tasks
    .filter((t) => taskIds.includes(t.id))
    .reduce((sum, t) => sum + t.photos.length, 0);
  return n ? ` · ${plural(n, "photo")}` : "";
};
