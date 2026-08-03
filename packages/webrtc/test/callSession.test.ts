import { beforeEach, describe, expect, it, vi } from "vitest";
import { CallSession, type CallSignalingTransport } from "../src/callSession";
import type { CallStateInfo } from "../src/callState";

/**
 * jsdom 没有 WebRTC 实现，所以这里用假的 RTCPeerConnection / getUserMedia。
 * 这测的是"信令接线对不对"（该发的信令发了没、状态转对了没），
 * 不是"WebRTC 本身能不能连通"——后者只能在真机/真浏览器上验证。
 */
class FakePeerConnection {
  onicecandidate: ((e: { candidate: RTCIceCandidate | null }) => void) | null = null;
  ontrack: ((e: { streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState = "new";
  remoteDescription: unknown = null;
  addedTracks: unknown[] = [];
  addedCandidates: RTCIceCandidateInit[] = [];
  closed = false;

  addTrack(track: unknown) {
    this.addedTracks.push(track);
  }
  async createOffer() {
    return { type: "offer", sdp: "FAKE_OFFER_SDP" };
  }
  async createAnswer() {
    return { type: "answer", sdp: "FAKE_ANSWER_SDP" };
  }
  async setLocalDescription() {}
  async setRemoteDescription(desc: unknown) {
    this.remoteDescription = desc;
  }
  async addIceCandidate(c: RTCIceCandidateInit) {
    this.addedCandidates.push(c);
  }
  close() {
    this.closed = true;
  }
  /** 测试辅助：模拟连接状态变化 */
  simulateConnectionState(state: string) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

class FakeTrack {
  enabled = true;
  stopped = false;
  constructor(public kind: "audio" | "video") {}
  stop() {
    this.stopped = true;
  }
}

let lastPc: FakePeerConnection;
let sentSignals: { type: string; target: string; callId: string; payload?: Record<string, unknown> }[];
let transport: CallSignalingTransport;
let states: CallStateInfo[];
let fakeTracks: FakeTrack[];

beforeEach(() => {
  sentSignals = [];
  states = [];
  fakeTracks = [new FakeTrack("audio"), new FakeTrack("video")];

  (globalThis as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = function () {
    lastPc = new FakePeerConnection();
    return lastPc;
  };

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => fakeTracks,
          getAudioTracks: () => fakeTracks.filter((t) => t.kind === "audio"),
          getVideoTracks: () => fakeTracks.filter((t) => t.kind === "video"),
        }),
      },
    },
  });

  transport = {
    sendSignaling: vi.fn(async (type, target, callId, payload) => {
      sentSignals.push({ type, target, callId, ...(payload ? { payload } : {}) });
    }),
  };
});

function makeSession(kind: "voice" | "video" = "voice") {
  return new CallSession({
    callId: "call-1",
    peerDeviceId: "peer-device",
    kind,
    transport,
    onStateChange: (info) => states.push(info),
    onRemoteStream: () => {},
    onLocalStream: () => {},
  });
}

describe("CallSession — outgoing", () => {
  it("sends call_invite with the local SDP offer and moves to 'outgoing'", async () => {
    const session = makeSession();
    await session.startOutgoing();

    expect(states[0]?.state).toBe("outgoing");
    const invite = sentSignals.find((s) => s.type === "call_invite");
    expect(invite).toBeDefined();
    expect(invite?.target).toBe("peer-device");
    expect(invite?.payload?.sdp).toBe("FAKE_OFFER_SDP");
  });

  it("requests video media only for a video call", async () => {
    await makeSession("voice").startOutgoing();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });

    await makeSession("video").startOutgoing();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: true });
  });

  it("fails honestly when microphone permission is denied instead of appearing to connect", async () => {
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    const session = makeSession();
    await session.startOutgoing();
    expect(session.state).toEqual({ state: "ended", endReason: "failed" });
  });

  it("moves to connected when the peer connection actually connects", async () => {
    const session = makeSession();
    await session.startOutgoing();
    await session.receiveAnswer("FAKE_ANSWER_SDP");
    expect(session.state.state).toBe("connecting");

    lastPc.simulateConnectionState("connected");
    expect(session.state.state).toBe("connected");
  });

  it("reports failure (not a silent hang) when ICE cannot establish a path — the no-TURN case", async () => {
    const session = makeSession();
    await session.startOutgoing();
    await session.receiveAnswer("FAKE_ANSWER_SDP");

    lastPc.simulateConnectionState("failed");
    expect(session.state).toEqual({ state: "ended", endReason: "failed" });
  });
});

describe("CallSession — incoming", () => {
  it("sets the remote offer and replies with call_ring", async () => {
    const session = makeSession();
    await session.receiveInvite("REMOTE_OFFER_SDP");

    expect(session.state.state).toBe("incoming");
    expect(lastPc.remoteDescription).toEqual({ type: "offer", sdp: "REMOTE_OFFER_SDP" });
    expect(sentSignals.some((s) => s.type === "call_ring")).toBe(true);
  });

  it("accepting sends call_answer with the local answer SDP", async () => {
    const session = makeSession();
    await session.receiveInvite("REMOTE_OFFER_SDP");
    await session.accept();

    const answer = sentSignals.find((s) => s.type === "call_answer");
    expect(answer?.payload?.sdp).toBe("FAKE_ANSWER_SDP");
    expect(session.state.state).toBe("connecting");
  });

  it("rejecting sends call_reject and ends the call", async () => {
    const session = makeSession();
    await session.receiveInvite("REMOTE_OFFER_SDP");
    await session.reject();

    expect(sentSignals.some((s) => s.type === "call_reject")).toBe(true);
    expect(session.state).toEqual({ state: "ended", endReason: "rejected" });
  });
});

describe("CallSession — ICE candidates", () => {
  it("buffers candidates that arrive before the remote description, then applies them", async () => {
    const session = makeSession();
    await session.startOutgoing();
    // No remote description yet — this candidate must be buffered, not dropped or thrown.
    await session.receiveIceCandidate({ candidate: "early-candidate" });
    expect(lastPc.addedCandidates).toHaveLength(0);

    await session.receiveAnswer("FAKE_ANSWER_SDP");
    expect(lastPc.addedCandidates).toEqual([{ candidate: "early-candidate" }]);
  });

  it("applies candidates directly once the remote description is set", async () => {
    const session = makeSession();
    await session.startOutgoing();
    await session.receiveAnswer("FAKE_ANSWER_SDP");
    await session.receiveIceCandidate({ candidate: "late-candidate" });
    expect(lastPc.addedCandidates).toContainEqual({ candidate: "late-candidate" });
  });

  it("sends locally-gathered candidates to the peer", async () => {
    const session = makeSession();
    await session.startOutgoing();
    lastPc.onicecandidate?.({
      candidate: { toJSON: () => ({ candidate: "local-cand" }) } as unknown as RTCIceCandidate,
    });
    await Promise.resolve();
    expect(sentSignals.some((s) => s.type === "ice_candidate")).toBe(true);
  });
});

describe("CallSession — teardown and controls", () => {
  it("hangup stops local tracks and closes the peer connection", async () => {
    const session = makeSession("video");
    await session.startOutgoing();
    await session.hangup();

    expect(session.state).toEqual({ state: "ended", endReason: "hungup" });
    expect(fakeTracks.every((t) => t.stopped)).toBe(true);
    expect(lastPc.closed).toBe(true);
  });

  it("mute toggles only audio tracks", async () => {
    const session = makeSession("video");
    await session.startOutgoing();
    session.setMuted(true);

    expect(fakeTracks.find((t) => t.kind === "audio")?.enabled).toBe(false);
    expect(fakeTracks.find((t) => t.kind === "video")?.enabled).toBe(true);
  });

  it("camera toggle affects only video tracks", async () => {
    const session = makeSession("video");
    await session.startOutgoing();
    session.setCameraEnabled(false);

    expect(fakeTracks.find((t) => t.kind === "video")?.enabled).toBe(false);
    expect(fakeTracks.find((t) => t.kind === "audio")?.enabled).toBe(true);
  });

  it("still ends locally even if sending the hangup signal fails (connection already dropped)", async () => {
    transport.sendSignaling = vi.fn().mockRejectedValue(new Error("socket closed"));
    const session = makeSession();
    await session.startOutgoing();
    await session.hangup();
    expect(session.state.state).toBe("ended");
  });
});
