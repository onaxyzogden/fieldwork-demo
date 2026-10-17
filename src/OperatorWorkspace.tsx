import { OperatorHome, OperatorToday } from "./OperatorWork";
import { dayKey } from "./work";
import { dayLabel } from "./intake";
import { ShieldCheck } from "lucide-react";
import { providers, money, dateLabel, hoursLabel, hoursOf } from "./model";
import { lazyScreen } from "./Recovery";
import { plural } from "./plural";
import { OperatorRequests } from "./OperatorRequests";
import { useWorkspace } from "./workspaceContext";

/* Loaded when first opened, not with the app (ADR 074). */
const Walkthroughs = lazyScreen(() => import("./Walkthroughs"));

/** The operator's pages, one per sidebar entry (ADR 077). */
export function OperatorWorkspace() {
  const {
    page,
    choose,
    notify,
    s,
    setModal,
    setPage,
    setSidebar,
    update,
    r,
    role,
    openWalkthrough,
    setOpenWalkthrough,
  } = useWorkspace();
  /* One pin per listed visit, in appointment order; the dashed route only
     joins them when they are one provider's day (ADR 092). */
  function RouteMap({ stops, route }: { stops: number; route: boolean }) {
    const pins = Array.from({ length: stops }, (_, i) => [
      stops === 1 ? 350 : 110 + (i * 480) / (stops - 1),
      150 - 35 * Math.sin(i * 1.3),
    ]);
    return (
      <div className="route-map">
        <svg
          viewBox="0 0 700 300"
          aria-label={`Illustrative map, ${plural(stops, "visit")}`}
          role="img"
        >
          <defs>
            <pattern
              id="grid"
              width="52"
              height="42"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-21)"
            >
              <path
                d="M 52 0 L 0 0 0 42"
                fill="none"
                stroke="var(--line)"
                strokeWidth="2"
              />
            </pattern>
          </defs>
          <rect width="700" height="300" fill="var(--panel)" />
          <rect width="700" height="300" fill="url(#grid)" />
          <path
            d="M0 258 Q190 196 310 268 T700 210 L700 300H0Z"
            fill="var(--surface-raised)"
          />
          <path
            d="M-30 180 Q190 90 340 125T730 25"
            fill="none"
            stroke="var(--line)"
            strokeWidth="11"
          />
          {route && stops > 1 && (
            <path
              d={"M" + pins.map(([x, y]) => `${x} ${y}`).join(" L")}
              fill="none"
              stroke="var(--accent-text)"
              strokeWidth="4"
              strokeDasharray="7 5"
            />
          )}
          {pins.map(([x, y], i) => (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r="16"
                fill="var(--accent-text)"
                stroke="var(--panel)"
                strokeWidth="4"
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fill="var(--bg)"
                fontSize="12"
                fontWeight="bold"
              >
                {i + 1}
              </text>
            </g>
          ))}
          <text
            x="282"
            y="75"
            fill="var(--muted)"
            fontSize="14"
            letterSpacing="4"
          >
            OAKVILLE
          </text>
          <text
            x="440"
            y="273"
            fill="var(--muted)"
            fontSize="11"
            letterSpacing="3"
          >
            LAKE ONTARIO
          </text>
          <text x="30" y="35" fill="var(--muted)" fontSize="10">
            QEW
          </text>
        </svg>
      </div>
    );
  }
  switch (page) {
    case "Home":
      return (
        <OperatorHome
          s={s}
          open={(id) => {
            choose(id);
            setPage("Requests");
          }}
          update={update}
          today={() => setPage("Today")}
        />
      );
    case "More":
      return (
        <section className="card panel">
          <h1>More</h1>
          {["Contractors", "Activity"].map((x) => (
            <button className="queue-item" key={x} onClick={() => setPage(x)}>
              {x} →
            </button>
          ))}
          {/* Demo settings is in the sidebar, once (ADR 083). */}
        </section>
      );
    case "Walkthroughs":
      return (
        <Walkthroughs
          s={s}
          update={update}
          notify={notify}
          openRequest={(id) => {
            choose(id);
            setPage("Requests");
          }}
          opening={openWalkthrough}
          opened={() => setOpenWalkthrough("")}
        />
      );
    case "Today":
      return (
        <OperatorToday
          s={s}
          mapView={(n, route) => <RouteMap stops={n} route={route} />}
          requests={() => setPage("Requests")}
          update={update}
          open={(id) => {
            choose(id);
            setPage("Requests");
          }}
        />
      );
    case "Contractors":
      return (
        <>
          {/* An operational page: it names itself and compares, rather
             than selling the network to the person who runs it (ADR 085). */}
          <div className="heading">
            <div>
              <h1>Contractors</h1>
              <p>
                {plural(providers.length, "contractor")} · Halton / GTA ·
                invite-only · hours set by each contractor
              </p>
            </div>
          </div>
          <section className="card panel">
            {/* Explicit roles: the stacked layout below 47rem changes these
               elements' display, which can drop table semantics in some
               browsers (ADR 085). */}
            <table className="roster" role="table">
              <caption className="sr-only">
                Contractors, with their rate, hours and restricted-work
                eligibility
              </caption>
              <thead role="rowgroup">
                <tr role="row">
                  {[
                    "Contractor",
                    "Base",
                    "Skills",
                    "Rate",
                    "Hours",
                    "Next day off",
                    "Restricted work",
                  ].map((h) => (
                    <th key={h} scope="col" role="columnheader">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody role="rowgroup">
                {providers.map((p) => {
                  /* Their own hours, as they set them (ADR 067). */
                  const hours = hoursLabel(hoursOf(s, p.id));
                  const off = hoursOf(s, p.id).off.find(
                    (d) => d >= dayKey(s.clock),
                  );
                  return (
                    <tr key={p.id} role="row">
                      <th scope="row" role="rowheader">
                        {p.name}
                        <small>{p.role}</small>
                      </th>
                      <td role="cell" data-label="Base">
                        {p.city}
                      </td>
                      <td
                        role="cell"
                        data-label="Skills"
                        className="roster-wrap"
                      >
                        {p.skills}
                      </td>
                      <td role="cell" data-label="Rate" className="roster-rate">
                        {money(p.rate)} / hour
                      </td>
                      {/* Wraps between groups of days, never inside one. */}
                      <td
                        role="cell"
                        data-label="Hours"
                        className={
                          hours === "No hours set"
                            ? "roster-wrap muted"
                            : "roster-wrap"
                        }
                      >
                        <span>
                          {hours.split(" · ").map((g, i) => (
                            <span key={g}>
                              {i > 0 && " · "}
                              <span className="roster-group">{g}</span>
                            </span>
                          ))}
                        </span>
                      </td>
                      <td
                        role="cell"
                        data-label="Next day off"
                        className={off ? "" : "muted"}
                      >
                        {off ? dayLabel(off) : "None upcoming"}
                      </td>
                      <td
                        role="cell"
                        data-label="Restricted work"
                        className={p.eligible ? "" : "muted"}
                      >
                        {p.eligible ? (
                          <span className="roster-flag">
                            <ShieldCheck aria-hidden="true" size={16} />
                            Marked eligible
                          </span>
                        ) : (
                          "General scope"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="roster-note">
              Restricted-work eligibility is marked by you. Software does not
              verify credentials.
            </p>
          </section>
        </>
      );
    case "Activity":
      return (
        <>
          <div className="heading">
            <div>
              <h1>Activity history</h1>
              <p>A shared record of decisions and simulated notifications.</p>
            </div>
          </div>
          <section className="card panel">
            {s.events.map((e) => {
              const body = (
                <>
                  <span className="event-dot" />
                  <span className="event-body">
                    <strong>{e.text}</strong>
                    <small>{dateLabel(e.at)}</small>
                  </span>
                </>
              );
              /* An entry about a request opens it, as Home's cards do
                 (ADR 083). */
              const id = e.requestId;
              return id && s.requests.some((x) => x.id === id) ? (
                <button
                  className="event event-link"
                  key={e.id}
                  onClick={() => {
                    choose(id);
                    setPage("Requests");
                  }}
                >
                  {body}
                </button>
              ) : (
                <div className="event" key={e.id}>
                  {body}
                </div>
              );
            })}
          </section>
        </>
      );
    case "Requests":
      return <OperatorRequests />;
    default:
      return null;
  }
}
