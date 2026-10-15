/**
 * The operator's Home greeting follows the demo's clock in Toronto time
 * (ADR 084). Fixed instants, so it passes at any hour of the real day.
 */
import { describe, it, expect } from "vitest";
import { greetingFor } from "./OperatorWork";

/* 15 October 2026 is daylight time in Toronto, UTC−4. */
const at = (hhmm: string) => +new Date(`2026-10-15T${hhmm}:00-04:00`);

describe("greetingFor", () => {
  it("says good morning before noon", () => {
    expect(greetingFor(at("00:00"))).toBe("Good morning!");
    expect(greetingFor(at("09:00"))).toBe("Good morning!");
    expect(greetingFor(at("11:59"))).toBe("Good morning!");
  });

  it("says good afternoon from noon until six", () => {
    expect(greetingFor(at("12:00"))).toBe("Good afternoon!");
    expect(greetingFor(at("17:59"))).toBe("Good afternoon!");
  });

  it("says good evening from six", () => {
    expect(greetingFor(at("18:00"))).toBe("Good evening!");
    expect(greetingFor(at("23:59"))).toBe("Good evening!");
  });

  it("reads Toronto's hour, not the machine's", () => {
    /* 20:00 UTC is 16:00 in Toronto. */
    expect(greetingFor(+new Date("2026-10-15T20:00:00Z"))).toBe(
      "Good afternoon!",
    );
  });
});
