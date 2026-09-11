import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Printer,
  Sun,
  Moon,
  Layers,
  ChevronDown,
} from "lucide-react";
import {
  roles,
  stages,
  entities,
  examples,
  alternatives,
  queueRules,
  type Role,
  type Stage,
} from "./blueprint-data";
import "./blueprint.css";
function Detail({ stage }: { stage: Stage }) {
  return (
    <>
      <div className="bp-detail-head">
        <span className="bp-kicker">STAGE {stages.indexOf(stage) + 1} / 8</span>
        <h2>{stage.title}</h2>
        <p>{stage.subtitle}</p>
      </div>
      <dl className="bp-facts">
        <div>
          <dt>Trigger</dt>
          <dd>{stage.trigger}</dd>
        </div>
        <div>
          <dt>Prerequisites</dt>
          <dd>{stage.gate}</dd>
        </div>
        <div>
          <dt>Records involved</dt>
          <dd className="bp-links">
            {stage.records.map((id) => (
              <a href={"#entity-" + id} key={id}>
                {entities.find((e) => e.id === id)?.name}
              </a>
            ))}
          </dd>
        </div>
        <div>
          <dt>Notifications</dt>
          <dd>{stage.notifications}</dd>
        </div>
        <div>
          <dt>Next actions</dt>
          <dd>{stage.next}</dd>
        </div>
      </dl>
      <div className="bp-role-details">
        {roles.map((role) => (
          <section key={role}>
            <h3>{role}</h3>
            <strong>{stage.lanes[role].title}</strong>
            <p>{stage.lanes[role].body}</p>
          </section>
        ))}
      </div>
      <p className="bp-evidence">
        Implementation references: {stage.evidence.join(" · ")}
      </p>
    </>
  );
}
export default function Blueprint() {
  const [selected, setSelected] = useState("submit");
  const [role, setRole] = useState<Role | "All roles">("All roles");
  const [example, setExample] = useState("delegate");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("fieldwork-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.title = "Fieldwork — Developer service blueprint";
  }, [theme]);
  const selectStage = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(".bp-selected");
      panel?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      panel?.focus({ preventScroll: true });
    });
  };
  const current = stages.find((s) => s.id === selected)!;
  const path = examples.find((e) => e.id === example)!;
  return (
    <div className="bp">
      <a className="bp-skip" href="#bp-content">
        Skip to blueprint
      </a>
      <header className="bp-top">
        <a className="bp-brand" href="?">
          fieldwork<span>.</span>
        </a>
        <span className="bp-top-label">DEVELOPER HANDOFF</span>
        <div className="bp-top-actions">
          <a href="?" className="secondary">
            <ArrowLeft size={16} />
            Back to prototype
          </a>
          <button
            className="secondary"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button className="primary" onClick={() => window.print()}>
            <Printer size={16} />
            Print / Save PDF
          </button>
        </div>
      </header>
      <main id="bp-content">
        <section className="bp-hero">
          <div>
            <p className="bp-kicker">ONE REQUEST · THREE PERSPECTIVES</p>
            <h1>See the whole service journey.</h1>
            <p className="bp-intro">
              Who acts, what changes, and what happens next. A service blueprint
              grounded in the working prototype.
            </p>
          </div>
          <aside>
            <Layers size={24} />
            <strong>Request → Tasks → Visit → Assignment</strong>
            <p>
              Quote and payment stay separate. Acceptance alone is not customer
              confirmation.
            </p>
            <span className="bp-chip">Read-only · No demo records changed</span>
          </aside>
        </section>
        <div className="bp-legend">
          <span>
            <i className="bp-dot implemented" />
            Implemented <small>Working prototype behavior</small>
          </span>
          <span>
            <i className="bp-dot simulated" />
            Simulated <small>Local stand-in for an integration</small>
          </span>
          <span>
            <i className="bp-dot gap" />
            Production gap <small>Not implemented; not a commitment</small>
          </span>
        </div>
        <section className="bp-controls" aria-label="Blueprint filters">
          <label>
            Perspective
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role | "All roles")}
            >
              <option>All roles</option>
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            Example path
            <select
              value={example}
              onChange={(e) => {
                setExample(e.target.value);
                setSelected(
                  examples.find((x) => x.id === e.target.value)!.steps[0],
                );
              }}
            >
              {examples.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <a href="#bp-reference">Entity & state reference ↓</a>
        </section>
        <section className="bp-path" aria-live="polite">
          <span className="bp-kicker">EXAMPLE · {path.name}</span>
          <p>{path.text}</p>
          <div>
            {path.steps.map((id, i) => (
              <button
                key={id + i}
                className={selected === id ? "chosen" : ""}
                onClick={() => selectStage(id)}
              >
                {stages.find((s) => s.id === id)?.title}
                {i < path.steps.length - 1 && <ArrowRight size={14} />}
              </button>
            ))}
          </div>
        </section>
        <nav className="bp-stage-nav" aria-label="Journey stages">
          <span>Stage {stages.indexOf(current) + 1} of 8</span>
          {stages.map((s, i) => (
            <button
              key={s.id}
              aria-label={`${i + 1}. ${s.title}`}
              aria-current={selected === s.id ? "step" : undefined}
              onClick={() => selectStage(s.id)}
            >
              <b>{i + 1}</b>
              <span>{s.title}</span>
            </button>
          ))}
        </nav>
        <section className="bp-board" aria-label="Cross-role service blueprint">
          <div
            className="bp-board-grid"
            style={{
              gridTemplateRows: `auto repeat(${role === "All roles" ? 4 : 1},minmax(160px,auto))`,
            }}
          >
            <div className="bp-axis">Perspective / stage</div>
            {stages.map((s, i) => (
              <button
                className={
                  "bp-column " + (selected === s.id ? "is-selected" : "")
                }
                key={s.id}
                onClick={() => selectStage(s.id)}
              >
                <span>0{i + 1}</span>
                <strong>{s.title}</strong>
              </button>
            ))}
            {(role === "All roles" ? roles : [role]).map((r) => (
              <div className="bp-lane" key={r}>
                <div className={"bp-lane-label bp-" + r.toLowerCase()}>
                  <strong>{r}</strong>
                  <small>
                    {r === "System"
                      ? "Records & rules"
                      : r === "Customer"
                        ? "Request & follow"
                        : r === "Operator"
                          ? "Decide & coordinate"
                          : "Accept & deliver"}
                  </small>
                </div>
                {stages.map((s) => (
                  <button
                    key={s.id}
                    className={
                      "bp-cell " + (selected === s.id ? "is-selected" : "")
                    }
                    onClick={() => selectStage(s.id)}
                  >
                    <span className="bp-card-index">{s.capability}</span>
                    <strong>{s.lanes[r].title}</strong>
                    <span>{s.lanes[r].body}</span>
                    <small>Explore handoff ↗</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </section>
        <section className="bp-mobile-stages" aria-label="Stages by role">
          {stages.map((s, i) => (
            <article key={s.id}>
              <button
                className="bp-mobile-heading"
                aria-current={s.id === selected ? "step" : undefined}
                onClick={() => selectStage(s.id)}
              >
                <span>0{i + 1}</span>
                <h2>{s.title}</h2>
                <ChevronDown size={18} />
              </button>
              {(role === "All roles" ? roles : [role]).map((r) => (
                <details key={r}>
                  <summary>
                    {r} · {s.lanes[r].title}
                  </summary>
                  <p>{s.lanes[r].body}</p>
                </details>
              ))}
            </article>
          ))}
        </section>
        <section
          className="bp-selected"
          tabIndex={-1}
          aria-label="Selected stage details"
        >
          <Detail stage={current} />
        </section>
        <section className="bp-print-overview">
          <h1>Fieldwork service blueprint</h1>
          <p>
            Current prototype · Implemented behavior and simulated integrations
            · Full detail follows
          </p>
          <table>
            <thead>
              <tr>
                <th>Perspective</th>
                {stages.map((s, i) => (
                  <th key={s.id}>
                    {i + 1}. {s.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r}>
                  <th>{r}</th>
                  {stages.map((s) => (
                    <td key={s.id}>{s.lanes[r].title}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <strong>Confirmation:</strong> Eligible scope/providers + accepted
            assignments + approved quote + applicable payment.{" "}
            <strong>Completion:</strong> Ends the visit; unresolved tasks
            require operator follow-up. No automatic payout or return visit.
          </p>
        </section>
        <div className="bp-print-details">
          {stages.map((s) => (
            <section key={s.id}>
              <Detail stage={s} />
            </section>
          ))}
        </div>
        <section className="bp-reference" id="bp-reference">
          <p className="bp-kicker">ENTITY & STATE REFERENCE</p>
          <h2>One record, one responsibility.</h2>
          <p>
            Stored values below are distinct from the simplified labels shown on
            screen.
          </p>
          <nav className="bp-links" aria-label="Entity links">
            {entities.map((e) => (
              <a href={"#entity-" + e.id} key={e.id}>
                {e.name}
              </a>
            ))}
          </nav>
          {entities.map((e) => (
            <article id={"entity-" + e.id} key={e.id}>
              <h3>{e.name}</h3>
              <dl>
                <div>
                  <dt>Owns</dt>
                  <dd>{e.owns}</dd>
                </div>
                <div>
                  <dt>States / values</dt>
                  <dd>{e.states}</dd>
                </div>
                <div>
                  <dt>Behavior</dt>
                  <dd>{e.note}</dd>
                </div>
              </dl>
              <div className="bp-links">
                {e.links.map((id) => (
                  <a key={id} href={"#entity-" + id}>
                    {entities.find((e) => e.id === id)?.name} ↗
                  </a>
                ))}
              </div>
            </article>
          ))}
          <article>
            <h3>Derived display & queue labels</h3>
            <p>
              Visit display precedence: Issue → Completed → In Progress → On the
              Way → stored visit status. On the Way is execution-derived; it is
              not an additional stored Visit.status.
            </p>
            <p>{queueRules}</p>
          </article>
        </section>
        <section className="bp-alternatives">
          <p className="bp-kicker">EXCEPTIONS & LIMITS</p>
          <h2>The paths outside the happy path.</h2>
          {alternatives.map(([name, behavior, status, gap]) => (
            <article key={name}>
              <div>
                <h3>{name}</h3>
                <span
                  className={
                    "bp-chip " + (status === "Production gap" ? "gap" : "")
                  }
                >
                  {status}
                </span>
              </div>
              <p>{behavior}</p>
              <p className="bp-muted">{gap}</p>
            </article>
          ))}
        </section>
        <footer className="bp-footer">
          <strong>fieldwork.</strong>
          <p>
            Developer reference · Verified against prototype sources · September
            2026
          </p>
          <p>
            Example paths are documentation, not live bookings. This view does
            not mount the booking app or write to its browser storage.
          </p>
          <a href="?">Return to prototype →</a>
        </footer>
      </main>
    </div>
  );
}
