import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import {
  registerTap,
  INITIAL_TAP_STATE,
  TAPS_TO_UNLOCK,
  TAP_WINDOW_MS,
  isAdminUnlocked,
  setAdminUnlocked,
} from "../src/adminAccess";

describe("registerTap", () => {
  it("needs exactly seven taps", () => {
    let state = INITIAL_TAP_STATE;
    let result = { unlocked: false } as ReturnType<typeof registerTap>;
    for (let i = 1; i <= TAPS_TO_UNLOCK; i++) {
      result = registerTap(state, 1000 + i * 100);
      state = result.state;
      if (i < TAPS_TO_UNLOCK) expect(result.unlocked).toBe(false);
    }
    expect(result.unlocked).toBe(true);
  });

  it("counts down so the user gets some feedback before it fires", () => {
    const first = registerTap(INITIAL_TAP_STATE, 1000);
    expect(first.remaining).toBe(TAPS_TO_UNLOCK - 1);
  });

  it("restarts counting when taps are too far apart", () => {
    let state = INITIAL_TAP_STATE;
    for (let i = 0; i < 5; i++) {
      state = registerTap(state, 1000 + i * 100).state;
    }
    // 隔了很久再点，应该从 1 重新开始，而不是接着数到 7
    const late = registerTap(state, 1000 + 5 * 100 + TAP_WINDOW_MS + 1);
    expect(late.unlocked).toBe(false);
    expect(late.state.count).toBe(1);
  });

  it("resets the counter after unlocking, so it doesn't re-fire on the next tap", () => {
    let state = INITIAL_TAP_STATE;
    let result = registerTap(state, 1000);
    for (let i = 2; i <= TAPS_TO_UNLOCK; i++) {
      result = registerTap(result.state, 1000 + i * 100);
    }
    expect(result.unlocked).toBe(true);
    expect(result.state).toEqual(INITIAL_TAP_STATE);
  });

  it("taps right at the window boundary still count", () => {
    const state = { count: 3, lastTapAtMs: 1000 };
    expect(registerTap(state, 1000 + TAP_WINDOW_MS).state.count).toBe(4);
  });
});

describe("admin unlock persistence", () => {
  beforeEach(async () => {
    await setAdminUnlocked(false);
  });

  it("starts locked", async () => {
    expect(await isAdminUnlocked()).toBe(false);
  });

  it("remembers being unlocked", async () => {
    await setAdminUnlocked(true);
    expect(await isAdminUnlocked()).toBe(true);
  });

  it("can be locked again", async () => {
    await setAdminUnlocked(true);
    await setAdminUnlocked(false);
    expect(await isAdminUnlocked()).toBe(false);
  });
});
