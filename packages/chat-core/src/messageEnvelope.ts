/**
 * 消息信封——放在**加密之后的载荷内部**，中继看不到。
 *
 * 这是个刻意的设计决定：图片、语音、文件、公告都不给 relay 加新的帧类型，
 * 而是复用同一个 `forward` 密文帧，把"这是什么类型的消息"放进加密内容里。
 * 好处是中继依然完全不知道你在传什么（盲中继原则），加新消息类型不需要动
 * 服务端一行代码；代价是中继无法针对不同类型做优化（比如大文件限流），
 * 这个取舍在当前"隐私优先"的定位下是划算的。
 */

export type MessageEnvelope =
  | TextEnvelope
  | AnnouncementEnvelope
  | FileMetaEnvelope
  | FileChunkEnvelope;

export interface TextEnvelope {
  kind: "text";
  /** 客户端生成的消息 ID，用于去重（见 dedup.ts） */
  id: string;
  text: string;
  sentAtMs: number;
  /** 发送者昵称。在加密载荷内部，中继看不到。老版本客户端发的消息没有这个字段，
   *  接收方要能容忍缺失（回退到设备 ID 短前缀）。 */
  senderName?: string;
  /** 回复的目标消息。整段在加密载荷里，中继看不到引用了什么。
   *  存的是快照而不是消息 ID——对方可能已经把原消息删了，
   *  或者根本没收到过（比如他是后来才加入的）。 */
  replyTo?: {
    senderName: string;
    /** 被引用消息的摘要，最多截断到 60 字 */
    excerpt: string;
  };
}

export interface AnnouncementEnvelope {
  kind: "announcement";
  id: string;
  title: string;
  body: string;
  sentAtMs: number;
  senderName?: string;
}

/** 文件传输的第一帧：告诉接收方接下来会有多少个分片、原始文件名是什么。
 *  文件名在这里（也就是在加密内容里），中继看不到——对应第十节
 *  "文件名经过加密保护"的要求。 */
export interface FileMetaEnvelope {
  kind: "file-meta";
  senderName?: string;
  /** 文件 ID，后续分片用它关联回来 */
  fileId: string;
  fileName: string;
  mimeType: string;
  totalBytes: number;
  totalChunks: number;
  /** 图片/语音/普通文件——决定 UI 怎么渲染（显示缩略图 / 播放器 / 文件卡片） */
  mediaKind: "image" | "voice" | "file";
  sentAtMs: number;
}

export interface FileChunkEnvelope {
  kind: "file-chunk";
  fileId: string;
  /** 从 0 开始的分片序号 */
  chunkIndex: number;
  /** 这一片的内容，base64url */
  dataB64Url: string;
}

export function encodeEnvelope(envelope: MessageEnvelope): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(envelope));
}

export class EnvelopeDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvelopeDecodeError";
  }
}

const VALID_KINDS = new Set(["text", "announcement", "file-meta", "file-chunk"]);

export function decodeEnvelope(bytes: Uint8Array): MessageEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new EnvelopeDecodeError("载荷不是合法 JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new EnvelopeDecodeError("载荷不是对象");
  }
  const kind = (parsed as { kind?: unknown }).kind;
  if (typeof kind !== "string" || !VALID_KINDS.has(kind)) {
    // 未知类型可能是对端用了更新版本的客户端——调用方应该忽略这条消息而不是崩溃
    throw new EnvelopeDecodeError(`未知的消息类型: ${String(kind)}`);
  }
  return parsed as MessageEnvelope;
}
