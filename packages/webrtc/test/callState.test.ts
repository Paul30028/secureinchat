import { describe, expect, it } from "vitest";
import { describeCallState, isCallActive, nextCallState, type CallStateInfo } from "../src/callState";

const idle: CallStateInfo = { state: "idle" };

describe("nextCallState — outgoing call happy path", () => {
  it("idle -> outgoing -> ringing-remote -> connecting -> connected", () => {
    let s = nextCallState(idle, { type: "start-outgoing" });
    expect(s.state).toBe("outgoing");
    s = nextCallState(s, { type: "remote-ringing" });
    expect(s.state).toBe("ringing-remote");
    s = nextCallState(s, { type: "remote-accepted" });
    expect(s.state).toBe("connecting");
    s = nextCallState(s, { type: "media-connected" });
    expect(s.state).toBe("connected");
  });

  it("can go straight from outgoing to connecting if the peer answers before ringing arrives", () => {
    const s = nextCallState(nextCallState(idle, { type: "start-outgoing" }), { type: "remote-accepted" });
    expect(s.state).toBe("connecting");
  });
});

describe("nextCallState — incoming call happy path", () => {
  it("idle -> incoming -> connecting -> connected", () => {
    let s = nextCallState(idle, { type: "receive-invite" });
    expect(s.state).toBe("incoming");
    s = nextCallState(s, { type: "accept" });
    expect(s.state).toBe("connecting");
    s = nextCallState(s, { type: "media-connected" });
    expect(s.state).toBe("connected");
  });
});

describe("nextCallState — ending a call", () => {
  it("rejecting an incoming call ends it with reason 'rejected'", () => {
    const s = nextCallState(nextCallState(idle, { type: "receive-invite" }), { type: "reject" });
    expect(s).toEqual({ state: "ended", endReason: "rejected" });
  });

  it("cancelling an outgoing call ends it with reason 'cancelled'", () => {
    const s = nextCallState(nextCallState(idle, { type: "start-outgoing" }), { type: "cancel" });
    expect(s).toEqual({ state: "ended", endReason: "cancelled" });
  });

  it("hangup works from any active state, including mid-connect", () => {
    for (const setup of [
      [{ type: "start-outgoing" as const }],
      [{ type: "receive-invite" as const }],
      [{ type: "receive-invite" as const }, { type: "accept" as const }],
      [{ type: "start-outgoing" as const }, { type: "remote-accepted" as const }, { type: "media-connected" as const }],
    ]) {
      let s: CallStateInfo = idle;
      for (const e of setup) s = nextCallState(s, e);
      const ended = nextCallState(s, { type: "hangup" });
      expect(ended).toEqual({ state: "ended", endReason: "hungup" });
    }
  });

  it("a media failure ends the call with reason 'failed' (not silently pretending to connect)", () => {
    const s = nextCallState(nextCallState(idle, { type: "start-outgoing" }), { type: "failed" });
    expect(s).toEqual({ state: "ended", endReason: "failed" });
  });

  it("the remote hanging up ends the call", () => {
    let s = nextCallState(idle, { type: "receive-invite" });
    s = nextCallState(s, { type: "accept" });
    s = nextCallState(s, { type: "remote-ended" });
    expect(s).toEqual({ state: "ended", endReason: "remote-ended" });
  });
});

describe("nextCallState — robustness against duplicate/out-of-order signaling", () => {
  it("ignores events that don't apply to the current state instead of throwing", () => {
    // A stray 'accept' while idle is meaningless — must not crash or transition.
    expect(nextCallState(idle, { type: "accept" })).toEqual(idle);
    expect(nextCallState(idle, { type: "media-connected" })).toEqual(idle);
  });

  it("a duplicate hangup after the call already ended does not change anything", () => {
    const ended = nextCallState(nextCallState(idle, { type: "start-outgoing" }), { type: "hangup" });
    expect(nextCallState(ended, { type: "hangup" })).toEqual(ended);
    expect(nextCallState(ended, { type: "remote-ended" })).toEqual(ended);
  });

  it("cannot resurrect an ended call with a new invite", () => {
    const ended = nextCallState(nextCallState(idle, { type: "receive-invite" }), { type: "reject" });
    expect(nextCallState(ended, { type: "receive-invite" })).toEqual(ended);
  });
});

describe("isCallActive", () => {
  it("is true for in-progress states and false for idle/ended", () => {
    expect(isCallActive("idle")).toBe(false);
    expect(isCallActive("ended")).toBe(false);
    for (const s of ["outgoing", "ringing-remote", "incoming", "connecting", "connected"] as const) {
      expect(isCallActive(s)).toBe(true);
    }
  });
});

describe("describeCallState", () => {
  it("distinguishes voice and video for incoming and connected", () => {
    expect(describeCallState({ state: "incoming" }, "video")).toContain("视频通话");
    expect(describeCallState({ state: "incoming" }, "voice")).toContain("语音通话");
    expect(describeCallState({ state: "connected" }, "video")).toContain("视频通话");
  });

  it("reports a failed connection honestly rather than as a normal hangup", () => {
    expect(describeCallState({ state: "ended", endReason: "failed" }, "voice")).toBe("通话连接失败");
    expect(describeCallState({ state: "ended", endReason: "rejected" }, "voice")).toBe("对方已拒接");
    expect(describeCallState({ state: "ended", endReason: "remote-ended" }, "voice")).toBe("对方已挂断");
  });
});
