import { describe, expect, it, beforeEach } from "vitest";
import { RelayClient } from "../src/relayClient";
import { TestOnlyInMemoryKeystore, generateAeadKey, decryptAead } from "@secureinchat/crypto-core";
import { decodeEnvelope } from "../src/messageEnvelope";

/** 行为合规的假中继，可以模拟掉线和恢复 */
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

  simulateDrop() {
    this.onclose?.();
  }

  /** 取出这个 socket 上真正发出去的 forward 帧 */
  forwardFrames(): string[] {
    return this.sent.filter((s) => JSON.parse(s).type === "forward");
  }
}

async function makeClient(groupKey: CryptoKey) {
  const keystore = new TestOnlyInMemoryKeystore();
  const alias = await keystore.generateDeviceKeyPair("d");
  return new RelayClient("ws://test", {
    deviceId: "d",
    groupId: "g",
    keystore,
    keystoreAlias: alias,
    groupKey,
    epoch: 0,
    WebSocketImpl: MockRelaySocket as unknown as typeof WebSocket,
  });
}

/** 把 socket 上发出的 forward 帧解密回文本，用来验证补发的内容和顺序 */
async function decodeSentTexts(socket: MockRelaySocket, groupKey: CryptoKey): Promise<string[]> {
  const aad = new TextEncoder().encode("secureinchat:msg:g:0");
  const texts: string[] = [];
  for (const raw of socket.forwardFrames()) {
    const { ciphertextB64 } = JSON.parse(raw);
    const padded = ciphertextB64 + "=".repeat((4 - (ciphertextB64.length % 4)) % 4);
    const bin = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const packed = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) packed[i] = bin.charCodeAt(i);
    const ivLen = packed[0]!;
    const plaintext = await decryptAead(
      groupKey,
      { iv: packed.slice(1, 1 + ivLen), ciphertext: packed.slice(1 + ivLen) },
      aad
    );
    const env = decodeEnvelope(plaintext);
    if (env.kind === "text") texts.push(env.text);
  }
  return texts;
}

describe("RelayClient offline queue", () => {
  beforeEach(() => {
    MockRelaySocket.instances = [];
  });

  it("sends immediately when connected", async () => {
    const groupKey = await generateAeadKey();
    const client = await makeClient(groupKey);
    await client.connect("register");

    const result = await client.sendEnvelope({ kind: "text", id: "1", text: "在线消息", sentAtMs: 1 });
    expect(result).toBe("sent");
    expect(client.pendingMessageCount).toBe(0);
    client.close();
  });

  it("queues instead of throwing when not connected at all", async () => {
    const groupKey = await generateAeadKey();
    const client = await makeClient(groupKey);

    const result = await client.sendEnvelope({ kind: "text", id: "1", text: "离线消息", sentAtMs: 1 });
    expect(result).toBe("queued");
    expect(client.pendingMessageCount).toBe(1);
  });

  it("queues messages sent while dropped, then redelivers them after reconnect", async () => {
    const groupKey = await generateAeadKey();
    const client = await makeClient(groupKey);
    await client.connect("register");

    MockRelaySocket.instances[0]!.simulateDrop();
    expect(client.connectionStatus).toBe("reconnecting");

    await client.sendEnvelope({ kind: "text", id: "1", text: "断线时发的", sentAtMs: 1 });
    expect(client.pendingMessageCount).toBe(1);

    // 模拟重连成功（真实场景由退避定时器触发，这里直接再连一次）
    await client.connect("authenticate");

    expect(client.pendingMessageCount).toBe(0);
    const secondSocket = MockRelaySocket.instances[MockRelaySocket.instances.length - 1]!;
    const texts = await decodeSentTexts(secondSocket, groupKey);
    expect(texts).toEqual(["断线时发的"]);

    client.close();
  });

  it("redelivers multiple queued messages in the original order", async () => {
    const groupKey = await generateAeadKey();
    const client = await makeClient(groupKey);
    await client.connect("register");
    MockRelaySocket.instances[0]!.simulateDrop();

    await client.sendEnvelope({ kind: "text", id: "1", text: "第一条", sentAtMs: 1 });
    await client.sendEnvelope({ kind: "text", id: "2", text: "第二条", sentAtMs: 2 });
    await client.sendEnvelope({ kind: "text", id: "3", text: "第三条", sentAtMs: 3 });
    expect(client.pendingMessageCount).toBe(3);

    await client.connect("authenticate");

    const socket = MockRelaySocket.instances[MockRelaySocket.instances.length - 1]!;
    const texts = await decodeSentTexts(socket, groupKey);
    expect(texts).toEqual(["第一条", "第二条", "第三条"]);

    client.close();
  });

  it("does not resend a message that already went out successfully", async () => {
    const groupKey = await generateAeadKey();
    const client = await makeClient(groupKey);
    await client.connect("register");

    await client.sendEnvelope({ kind: "text", id: "1", text: "已发送", sentAtMs: 1 });
    const firstSocket = MockRelaySocket.instances[0]!;
    expect((await decodeSentTexts(firstSocket, groupKey))).toEqual(["已发送"]);

    firstSocket.simulateDrop();
    await client.connect("authenticate");

    const secondSocket = MockRelaySocket.instances[MockRelaySocket.instances.length - 1]!;
    expect(await decodeSentTexts(secondSocket, groupKey)).toEqual([]); // 没有重复补发

    client.close();
  });

  it("notifies queue-change handlers so the UI can show a pending count", async () => {
    const groupKey = await generateAeadKey();
    const client = await makeClient(groupKey);
    const counts: number[] = [];
    client.onQueueChange((n) => counts.push(n));

    await client.sendEnvelope({ kind: "text", id: "1", text: "a", sentAtMs: 1 });
    await client.sendEnvelope({ kind: "text", id: "2", text: "b", sentAtMs: 2 });

    expect(counts).toEqual([1, 2]);
  });

  it("clears the pending count back to zero once the queue is flushed", async () => {
    const groupKey = await generateAeadKey();
    const client = await makeClient(groupKey);
    await client.sendEnvelope({ kind: "text", id: "1", text: "a", sentAtMs: 1 });
    expect(client.pendingMessageCount).toBe(1);

    await client.connect("register");
    expect(client.pendingMessageCount).toBe(0);

    client.close();
  });
});
