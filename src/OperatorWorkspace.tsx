import { OperatorHome, OperatorToday } from "./OperatorWork";
import { dayKey } from "./work";
import { dayLabel } from "./intake";
import { MapPin } from "lucide-react";
import { providers, money, dateLabel, hoursLabel, hoursOf } from "./model";
import { lazyScreen } from "./Recovery";
import { useWorkspace } from "./workspaceContext";

/* Loaded when first opened, not with the app (ADR 074). */
const Walkthroughs = lazyScreen(() => import("./Walkthroughs"));

/** The operator's pages, except Requests, which `Workspace` still renders (ADR 077). */
export function OperatorWorkspace() {
  const {
    page,
    RouteMap,
    choose,
    notify,
    s,
    setModal,
    setPage,
    setSidebar,
    update,
  } = useWorkspace();
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
    default:
      return null;
  }
}
