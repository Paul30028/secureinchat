import { describe, expect, it } from "vitest";
import {
  addLatencySample,
  EMPTY_LATENCY_STATS,
  MAX_SAMPLES,
  qualityFor,
  describeQuality,
  recordDisconnect,
  recordReconnect,
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
