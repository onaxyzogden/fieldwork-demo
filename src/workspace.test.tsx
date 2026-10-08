// @vitest-environment jsdom
/**
 * Screen tests for the three role workspaces (ADR 077). They pin what each
 * role sees and can do on the seeded demo, so `Workspace` can be broken up
 * one role at a time without changing it. They query by role and visible
 * text, not markup, and avoid anything that depends on today's date.
 */
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import React, { useState } from "react";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import { Workspace, type Role } from "./Workspace";
import { freshDemo } from "./store";
import { providers, type State } from "./model";
import { issueQuote } from "./decisions";
import { addFinding, createWalkthrough } from "./pmw";

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
    open("Operator");
    expect(h1().textContent).toBe("Good morning!");
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

  it("opens Demo settings from More", () => {
    open("Operator");
    go(/^More/);
    fireEvent.click(screen.getByRole("button", { name: "Demo settings →" }));
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
      screen.getByRole("heading", { name: "1 tasks in this visit" }),
    ).toBeTruthy();
  });

  it("asks why before declining, and can be cancelled", () => {
    open("Contractor");
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(
      screen.getByRole("heading", { name: "Why are you declining?" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline job" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("heading", { name: "Why are you declining?" }),
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
    go(/^More/);
    fireEvent.click(screen.getByRole("button", { name: "Demo settings →" }));
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
