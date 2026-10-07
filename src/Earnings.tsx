import { type State, money } from "./model";
import { earnings, weekLabel } from "./earnings";
import { dayLabel } from "./intake";
import { dayKey } from "./work";

/**
 * What a contractor has earned, week by week, and when each week is paid
 * (ADR 067). The payouts are simulated, and the page says so.
 */
export default function Earnings({
  s,
  provider,
}: {
  s: State;
  provider: string;
}) {
  const e = earnings(s, provider, s.clock);
  return (
    <div className="contractor-wrap">
      <div className="heading role-greeting">
        <div>
          <h1>Earnings</h1>
          <p>What you’ve earned, and when it’s paid.</p>
        </div>
      </div>
      {e.weeks.map((w) => (
        <section
          className="card panel"
          key={w.start}
          aria-labelledby={"earn-" + w.start}
        >
          <h2 id={"earn-" + w.start}>{weekLabel(w.start, e.now)}</h2>
          {/* This week's totals so far, at the top of its own card. */}
          {w.start === e.now && (
            <div className="earnings-totals">
              <div>
                <strong>{money(w.earned)}</strong>
                <small>Earned</small>
              </div>
              <div>
                <strong>{money(w.upcoming)}</strong>
                <small>Upcoming</small>
              </div>
            </div>
          )}
          {w.earned > 0 && (
            <p className={"earnings-payout" + (w.payout.paid ? " paid" : "")}>
              {w.payout.paid ? "Paid" : "Payout pending"} ·{" "}
              {dayLabel(w.payout.day)} · {money(w.earned)}
            </p>
          )}
          {w.jobs.length ? (
            <ul className="earnings-jobs">
              {w.jobs.map((j) => (
                <li key={j.assignmentId}>
                  <span>
                    {j.summary}
                    <small className="muted">
                      {dayLabel(dayKey(j.at))} · {j.customer}
                    </small>
                  </span>
                  <span>
                    {money(j.pay)}
                    {!j.done && <small className="muted">upcoming</small>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              {e.weeks.length === 1
                ? "No jobs yet. Accepted jobs and their pay will show here."
                : "No jobs this week."}
            </p>
          )}
        </section>
      ))}
      <p className="muted">Payouts are simulated. No money has been sent.</p>
    </div>
  );
}
