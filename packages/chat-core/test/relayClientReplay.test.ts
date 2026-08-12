import { describe, expect, it, beforeEach } from "vitest";
import { RelayClient } from "../src/relayClient";
import { TestOnlyInMemoryKeystore, generateAeadKey, encryptAead } from "@secureinchat/crypto-core";
import { encodeEnvelope, type MessageEnvelope } from "../src/messageEnvelope";

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

  close() {}
  push(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const GROUP_ID = "g";
const EPOCH = 0;

/** 把一个信封加密成中继会转发的那种 forward 帧 */
async function makeForwardFrame(groupKey: CryptoKey, envelope: MessageEnvelope, fromDeviceId: string) {
  const aad = new TextEncoder().encode(`secureinchat:msg:${GROUP_ID}:${EPOCH}`);
  const ct = await encryptAead(groupKey, encodeEnvelope(envelope), aad);
  const packed = new Uint8Array(1 + ct.iv.byteLength + ct.ciphertext.byteLength);
  packed[0] = ct.iv.byteLength;
  packed.set(ct.iv, 1);
  packed.set(ct.ciphertext, 1 + ct.iv.byteLength);
  return { type: "forward", fromDeviceId, ciphertextB64: toBase64Url(packed) };
}

async function connectedClient(groupKey: CryptoKey) {
  const keystore = new TestOnlyInMemoryKeystore();
  const alias = await keystore.generateDeviceKeyPair("me");
  const client = new RelayClient("ws://test", {
    deviceId: "me",
    groupId: GROUP_ID,
    keystore,
    keystoreAlias: alias,
    groupKey,
    epoch: EPOCH,
    WebSocketImpl: MockRelaySocket as unknown as typeof WebSocket,
  });
  await client.connect("register");
  return { client, socket: MockRelaySocket.instances[MockRelaySocket.instances.length - 1]! };
}

function textEnvelope(seq: number | undefined, text: string): MessageEnvelope {
  return {
    kind: "text",
    id: `m${seq ?? "x"}`,
    text,
    sentAtMs: 1,
    ...(seq !== undefined ? { seq } : {}),
  };
}

describe("replay protection", () => {
  beforeEach(() => {
    MockRelaySocket.instances = [];
  });

  it("delivers a message once", async () => {
    const groupKey = await generateAeadKey();
    const { client, socket } = await connectedClient(groupKey);
    const received: string[] = [];
    client.onMessage((m) => {
      if (m.envelope.kind === "text") received.push(m.envelope.text);
    });

    socket.push(await makeForwardFrame(groupKey, textEnvelope(0, "你好"), "alice"));
    await new Promise((r) => setTimeout(r, 20));

    expect(received).toEqual(["你好"]);
    client.close();
  });

  it("drops the same message replayed — this is the whole point", async () => {
    const groupKey = await generateAeadKey();
    const { client, socket } = await connectedClient(groupKey);
    const received: string[] = [];
    client.onMessage((m) => {
      if (m.envelope.kind === "text") received.push(m.envelope.text);
    });

    const frame = await makeForwardFrame(groupKey, textEnvelope(0, "转账已收到"), "alice");
    socket.push(frame);
    socket.push(frame); // 原样重放
    socket.push(frame);
    await new Promise((r) => setTimeout(r, 20));

    expect(received).toEqual(["转账已收到"]);
    client.close();
  });

  it("accepts distinct messages from the same sender", async () => {
    const groupKey = await generateAeadKey();
    const { client, socket } = await connectedClient(groupKey);
    const received: string[] = [];
    client.onMessage((m) => {
      if (m.envelope.kind === "text") received.push(m.envelope.text);
    });

    socket.push(await makeForwardFrame(groupKey, textEnvelope(0, "第一条"), "alice"));
    socket.push(await makeForwardFrame(groupKey, textEnvelope(1, "第二条"), "alice"));
    await new Promise((r) => setTimeout(r, 20));

    expect(received).toEqual(["第一条", "第二条"]);
    client.close();
  });

  it("tracks senders separately — same seq from two people is not a replay", async () => {
    const groupKey = await generateAeadKey();
    const { client, socket } = await connectedClient(groupKey);
    const received: string[] = [];
    client.onMessage((m) => {
      if (m.envelope.kind === "text") received.push(m.envelope.text);
    });

    socket.push(await makeForwardFrame(groupKey, textEnvelope(0, "李阳说"), "alice"));
    socket.push(await makeForwardFrame(groupKey, textEnvelope(0, "张溪说"), "bob"));
    await new Promise((r) => setTimeout(r, 20));

    expect(received).toEqual(["李阳说", "张溪说"]);
    client.close();
  });

  it("accepts out-of-order arrivals — the network reorders, that isn't an attack", async () => {
    const groupKey = await generateAeadKey();
    const { client, socket } = await connectedClient(groupKey);
    const received: string[] = [];
    client.onMessage((m) => {
      if (m.envelope.kind === "text") received.push(m.envelope.text);
    });

    socket.push(await makeForwardFrame(groupKey, textEnvelope(2, "第三条"), "alice"));
    socket.push(await makeForwardFrame(groupKey, textEnvelope(1, "第二条"), "alice"));
    await new Promise((r) => setTimeout(r, 20));

    expect(received.sort()).toEqual(["第三条", "第二条"].sort());
    client.close();
  });

  it("still delivers messages from older clients that carry no seq", async () => {
    const groupKey = await generateAeadKey();
    const { client, socket } = await connectedClient(groupKey);
    const received: string[] = [];
    client.onMessage((m) => {
      if (m.envelope.kind === "text") received.push(m.envelope.text);
    });

    socket.push(await makeForwardFrame(groupKey, textEnvelope(undefined, "老客户端发的"), "alice"));
    await new Promise((r) => setTimeout(r, 20));

    // 丢掉真实消息比接受一次重放更糟
    expect(received).toEqual(["老客户端发的"]);
    client.close();
  });

  it("stamps an increasing seq on outgoing messages", async () => {
    const groupKey = await generateAeadKey();
    const { client, socket } = await connectedClient(groupKey);

    await client.sendText("一");
    await client.sendText("二");

    const forwards = socket.sent.filter((s) => JSON.parse(s).type === "forward");
    expect(forwards).toHaveLength(2);
    client.close();
  });
});

describe("announcement replay protection", () => {
  beforeEach(() => {
    MockRelaySocket.instances = [];
  });

  function announcement(id: string, title: string): MessageEnvelope {
    return { kind: "announcement", id, category: "scripture", title, body: "内容", sentAtMs: 1 };
  }

  it("applies a new announcement", async () => {
    const groupKey = await generateAeadKey();
    const { client, socket } = await connectedClient(groupKey);
    const titles: string[] = [];
    client.onMessage((m) => {
      if (m.envelope.kind === "announcement") titles.push(m.envelope.title);
    });

    socket.push(await makeForwardFrame(groupKey, announcement("a1", "今日经文"), "admin"));
    await new Promise((r) => setTimeout(r, 20));

    expect(titles).toEqual(["今日经文"]);
    client.close();
  });

  it("ignores a replayed announcement, so an old one can't displace today's", async () => {
    const groupKey = await generateAeadKey();
    const { client, socket } = await connectedClient(groupKey);
    const titles: string[] = [];
    client.onMessage((m) => {
      if (m.envelope.kind === "announcement") titles.push(m.envelope.title);
    });

    const yesterday = await makeForwardFrame(groupKey, announcement("a1", "昨天的经文"), "admin");
    socket.push(yesterday);
    socket.push(await makeForwardFrame(groupKey, announcement("a2", "今天的经文"), "admin"));
    socket.push(yesterday); // 重放昨天那条
    await new Promise((r) => setTimeout(r, 20));

    expect(titles).toEqual(["昨天的经文", "今天的经文"]);
    client.close();
  });

  it("treats announcements with different ids as distinct", async () => {
    const groupKey = await generateAeadKey();
    const { client, socket } = await connectedClient(groupKey);
    const titles: string[] = [];
    client.onMessage((m) => {
      if (m.envelope.kind === "announcement") titles.push(m.envelope.title);
    });

    socket.push(await makeForwardFrame(groupKey, announcement("a1", "经文"), "admin"));
    socket.push(await makeForwardFrame(groupKey, announcement("a2", "更新后的经文"), "admin"));
    await new Promise((r) => setTimeout(r, 20));

    expect(titles).toEqual(["经文", "更新后的经文"]);
    client.close();
  });
});
