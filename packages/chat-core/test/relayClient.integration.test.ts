import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocketImpl from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestOnlyInMemoryKeystore, deriveGroupEpochKey } from "@secureinchat/crypto-core";
import { RelayClient } from "../src/relayClient";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELAY_DIR = path.resolve(__dirname, "../../../server/relay");
const PORT = 18765; // 固定但不常用的端口，避免和本地开发用的 8765 撞车
const URL = `ws://127.0.0.1:${PORT}`;

let relayProcess: ChildProcessWithoutNullStreams;

const RUN_CROSS_STACK = process.env.SECUREINCHAT_RUN_CROSS_STACK_TESTS === "1";

async function makeClient(deviceId: string, groupId: string, groupKey: CryptoKey) {
  const keystore = new TestOnlyInMemoryKeystore();
  const alias = await keystore.generateDeviceKeyPair(deviceId);
  return new RelayClient(URL, {
    deviceId,
    groupId,
    keystore,
    keystoreAlias: alias,
    groupKey,
    epoch: 0,
    WebSocketImpl: WebSocketImpl as unknown as typeof WebSocket,
  });
}

/**
 * 这是全项目里唯一一处真正跨语言、跨进程的集成测试：真的拉起 Python relay
 * 子进程，TS 端用真实 WebSocket 连上去，走真实的 ECDSA 握手和 AES-GCM 加解密。
 * 比单独测 TS 或单独测 Python 更能说明问题——两边"各自测都过"不代表接起来真的通。
 *
 * 需要 server/relay 的 Python venv 存在，默认的 chat-core CI job 只装 Node 依赖，
 * 没有这个环境——所以用环境变量门槛控制，普通 `npm test` 会跳过这个文件，
 * 专门的 cross-stack-integration CI job（同时装 Node+Python）才会真的跑它。
 */
describe.skipIf(!RUN_CROSS_STACK)("RelayClient <-> real Python relay (cross-stack integration)", () => {
  beforeAll(async () => {
    relayProcess = spawn(path.join(RELAY_DIR, ".venv/bin/python"), ["main.py"], {
      cwd: RELAY_DIR,
      env: {
        ...process.env,
        SECUREINCHAT_RELAY_PORT: String(PORT),
        // 注册表现在持久化到 devices.db。不隔离的话，上一次运行留下的注册记录
        // 会让这一次的 register_device 被拒（"device already registered"），
        // 测试就变成了"第一次能过、之后都挂"。
        SECUREINCHAT_DEVICE_DB: ":memory:",
      },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("relay 子进程 10 秒内没输出 READY")), 10_000);
      relayProcess.stdout.on("data", (chunk: Buffer) => {
        if (chunk.toString().includes("READY")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      relayProcess.stderr.on("data", (chunk: Buffer) => {
        // eslint-disable-next-line no-console
        console.error("[relay stderr]", chunk.toString());
      });
      relayProcess.on("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`relay 子进程提前退出，exit code ${code}`));
      });
    });
  }, 15_000);

  afterAll(() => {
    relayProcess?.kill();
  });

  it("two devices register, join the same group, and exchange an encrypted message", async () => {
    const groupId = "cross-stack-test-group";
    const rawMaterial = crypto.getRandomValues(new Uint8Array(32));
    const groupKey = await deriveGroupEpochKey({ rawKeyMaterial: rawMaterial, groupId, epoch: 0 });

    const alice = await makeClient("alice-cross-stack", groupId, groupKey);
    const bob = await makeClient("bob-cross-stack", groupId, groupKey);

    await alice.connect("register");
    await bob.connect("register");

    const received: string[] = [];
    bob.onMessage((msg) => {
      if (msg.envelope.kind === "text") received.push(msg.envelope.text);
    });

    await alice.sendText("你好，这是一条真实跨进程加密消息");

    await new Promise((resolve) => setTimeout(resolve, 300)); // 给转发一点时间
    expect(received).toEqual(["你好，这是一条真实跨进程加密消息"]);

    alice.close();
    bob.close();
  }, 10_000);

  it("a device with the wrong group key cannot read the message (decryption fails silently, no crash)", async () => {
    const groupId = "cross-stack-test-group-2";
    const rawMaterial = crypto.getRandomValues(new Uint8Array(32));
    const wrongMaterial = crypto.getRandomValues(new Uint8Array(32));
    const groupKey = await deriveGroupEpochKey({ rawKeyMaterial: rawMaterial, groupId, epoch: 0 });
    const wrongKey = await deriveGroupEpochKey({ rawKeyMaterial: wrongMaterial, groupId, epoch: 0 });

    const alice = await makeClient("alice-wrongkey", groupId, groupKey);
    const eve = await makeClient("eve-wrongkey", groupId, wrongKey); // same group, different key material

    await alice.connect("register");
    await eve.connect("register");

    const received: string[] = [];
    eve.onMessage((msg) => {
      if (msg.envelope.kind === "text") received.push(msg.envelope.text);
    });

    await alice.sendText("这条消息 eve 不应该能读懂");
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(received).toEqual([]); // 收到了密文帧，但解密失败，onMessage 不会触发

    alice.close();
    eve.close();
  }, 10_000);

  /**
   * 公告的端到端投递。
   *
   * Paul 报告"发布后同群其他人看不见,只有自己能看见"。签名验证、栏目归类、
   * 重放去重都在收发路径上,任何一环出错都会表现成"别人收不到"。
   * 单独测哪一环都不够——必须两个真实客户端经真实中继跑一遍。
   */
  it("delivers an announcement from one client to another", async () => {
    const groupKey = await deriveGroupEpochKey({
      rawKeyMaterial: new Uint8Array(32).fill(9),
      groupId: "group-ann",
      epoch: 0,
    });
    const admin = await makeClient("admin-device", "group-ann", groupKey);
    const member = await makeClient("member-device", "group-ann", groupKey);

    await admin.connect("register");
    await member.connect("register");

    const received: { title: string; body: string; category?: string | undefined }[] = [];
    member.onMessage((msg) => {
      if (msg.envelope.kind === "announcement") {
        received.push({
          title: msg.envelope.title,
          body: msg.envelope.body,
          category: msg.envelope.category,
        });
      }
    });

    await admin.sendEnvelope({
      kind: "announcement",
      id: "ann-1",
      category: "scripture",
      title: "诗篇 133:1",
      body: "弟兄和睦同居",
      sentAtMs: Date.now(),
      adminSignature: "signature-checked-by-the-app-layer",
    });

    await new Promise((r) => setTimeout(r, 500));

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ title: "诗篇 133:1", category: "scripture" });

    admin.close();
    member.close();
  });

  it("measures round-trip latency via the heartbeat", async () => {
    const groupKey = await deriveGroupEpochKey({
      rawKeyMaterial: new Uint8Array(32).fill(7),
      groupId: "group-hb",
      epoch: 0,
    });
    const keystore = new TestOnlyInMemoryKeystore();
    const alias = await keystore.generateDeviceKeyPair("hb-device");
    const client = new RelayClient(URL, {
      deviceId: "hb-device",
      groupId: "group-hb",
      keystore,
      keystoreAlias: alias,
      groupKey,
      epoch: 0,
      WebSocketImpl: WebSocketImpl as unknown as typeof WebSocket,
      heartbeatIntervalMs: 100, // 默认 20 秒，测试等不起
    });

    const samples: number[] = [];
    client.onLatency((rtt) => samples.push(rtt));
    await client.connect("register");

    await new Promise((r) => setTimeout(r, 600));

    // Paul 的诊断页一直显示"尚未测量"——先确认心跳到底会不会回报
    expect(samples.length).toBeGreaterThan(0);
    expect(samples[0]).toBeGreaterThanOrEqual(0);

    client.close();
  });
});
