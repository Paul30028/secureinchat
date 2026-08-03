import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { reconnectDelayMs, HEARTBEAT_INTERVAL_MS, RelayClient } from "../src/relayClient";
import { TestOnlyInMemoryKeystore, generateAeadKey } from "@secureinchat/crypto-core";

describe("reconnectDelayMs", () => {
  it("matches the schedule from the relay spec: immediate, 3s, then 5/10/20/30 capped", () => {
    expect(reconnectDelayMs(0)).toBe(0);
    expect(reconnectDelayMs(1)).toBe(3_000);
    expect(reconnectDelayMs(2)).toBe(5_000);
    expect(reconnectDelayMs(3)).toBe(10_000);
    expect(reconnectDelayMs(4)).toBe(20_000);
    expect(reconnectDelayMs(5)).toBe(30_000);
  });

  it("never exceeds the 30s cap no matter how long the outage lasts", () => {
    for (const attempt of [6, 10, 50, 1000]) {
      expect(reconnectDelayMs(attempt)).toBe(30_000);
    }
  });
});

/** 模拟一个行为合规的中继：下发 challenge、接受认证、对 ping 回 pong */
class MockRelaySocket {
  static instances: MockRelaySocket[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closed = false;

  constructor(public url: string) {
    MockRelaySocket.instances.push(this);
    setTimeout(() => {
      this.onmessage?.({ data: JSON.stringify({ type: "auth_challenge", nonce: "n" }) });
    }, 0);
  }

  send(raw: string) {
    this.sent.push(raw);
    const frame = JSON.parse(raw);
    if (frame.type === "register_device" || frame.type === "auth_response") {
      setTimeout(() => this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) }), 0);
    }
    if (frame.type === "ping") {
      setTimeout(
        () => this.onmessage?.({ data: JSON.stringify({ type: "pong", timestamp: frame.timestamp }) }),
        0
      );
    }
  }

  close() {
    this.closed = true;
    this.onclose?.();
  }

  /** 模拟网络掉线（不是主动 close） */
  simulateDrop() {
    this.onclose?.();
  }
}

async function makeConnectedClient(heartbeatIntervalMs?: number) {
  const keystore = new TestOnlyInMemoryKeystore();
  const alias = await keystore.generateDeviceKeyPair("device-1");
  const groupKey = await generateAeadKey();
  const client = new RelayClient("ws://test", {
    deviceId: "device-1",
    groupId: "group-1",
    keystore,
    keystoreAlias: alias,
    groupKey,
    epoch: 0,
    WebSocketImpl: MockRelaySocket as unknown as typeof WebSocket,
    ...(heartbeatIntervalMs !== undefined ? { heartbeatIntervalMs } : {}),
  });
  await client.connect("register");
  return client;
}

describe("RelayClient heartbeat and reconnect", () => {
  beforeEach(() => {
    MockRelaySocket.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports connected status after a successful handshake", async () => {
    const client = await makeConnectedClient();
    expect(client.connectionStatus).toBe("connected");
    client.close();
  });

  it("notifies status handlers on connect and on intentional close", async () => {
    const seen: string[] = [];
    const keystore = new TestOnlyInMemoryKeystore();
    const alias = await keystore.generateDeviceKeyPair("d");
    const groupKey = await generateAeadKey();
    const client = new RelayClient("ws://test", {
      deviceId: "d",
      groupId: "g",
      keystore,
      keystoreAlias: alias,
      groupKey,
      epoch: 0,
      WebSocketImpl: MockRelaySocket as unknown as typeof WebSocket,
    });
    client.onStatusChange((s) => seen.push(s));

    await client.connect("register");
    client.close();

    expect(seen).toContain("connected");
    expect(seen[seen.length - 1]).toBe("disconnected");
  });

  it("sends an application-level ping on the heartbeat interval", async () => {
    // 用一个很短的真实间隔，而不是把假定时器和真实 WebCrypto 混在一起
    const client = await makeConnectedClient(30);
    const socket = MockRelaySocket.instances[0]!;
    const before = socket.sent.filter((s) => JSON.parse(s).type === "ping").length;

    await new Promise((r) => setTimeout(r, 120));
    const after = socket.sent.filter((s) => JSON.parse(s).type === "ping").length;

    expect(after).toBeGreaterThan(before);
    client.close();
  });

  it("reports round-trip latency when a pong comes back", async () => {
    const client = await makeConnectedClient();
    const latencies: number[] = [];
    client.onLatency((rtt) => latencies.push(rtt));

    const socket = MockRelaySocket.instances[0]!;
    socket.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
    await new Promise((r) => setTimeout(r, 20));

    expect(latencies.length).toBeGreaterThan(0);
    expect(latencies[0]).toBeGreaterThanOrEqual(0);
    client.close();
  });

  it("goes to reconnecting (not disconnected) when the connection drops unexpectedly", async () => {
    const client = await makeConnectedClient();
    MockRelaySocket.instances[0]!.simulateDrop();
    expect(client.connectionStatus).toBe("reconnecting");
    client.close();
  });

  it("actually opens a new socket after the backoff elapses", async () => {
    const client = await makeConnectedClient();
    expect(MockRelaySocket.instances).toHaveLength(1);

    // 假定时器必须在掉线之前装上——掉线会用 setTimeout 排重连，
    // 之后再切假定时器就捕获不到那个已经排好的真实定时器了。
    vi.useFakeTimers();
    MockRelaySocket.instances[0]!.simulateDrop();
    vi.advanceTimersByTime(3_100); // 第一次退避是 3s
    expect(MockRelaySocket.instances.length).toBeGreaterThan(1);

    client.close();
  });

  it("does NOT reconnect after an intentional close", async () => {
    const client = await makeConnectedClient();
    client.close();
    const countAfterClose = MockRelaySocket.instances.length;

    vi.useFakeTimers();
    vi.advanceTimersByTime(60_000);

    expect(MockRelaySocket.instances).toHaveLength(countAfterClose);
    expect(client.connectionStatus).toBe("disconnected");
  });

  it("stops the heartbeat once closed (no pings on a dead client)", async () => {
    const client = await makeConnectedClient(30);
    const socket = MockRelaySocket.instances[0]!;
    client.close();
    const pingsAtClose = socket.sent.filter((s) => JSON.parse(s).type === "ping").length;

    await new Promise((r) => setTimeout(r, 150));

    expect(socket.sent.filter((s) => JSON.parse(s).type === "ping")).toHaveLength(pingsAtClose);
  });
});
