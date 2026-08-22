import { describe, expect, it, beforeEach } from "vitest";
import { RelayClient } from "../src/relayClient";
import { TestOnlyInMemoryKeystore, generateAeadKey } from "@secureinchat/crypto-core";

/** 假中继，可以手动下发 presence 相关的帧 */
class MockRelaySocket {
  static instances: MockRelaySocket[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    MockRelaySocket.instances.push(this);
    setTimeout(() => this.onmessage?.({ data: JSON.stringify({ type: "auth_challenge", nonce: "n" }) }), 0);
  }

  send(raw: string) {
    this.sent.push(raw);
    const frame = JSON.parse(raw);
    if (frame.type === "register_device" || frame.type === "auth_response") {
      setTimeout(() => this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) }), 0);
    }
  }

  close() {
    this.onclose?.();
  }

  /** 服务端主动推一帧 */
  push(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

async function makeConnectedClient() {
  const keystore = new TestOnlyInMemoryKeystore();
  const alias = await keystore.generateDeviceKeyPair("me");
  const groupKey = await generateAeadKey();
  const client = new RelayClient("ws://test", {
    deviceId: "me",
    groupId: "g",
    keystore,
    keystoreAlias: alias,
    groupKey,
    epoch: 0,
    WebSocketImpl: MockRelaySocket as unknown as typeof WebSocket,
  });
  await client.connect("register");
  return { client, socket: MockRelaySocket.instances[MockRelaySocket.instances.length - 1]! };
}

describe("RelayClient presence", () => {
  beforeEach(() => {
    MockRelaySocket.instances = [];
  });

  it("starts with nobody online", async () => {
    const { client } = await makeConnectedClient();
    expect(client.onlinePeers).toEqual([]);
    client.close();
  });

  it("adopts the roster the relay sends on connect", async () => {
    const { client, socket } = await makeConnectedClient();
    socket.push({ type: "presence", deviceIds: ["alice", "bob"] });
    expect(client.onlinePeers.sort()).toEqual(["alice", "bob"]);
    client.close();
  });

  it("adds a peer that joins", async () => {
    const { client, socket } = await makeConnectedClient();
    socket.push({ type: "presence", deviceIds: ["alice"] });
    socket.push({ type: "peer_joined", deviceId: "bob" });
    expect(client.onlinePeers.sort()).toEqual(["alice", "bob"]);
    client.close();
  });

  it("removes a peer that leaves", async () => {
    const { client, socket } = await makeConnectedClient();
    socket.push({ type: "presence", deviceIds: ["alice", "bob"] });
    socket.push({ type: "peer_left", deviceId: "alice" });
    expect(client.onlinePeers).toEqual(["bob"]);
    client.close();
  });

  it("a fresh roster replaces the old one rather than merging (matters after reconnect)", async () => {
    const { client, socket } = await makeConnectedClient();
    socket.push({ type: "presence", deviceIds: ["alice", "bob"] });
    socket.push({ type: "presence", deviceIds: ["carol"] });
    expect(client.onlinePeers).toEqual(["carol"]);
    client.close();
  });

  it("notifies handlers on every change", async () => {
    const { client, socket } = await makeConnectedClient();
    const seen: string[][] = [];
    client.onPeersChange((peers) => seen.push([...peers].sort()));

    socket.push({ type: "presence", deviceIds: ["alice"] });
    socket.push({ type: "peer_joined", deviceId: "bob" });
    socket.push({ type: "peer_left", deviceId: "alice" });

    expect(seen).toEqual([["alice"], ["alice", "bob"], ["bob"]]);
    client.close();
  });

  it("ignores malformed presence frames instead of corrupting the roster", async () => {
    const { client, socket } = await makeConnectedClient();
    socket.push({ type: "presence", deviceIds: ["alice"] });

    socket.push({ type: "presence" }); // 没有 deviceIds
    socket.push({ type: "peer_joined" }); // 没有 deviceId
    socket.push({ type: "peer_left", deviceId: 123 }); // 类型不对

    expect(client.onlinePeers).toEqual(["alice"]);
    client.close();
  });

  it("does not add duplicates when the same peer is announced twice", async () => {
    const { client, socket } = await makeConnectedClient();
    socket.push({ type: "peer_joined", deviceId: "alice" });
    socket.push({ type: "peer_joined", deviceId: "alice" });
    expect(client.onlinePeers).toEqual(["alice"]);
    client.close();
  });
});
