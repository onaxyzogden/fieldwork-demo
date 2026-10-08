import { OperatorHome, OperatorToday } from "./OperatorWork";
import { dayKey } from "./work";
import { dayLabel } from "./intake";
import { MapPin, ArrowUpRight } from "lucide-react";
import { providers, money, dateLabel, hoursLabel, hoursOf } from "./model";
import { lazyScreen } from "./Recovery";
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
  } = useWorkspace();
  function RouteMap() {
    return (
      <div className="route-map">
        <svg
          viewBox="0 0 700 300"
          aria-label="Illustrative Oakville route map"
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
          <path
            d="M130 179 L232 130 349 166 445 103 553 129"
            fill="none"
            stroke="var(--accent-text)"
            strokeWidth="4"
            strokeDasharray="7 5"
          />
          {[
            [130, 179],
            [349, 166],
            [553, 129],
          ].map(([x, y], i) => (
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
            fill="var(--surface-raised)"
            fontSize="11"
            letterSpacing="3"
          >
            LAKE ONTARIO
          </text>
          <text x="30" y="35" fill="var(--muted)" fontSize="10">
            QEW
          </text>
        </svg>
        <span className="map-label">Illustrative map · simulated travel</span>
        <button
          className="map-expand"
          aria-label="Open route view"
          onClick={() => setPage("Today")}
        >
          <ArrowUpRight size={16} />
        </button>
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
          <button
            className="queue-item"
            onClick={() => {
              setSidebar(false);
              setModal("Demo settings");
            }}
          >
            Demo settings →
          </button>
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
        />
      );
    case "Today":
      return (
        <OperatorToday
          s={s}
          mapView={<RouteMap />}
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
          <div className="heading">
            <div>
              <div className="eyebrow">YOUR TRUSTED NETWORK</div>
              <h1>Good people. Great work.</h1>
              <p>
                Invite-only roster · hours set by each contractor · illustrative
                eligibility
              </p>
            </div>
          </div>
          <div className="roster">
            {providers.map((p) => (
              <section className="card panel" key={p.id}>
                <div className="avatar large">{p.initials}</div>
                <h2>{p.name}</h2>
                <p>{p.role}</p>
                <p>
                  <MapPin size={16} />
                  {p.city} · Halton / GTA
                </p>
                <p>{p.skills}</p>
                <h3>
                  {money(p.rate)}
                  <small> / hour</small>
                </h3>
                {/* Their own hours, as they set them (ADR 067). */}
                <span className="badge green">
                  Active · {hoursLabel(hoursOf(s, p.id))}
                </span>
                {hoursOf(s, p.id).off.some((d) => d >= dayKey(s.clock)) && (
                  <p>
                    Next day off:{" "}
                    {dayLabel(
                      hoursOf(s, p.id).off.find((d) => d >= dayKey(s.clock))!,
                    )}
                  </p>
                )}
                <p>
                  {p.eligible
                    ? "Restricted work eligibility marked by operator; credentials not verified by software."
                    : "General handyman scope only."}
                </p>
              </section>
            ))}
          </div>
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
            {s.events.map((e) => (
              <div className="event" key={e.id}>
                <span className="event-dot" />
                <div>
                  <strong>{e.text}</strong>
                  <small>{dateLabel(e.at)}</small>
                </div>
              </div>
            ))}
          </section>
        </>
      );
    case "Requests":
      return <OperatorRequests />;
    default:
      return null;
  }
}
