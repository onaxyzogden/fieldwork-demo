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
} from "@testing-library/react";
import { Workspace, type Role } from "./Workspace";
import { freshDemo } from "./store";
import type { State } from "./model";

function Harness({ role }: { role: Role }) {
  const [s, setS] = useState<State>(freshDemo);
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
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const open = (role: Role) => render(<Harness role={role} />);
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
