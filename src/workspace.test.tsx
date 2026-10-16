// @vitest-environment jsdom
/**
 * Screen tests for the three role workspaces (ADR 077). They pin what each
 * role sees and can do on the seeded demo, so `Workspace` can be broken up
 * one role at a time without changing it. They query by role and visible
 * text, not markup, and avoid anything that depends on today's date.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import React, { useState } from "react";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
  waitFor,
  act,
} from "@testing-library/react";
import { Workspace, type Role } from "./Workspace";
import { KEY, freshDemo } from "./store";
import {
  approveQuote,
  declineQuote,
  INSTANT_PRICES,
  providers,
  reconcile,
  type State,
} from "./model";
import { issueQuote, nextDecision, offerVisit } from "./decisions";
import {
  addFinding,
  convertApproved,
  createWalkthrough,
  decide,
  sendWalkthrough,
} from "./pmw";
import Assessment from "./Assessment";
import { plural } from "./plural";
import { respondToOffer } from "./dispatch";
import Blueprint from "./Blueprint";
import { bucket } from "./work";
import { greetingFor } from "./OperatorWork";

function Harness({
  role,
  init,
}: {
  role: Role;
  /** Changes to the seeded demo before the first render. */
  init?: (s: State) => void;
}) {
  const [s, setS] = useState<State>(() => {
    const d = freshDemo();
    init?.(d);
    return d;
  });
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  return (
    <Workspace
      s={s}
      setS={setS}
      theme={theme}
      setTheme={setTheme}
      initialRole={role}
    />
  );
}

beforeAll(() => {
  /* jsdom has <dialog> but not its methods. */
  const proto = HTMLDialogElement.prototype;
  proto.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.show ??= proto.showModal;
  proto.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  /* Nor scrolling: the fulfillment panel scrolls itself into view. */
  Element.prototype.scrollIntoView ??= function () {};
  Element.prototype.scrollTo ??= function () {};
});
/* Each role loads as its own chunk (ADR 078). Load all three once, so every
   test renders its role at once, as a returning visit does. The first import
   is transformed on demand, which can take seconds when the suite runs in
   parallel. */
beforeAll(async () => {
  for (const role of ["Operator", "Customer", "Contractor"] as Role[]) {
    render(<Harness role={role} />);
    await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull(), {
      timeout: 20_000,
    });
    cleanup();
  }
  localStorage.clear();
}, 60_000);
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

const open = (role: Role, init?: (s: State) => void) =>
  render(<Harness role={role} init={init} />);
const sidebar = () =>
  within(screen.getAllByRole("navigation", { hidden: true })[0]);
const go = (page: RegExp) =>
  fireEvent.click(sidebar().getByRole("button", { name: page, hidden: true }));
const h1 = () => screen.getByRole("heading", { level: 1 });

describe("Operator workspace", () => {
  it("opens on Home with the decisions waiting", () => {
    /* The greeting follows the demo's clock, which is seeded from now, so
       the heading is checked against that clock, not a time of day. */
    let clock = 0;
    open("Operator", (s) => {
      clock = s.clock;
    });
    expect(h1().textContent).toBe(greetingFor(clock));
    expect(
      screen.getByRole("button", { name: /Work through \d+ decisions?/ }),
    ).toBeTruthy();
    expect(
      sidebar()
        .getByRole("button", { name: /^Home/, hidden: true })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("shows a request with its assignment actions", () => {
    open("Operator");
    go(/^Requests/);
    expect(h1().textContent).toBe("Service requests");
    expect(
      screen.getByRole("heading", { level: 2 }).textContent,
    ).toBe("38 Lakeshore Road West");
    for (const name of ["Offer to a contractor", "Do it myself", "Decline request"])
      expect(screen.getByRole("button", { name })).toBeTruthy();
  });

  it("switches to another request from the list", () => {
    open("Operator");
    go(/^Requests/);
    fireEvent.click(screen.getByRole("button", { name: /^Priya Nair/ }));
    expect(
      screen.getByRole("heading", { level: 2 }).textContent,
    ).toBe("215 New Street");
  });

  it("narrows the request list by search and filter", () => {
    open("Operator");
    go(/^Requests/);
    const search = screen.getByPlaceholderText("Search requests…");
    const list = () =>
      within(search.closest("section")!)
        .getAllByRole("button")
        .map((b) => b.textContent);
    const all = list().length;
    fireEvent.change(search, { target: { value: "Priya" } });
    expect(list()).toHaveLength(1);
    expect(list()[0]).toMatch(/^Priya Nair/);
    fireEvent.change(search, { target: { value: "" } });
    expect(list()).toHaveLength(all);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter requests" }),
      {
        target: { value: "Draft" },
      },
    );
    expect(list().length).toBeLessThan(all);
  });

  it("opens and closes the request list on small screens", () => {
    open("Operator");
    go(/^Requests/);
    const toggle = screen.getByRole("button", { name: "Browse requests" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(
      screen
        .getByRole("button", { name: "Close request list" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("offers the job to a contractor, and goes back", () => {
    open("Operator");
    go(/^Requests/);
    fireEvent.click(
      screen.getByRole("button", { name: "Offer to a contractor" }),
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Assign Contractor" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /^Recommended appointments/ }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Browse requests" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "← Back to request" }));
    expect(
      screen.queryByRole("heading", { name: "Assign Contractor" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Offer to a contractor" }),
    ).toBeTruthy();
  });

  it("schedules the job for the operator", () => {
    open("Operator");
    go(/^Requests/);
    fireEvent.click(screen.getByRole("button", { name: "Do it myself" }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Do It Myself" }),
    ).toBeTruthy();
  });

  it("asks before declining a request, and can be closed", () => {
    open("Operator");
    go(/^Requests/);
    fireEvent.click(screen.getByRole("button", { name: "Decline request" }));
    const dialog = screen.getByRole("dialog", { name: "Decline request" });
    expect(
      within(dialog).getByText(/cancel its proposed visits\?/),
    ).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close dialog" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "38 Lakeshore Road West",
    );
  });

  it("loads Walkthroughs on demand", async () => {
    open("Operator");
    go(/^Walkthroughs/);
    expect(
      await screen.findByRole("heading", { name: "Property walkthroughs" }),
    ).toBeTruthy();
  });

  it("has Today and More pages", () => {
    open("Operator");
    go(/^Today/);
    expect(h1().textContent).toBe("Today");
    go(/^More/);
    expect(h1().textContent).toBe("More");
    expect(screen.getByRole("button", { name: "Activity →" })).toBeTruthy();
  });

  it("lists the contractors from More", () => {
    open("Operator");
    go(/^More/);
    fireEvent.click(screen.getByRole("button", { name: "Contractors →" }));
    expect(h1().textContent).toBe("Good people. Great work.");
    for (const name of ["Marcus Chen", "Nina Patel"])
      expect(screen.getByRole("heading", { name })).toBeTruthy();
  });

  it("shows the activity history from More", () => {
    open("Operator");
    go(/^More/);
    fireEvent.click(screen.getByRole("button", { name: "Activity →" }));
    expect(h1().textContent).toBe("Activity history");
  });

  it("opens Demo settings from the sidebar", () => {
    open("Operator");
    fireEvent.click(
      screen.getByRole("button", { name: /Demo settings/, hidden: true }),
    );
    expect(screen.getByRole("heading", { name: /Demo settings/ })).toBeTruthy();
  });
});

describe("Customer workspace", () => {
  it("opens on My bookings", () => {
    open("Customer");
    expect(h1().textContent).toBe("Home, handled.");
    expect(
      sidebar()
        .getByRole("button", { name: "My bookings", hidden: true })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("button", { name: /^38 Lakeshore Road West/ }),
    ).toBeTruthy();
  });

  it("views the portal as another customer", () => {
    open("Customer");
    fireEvent.click(screen.getByRole("button", { name: "Priya Nair" }));
    expect(screen.getByRole("heading", { name: "Furniture assembly" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^215 New Street/ })).toBeTruthy();
  });

  it("loads New request on demand", async () => {
    open("Customer");
    go(/^New request/);
    expect(
      await screen.findByRole("heading", { name: "Where should we come?" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "A different address" })).toBeTruthy();
  });

  it("offers to continue a request left part way", async () => {
    open("Customer");
    go(/^New request/);
    await screen.findByRole("heading", { name: "Where should we come?" });
    go(/^My bookings/);
    expect(screen.getByRole("button", { name: "Continue request" })).toBeTruthy();
  });
});

describe("Contractor workspace", () => {
  it("opens on Your Work with the offer to review", () => {
    open("Contractor");
    expect(h1().textContent).toBe("Your Work");
    expect(screen.getByRole("heading", { name: "TV mounting" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Your pay: \$110/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept job" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
  });

  it("switches who it is viewing as", () => {
    open("Contractor");
    const pressed = (name: string) =>
      screen.getByRole("button", { name }).getAttribute("aria-pressed");
    expect(pressed("Marcus Chen")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Nina Patel" }));
    expect(pressed("Nina Patel")).toBe("true");
    expect(pressed("Marcus Chen")).toBe("false");
    expect(screen.queryByRole("button", { name: "Accept job" })).toBeNull();
  });

  it("accepts a job", () => {
    open("Contractor");
    fireEvent.click(screen.getByRole("button", { name: "Accept job" }));
    expect(screen.getByText("Job accepted")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Accept job" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "1 task in this visit" }),
    ).toBeTruthy();
  });

  it("asks why before declining, and can go back", () => {
    open("Contractor");
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(
      screen.getByRole("group", { name: "Why are you declining?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.queryByRole("group", { name: "Why are you declining?" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Accept job" })).toBeTruthy();
  });

  it("has Earnings and Availability pages", () => {
    open("Contractor");
    go(/^Earnings/);
    expect(h1().textContent).toBe("Earnings");
    expect(screen.getByRole("heading", { name: "This week" })).toBeTruthy();
    go(/^Availability/);
    expect(h1().textContent).toBe("Availability");
    expect(screen.getByRole("heading", { name: "Each week" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Days off" })).toBeTruthy();
  });
});

describe("Switching roles", () => {
  it("goes from the operator to the contractor's home", () => {
    open("Operator");
    fireEvent.click(screen.getByRole("button", { name: "Contractor" }));
    expect(h1().textContent).toBe("Your Work");
    fireEvent.click(screen.getByRole("button", { name: "Customer" }));
    expect(h1().textContent).toBe("Home, handled.");
  });
});

/* ADR 079: the platform audit's P1s. Focus always lands somewhere, and no
   destructive action happens in one tap. */
describe("Focus and friction (ADR 079)", () => {
  const focused = () => document.activeElement;
  /** Customer c2's own request, with a quote waiting on them. */
  const quoted = (d: State) => {
    const r = d.requests.find(
      (x) => x.accountId === "c2" && x.status !== "Draft",
    )!;
    issueQuote(d, r.id, {
      type: "Fixed price",
      amount: 240,
      payOnCompletion: false,
    });
  };

  it("closes the decision queue on Escape, with focus left on the page", () => {
    open("Operator");
    const trigger = screen.getByRole("button", {
      name: /Work through \d+ decisions?/,
    });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Decisions" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Decisions" })).toBeNull();
    expect(focused()).not.toBe(document.body);
  });

  it("makes the page behind the decision queue inert", () => {
    open("Operator");
    fireEvent.click(
      screen.getByRole("button", { name: /Work through \d+ decisions?/ }),
    );
    /* jsdom keeps `inert` as a property, not an attribute. */
    const dialog = screen.getByRole("dialog", { name: "Decisions" });
    const muted: Element[] = [];
    for (let n: Element | null = dialog; n?.parentElement; n = n.parentElement)
      for (const sib of n.parentElement.children)
        if (sib !== n && (sib as HTMLElement).inert) muted.push(sib);
    expect(muted.length).toBeGreaterThan(0);
  });

  it("asks why before the quote card declines, and keeps focus", () => {
    open("Customer", quoted);
    go(/^My bookings/);
    const card = document.querySelector<HTMLElement>(".panel.quote")!;
    fireEvent.click(within(card).getByRole("button", { name: "Decline" }));
    expect(screen.queryByText("Quote declined")).toBeNull();
    expect(focused()).toBe(
      within(card).getByRole("button", { name: "Too expensive" }),
    );
    fireEvent.click(within(card).getByRole("button", { name: "Back" }));
    expect(focused()).toBe(
      within(card).getByRole("button", { name: "Decline" }),
    );
    fireEvent.click(within(card).getByRole("button", { name: "Decline" }));
    fireEvent.click(
      within(card).getByRole("button", { name: "Too expensive" }),
    );
    expect(screen.getByText("Quote declined")).toBeTruthy();
    expect(focused()).not.toBe(document.body);
  });

  it("confirms before declining an additional charge", () => {
    open("Customer", (d) => {
      quoted(d);
      const q = d.quotes.at(-1)!;
      d.charges = [
        ...(d.charges ?? []),
        {
          id: "ch-test",
          requestId: q.requestId,
          amount: 80,
          reason: "A second shelf",
          taskIds: [],
          status: "Sent",
          plan: {
            providerId: providers[0].id,
            start: new Date(d.clock + 3 * 86400000).toISOString(),
            travel: 0,
            duration: 60,
            pay: 50,
          },
          sentAt: new Date(d.clock).toISOString(),
        },
      ];
    });
    go(/^My bookings/);
    const card = screen
      .getByText("ADDITIONAL CHARGE")
      .closest<HTMLElement>(".panel")!;
    fireEvent.click(within(card).getByRole("button", { name: "Decline" }));
    expect(screen.queryByText("Charge declined")).toBeNull();
    const keep = within(card).getByRole("button", { name: "Keep it" });
    expect(focused()).toBe(keep);
    fireEvent.click(keep);
    fireEvent.click(within(card).getByRole("button", { name: "Decline" }));
    fireEvent.click(
      within(card).getByRole("button", { name: "Decline charge" }),
    );
    expect(screen.getByText("Charge declined")).toBeTruthy();
    expect(focused()).not.toBe(document.body);
  });

  it("moves focus into the queue's decline reasons and back", () => {
    open("Contractor");
    fireEvent.click(
      screen.getByRole("button", { name: /^Review \d+ offers?/ }),
    );
    const dialog = screen.getByRole("dialog", { name: "Offers" });
    const decline = within(dialog).getByRole("button", { name: "Decline" });
    decline.focus();
    fireEvent.click(decline);
    expect(dialog.contains(focused())).toBe(true);
    expect(focused()?.tagName).toBe("BUTTON");
    fireEvent.click(within(dialog).getByRole("button", { name: "Back" }));
    expect(focused()).toBe(
      within(dialog).getByRole("button", { name: "Decline" }),
    );
  });

  it("confirms before resetting the demo", () => {
    open("Operator");
    fireEvent.click(
      screen.getByRole("button", { name: /Demo settings/, hidden: true }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Reset all demo data/ }),
    );
    expect(screen.queryByText("All five scenarios reset")).toBeNull();
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(focused()).toBe(cancel);
    fireEvent.click(cancel);
    fireEvent.click(
      screen.getByRole("button", { name: /Reset all demo data/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset everything" }));
    expect(screen.getByText("All five scenarios reset")).toBeTruthy();
  });

  it("can undo removing a finding", async () => {
    open("Operator", (d) => {
      const w = createWalkthrough(d, "p1");
      addFinding(d, w.id, { area: "Hall", title: "Loose handrail" });
      addFinding(d, w.id, { area: "Kitchen", title: "Dripping tap" });
    });
    go(/^Walkthroughs/);
    await screen.findByRole("heading", { name: "Property walkthroughs" });
    fireEvent.click(
      screen
        .getAllByRole("button")
        .find(
          (b) =>
            b.classList.contains("queue-item") && /Draft/.test(b.textContent!),
        )!,
    );
    const removes = await screen.findAllByRole("button", {
      name: /Remove finding/,
    });
    const before = removes.length;
    fireEvent.click(removes[0]);
    expect(
      screen.queryAllByRole("button", { name: /Remove finding/ }).length,
    ).toBe(before - 1);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      screen.queryAllByRole("button", { name: /Remove finding/ }).length,
    ).toBe(before);
  });

  it("moves focus to the next intake step's heading", async () => {
    open("Customer");
    go(/^New request/);
    await screen.findByRole("heading", { name: "Where should we come?" });
    const saved = screen.getByRole("region", { name: "Your addresses" });
    fireEvent.click(within(saved).getAllByRole("button")[0]);
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    expect(focused()).toBe(
      screen.getByRole("heading", { name: "What do you need taken care of?" }),
    );
  });

  it("says which offers saving hours will withdraw, before it does", () => {
    open("Contractor");
    go(/^Availability/);
    /* No hours at all: every open offer falls outside them. */
    for (const on of screen
      .getAllByRole("button", { pressed: true })
      .filter((b) => b.classList.contains("time-pill")))
      fireEvent.click(on);
    const save = screen.getByRole("button", { name: "Save hours" });
    fireEvent.click(save);
    expect(screen.queryByText("Hours saved")).toBeNull();
    expect(screen.getByText(/^Saving withdraws \d+ offers?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(focused()).toBe(screen.getByRole("button", { name: "Save hours" }));
    fireEvent.click(screen.getByRole("button", { name: "Save hours" }));
    expect(focused()).toBe(
      screen.getByRole("button", { name: "Keep editing" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save and withdraw" }));
    expect(screen.getByText("Hours saved")).toBeTruthy();
    expect(focused()).not.toBe(document.body);
  });

  it("says which role is being viewed", () => {
    open("Operator");
    const group = screen.getByRole("group", { name: "Viewing as" });
    const pressed = (name: string) =>
      within(group).getByRole("button", { name }).getAttribute("aria-pressed");
    expect(pressed("Operator")).toBe("true");
    expect(pressed("Customer")).toBe("false");
  });
});

/* ADR 080: the platform audit's P2s. What the screen says matches what
   happened, and is said where it can be read. */
describe("State and wording (ADR 080)", () => {
  const focused = () => document.activeElement;
  const toasts = () => document.querySelector<HTMLElement>(".toasts")!;
  /** Customer c2, part way through booking the seeded door adjustment. */
  const booking = (d: State) => {
    const r = d.requests.find((x) => x.status === "Draft")!;
    r.accountId = "c2";
    r.intakeScreen = "booking";
    const t = d.tasks.find((x) => x.requestId === r.id)!;
    t.answers = {
      "door-adjust:location": "Interior",
      "door-adjust:symptom": "Rubbing or sticking",
      "door-adjust:damage": "No visible damage",
      "door-adjust:count": "1",
    };
    t.entryStage = "done";
  };
  const instantBook = async () => {
    go(/^New request/);
    await screen.findByRole("heading", { name: "Available appointments" });
    fireEvent.click(document.querySelector(".intake-times button")!);
    fireEvent.click(screen.getByRole("button", { name: "Book & pay $129" }));
  };
  const settings = () =>
    fireEvent.click(
      screen.getAllByRole("button", { name: /Demo settings/ })[0],
    );

  it("keeps the toast region mounted, and an error is an alert", async () => {
    open("Customer", booking);
    expect(toasts().getAttribute("role")).toBe("status");
    settings();
    fireEvent.click(screen.getByLabelText("Customer payments fail"));
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await instantBook();
    fireEvent.click(screen.getByRole("button", { name: /^Pay / }));
    expect(screen.getByRole("alert").textContent).toMatch(
      /payment didn’t go through/,
    );
  });

  it("keeps a new toast up for its full time", () => {
    open("Operator");
    vi.useFakeTimers();
    try {
      const reset = () => {
        settings();
        fireEvent.click(
          screen.getByRole("button", { name: /Reset all demo data/ }),
        );
        fireEvent.click(
          screen.getByRole("button", { name: "Reset everything" }),
        );
      };
      reset();
      act(() => vi.advanceTimersByTime(3000));
      reset();
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.queryByText("All five scenarios reset")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("drops a toast when switching who is being viewed", () => {
    open("Contractor");
    fireEvent.click(screen.getByRole("button", { name: "Accept job" }));
    expect(screen.getByText("Job accepted")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nina Patel" }));
    expect(screen.queryByText("Job accepted")).toBeNull();
  });

  it("names whoever is being viewed in the sidebar", () => {
    open("Contractor");
    const me = document.querySelector<HTMLElement>(".sidebar .workspace")!;
    expect(me.textContent).toContain("Marcus Chen");
    expect(me.textContent).not.toContain("Yousef");
  });

  it("counts the same requests in the sidebar, on Home and in the list", () => {
    const d = freshDemo();
    const needs = d.requests.filter(
      (r) => bucket(d, r.id) === "Needs Action",
    ).length;
    open("Operator");
    const nav = sidebar().getByRole("button", {
      name: /^Requests/,
      hidden: true,
    });
    expect(nav.textContent).toContain(String(needs));
    go(/^Requests/);
    const list = within(
      screen.getByPlaceholderText("Search requests…").closest("section")!,
    )
      .getAllByRole("button")
      .filter((b) => b.classList.contains("queue-item"));
    expect(
      screen.getByText(/^\d+ requests?$/).textContent,
    ).toBe(`${list.length} request${list.length === 1 ? "" : "s"}`);
  });

  it("marks More as current on the pages under it", () => {
    open("Operator");
    go(/^More/);
    fireEvent.click(screen.getByRole("button", { name: "Contractors →" }));
    expect(
      sidebar()
        .getByRole("button", { name: /^More/, hidden: true })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("goes back to the request list, not Home", () => {
    open("Operator");
    go(/^Requests/);
    fireEvent.click(screen.getByRole("button", { name: "← All requests" }));
    expect(h1().textContent).toBe("Service requests");
    expect(focused()).toBe(screen.getByPlaceholderText("Search requests…"));
  });

  it("moves focus to the request chosen from the list", () => {
    open("Operator");
    go(/^Requests/);
    fireEvent.click(screen.getByRole("button", { name: /^Priya Nair/ }));
    expect(focused()).toBe(
      screen.getByRole("heading", { level: 2, name: "215 New Street" }),
    );
  });

  it("says what the decision queue just sent", () => {
    open("Operator");
    fireEvent.click(
      screen.getByRole("button", { name: /Work through \d+ decisions?/ }),
    );
    const dialog = screen.getByRole("dialog", { name: "Decisions" });
    for (let i = 0; i < 6; i++) {
      const offer = within(dialog).queryByRole("button", {
        name: /^Offer to /,
      });
      if (offer) {
        const label = offer.textContent!;
        fireEvent.click(offer);
        expect(within(dialog).getByText("Sent: " + label)).toBeTruthy();
        return;
      }
      fireEvent.click(within(dialog).getByRole("button", { name: /^Skip/ }));
    }
    throw new Error("No offer in the queue");
  });

  it("says an accepted job is waiting on the customer", () => {
    open("Contractor");
    fireEvent.click(screen.getByRole("button", { name: "Accept job" }));
    const job = document.querySelector<HTMLElement>(".work-detail")!;
    expect(within(job).queryByText("Proposed")).toBeNull();
    expect(within(job).getByText("Accepted")).toBeTruthy();
    expect(job.textContent).toMatch(/customer confirms/);
  });

  it("can remove a photo taken on site, and undo it", () => {
    open("Contractor", (d) => {
      const v = d.visits.find((x) => x.providerId === "marcus")!;
      d.assignments.find((a) => a.visitId === v.id)!.status = "Accepted";
      issueQuote(d, v.requestId, {
        type: "Fixed price",
        amount: 240,
        payOnCompletion: true,
      });
      approveQuote(d, d.quotes.at(-1)!.id);
      reconcile(d);
      expect(v.status).toBe("Confirmed");
      v.execution = {
        startedAt: new Date(d.clock).toISOString(),
        outcomes: {
          [v.taskIds[0]]: {
            outcome: "",
            note: "",
            before: ["data:image/png;base64,AA=="],
            after: [],
          },
        },
      };
    });
    expect(screen.getByAltText("before photo 1")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove before photo 1" }),
    );
    expect(screen.queryByAltText("before photo 1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByAltText("before photo 1")).toBeTruthy();
  });

  it("keeps unsaved hours when leaving Availability and coming back", () => {
    open("Contractor");
    go(/^Availability/);
    const pills = () =>
      screen
        .getAllByRole("button", { pressed: true })
        .filter((b) => b.classList.contains("time-pill"));
    const before = pills().length;
    fireEvent.click(pills()[0]);
    expect(screen.getByText(/^Unsaved changes/)).toBeTruthy();
    go(/^Earnings/);
    go(/^Availability/);
    expect(pills().length).toBe(before - 1);
    expect(screen.getByText(/^Unsaved changes/)).toBeTruthy();
  });

  it("says a declined quote is being revised, not that it is ready", () => {
    open("Customer", (d) => {
      const r = d.requests.find(
        (x) => x.accountId === "c2" && x.status !== "Draft",
      )!;
      issueQuote(d, r.id, {
        type: "Fixed price",
        amount: 240,
        payOnCompletion: false,
      });
      declineQuote(d, d.quotes.at(-1)!.id, "Too expensive");
      reconcile(d);
    });
    go(/^My bookings/);
    expect(screen.queryByText("Quote ready")).toBeNull();
    expect(screen.getAllByText(/revising it/).length).toBeGreaterThan(0);
  });

  it("confirms an Instant Book, and focuses the new booking", async () => {
    open("Customer", booking);
    await instantBook();
    fireEvent.click(screen.getByRole("button", { name: /^Pay / }));
    expect(toasts().textContent).toMatch(/^Booked and paid · \$129/);
    await waitFor(() =>
      expect(focused()?.textContent).toMatch(/^124 Maple Grove Drive/),
    );
  });

  it("records the catalogue job's Instant Book price (ADR 084)", async () => {
    open("Customer", booking);
    await instantBook();
    fireEvent.click(screen.getByRole("button", { name: /^Pay / }));
    const saved: State = JSON.parse(localStorage.getItem(KEY)!);
    const quote = saved.quotes.at(-1)!;
    const price = INSTANT_PRICES["Handyman / Doors / Adjustment"];
    expect([quote.amount, quote.high, quote.notes]).toEqual([
      price.amount,
      price.amount,
      price.notes,
    ]);
    expect(saved.payments.at(-1)).toMatchObject({
      quoteId: quote.id,
      amount: price.amount,
      status: "Paid",
    });
  });

  it("says a task is missing beside the task, not in a toast", async () => {
    open("Customer");
    go(/^New request/);
    await screen.findByRole("heading", { name: "Where should we come?" });
    const saved = screen.getByRole("region", { name: "Your addresses" });
    fireEvent.click(within(saved).getAllByRole("button")[0]);
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    expect(toasts().textContent).toBe("");
    expect(screen.getByText("Add a task before continuing.")).toBeTruthy();
    await waitFor(() => expect(focused()?.tagName).toBe("TEXTAREA"));
  });

  it("asks for a description beside photos that have none (ADR 082)", async () => {
    let id = "";
    open("Customer", (d) => {
      const r = d.requests.find((x) => x.status === "Draft")!;
      r.accountId = "c2";
      r.intakeScreen = "tasks";
      const t = d.tasks.find((x) => x.requestId === r.id)!;
      t.description = "";
      t.photos = ["data:image/png;base64,iVBORw0KGgo="];
      id = t.id;
    });
    go(/^New request/);
    fireEvent.click(await screen.findByRole("button", { name: /^Continue/ }));
    expect(toasts().textContent).toBe("");
    const message = screen.getByText(
      "Describe the task for these photos before continuing.",
    );
    const description = document.getElementById("task-description-" + id)!;
    await waitFor(() => expect(focused()).toBe(description));
    expect(description.getAttribute("aria-describedby")).toContain(message.id);
    /* It stays on the tasks screen rather than going on to booking. */
    expect(screen.queryByRole("heading", { name: /appointments/ })).toBeNull();
  });
});

describe("Accessibility (ADR 081)", () => {
  const focused = () => document.activeElement;
  const toasts = () => document.querySelector<HTMLElement>(".toasts")!;
  const focusable = (root: Element) => [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  ];
  /** Tab from the last control comes round to the first, and back. */
  const trapsTab = (dialog: HTMLElement) => {
    const list = focusable(dialog);
    list.at(-1)!.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(focused()).toBe(list[0]);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(focused()).toBe(list.at(-1));
  };
  /** Marcus's confirmed job, started, so it opens on the job screen. */
  const onTheJob = (d: State) => {
    const v = d.visits.find((x) => x.providerId === "marcus")!;
    d.assignments.find((a) => a.visitId === v.id)!.status = "Accepted";
    issueQuote(d, v.requestId, {
      type: "Fixed price",
      amount: 240,
      payOnCompletion: true,
    });
    approveQuote(d, d.quotes.at(-1)!.id);
    reconcile(d);
    v.execution = { startedAt: new Date(d.clock).toISOString(), outcomes: {} };
  };
  /** A draft walkthrough with one finding still to price. */
  const unpriced = (d: State) => {
    d.walkthroughs = d.walkthroughs.filter((x) => x.status !== "Draft");
    const w = createWalkthrough(d, "p1");
    addFinding(d, w.id, { area: "Hall", title: "Loose handrail" });
  };
  const openDraft = async () => {
    go(/^Walkthroughs/);
    await screen.findByRole("heading", { name: "Property walkthroughs" });
    fireEvent.click(
      screen
        .getAllByRole("button")
        .find(
          (b) =>
            b.classList.contains("queue-item") && /Draft/.test(b.textContent!),
        )!,
    );
  };

  it("closes the job screen on Escape, and keeps Tab inside it", () => {
    open("Contractor", onTheJob);
    trapsTab(screen.getByRole("dialog", { name: "Job" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Job" })).toBeNull();
  });

  it("closes the on-site screen on Escape, and keeps Tab inside it", async () => {
    open("Operator", unpriced);
    await openDraft();
    fireEvent.click(await screen.findByRole("button", { name: /^Price 1 item/ }));
    const dialog = screen.getByRole("dialog", { name: "Price items" });
    trapsTab(dialog);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Price items" })).toBeNull();
    expect(focused()).not.toBe(document.body);
  });

  it("says which way an on-site item is priced", async () => {
    open("Operator", unpriced);
    await openDraft();
    fireEvent.click(await screen.findByRole("button", { name: /^Price 1 item/ }));
    const price = screen.getByRole("button", { name: "Price it" });
    const look = screen.getByRole("button", { name: "Needs a closer look" });
    expect([price, look].map((b) => b.getAttribute("aria-pressed"))).toContain(
      "true",
    );
    fireEvent.click(look);
    expect(look.getAttribute("aria-pressed")).toBe("true");
    expect(price.getAttribute("aria-pressed")).toBe("false");
  });

  it("holds a toast while it is pointed at or focused, and can dismiss it", () => {
    open("Contractor");
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Accept job" }));
      fireEvent.mouseEnter(toasts());
      act(() => vi.advanceTimersByTime(10_000));
      expect(screen.queryByText("Job accepted")).not.toBeNull();
      /* Left, it starts its time over rather than vanishing at once. */
      fireEvent.mouseLeave(toasts());
      act(() => vi.advanceTimersByTime(2000));
      expect(screen.queryByText("Job accepted")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(toasts().textContent).toBe("");
      expect(document.activeElement).not.toBe(document.body);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps an error up until it is dismissed", async () => {
    open("Customer", (d) => {
      const r = d.requests.find((x) => x.status === "Draft")!;
      r.accountId = "c2";
      r.intakeScreen = "booking";
      const t = d.tasks.find((x) => x.requestId === r.id)!;
      t.answers = {
        "door-adjust:location": "Interior",
        "door-adjust:symptom": "Rubbing or sticking",
        "door-adjust:damage": "No visible damage",
        "door-adjust:count": "1",
      };
      t.entryStage = "done";
    });
    fireEvent.click(screen.getAllByRole("button", { name: /Demo settings/ })[0]);
    fireEvent.click(screen.getByLabelText("Customer payments fail"));
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    go(/^New request/);
    await screen.findByRole("heading", { name: "Available appointments" });
    fireEvent.click(document.querySelector(".intake-times button")!);
    fireEvent.click(screen.getByRole("button", { name: "Book & pay $129" }));
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: /^Pay / }));
      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.getByRole("alert").textContent).toMatch(
        /payment didn’t go through/,
      );
    } finally {
      vi.useRealTimers();
    }
    fireEvent.click(
      within(screen.getByRole("alert")).getByRole("button", { name: "Dismiss" }),
    );
    expect(screen.getByRole("alert").textContent).toBe("");
  });

  it("marks the chosen request as current in the list", () => {
    open("Operator");
    go(/^Requests/);
    const items = () =>
      screen
        .getAllByRole("button")
        .filter((b) => b.classList.contains("queue-item"));
    expect(
      items().filter((b) => b.getAttribute("aria-current") === "true"),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /^Priya Nair/ }));
    expect(
      screen
        .getByRole("button", { name: /^Priya Nair/ })
        .getAttribute("aria-current"),
    ).toBe("true");
  });

  it("says which appointment is chosen", () => {
    open("Operator");
    go(/^Requests/);
    fireEvent.click(
      screen.getByRole("button", { name: "Offer to a contractor" }),
    );
    const slots = [...document.querySelectorAll<HTMLElement>(".slot-grid .slot")];
    expect(slots.length).toBeGreaterThan(1);
    fireEvent.click(slots[1]);
    expect(slots.map((b) => b.getAttribute("aria-pressed"))).toEqual(
      slots.map((_, i) => String(i === 1)),
    );
  });

  it("says which contractor a reassignment goes to", () => {
    let name = "";
    open("Operator", (d) => {
      const a = d.assignments.find((x) => x.status === "Offered")!;
      respondToOffer(d, a.id, "Declined");
      reconcile(d);
      const v = d.visits.find((x) => x.id === a.visitId)!;
      name = d.requests.find((r) => r.id === v.requestId)!.name;
    });
    go(/^Requests/);
    fireEvent.click(
      screen
        .getAllByRole("button")
        .find(
          (b) =>
            b.classList.contains("queue-item") && b.textContent!.includes(name),
        )!,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Offer to another contractor/ }),
    );
    const cards = [
      ...document.querySelectorAll<HTMLElement>(".provider-options .provider-card"),
    ];
    expect(cards.length).toBeGreaterThan(0);
    fireEvent.click(cards[0]);
    expect(cards[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("says which sample scenario is open", () => {
    open("Operator");
    fireEvent.click(screen.getAllByRole("button", { name: /Demo settings/ })[0]);
    const strip = document.querySelector<HTMLElement>(".scenario-strip")!;
    const buttons = within(strip).getAllByRole("button", { hidden: true });
    fireEvent.click(buttons[1]);
    expect(
      buttons.map((b) => b.getAttribute("aria-pressed")),
    ).toEqual(buttons.map((_, i) => String(i === 1)));
  });

  it("marks the chosen stage on the Blueprint's example path", () => {
    render(<Blueprint />);
    const path = document.querySelector<HTMLElement>(".bp-path")!;
    const steps = within(path).getAllByRole("button");
    fireEvent.click(steps[1]);
    expect(steps[1].getAttribute("aria-current")).toBe("step");
    expect(
      steps.filter((b) => b.getAttribute("aria-current") === "step"),
    ).toHaveLength(1);
  });

  it("says in words which booking steps are done and which is current", () => {
    open("Customer", (d) => {
      const r = d.requests.find(
        (x) => x.accountId === "c2" && x.status !== "Draft",
      )!;
      /* A quote is the current step once someone has taken the job: the
         operator takes it here, which is accepted as it is made. */
      const take = nextDecision(d, r.id);
      if (take?.kind !== "assign") throw new Error("not an assign decision");
      offerVisit(d, {
        requestId: r.id,
        taskIds: take.taskIds,
        providerId: take.self!.providerId,
        start: take.self!.start,
        travel: take.self!.travel,
        duration: take.duration,
        pay: take.self!.pay,
        opKey: "k-track",
      });
      issueQuote(d, r.id, {
        type: "Fixed price",
        amount: 240,
        payOnCompletion: false,
      });
      reconcile(d);
    });
    go(/^My bookings/);
    const steps = [...document.querySelectorAll<HTMLElement>(".status-step")];
    const received = steps.find((x) => x.textContent!.startsWith("Received"))!;
    expect(received.textContent).toMatch(/done/);
    const current = steps.filter(
      (x) => x.getAttribute("aria-current") === "step",
    );
    expect(current.map((x) => x.textContent)).toEqual(["Quote"]);
  });
});

describe("Accessibility (ADR 082)", () => {
  /** Each heading is at most one level below the one before it. */
  const noSkips = () => {
    const levels = [
      ...document.querySelectorAll("main h1, main h2, main h3, main h4, main h5, main h6, [role=dialog] h1, [role=dialog] h2, [role=dialog] h3, [role=dialog] h4"),
    ].map((h) => [Number(h.tagName[1]), h.textContent] as const);
    const skips = levels.filter(
      ([n], i) => i > 0 && n > levels[i - 1][0] + 1,
    );
    expect(skips).toEqual([]);
  };
  const noPriceHeadings = () =>
    expect(
      screen
        .queryAllByRole("heading", { hidden: true })
        .map((h) => h.textContent)
        .filter((x) => /\$\d/.test(x!)),
    ).toEqual([]);
  /** The customer's first open request, with a quote waiting. */
  const quoted = (d: State) => {
    const r = d.requests.find(
      (x) => x.accountId === "c2" && x.status !== "Draft",
    )!;
    issueQuote(d, r.id, {
      type: "Fixed price",
      amount: 240,
      payOnCompletion: false,
    });
    reconcile(d);
  };
  /** The draft request, on the step that asks about its task. */
  const details = (d: State) => {
    const r = d.requests.find((x) => x.status === "Draft")!;
    r.accountId = "c2";
    r.intakeScreen = "tasks";
    const t = d.tasks.find((x) => x.requestId === r.id)!;
    t.answers = {};
    t.entryStage = "details";
    r.editingTaskId = t.id;
  };
  const toAddress = async () => {
    open("Customer");
    go(/^New request/);
    await screen.findByRole("heading", { name: "Where should we come?" });
  };
  const describedBy = (el: Element) =>
    (el.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");

  it("never skips a heading level", async () => {
    open("Operator");
    go(/^Requests/);
    fireEvent.click(
      screen.getByRole("button", { name: "Offer to a contractor" }),
    );
    noSkips();
    cleanup();
    open("Customer", quoted);
    go(/^My bookings/);
    noSkips();
    cleanup();
    open("Operator");
    go(/^Walkthroughs/);
    await screen.findByRole("heading", { name: "Property walkthroughs" });
    fireEvent.click(screen.getByRole("button", { name: /New walkthrough/ }));
    noSkips();
  });

  it("does not make a price a heading", () => {
    open("Customer", quoted);
    go(/^My bookings/);
    expect(screen.getAllByText(/\$240/).length).toBeGreaterThan(0);
    noPriceHeadings();
  });

  it("labels the page list, skips to the content, and keeps the footer out of main", () => {
    open("Operator");
    expect(
      screen.getByRole("navigation", { name: "Pages", hidden: true }),
    ).toBeTruthy();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    const main = document.querySelector("main")!;
    expect(skip.getAttribute("href")).toBe("#" + main.id);
    expect(main.id).not.toBe("");
    expect(document.querySelector("footer")).not.toBeNull();
    expect(main.querySelector("footer")).toBeNull();
    expect(screen.queryByRole("link", { name: /Fieldwork/ })).toBeNull();
  });

  it("names the drawer's close button and the online dot cleanly", () => {
    open("Operator");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Open navigation", hidden: true })[0],
    );
    expect(
      screen
        .getAllByRole("button", { name: "Close navigation", hidden: true })
        .some((b) => b.classList.contains("drawer-close")),
    ).toBe(true);
    expect(
      screen.getAllByRole("img", { name: "Online", hidden: true }).length,
    ).toBeGreaterThan(0);
  });

  it("describes a field by its error, and leaves the error out of its name", async () => {
    open("Operator");
    go(/^Walkthroughs/);
    await screen.findByRole("heading", { name: "Property walkthroughs" });
    fireEvent.click(screen.getByRole("button", { name: /New walkthrough/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Property" }), {
      target: { value: "new" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Start walkthrough/ }));
    const street = screen.getByRole("textbox", { name: "Street address" });
    expect(street.getAttribute("aria-invalid")).toBe("true");
    expect(describedBy(street)).not.toBe("");
  });

  it("keeps Not sure and its error out of a question's name", async () => {
    open("Customer", details);
    go(/^New request/);
    await screen.findByRole("button", { name: "Save answers" });
    fireEvent.click(screen.getByRole("button", { name: "Save answers" }));
    const fields = [
      ...document.querySelectorAll<HTMLElement>(
        "input[id^='q-'], select[id^='q-']",
      ),
    ];
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      const name = screen
        .getAllByRole(f.tagName === "SELECT" ? "combobox" : "textbox")
        .find((x) => x === f);
      expect(name).toBeTruthy();
      const label = document.querySelector(`label[for='${f.id}']`);
      expect(label?.textContent).not.toMatch(/Not sure|Answer this/);
      if (f.getAttribute("aria-invalid") === "true")
        expect(describedBy(f)).toMatch(/Answer this/);
    }
  });

  it("says which address part each field is", async () => {
    await toAddress();
    const auto = [...document.querySelectorAll("[autocomplete]")].map((x) =>
      x.getAttribute("autocomplete"),
    );
    expect(auto).toEqual(
      expect.arrayContaining(["address-line1", "address-line2", "address-level2"]),
    );
    expect(auto).not.toContain("street-address");
  });

  it("says in words which intake steps are done", async () => {
    await toAddress();
    fireEvent.click(
      within(screen.getByRole("region", { name: "Your addresses" })).getAllByRole(
        "button",
      )[0],
    );
    fireEvent.click(screen.getByRole("button", { name: /^Continue/ }));
    const steps = document.querySelector(".intake-steps")!;
    expect(steps.textContent).toMatch(/, done/);
  });

  it("says a deadline is soon in words, not only in colour", () => {
    open("Contractor", (d) => {
      for (const a of d.assignments)
        if (a.status === "Offered") a.expiresAt = d.clock + 30 * 60_000;
    });
    const soon = document.querySelector(".when-soon")!;
    expect(soon).not.toBeNull();
    expect(soon.textContent).toMatch(/soon/);
  });

  it("points each disclosure at what it shows", async () => {
    open("Operator");
    go(/^Requests/);
    const browse = screen.getByRole("button", { name: /Browse requests/ });
    expect(document.getElementById(browse.getAttribute("aria-controls") ?? "")).not.toBeNull();
    cleanup();
    open("Operator");
    go(/^Walkthroughs/);
    await screen.findByRole("heading", { name: "Property walkthroughs" });
    const add = screen.getByRole("button", { name: /New walkthrough/ });
    expect(add.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(add);
    expect(add.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(add.getAttribute("aria-controls") ?? "")).not.toBeNull();
  });

  it("keeps the incoming-update region mounted while it is empty", () => {
    open("Operator", (d) => {
      for (const n of d.notifications || []) n.read = true;
    });
    expect(document.querySelector(".incoming-notice")).toBeNull();
    const region = document.querySelector(".incoming-region");
    expect(region?.getAttribute("role")).toBe("status");
  });

  it("hides icons from a screen reader", () => {
    open("Operator");
    expect(
      [...document.querySelectorAll("svg.lucide")].filter(
        (x) => x.getAttribute("aria-hidden") !== "true",
      ),
    ).toEqual([]);
  });

  it("announces only the Blueprint path's description, outside its footer", () => {
    render(<Blueprint />);
    const path = document.querySelector(".bp-path")!;
    expect(path.getAttribute("aria-live")).toBeNull();
    expect(path.querySelector("p")?.getAttribute("aria-live")).toBe("polite");
    expect(document.querySelector("main .bp-footer")).toBeNull();
  });
});

describe("Friction and wording (ADR 083)", () => {
  /** r2's suggested contractor offer, made before the first render. */
  const offered = (d: State) => {
    const take = nextDecision(d, "r2");
    if (take?.kind !== "assign" || !take.offer) throw new Error("no offer");
    offerVisit(d, {
      requestId: "r2",
      taskIds: take.taskIds,
      providerId: take.offer.providerId,
      start: take.offer.start,
      travel: take.offer.travel,
      duration: take.duration,
      pay: take.offer.pay,
      opKey: "k-083",
    });
    reconcile(d);
  };

  it("takes back an offer from the decision queue", () => {
    open("Operator");
    fireEvent.click(
      screen.getByRole("button", { name: /Work through \d+ decisions?/ }),
    );
    const dialog = screen.getByRole("dialog", { name: "Decisions" });
    for (let i = 0; i < 6; i++) {
      const offer = within(dialog).queryByRole("button", { name: /^Offer to / });
      if (offer) {
        fireEvent.click(offer);
        fireEvent.click(within(dialog).getByRole("button", { name: /^Undo/ }));
        expect(within(dialog).getByText(/^Offer to .* withdrawn/)).toBeTruthy();
        expect(within(dialog).queryByRole("button", { name: /^Undo/ })).toBeNull();
        return;
      }
      fireEvent.click(within(dialog).getByRole("button", { name: /^Skip/ }));
    }
    throw new Error("No offer in the queue");
  });

  it("withdraws an offer from the request page until it is accepted", () => {
    open("Operator", offered);
    go(/^Requests/);
    fireEvent.click(screen.getByRole("button", { name: /^Visits/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Withdraw offer/ }));
    expect(screen.getByText(/Offer withdrawn/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Withdraw offer/ })).toBeNull();
    cleanup();
    open("Operator", (d) => {
      offered(d);
      respondToOffer(d, d.assignments.at(-1)!.id, "Accepted");
      reconcile(d);
    });
    go(/^Requests/);
    fireEvent.click(screen.getByRole("button", { name: /^Visits/ }));
    expect(screen.queryByRole("button", { name: /^Withdraw offer/ })).toBeNull();
  });

  it("shows a converted assessment's decisions without buttons for them", () => {
    const s = freshDemo();
    const w = createWalkthrough(s, "p2");
    const f = addFinding(s, w.id, {
      title: "Door rubbing against frame",
      proposed: "Adjust the sticking door",
      price: 180,
    });
    sendWalkthrough(s, w.id);
    decide(s, f.id, "Approved");
    convertApproved(s, w.id);
    localStorage.setItem(KEY, JSON.stringify(s));
    render(<Assessment token={w.access!.token} />);
    for (const name of [/^Approve$/, /^Not now$/])
      expect(screen.queryByRole("button", { name })).toBeNull();
    const card = screen
      .getByRole("heading", { name: /Door rubbing/ })
      .closest("section")!;
    expect(card.querySelectorAll(".badge").length).toBe(1);
  });

  it("calls the operator's bucket Needs Action everywhere", () => {
    open("Operator");
    expect(screen.queryByText(/Needs Attention/)).toBeNull();
    expect(screen.queryByLabelText(/needing attention/)).toBeNull();
  });

  it("counts in the singular when there is one", () => {
    expect([plural(1, "task"), plural(2, "task"), plural(0, "photo")]).toEqual([
      "1 task",
      "2 tasks",
      "0 photos",
    ]);
    open("Contractor");
    expect(screen.queryByText(/\b1 tasks\b/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Accept job" }));
    expect(
      screen.getByRole("heading", { name: "1 task in this visit" }),
    ).toBeTruthy();
  });

  it("counts in the singular in the operator's request list", () => {
    open("Operator");
    go(/^Requests/);
    expect(screen.getAllByText(/· 1 task$/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\b1 tasks\b/)).toBeNull();
  });

  it("says nothing about photos when there are none", () => {
    const none = (d: State) => {
      for (const t of d.tasks) t.photos = [];
    };
    open("Contractor", none);
    expect(screen.queryByText(/\b0 photos\b/)).toBeNull();
    cleanup();
    open("Operator", none);
    go(/^Requests/);
    expect(screen.queryByText(/\b0 photos\b/)).toBeNull();
  });

  it("opens a request from its activity entry", () => {
    open("Operator", offered);
    go(/^More/);
    fireEvent.click(screen.getByRole("button", { name: "Activity →" }));
    fireEvent.click(
      within(screen.getByRole("main")).getAllByRole("button", { name: /·/ })[0],
    );
    expect(h1().textContent).toBe("Service requests");
  });

  it("keeps Demo settings in the sidebar only", () => {
    open("Operator");
    go(/^More/);
    expect(screen.queryByRole("button", { name: "Demo settings →" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Demo settings/, hidden: true }),
    ).toBeTruthy();
  });

  it("says what the Requests count counts", () => {
    open("Operator");
    expect(
      sidebar().getByRole("button", {
        name: /^Requests, \d+ needs? action$/,
        hidden: true,
      }),
    ).toBeTruthy();
  });

  it("declines from the Work page with the queue's one-tap reasons", () => {
    open("Contractor");
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    const why = screen.getByRole("group", { name: "Why are you declining?" });
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(within(why).getByRole("button", { name: "Too far" }));
    expect(screen.queryByRole("button", { name: "Accept job" })).toBeNull();
  });

  it("names what each Remove removes", async () => {
    open("Contractor");
    go(/^Availability/);
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2099-03-02" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add day off" }));
    expect(
      screen.getByRole("button", { name: /^Remove day off / }),
    ).toBeTruthy();
    cleanup();
    open("Customer", (d) => {
      const r = d.requests.find((x) => x.status === "Draft")!;
      r.accountId = "c2";
      r.intakeScreen = "tasks";
      const t = d.tasks.find((x) => x.requestId === r.id)!;
      t.entryStage = "description";
      d.tasks.push({
        ...structuredClone(t),
        id: "t-083",
        description: "Fix the gate latch",
      });
    });
    go(/^New request/);
    await screen.findByRole("heading", {
      name: /What do you need taken care of/,
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove task 2" }));
    expect(
      screen.getAllByRole("status").map((x) => x.textContent).join(" "),
    ).toMatch(/Fix the gate latch/);
  });

  it("puts one primary action on the customer's Home", () => {
    open("Customer", (d) => {
      const r = d.requests.find(
        (x) => x.accountId === "c2" && x.status !== "Draft",
      )!;
      issueQuote(d, r.id, {
        type: "Fixed price",
        amount: 240,
        payOnCompletion: false,
      });
      reconcile(d);
    });
    go(/^My bookings/);
    if (!document.querySelector(".accordion-head[aria-expanded=true]"))
      fireEvent.click(document.querySelector(".accordion-head")!);
    expect(document.querySelectorAll("main button.primary").length).toBe(1);
  });

  it("does not name the provider before they accept", () => {
    let name = "";
    open("Customer", (d) => {
      const r = d.requests.find(
        (x) => x.accountId === "c2" && x.status !== "Draft",
      )!;
      const take = nextDecision(d, r.id);
      if (take?.kind !== "assign" || !take.offer) throw new Error("no offer");
      name = providers.find((p) => p.id === take.offer!.providerId)!.name;
      offerVisit(d, {
        requestId: r.id,
        taskIds: take.taskIds,
        providerId: take.offer.providerId,
        start: take.offer.start,
        travel: take.offer.travel,
        duration: take.duration,
        pay: take.offer.pay,
        opKey: "k-083-k",
      });
      reconcile(d);
    });
    go(/^My bookings/);
    if (!document.querySelector(".accordion-head[aria-expanded=true]"))
      fireEvent.click(document.querySelector(".accordion-head")!);
    expect(screen.queryByText(new RegExp("^" + name + " ·"))).toBeNull();
    expect(screen.getByText(/^Your provider ·/)).toBeTruthy();
  });
});
