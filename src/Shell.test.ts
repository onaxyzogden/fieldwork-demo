import { describe, it, expect } from "vitest";
import { homeOf, identity, initialsOf } from "./Shell";

describe("who the shell says you are (ADR 073)", () => {
  it("takes initials from the first two words of a name", () => {
    expect(initialsOf("Sarah Lin")).toBe("SL");
    expect(initialsOf("Northline Property Management")).toBe("NP");
  });

  it("names the customer account being viewed, not a fixed persona", () => {
    expect(identity("Customer", "marcus", "c1")).toEqual({
      initials: "SL",
      name: "Sarah Lin",
    });
    expect(identity("Customer", "marcus", "c2").initials).toBe("DB");
  });

  it("gives each role one home, which is a sidebar item", () => {
    expect(homeOf("Customer")).toBe("My bookings");
    expect(homeOf("Operator")).toBe("Home");
    expect(homeOf("Contractor")).toBe("Your Work");
  });
});
