import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildIceServers,
  probeIceServers,
  IceConfigError,
  DEFAULT_STUN_URLS,
  type IceConfiguration,
} from "../src/iceConfig";

describe("buildIceServers", () => {
  it("falls back to the default public STUN when nothing is configured", () => {
    const config = buildIceServers();
    expect(config.iceServers).toEqual([{ urls: DEFAULT_STUN_URLS }]);
    expect(config.hasTurn).toBe(false);
    expect(config.iceTransportPolicy).toBe("all");
  });

  it("includes a configured TURN server and reports hasTurn", () => {
    const config = buildIceServers({
      turn: { url: "turn:turn.example.com:3478", username: "u", credential: "p" },
    });
    expect(config.hasTurn).toBe(true);
    expect(config.iceServers).toContainEqual({
      urls: "turn:turn.example.com:3478",
      username: "u",
      credential: "p",
    });
  });

  it("accepts turns: (TLS) URLs", () => {
    const config = buildIceServers({
      turn: { url: "turns:turn.example.com:5349", username: "u", credential: "p" },
    });
    expect(config.hasTurn).toBe(true);
  });

  it("rejects a TURN url with the wrong scheme", () => {
    expect(() =>
      buildIceServers({ turn: { url: "https://turn.example.com", username: "u", credential: "p" } })
    ).toThrow(IceConfigError);
  });

  it("rejects incomplete TURN credentials rather than silently producing a broken config", () => {
    expect(() =>
      buildIceServers({ turn: { url: "turn:turn.example.com:3478", username: "", credential: "p" } })
    ).toThrow(IceConfigError);
  });

  it("sets iceTransportPolicy=relay when forceRelay is on and TURN exists", () => {
    const config = buildIceServers({
      turn: { url: "turn:t:3478", username: "u", credential: "p" },
      forceRelay: true,
    });
    expect(config.iceTransportPolicy).toBe("relay");
  });

  it("refuses forceRelay without TURN — that combination can never connect", () => {
    expect(() => buildIceServers({ forceRelay: true })).toThrow(IceConfigError);
  });

  it("honours custom STUN urls", () => {
    const config = buildIceServers({ stunUrls: ["stun:stun.example.org:3478"] });
    expect(config.iceServers[0]).toEqual({ urls: ["stun:stun.example.org:3478"] });
  });
});

describe("probeIceServers", () => {
  const originalRTC = globalThis.RTCPeerConnection;

  afterEach(() => {
    globalThis.RTCPeerConnection = originalRTC;
  });

  const config: IceConfiguration = {
    iceServers: [{ urls: "stun:x" }],
    iceTransportPolicy: "all",
    hasTurn: false,
  };

  it("reports unsupported when WebRTC is unavailable", async () => {
    // @ts-expect-error deliberately removing the global for this test
    delete globalThis.RTCPeerConnection;
    const result = await probeIceServers(config);
    expect(result).toEqual({ ok: false, error: "当前环境不支持 WebRTC" });
  });

  it("detects a relay candidate when TURN is working", async () => {
    class FakePC {
      onicecandidate: ((e: { candidate: { candidate: string } | null }) => void) | null = null;
      addTransceiver() {}
      async createOffer() {
        return { type: "offer", sdp: "" };
      }
      async setLocalDescription() {
        setTimeout(() => {
          this.onicecandidate?.({ candidate: { candidate: "candidate:1 1 udp 1 1.2.3.4 1 typ srflx" } });
          this.onicecandidate?.({ candidate: { candidate: "candidate:2 1 udp 1 5.6.7.8 1 typ relay" } });
          this.onicecandidate?.({ candidate: null });
        }, 0);
      }
      close() {}
    }
    globalThis.RTCPeerConnection = FakePC as unknown as typeof RTCPeerConnection;

    const result = await probeIceServers(config, 500);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sawRelayCandidate).toBe(true);
      expect(result.candidateTypes.sort()).toEqual(["relay", "srflx"]);
    }
  });

  it("reports no relay candidate when only STUN candidates are gathered (cross-carrier calls will likely fail)", async () => {
    class FakePC {
      onicecandidate: ((e: { candidate: { candidate: string } | null }) => void) | null = null;
      addTransceiver() {}
      async createOffer() {
        return { type: "offer", sdp: "" };
      }
      async setLocalDescription() {
        setTimeout(() => {
          this.onicecandidate?.({ candidate: { candidate: "candidate:1 1 udp 1 1.2.3.4 1 typ host" } });
          this.onicecandidate?.({ candidate: null });
        }, 0);
      }
      close() {}
    }
    globalThis.RTCPeerConnection = FakePC as unknown as typeof RTCPeerConnection;

    const result = await probeIceServers(config, 500);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sawRelayCandidate).toBe(false);
  });

  it("returns an error result instead of throwing when the connection blows up", async () => {
    class ExplodingPC {
      constructor() {
        throw new Error("boom");
      }
    }
    globalThis.RTCPeerConnection = ExplodingPC as unknown as typeof RTCPeerConnection;

    const result = await probeIceServers(config, 500);
    expect(result).toEqual({ ok: false, error: "boom" });
  });
});
