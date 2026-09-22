import { type RefObject } from "react";
import {
  Bell,
  Briefcase,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Layers,
  LayoutDashboard,
  ListTodo,
  Menu,
  Moon,
  MoreHorizontal,
  Navigation,
  Plus,
  RotateCcw,
  Settings,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import { type State, providers } from "./model";

/**
 * The chrome every role shares: the navigation drawer, the prototype banner
 * and the topbar.
 *
 * These sat inline in Workspace, which is how that component reached 3,100
 * lines — the frame and three roles' worth of screens in one function. They
 * are the honest thing to lift out first: they are identical for every role,
 * they are what side by side renders three of, and unlike the role bodies they
 * depend on a handful of named values rather than on two dozen pieces of
 * Workspace's internal state.
 */

export type Role = "Customer" | "Operator" | "Contractor";

/** Who the avatar and the profile line are describing. The operator and the
 *  customer are fixed personas; the contractor is whoever is being viewed as. */
export const identity = (role: Role, contractor: string) =>
  role === "Operator"
    ? { initials: "YH", name: "Yousef Haddad" }
    : role === "Customer"
      ? { initials: "SM", name: "Customer portal" }
      : {
          initials: providers.find((p) => p.id === contractor)?.initials,
          name: providers.find((p) => p.id === contractor)?.name,
        };

const NAV: Record<Role, [typeof Plus, string][]> = {
  Operator: [
    [LayoutDashboard, "Home"],
    [ListTodo, "Requests"],
    [ClipboardCheck, "Walkthroughs"],
    [Navigation, "Today"],
    [MoreHorizontal, "More"],
  ],
  Customer: [
    [Plus, "New request"],
    [CalendarDays, "My bookings"],
  ],
  Contractor: [[Briefcase, "Your Work"]],
};

export function Sidebar({
  s,
  role,
  page,
  setPage,
  open,
  setOpen,
  idPrefix,
  contractor,
  setModal,
  startOrResumeRequest,
}: {
  s: State;
  role: Role;
  page: string;
  setPage: (p: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  idPrefix: string;
  contractor: string;
  setModal: (m: string) => void;
  startOrResumeRequest: () => void;
}) {
  const me = identity(role, contractor);
  return (
    <>
      {open && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id={idPrefix + "workspace-navigation"}
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label="Workspace navigation"
        className={"sidebar " + (open ? "open" : "")}
      >
        {open && (
          <button
            className="text-button drawer-close"
            onClick={() => setOpen(false)}
          >
            Close navigation ×
          </button>
        )}
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">
            <Wrench size={20} />
          </span>
          fieldwork<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <div className="avatar amber">YH</div>
          <div>
            <strong>Yousef’s workspace</strong>
            <small>Halton &amp; Greater Toronto</small>
          </div>
          <span className="online" />
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {NAV[role].map(([Icon, label]) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              onClick={() => {
                if (label === "New request") startOrResumeRequest();
                else setPage(label);
                setOpen(false);
              }}
            >
              <Icon size={24} />
              {label}
              {label === "Requests" && (
                <span className="nav-count">
                  {s.requests.filter((r) => r.status !== "Draft").length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="service-zone">
            <span className="online" /> Service area active
            <small>Oakville · Burlington · Milton</small>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setOpen(false);
              setModal("Demo settings");
            }}
          >
            <Settings size={16} /> Demo settings
          </button>
          <div className="profile">
            <div className="avatar">{me.initials}</div>
            <div>
              <strong>{me.name}</strong>
              <small>{role} view</small>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export function DemoBar({
  role,
  setRole,
  setPage,
  compareMode,
  onEnterCompare,
  onExitCompare,
}: {
  role: Role;
  setRole: (r: Role) => void;
  setPage: (p: string) => void;
  compareMode?: boolean;
  onEnterCompare?: () => void;
  onExitCompare?: () => void;
}) {
  /** Each role lands on its own home, not on whatever the last role was. */
  const homeOf = (r: Role) =>
    r === "Operator" ? "Home" : r === "Customer" ? "My bookings" : "Your Work";
  return (
    <div className="demo-bar">
      <span>
        <span className="demo-dot" /> INTERACTIVE PROTOTYPE{" "}
        <span className="demo-extra">
          · All data and transactions are simulated
        </span>
      </span>
      <div className="role-switch">
        {compareMode ? (
          <>
            <span className="chosen">{role}</span>
            <button className="text-button" onClick={onExitCompare}>
              <X size={16} /> Exit side by side
            </button>
          </>
        ) : (
          <>
            {(["Customer", "Operator", "Contractor"] as const).map((x) => (
              <button
                key={x}
                className={role === x ? "chosen" : ""}
                onClick={() => {
                  setRole(x);
                  setPage(homeOf(x));
                }}
              >
                {x}
              </button>
            ))}
            <button className="text-button" onClick={onEnterCompare}>
              <Layers size={16} /> Side by side
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function Topbar({
  s,
  role,
  page,
  open,
  setOpen,
  idPrefix,
  contractor,
  theme,
  setTheme,
  setModal,
  unread,
  menuTrigger,
}: {
  s: State;
  role: Role;
  page: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  idPrefix: string;
  contractor: string;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  setModal: (m: string) => void;
  unread: number;
  menuTrigger: RefObject<HTMLButtonElement | null>;
}) {
  const toDark = theme === "light";
  const themeLabel = toDark ? "Switch to dark mode" : "Switch to light mode";
  return (
    <header className="topbar">
      <div className="row">
        <button
          className="mobile-menu icon-button"
          ref={menuTrigger}
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls={idPrefix + "workspace-navigation"}
          onClick={() => setOpen(!open)}
        >
          <Menu />
        </button>
        <span>{role}</span>
        <ChevronRight size={16} />
        <strong>{page}</strong>
      </div>
      <div className="row">
        <span className="top-date">
          {new Date(s.clock).toLocaleDateString("en-CA", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </span>
        <button
          className="icon-button"
          aria-label={themeLabel}
          title={themeLabel}
          onClick={() => setTheme(toDark ? "dark" : "light")}
        >
          {toDark ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <button
          className="icon-button"
          aria-label={`View notifications (${unread} unread)`}
          onClick={() => setModal("Notifications")}
        >
          <Bell size={20} />
          {!!unread && <span className="notification-count">{unread}</span>}
        </button>
        <div className="avatar small">
          {identity(role, contractor).initials}
        </div>
      </div>
    </header>
  );
}

/**
 * The Demo settings dialog.
 *
 * It read fourteen pieces of Workspace's internal state inline — setS, save,
 * seed, migrateDispatch, setActive, setCustomer, setStep, setPage and the rest
 * — which is what "reset the demo" needs, but not what a dialog should know.
 * Workspace keeps the resetting and hands this four callbacks, so the dialog
 * describes itself and the state machinery stays where the state is.
 */
export function DemoSettings({
  role,
  autoReoffer,
  activeScenario,
  onChooseScenario,
  onToggleAutoReoffer,
  onAdvanceClock,
  onReset,
}: {
  role: Role;
  autoReoffer: boolean;
  activeScenario: string;
  onChooseScenario: (requestId: string) => void;
  onToggleAutoReoffer: (on: boolean) => void;
  onAdvanceClock: () => void;
  onReset: () => void;
}) {
  const scenarios = [
    "01 Door adjustment",
    "02 Four-task visit",
    "03 Delegate a job",
    "04 Needs review",
    "05 Decline & reassign",
  ];
  return (
    <>
      <details className="sample-scenarios">
        <summary>Sample scenarios</summary>
        <div className="scenario-strip">
          <p>
            Open a fictional sample request. Existing demo changes are
            preserved.
          </p>
          {scenarios.map((x, i) => (
            <button
              className={activeScenario === "r" + (i + 1) ? "selected" : ""}
              key={x}
              onClick={() => onChooseScenario("r" + (i + 1))}
            >
              {x}
            </button>
          ))}
        </div>
      </details>

      <a className="secondary" href="?view=blueprint">
        Developer blueprint →
      </a>
      {role === "Operator" && (
        <div className="dispatch-setting">
          <label className="row">
            <input
              type="checkbox"
              checked={autoReoffer}
              onChange={(e) => onToggleAutoReoffer(e.target.checked)}
            />{" "}
            Automatically reoffer declined jobs
          </label>
          <p>
            Offer to the next eligible contractor at the same time and pay.
            You’ll be notified of the outcome. If no match fits, you choose the
            next step. Existing declines and expired offers remain manual.
          </p>
        </div>
      )}
      <p>
        Mock data is stored in this browser. No real payments or notifications
        are sent.
      </p>
      <p>
        Demo policies: 24-hour change cutoff, sequential two-hour offers,
        weekday 9–5 availability, 15-minute setup/overrun buffer.
      </p>
      <button className="secondary full" onClick={onAdvanceClock}>
        Advance clock 3 hours
      </button>
      <button className="secondary full actions" onClick={onReset}>
        <RotateCcw size={16} /> Reset all demo data
      </button>
    </>
  );
}
