import {
  bytesToBase64Url,
  base64UrlToBytes,
  shouldPersistMediaBytes,
  type StoredMessage,
} from "@secureinchat/chat-core";
import type { DisplayMessage } from "./screens/ChatScreen";

/**
 * 内存里的消息（媒体用 objectUrl 渲染）和落盘的消息（媒体存 base64）之间的转换。
 *
 * objectUrl 是当次页面会话内的临时引用，重启后必然失效，所以不能直接存；
 * 反过来读出来的时候要重新 createObjectURL 才能渲染。
 */

export function toStored(msg: DisplayMessage, mediaBytes?: Uint8Array): StoredMessage {
  const base: StoredMessage = {
    id: msg.id,
    isOwn: msg.isOwn,
    senderLabel: msg.fromDeviceId,
    // 用消息自己的时间，不是落盘那一刻——否则重启后所有历史消息
    // 的时间都会变成最后一次保存的时间
    sentAtMs: msg.sentAtMs,
    text: msg.text,
  };
  if (!msg.media) return base;

  const persistBytes = mediaBytes && shouldPersistMediaBytes(msg.media.sizeBytes);
  return {
    ...base,
    media: {
      mediaKind: msg.media.mediaKind,
      fileName: msg.media.fileName,
      mimeType: msg.media.mimeType,
      sizeBytes: msg.media.sizeBytes,
      // 超过上限的媒体只留元信息：重启后会显示文件名和大小，但内容打不开。
      // 这比整条消息消失要好，用户至少知道当时收到过什么。
      dataB64Url: persistBytes ? bytesToBase64Url(mediaBytes) : undefined,
    },
  };
}

export function fromStored(stored: StoredMessage): DisplayMessage {
  const base: DisplayMessage = {
    id: stored.id,
    isOwn: stored.isOwn,
    fromDeviceId: stored.senderLabel,
    sentAtMs: stored.sentAtMs,
    text: stored.text,
  };
  if (!stored.media) return base;

  let objectUrl = "";
  if (stored.media.dataB64Url) {
    const bytes = base64UrlToBytes(stored.media.dataB64Url);
    objectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: stored.media.mimeType }));
  }

  return {
    ...base,
    media: {
      mediaKind: stored.media.mediaKind,
      fileName: stored.media.fileName,
      mimeType: stored.media.mimeType,
      objectUrl,
      sizeBytes: stored.media.sizeBytes,
    },
  };
}
