import { encryptAead, decryptAead, type AeadCiphertext } from "@secureinchat/crypto-core";
import type { KeystorePort } from "@secureinchat/crypto-core";
import { decodeEnvelope, encodeEnvelope, type MessageEnvelope } from "./messageEnvelope";

/**
 * 客户端这边的中继协议实现——对应 docs/protocol/RELAY_CONTRACT_V0.md。
 * 只做"连上、认证、收发密文"这一层，消息去重/排序/离线队列（dedup.ts /
 * ordering.ts / offlineOutbox.ts）是上一层的事，这个类不管。
 */

export type AuthMode = "register" | "authenticate";

export interface RelayClientDeps {
  deviceId: string;
  groupId: string;
  keystore: KeystorePort;
  keystoreAlias: string;
  /** 这个群当前 epoch 的消息密钥（已经派生好，见 chat-core 的 groupJoin.ts） */
  groupKey: CryptoKey;
  epoch: number;
  /** 供测试注入；浏览器环境不传就用全局 WebSocket */
  WebSocketImpl?: typeof WebSocket;
}

export interface IncomingMessage {
  fromDeviceId: string;
  envelope: MessageEnvelope;
}

/** 通话信令帧类型——和 server/relay 的 SIGNALING_FRAME_TYPES 一一对应 */
export type SignalingType =
  | "call_invite"
  | "call_ring"
  | "call_answer"
  | "call_reject"
  | "call_cancel"
  | "call_hangup"
  | "ice_candidate";

export interface IncomingSignaling {
  type: SignalingType;
  fromDeviceId: string;
  callId: string;
  /** 解密后的信令内容（SDP / ICE candidate / 拒接原因等） */
  payload: Record<string, unknown>;
}

export interface CallFailed {
  callId: string;
  reason: string;
}

const SIGNALING_TYPES = new Set<string>([
  "call_invite",
  "call_ring",
  "call_answer",
  "call_reject",
  "call_cancel",
  "call_hangup",
  "ice_candidate",
]);

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 消息密文的打包格式：[1 byte iv 长度][iv][ciphertext]，和 secure-storage 的
 *  EncryptedKeyValueStore 用同一个思路，不为了"统一"而复用同一个函数——
 *  这里的密文是要通过网络传输再 base64url 编码的，落盘那个不需要。 */
function packCiphertext(input: AeadCiphertext): Uint8Array {
  const packed = new Uint8Array(1 + input.iv.byteLength + input.ciphertext.byteLength);
  packed[0] = input.iv.byteLength;
  packed.set(input.iv, 1);
  packed.set(input.ciphertext, 1 + input.iv.byteLength);
  return packed;
}

function unpackCiphertext(packed: Uint8Array): AeadCiphertext {
  const ivLen = packed[0]!;
  return { iv: packed.slice(1, 1 + ivLen), ciphertext: packed.slice(1 + ivLen) };
}

export class RelayClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Array<(msg: IncomingMessage) => void> = [];
  private signalingHandlers: Array<(sig: IncomingSignaling) => void> = [];
  private callFailedHandlers: Array<(info: CallFailed) => void> = [];

  constructor(
    private readonly url: string,
    private readonly deps: RelayClientDeps
  ) {}

  /** 连上、握手、认证。resolve 代表 auth_ok；reject 代表握手失败或连接错误。 */
  connect(mode: AuthMode): Promise<void> {
    const WS = this.deps.WebSocketImpl ?? WebSocket;
    return new Promise((resolve, reject) => {
      const ws = new WS(this.url);
      this.ws = ws;
      let settled = false;

      ws.onmessage = async (event: MessageEvent) => {
        let frame: Record<string, unknown>;
        try {
          frame = JSON.parse(String(event.data));
        } catch {
          return; // 畸形帧，客户端这边也一样静默丢弃
        }

        if (frame.type === "auth_challenge") {
          try {
            await this.respondToChallenge(ws, mode, String(frame.nonce));
          } catch (err) {
            settled = true;
            reject(err);
          }
          return;
        }

        if (frame.type === "auth_ok") {
          settled = true;
          ws.onmessage = (e: MessageEvent) => this.handleFrame(String(e.data));
          resolve();
          return;
        }

        if (frame.type === "auth_failed") {
          settled = true;
          reject(new Error(`认证失败: ${String(frame.reason)}`));
          return;
        }
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error("WebSocket 连接错误"));
        }
      };

      ws.onclose = () => {
        if (!settled) {
          settled = true;
          reject(new Error("连接在握手完成前被关闭"));
        }
      };
    });
  }

  private async respondToChallenge(ws: WebSocket, mode: AuthMode, nonce: string): Promise<void> {
    const { deviceId, groupId, keystore, keystoreAlias } = this.deps;
    const proofBytes = await keystore.sign(keystoreAlias, new TextEncoder().encode(nonce));
    const proof = toBase64Url(proofBytes);

    if (mode === "register") {
      const publicKeyRaw = await keystore.exportPublicKeyRaw(keystoreAlias);
      ws.send(
        JSON.stringify({
          type: "register_device",
          deviceId,
          groupId,
          publicKeyRawB64Url: toBase64Url(publicKeyRaw),
          proof,
        })
      );
      return;
    }

    ws.send(JSON.stringify({ type: "auth_response", deviceId, groupId, proof }));
  }

  private async handleFrame(raw: string): Promise<void> {
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }

    const frameType = frame.type;

    if (typeof frameType === "string" && SIGNALING_TYPES.has(frameType)) {
      await this.handleSignalingFrame(frameType as SignalingType, frame);
      return;
    }

    if (frameType === "call_failed") {
      const callId = frame.callId;
      const reason = frame.reason;
      if (typeof callId === "string") {
        for (const handler of this.callFailedHandlers) {
          handler({ callId, reason: typeof reason === "string" ? reason : "unknown" });
        }
      }
      return;
    }

    if (frameType !== "forward") return;

    const ciphertextB64 = frame.ciphertextB64;
    const fromDeviceId = frame.fromDeviceId;
    if (typeof ciphertextB64 !== "string" || typeof fromDeviceId !== "string") return;

    const aad = new TextEncoder().encode(`secureinchat:msg:${this.deps.groupId}:${this.deps.epoch}`);
    let plaintextBytes: Uint8Array;
    try {
      plaintextBytes = await decryptAead(this.deps.groupKey, unpackCiphertext(fromBase64Url(ciphertextB64)), aad);
    } catch {
      // 解密失败（密钥不对/被篡改）——不崩溃、不上抛，只是这条消息进不来。
      // 真实产品这里应该记一条"无法解密"的诊断日志，这次先不做。
      return;
    }

    let envelope: MessageEnvelope;
    try {
      envelope = decodeEnvelope(plaintextBytes);
    } catch {
      // 解密成功但内容不认识——多半是对端用了更新版本的客户端发了新类型的消息。
      // 忽略这一条，不要因为不认识就断开连接或崩溃。
      return;
    }

    for (const handler of this.messageHandlers) handler({ fromDeviceId, envelope });
  }

  onMessage(handler: (msg: IncomingMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onSignaling(handler: (sig: IncomingSignaling) => void): void {
    this.signalingHandlers.push(handler);
  }

  onCallFailed(handler: (info: CallFailed) => void): void {
    this.callFailedHandlers.push(handler);
  }

  private signalingAad(): Uint8Array {
    // 和消息用不同的 AAD 前缀——防止有人把一条消息密文挪来当信令用（或反过来）
    return new TextEncoder().encode(`secureinchat:signal:${this.deps.groupId}:${this.deps.epoch}`);
  }

  private async handleSignalingFrame(type: SignalingType, frame: Record<string, unknown>): Promise<void> {
    const fromDeviceId = frame.fromDeviceId;
    const callId = frame.callId;
    if (typeof fromDeviceId !== "string" || typeof callId !== "string") return;

    let payload: Record<string, unknown> = {};
    const encrypted = frame.payloadB64Url;
    if (typeof encrypted === "string") {
      try {
        const bytes = await decryptAead(this.deps.groupKey, unpackCiphertext(fromBase64Url(encrypted)), this.signalingAad());
        const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
        if (typeof parsed === "object" && parsed !== null) payload = parsed as Record<string, unknown>;
      } catch {
        // 信令解密失败——不是本群成员发的，或者被篡改了。丢弃，不让它影响通话状态机。
        return;
      }
    }

    for (const handler of this.signalingHandlers) handler({ type, fromDeviceId, callId, payload });
  }

  /**
   * 发送一条通话信令。SDP 和 ICE candidate 里含有 IP 地址等敏感信息，所以
   * payload 用群密钥加密——中继只能看到"谁在什么时候给谁发了一条什么类型的
   * 信令"（路由必需的元数据），看不到内容。
   */
  async sendSignaling(
    type: SignalingType,
    targetDeviceId: string,
    callId: string,
    payload: Record<string, unknown> = {}
  ): Promise<void> {
    if (!this.ws) throw new Error("RelayClient 还没连接，不能发信令");
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const ciphertext = await encryptAead(this.deps.groupKey, plaintext, this.signalingAad());
    this.ws.send(
      JSON.stringify({
        type,
        targetDeviceId,
        callId,
        payloadB64Url: toBase64Url(packCiphertext(ciphertext)),
      })
    );
  }

  /** 发送任意类型的消息信封（文本/公告/文件分片都走这里） */
  async sendEnvelope(envelope: MessageEnvelope): Promise<void> {
    if (!this.ws) throw new Error("RelayClient 还没连接，不能发消息");
    const aad = new TextEncoder().encode(`secureinchat:msg:${this.deps.groupId}:${this.deps.epoch}`);
    const ciphertext = await encryptAead(this.deps.groupKey, encodeEnvelope(envelope), aad);
    const ciphertextB64 = toBase64Url(packCiphertext(ciphertext));
    this.ws.send(JSON.stringify({ type: "forward", ciphertextB64 }));
  }

  /** 发文本消息的便捷方法 */
  async sendText(text: string): Promise<void> {
    await this.sendEnvelope({
      kind: "text",
      id: crypto.randomUUID(),
      text,
      sentAtMs: Date.now(),
    });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
