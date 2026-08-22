import type { FileChunkEnvelope, FileMetaEnvelope } from "./messageEnvelope";

/**
 * 文件分片与重组。
 *
 * ⚠️ 与原始需求第十节的差距，如实说明：需求要求"每个文件生成独立随机文件密钥"，
 * 当前实现**没有**做这一层——分片和普通消息一样用群 epoch 密钥加密，只是通过
 * AAD 绑定了 fileId + chunkIndex + epoch（"分片绑定文件ID、分片序号和群组
 * epoch"这条是满足的）。独立文件密钥需要接收方也能派生出同一把密钥，而
 * RelayClient 目前只持有派生后的 epoch 密钥、拿不到原始密钥材料，要补这一层
 * 得改密钥分发路径。这是明确的已知缺口，不是遗漏。
 */

/** 64KB 一片。WebSocket 单帧不宜过大，base64 编码后约 87KB，是个稳妥的值。 */
export const CHUNK_SIZE_BYTES = 64 * 1024;

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(s: string): Uint8Array {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function totalChunksFor(totalBytes: number, chunkSize = CHUNK_SIZE_BYTES): number {
  // 空文件也算一个分片，避免"0 个分片"这种需要特殊处理的边界情况
  return Math.max(1, Math.ceil(totalBytes / chunkSize));
}

export interface BuildFileEnvelopesInput {
  fileId: string;
  fileName: string;
  mimeType: string;
  mediaKind: FileMetaEnvelope["mediaKind"];
  bytes: Uint8Array;
  senderName?: string;
  sentAtMs?: number;
  chunkSize?: number;
}

/** 把一个文件拆成 1 个 meta 信封 + N 个分片信封，按顺序发送即可。 */
export function buildFileEnvelopes(input: BuildFileEnvelopesInput): {
  meta: FileMetaEnvelope;
  chunks: FileChunkEnvelope[];
} {
  const chunkSize = input.chunkSize ?? CHUNK_SIZE_BYTES;
  const totalChunks = totalChunksFor(input.bytes.byteLength, chunkSize);

  const meta: FileMetaEnvelope = {
    kind: "file-meta",
    fileId: input.fileId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    totalBytes: input.bytes.byteLength,
    totalChunks,
    mediaKind: input.mediaKind,
    sentAtMs: input.sentAtMs ?? Date.now(),
    ...(input.senderName ? { senderName: input.senderName } : {}),
  };

  const chunks: FileChunkEnvelope[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const slice = input.bytes.slice(i * chunkSize, (i + 1) * chunkSize);
    chunks.push({
      kind: "file-chunk",
      fileId: input.fileId,
      chunkIndex: i,
      dataB64Url: bytesToBase64Url(slice),
    });
  }
  return { meta, chunks };
}

export interface AssembledFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  mediaKind: FileMetaEnvelope["mediaKind"];
  bytes: Uint8Array;
  senderName?: string | undefined;
}

export interface IncomingFileProgress {
  fileId: string;
  fileName: string;
  mediaKind: FileMetaEnvelope["mediaKind"];
  receivedChunks: number;
  totalChunks: number;
}

/**
 * 接收端的重组器。分片可能乱序到达（网络本来就不保证顺序），所以按 index
 * 存进 Map 而不是直接 append，集齐了再按序拼起来。
 */
export class FileAssembler {
  private pending = new Map<string, { meta: FileMetaEnvelope; chunks: Map<number, Uint8Array> }>();

  /** 收到 meta 帧。重复的 meta（重发/重连）不会清空已经收到的分片。 */
  acceptMeta(meta: FileMetaEnvelope): void {
    const existing = this.pending.get(meta.fileId);
    if (existing) {
      existing.meta = meta;
      return;
    }
    this.pending.set(meta.fileId, { meta, chunks: new Map() });
  }

  /**
   * 收到分片。集齐所有分片时返回组装好的文件，否则返回 undefined。
   * 如果 meta 还没到（分片先到了），也返回 undefined——分片会被丢弃，
   * 因为没有 meta 就不知道总共该有多少片、文件叫什么。
   */
  acceptChunk(chunk: FileChunkEnvelope): AssembledFile | undefined {
    const entry = this.pending.get(chunk.fileId);
    if (!entry) return undefined;

    entry.chunks.set(chunk.chunkIndex, base64UrlToBytes(chunk.dataB64Url));
    if (entry.chunks.size < entry.meta.totalChunks) return undefined;

    const ordered: Uint8Array[] = [];
    for (let i = 0; i < entry.meta.totalChunks; i++) {
      const part = entry.chunks.get(i);
      if (!part) return undefined; // 数量够了但序号有洞——还不能组装
      ordered.push(part);
    }

    const totalLength = ordered.reduce((sum, part) => sum + part.byteLength, 0);
    const bytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of ordered) {
      bytes.set(part, offset);
      offset += part.byteLength;
    }

    this.pending.delete(chunk.fileId);
    return {
      fileId: entry.meta.fileId,
      fileName: entry.meta.fileName,
      mimeType: entry.meta.mimeType,
      mediaKind: entry.meta.mediaKind,
      bytes,
      senderName: entry.meta.senderName,
    };
  }

  /** 当前正在接收中的文件进度，供 UI 显示"接收中 3/12" */
  progress(): IncomingFileProgress[] {
    return [...this.pending.values()].map((entry) => ({
      fileId: entry.meta.fileId,
      fileName: entry.meta.fileName,
      mediaKind: entry.meta.mediaKind,
      receivedChunks: entry.chunks.size,
      totalChunks: entry.meta.totalChunks,
    }));
  }
}
