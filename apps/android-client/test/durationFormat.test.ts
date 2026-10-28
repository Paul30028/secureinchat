import { describe, expect, it } from "vitest";
import { formatDuration } from "../src/screens/MediaBubbleContent";

describe("formatDuration", () => {
  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("floors sub-second values to 0:00", () => {
    expect(formatDuration(999)).toBe("0:00");
  });

  it("formats 61 seconds as 1:01", () => {
    expect(formatDuration(61_000)).toBe("1:01");
  });

  it("formats one hour as 60:00", () => {
    expect(formatDuration(3_600_000)).toBe("60:00");
  });

  it("handles negative / non-finite defensively", () => {
    expect(formatDuration(-1)).toBe("0:00");
    expect(formatDuration(Number.NaN)).toBe("0:00");
  });
});
