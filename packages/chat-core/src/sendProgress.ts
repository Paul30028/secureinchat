/**
 * 发送进度。
 *
 * 一首圣诗几 MB 会被切成几十上百个分片，逐个加密发送要好几秒。没有进度显示
 * 的话，发布者点完按钮只能干等，很容易以为卡住了又点一次。
 */

export interface SendProgress {
  /** 已发出的分片数（不含 meta 帧） */
  sentChunks: number;
  totalChunks: number;
  fileName: string;
}

export function progressPercent(p: SendProgress): number {
  if (p.totalChunks <= 0) return 100;
  return Math.min(100, Math.round((p.sentChunks / p.totalChunks) * 100));
}

/** 给用户看的文案。小文件几乎瞬间发完，这时候显示百分比反而闪一下很吵，
 *  所以只在分片数确实多的时候才报百分比。 */
export function describeSendProgress(p: SendProgress): string {
  if (p.totalChunks <= 1) return `正在发送 ${p.fileName}`;
  return `正在发送 ${p.fileName}（${progressPercent(p)}%）`;
}

export interface SendFileOptions {
  onProgress?: ((progress: SendProgress) => void) | undefined;
}

/**
 * 按顺序发送 meta + 所有分片，每发完一片回报一次进度。
 *
 * 顺序发送而不是并发：中继是单条 WebSocket，并发只会把分片挤在一起，
 * 还会让"发到第几片"变得没有意义。
 */
export async function sendFileEnvelopes(
  meta: { fileName: string },
  metaEnvelope: unknown,
  chunks: unknown[],
  send: (envelope: unknown) => Promise<unknown>,
  options: SendFileOptions = {}
): Promise<void> {
  const total = chunks.length;
  options.onProgress?.({ sentChunks: 0, totalChunks: total, fileName: meta.fileName });

  await send(metaEnvelope);
  for (let i = 0; i < chunks.length; i++) {
    await send(chunks[i]);
    options.onProgress?.({ sentChunks: i + 1, totalChunks: total, fileName: meta.fileName });
  }
}
