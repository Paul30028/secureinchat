import { describe, expect, it } from "vitest";
import { formatMessageTime, formatListTime } from "../src/timeFormat";

/** 固定一个"现在"：2026-08-04 15:30 */
const NOW = new Date(2026, 7, 4, 15, 30, 0).getTime();

describe("formatMessageTime", () => {
  it("shows HH:MM for a message sent earlier today", () => {
    const sent = new Date(2026, 7, 4, 9, 5, 0).getTime();
    expect(formatMessageTime(sent, NOW)).toBe("09:05");
  });

  it("pads single-digit minutes", () => {
    const sent = new Date(2026, 7, 4, 14, 7, 0).getTime();
    expect(formatMessageTime(sent, NOW)).toBe("14:07");
  });

  it("prefixes yesterday's messages", () => {
    const sent = new Date(2026, 7, 3, 22, 15, 0).getTime();
    expect(formatMessageTime(sent, NOW)).toBe("昨天 22:15");
  });

  it("shows month and day for older messages", () => {
    const sent = new Date(2026, 6, 20, 8, 0, 0).getTime();
    expect(formatMessageTime(sent, NOW)).toBe("7月20日 08:00");
  });

  it("treats a message from 23:59 yesterday as yesterday, not as an hours-ago today", () => {
    const sent = new Date(2026, 7, 3, 23, 59, 0).getTime();
    expect(formatMessageTime(sent, NOW)).toBe("昨天 23:59");
  });
});

describe("formatListTime", () => {
  it("says 刚刚 within the first minute", () => {
    expect(formatListTime(NOW - 30_000, NOW)).toBe("刚刚");
  });

  it("counts minutes within the hour", () => {
    expect(formatListTime(NOW - 25 * 60_000, NOW)).toBe("25 分钟前");
  });

  it("switches to a clock time later the same day", () => {
    const sent = new Date(2026, 7, 4, 9, 5, 0).getTime();
    expect(formatListTime(sent, NOW)).toBe("09:05");
  });

  it("says 昨天 for yesterday", () => {
    const sent = new Date(2026, 7, 3, 10, 0, 0).getTime();
    expect(formatListTime(sent, NOW)).toBe("昨天");
  });

  it("shows month and day for older", () => {
    const sent = new Date(2026, 6, 20, 8, 0, 0).getTime();
    expect(formatListTime(sent, NOW)).toBe("7月20日");
  });
});
