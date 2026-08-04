import { encryptAead, decryptAead, randomUUID, type AeadCiphertext } from "@secureinchat/crypto-core";
import type { KeystorePort } from "@secureinchat/crypto-core";
import { decodeEnvelope, encodeEnvelope, type MessageEnvelope } from "./messageEnvelope";
import { OfflineOutbox } from "./offlineOutbox";

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
  /** 心跳间隔，默认 HEARTBEAT_INTERVAL_MS。测试可以调小以免等 20 秒。 */
  heartbeatIntervalMs?: number;
  /** 连接+认证的整体超时，默认 CONNECT_TIMEOUT_MS */
  connectTimeoutMs?: number;
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

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

/** 心跳间隔——按中继技术文档第 9 节：20 秒，防 NAT 超时/移动网络断开/Cloudflare 空闲关闭 */
export const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * 连接+认证的整体超时。没有这个的话，连到一个"能建 TCP 但不响应"的地址
 * （地址填错、服务没起、被防火墙静默丢包）会一直转圈不报错——用户完全不知道
 * 发生了什么。10 秒足够正常的手机网络完成 TLS + 握手。
 */
export const CONNECT_TIMEOUT_MS = 10_000;

/**
 * 重连退避——按中继技术文档第 10 节：立即 → 3s → 指数退避 5/10/20/30 → 封顶 30s。
 * 手机网络切换（WiFi ↔ 4G）、锁屏唤醒都会触发断连，必须自动恢复，不能让用户手动点。
 */
export function reconnectDelayMs(attempt: number): number {
  if (attempt <= 0) return 0;
  if (attempt === 1) return 3_000;
  return Math.min(5_000 * 2 ** (attempt - 2), 30_000);
}

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
  private statusHandlers: Array<(status: ConnectionStatus) => void> = [];
  private latencyHandlers: Array<(rttMs: number) => void> = [];

  private status: ConnectionStatus = "disconnected";
  private lastAuthMode: AuthMode | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  /** 用户主动 close() 之后不再自动重连——否则关不掉 */
  private intentionallyClosed = false;
  /**
   * 断线期间要发的消息排在这里，重连成功后按入队顺序补发。
   * 中继是无状态盲转发、按设计不暂存消息，所以"离线消息"只能由发送方自己扛。
   */
  private outbox = new OfflineOutbox<MessageEnvelope>();
  private queueHandlers: Array<(pendingCount: number) => void> = [];
  private queueSeq = 0;

  constructor(
    private readonly url: string,
    private readonly deps: RelayClientDeps
  ) {}

  /** 连上、握手、认证。resolve 代表 auth_ok；reject 代表握手失败或连接错误。 */
  connect(mode: AuthMode): Promise<void> {
    this.lastAuthMode = mode;
    this.intentionallyClosed = false;
    this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");
    const WS = this.deps.WebSocketImpl ?? WebSocket;
    return new Promise((resolve, reject) => {
      const ws = new WS(this.url);
      this.ws = ws;
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {
          // 忽略：本来就是连不上才超时的
        }
        reject(new Error(`连接超时（${this.url}）——请检查服务器地址是否正确、服务是否已启动`));
      }, this.deps.connectTimeoutMs ?? CONNECT_TIMEOUT_MS);
      const settle = () => {
        clearTimeout(timeout);
      };

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
            settle();
            reject(err);
          }
          return;
        }

        if (frame.type === "auth_ok") {
          settled = true;
          settle();
          this.reconnectAttempt = 0;
          this.setStatus("connected");
          this.startHeartbeat();
          // 补发完再 resolve —— connect() 返回应该意味着"已连上且积压已追平"，
          // 否则调用方拿到 resolve 后立刻检查队列会看到还没发完的中间状态。
          // 补发失败不阻塞连接本身：消息还在队列里，下次重连会再试。
          try {
            await this.flushOutbox();
          } catch {
            // 忽略：队列保留，等下一次重连
          }
          ws.onmessage = (e: MessageEvent) => this.handleFrame(String(e.data));
          resolve();
          return;
        }

        if (frame.type === "auth_failed") {
          settled = true;
          settle();
          reject(new Error(`认证失败: ${String(frame.reason)}`));
          return;
        }
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          settle();
          reject(new Error("WebSocket 连接错误"));
        }
      };

      ws.onclose = () => {
        this.stopHeartbeat();
        if (!settled) {
          settled = true;
          settle();
          reject(new Error("连接在握手完成前被关闭"));
          return;
        }
        // 握手成功之后才断的——属于运行中掉线，自动重连
        this.scheduleReconnect();
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

    if (frameType === "pong") {
      const ts = frame.timestamp;
      if (typeof ts === "number") {
        const rtt = Date.now() - ts;
        for (const handler of this.latencyHandlers) handler(rtt);
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
  onStatusChange(handler: (status: ConnectionStatus) => void): void {
    this.statusHandlers.push(handler);
  }

  /** 每次收到 pong 时回调一次往返延迟（毫秒）——用于连接诊断页 */
  onLatency(handler: (rttMs: number) => void): void {
    this.latencyHandlers.push(handler);
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const handler of this.statusHandlers) handler(status);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      // 发不出去说明连接已经废了——让 onclose/onerror 去触发重连，
      // 这里不自己判断连接状态，避免两处逻辑打架
      try {
        this.ws?.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
      } catch {
        // 忽略：连接已断，重连由 onclose 负责
      }
    }, this.deps.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private scheduleReconnect(): void {
    if (this.intentionallyClosed || this.lastAuthMode === null) {
      this.setStatus("disconnected");
      return;
    }
    if (this.reconnectTimer) return; // 已经排好队了，不要重复排

    this.reconnectAttempt += 1;
    this.setStatus("reconnecting");
    const delay = reconnectDelayMs(this.reconnectAttempt);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // 重连一律用 authenticate：设备在首次 register 时已经登记过了。
      // 如果服务端重启过（DeviceRegistry 是内存态），authenticate 会失败，
      // 这时退回 register 再试一次。
      void this.connect("authenticate").catch(() => {
        void this.connect("register").catch(() => {
          // 两种都失败——onclose 会再次触发 scheduleReconnect，继续退避重试
        });
      });
    }, delay);
  }

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
  /**
   * 发送消息信封。连接可用时直接发出（返回 "sent"）；断线时排进离线队列
   * （返回 "queued"），重连成功后按入队顺序自动补发——不再直接抛错，
   * 因为"手机锁屏了一下导致消息丢失"对用户来说是不可接受的。
   */
  async sendEnvelope(envelope: MessageEnvelope): Promise<"sent" | "queued"> {
    if (this.status !== "connected" || !this.ws) {
      this.enqueue(envelope);
      return "queued";
    }
    try {
      await this.transmit(envelope);
      return "sent";
    } catch {
      // 发的瞬间断了——排队等重连，别把消息丢了
      this.enqueue(envelope);
      return "queued";
    }
  }

  private async transmit(envelope: MessageEnvelope): Promise<void> {
    if (!this.ws) throw new Error("连接不可用");
    const aad = new TextEncoder().encode(`secureinchat:msg:${this.deps.groupId}:${this.deps.epoch}`);
    const ciphertext = await encryptAead(this.deps.groupKey, encodeEnvelope(envelope), aad);
    const ciphertextB64 = toBase64Url(packCiphertext(ciphertext));
    this.ws.send(JSON.stringify({ type: "forward", ciphertextB64 }));
  }

  private enqueue(envelope: MessageEnvelope): void {
    this.outbox.enqueue(`q-${this.queueSeq++}`, envelope);
    this.notifyQueue();
  }

  private notifyQueue(): void {
    const pending = this.pendingMessageCount;
    for (const handler of this.queueHandlers) handler(pending);
  }

  /** 还有多少条消息在等待发送——UI 可以据此显示"N 条等待发送" */
  get pendingMessageCount(): number {
    return this.outbox.listByStatus("pending").length;
  }

  onQueueChange(handler: (pendingCount: number) => void): void {
    this.queueHandlers.push(handler);
  }

  /**
   * 重连成功后补发。OfflineOutbox 按入队顺序遍历，所以补发是保序的——
   * 断线期间发的三条消息不会因为重连而乱序。
   */
  private async flushOutbox(): Promise<void> {
    if (this.pendingMessageCount === 0) return;
    await this.outbox.flush(async (envelope) => {
      await this.transmit(envelope);
    });
    this.notifyQueue();
  }

  /** 发文本消息的便捷方法 */
  async sendText(text: string): Promise<void> {
    await this.sendEnvelope({
      kind: "text",
      id: randomUUID(),
      text,
      sentAtMs: Date.now(),
    });
  }

  close(): void {
    this.intentionallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    this.setStatus("disconnected");
  }
}
