import { describe, expect, it } from "vitest";
import {
  createConference,
  addParticipant,
  updateParticipant,
  removeParticipant,
  activeCount,
  isEmpty,
  setSelfMuted,
  shouldInitiateTo,
  MAX_MESH_PARTICIPANTS,
} from "../src/conference";

function conferenceWith(count: number) {
  let state = createConference("conf-1");
  for (let i = 0; i < count; i++) {
    const result = addParticipant(state, `device-${i}`, `成员${i}`);
    if (result.ok) state = result.state;
  }
  return state;
}

describe("joining a conference", () => {
  it("starts with just you", () => {
    const state = createConference("conf-1");
    expect(state.participants).toEqual([]);
    expect(activeCount(state)).toBe(1);
  });

  it("adds a participant with their name", () => {
    const result = addParticipant(createConference("c"), "device-a", "李阳");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.participants[0]).toMatchObject({
        deviceId: "device-a",
        displayName: "李阳",
        state: "inviting",
      });
    }
  });

  it("treats a repeat join as already present rather than an error", () => {
    // 重连会导致重复加入，那不是错误
    const first = addParticipant(createConference("c"), "device-a");
    if (!first.ok) throw new Error("unexpected");
    const second = addParticipant(first.state, "device-a");

    expect(second.ok).toBe(true);
    if (second.ok) expect(second.state.participants).toHaveLength(1);
  });

  it("refuses to exceed the mesh limit", () => {
    // 已经有 MAX-1 个人 + 自己 = 满
    const full = conferenceWith(MAX_MESH_PARTICIPANTS - 1);
    const result = addParticipant(full, "one-too-many");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("人数已满");
  });

  it("rejects at join time rather than letting the call degrade for everyone", () => {
    const full = conferenceWith(MAX_MESH_PARTICIPANTS - 1);
    const result = addParticipant(full, "extra");
    expect(result.ok).toBe(false);
    // 会议本身没被破坏
    expect(activeCount(full)).toBe(MAX_MESH_PARTICIPANTS);
  });

  it("someone who left frees up a slot", () => {
    let full = conferenceWith(MAX_MESH_PARTICIPANTS - 1);
    expect(addParticipant(full, "extra").ok).toBe(false);

    full = removeParticipant(full, "device-0");
    expect(addParticipant(full, "extra").ok).toBe(true);
  });
});

describe("participant lifecycle", () => {
  it("tracks connection progress", () => {
    let state = conferenceWith(1);
    state = updateParticipant(state, "device-0", { state: "connecting" });
    expect(state.participants[0]!.state).toBe("connecting");

    state = updateParticipant(state, "device-0", { state: "connected" });
    expect(state.participants[0]!.state).toBe("connected");
  });

  it("counts only people actually in the call", () => {
    let state = conferenceWith(3);
    state = updateParticipant(state, "device-0", { state: "connected" });
    state = updateParticipant(state, "device-1", { state: "connected" });
    state = updateParticipant(state, "device-2", { state: "failed" });

    // 2 个连上的 + 自己
    expect(activeCount(state)).toBe(3);
  });

  it("knows when everyone else has gone", () => {
    let state = conferenceWith(2);
    expect(isEmpty(state)).toBe(false);

    state = removeParticipant(state, "device-0");
    state = removeParticipant(state, "device-1");
    expect(isEmpty(state)).toBe(true);
  });

  it("tracks who muted themselves", () => {
    let state = conferenceWith(1);
    state = updateParticipant(state, "device-0", { muted: true });
    expect(state.participants[0]!.muted).toBe(true);
  });

  it("tracks your own mute separately", () => {
    const state = setSelfMuted(conferenceWith(1), true);
    expect(state.selfMuted).toBe(true);
    expect(state.participants[0]!.muted).toBe(false);
  });
});

describe("shouldInitiateTo", () => {
  it("exactly one side initiates, so offers don't collide", () => {
    const a = "device-aaa";
    const b = "device-bbb";
    expect(shouldInitiateTo(a, b)).toBe(true);
    expect(shouldInitiateTo(b, a)).toBe(false);
  });

  it("is deterministic rather than timing-dependent", () => {
    // 同一对设备无论谁先进会议，答案都一样
    for (let i = 0; i < 10; i++) {
      expect(shouldInitiateTo("device-m", "device-z")).toBe(true);
    }
  });
});

describe("the limit holds under simultaneous joins", () => {
  it("counts people who are still connecting, not just those already connected", () => {
    // 这条是真踩过的：activeCount 原本只算 connected/connecting，
    // 刚加入(inviting)的人不计数。一堆人同时进会议时每个人看到的都是
    // "还没满"，上限就形同虚设。
    let state = createConference("c");
    for (let i = 0; i < MAX_MESH_PARTICIPANTS - 1; i++) {
      const r = addParticipant(state, `d-${i}`);
      if (r.ok) state = r.state;
    }
    // 全部还停在 inviting，一个都没接通
    expect(state.participants.every((p) => p.state === "inviting")).toBe(true);
    expect(activeCount(state)).toBe(MAX_MESH_PARTICIPANTS);
    expect(addParticipant(state, "extra").ok).toBe(false);
  });

  it("a failed participant doesn't hold a slot hostage", () => {
    let state = createConference("c");
    for (let i = 0; i < MAX_MESH_PARTICIPANTS - 1; i++) {
      const r = addParticipant(state, `d-${i}`);
      if (r.ok) state = r.state;
    }
    state = updateParticipant(state, "d-0", { state: "failed" });
    expect(addParticipant(state, "replacement").ok).toBe(true);
  });
});
