import { describe, expect, it } from "vitest";
import {
  addLatencySample,
  EMPTY_LATENCY_STATS,
  MAX_SAMPLES,
  qualityFor,
  describeQuality,
  recordDisconnect,
  recordReconnect,
  probeRelay,
} from "../src/connectionStats";

describe("latency stats", () => {
  it("starts empty rather than pretending to have measured something", () => {
    expect(EMPTY_LATENCY_STATS.averageMs).toBeNull();
    expect(qualityFor(EMPTY_LATENCY_STATS)).toBe("unknown");
    expect(describeQuality("unknown")).toBe("尚未测量");
  });

  it("tracks latest, average, min and max", () => {
    let stats = EMPTY_LATENCY_STATS;
    for (const rtt of [100, 300, 200]) stats = addLatencySample(stats, rtt);

    expect(stats.latestMs).toBe(200);
    expect(stats.averageMs).toBe(200);
    expect(stats.minMs).toBe(100);
    expect(stats.maxMs).toBe(300);
  });

  it("keeps only the most recent samples so memory stays bounded", () => {
    let stats = EMPTY_LATENCY_STATS;
    for (let i = 0; i < MAX_SAMPLES + 20; i++) stats = addLatencySample(stats, i);
    expect(stats.samples).toHaveLength(MAX_SAMPLES);
    expect(stats.samples[stats.samples.length - 1]).toBe(MAX_SAMPLES + 19);
  });

  it("rates a fast connection as good", () => {
    let stats = EMPTY_LATENCY_STATS;
    for (const rtt of [80, 120, 90]) stats = addLatencySample(stats, rtt);
    expect(qualityFor(stats)).toBe("good");
  });

  it("rates a slow connection as poor", () => {
    let stats = EMPTY_LATENCY_STATS;
    for (const rtt of [900, 1100]) stats = addLatencySample(stats, rtt);
    expect(qualityFor(stats)).toBe("poor");
  });

  it("rates the middle band as fair", () => {
    expect(qualityFor(addLatencySample(EMPTY_LATENCY_STATS, 400))).toBe("fair");
  });
});

describe("disconnect history", () => {
  it("records a drop with no recovery time yet", () => {
    const history = recordDisconnect([], 1000);
    expect(history).toEqual([{ atMs: 1000, recoveredAfterMs: null }]);
  });

  it("fills in how long recovery took", () => {
    const dropped = recordDisconnect([], 1000);
    const recovered = recordReconnect(dropped, 4500);
    expect(recovered[0]!.recoveredAfterMs).toBe(3500);
  });

  it("a second reconnect doesn't overwrite the recorded recovery time", () => {
    let history = recordReconnect(recordDisconnect([], 1000), 4000);
    history = recordReconnect(history, 9000);
    expect(history[0]!.recoveredAfterMs).toBe(3000);
  });

  it("reconnecting with no prior drop is a no-op", () => {
    expect(recordReconnect([], 1000)).toEqual([]);
  });

  it("keeps history bounded", () => {
    let history: ReturnType<typeof recordDisconnect> = [];
    for (let i = 0; i < MAX_SAMPLES + 10; i++) history = recordDisconnect(history, i);
    expect(history).toHaveLength(MAX_SAMPLES);
  });
});

describe("probeRelay", () => {
  class FakeSocket {
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;
    closed = false;
    constructor(public url: string, private behaviour: "challenge" | "wrong" | "error" | "silent") {
      setTimeout(() => {
        if (this.behaviour === "challenge") {
          this.onmessage?.({ data: JSON.stringify({ type: "auth_challenge", nonce: "n" }) });
        } else if (this.behaviour === "wrong") {
          this.onmessage?.({ data: JSON.stringify({ type: "hello" }) });
        } else if (this.behaviour === "error") {
          this.onerror?.();
        }
      }, 0);
    }
    close() {
      this.closed = true;
    }
  }

  function socketFactory(behaviour: "challenge" | "wrong" | "error" | "silent") {
    return function (url: string) {
      return new FakeSocket(url, behaviour);
    } as unknown as typeof WebSocket;
  }

  it("succeeds when the server sends auth_challenge", async () => {
    const result = await probeRelay("wss://relay.test", { WebSocketImpl: socketFactory("challenge") });
    expect(result.ok).toBe(true);
  });

  it("reports how long it took, so a slow-but-working link is distinguishable", async () => {
    const result = await probeRelay("wss://relay.test", { WebSocketImpl: socketFactory("challenge") });
    if (result.ok) expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("fails clearly when something else answers on that address", async () => {
    const result = await probeRelay("wss://relay.test", { WebSocketImpl: socketFactory("wrong") });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("不是这个应用的服务器");
  });

  it("fails when the socket errors", async () => {
    const result = await probeRelay("wss://relay.test", { WebSocketImpl: socketFactory("error") });
    expect(result.ok).toBe(false);
  });

  it("times out rather than hanging when the server never answers", async () => {
    const result = await probeRelay("wss://relay.test", {
      WebSocketImpl: socketFactory("silent"),
      timeoutMs: 30,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("超时");
  });
});
