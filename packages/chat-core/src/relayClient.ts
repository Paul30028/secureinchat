import { encryptAead, decryptAead, type AeadCiphertext } from "@secureinchat/crypto-core";
import type { KeystorePort } from "@secureinchat/crypto-core";

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

export interface IncomingTextMessage {
  fromDeviceId: string;
  text: string;
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
  private messageHandlers: Array<(msg: IncomingTextMessage) => void> = [];

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
    if (frame.type !== "forward") return;

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

    const text = new TextDecoder().decode(plaintextBytes);
    for (const handler of this.messageHandlers) handler({ fromDeviceId, text });
  }

  onMessage(handler: (msg: IncomingTextMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  async sendText(text: string): Promise<void> {
    if (!this.ws) throw new Error("RelayClient 还没连接，不能发消息");
    const aad = new TextEncoder().encode(`secureinchat:msg:${this.deps.groupId}:${this.deps.epoch}`);
    const plaintext = new TextEncoder().encode(text);
    const ciphertext = await encryptAead(this.deps.groupKey, plaintext, aad);
    const ciphertextB64 = toBase64Url(packCiphertext(ciphertext));
    this.ws.send(JSON.stringify({ type: "forward", ciphertextB64 }));
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
