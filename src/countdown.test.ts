import { describe, it, expect } from "vitest";
import { countdown } from "./countdown";

const at = (min: number) => new Date(1_000_000 + min * 60000).toISOString();

describe("countdown (ADR 063)", () => {
  it("says hours and minutes, the way a person would", () => {
    expect(countdown(1_000_000, at(100))).toEqual({
      text: "1 h 40 m",
      soon: false,
    });
    expect(countdown(1_000_000, at(120))?.text).toBe("2 h");
    expect(countdown(1_000_000, at(25))).toEqual({
      text: "25 min",
      soon: true,
    });
  });
  it('says a day or more in days, not as "50 h 0 m"', () => {
    expect(countdown(1_000_000, at(24 * 60))?.text).toBe("1 day");
    expect(countdown(1_000_000, at(50 * 60))?.text).toBe("2 days");
    expect(countdown(1_000_000, at(23 * 60 + 59))?.text).toBe("23 h 59 m");
  });
  it("is soon under an hour, not at it", () => {
    expect(countdown(1_000_000, at(59))?.soon).toBe(true);
    expect(countdown(1_000_000, at(60))?.soon).toBe(false);
  });
  it("rounds a part-minute up, so it never reads 0 min while still ahead", () => {
    expect(countdown(1_000_000, 1_000_000 + 10_000)?.text).toBe("1 min");
  });
  it("says nothing once the time has passed", () => {
    expect(countdown(1_000_000, at(0))).toBeNull();
    expect(countdown(1_000_000, at(-5))).toBeNull();
    expect(countdown(1_000_000, "not a date")).toBeNull();
  });
});
