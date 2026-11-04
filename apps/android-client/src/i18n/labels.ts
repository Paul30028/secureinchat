/**
 * 共享包（chat-core、webrtc）给出的是结构化状态；给用户看的文字在这里按当前语言生成。
 * 共享包里原来的中文 describe* 函数保留给其他调用方，App 不再用它们。
 */
import { progressPercent, type AnnouncementCategory, type ConnectionQuality, type SendProgress } from "@secureinchat/chat-core";
import type { CallKind, CallStateInfo } from "@secureinchat/webrtc";
import { t } from "./index";

/** 小文件几乎瞬间发完，这时候显示百分比反而闪一下很吵，所以只在分片数多的时候报百分比 */
export function sendProgressText(p: SendProgress): string {
  if (p.totalChunks <= 1) return t("progress.sending", { fileName: p.fileName });
  return t("progress.sendingPercent", { fileName: p.fileName, percent: progressPercent(p) });
}

export function callStateText(info: CallStateInfo, kind: CallKind): string {
  const video = kind === "video";
  switch (info.state) {
    case "outgoing":
      return t("call.outgoing");
    case "ringing-remote":
      return t("call.ringingRemote");
    case "incoming":
      return t(video ? "call.incomingVideo" : "call.incomingVoice");
    case "connecting":
      return t("call.connecting");
    case "connected":
      return t(video ? "call.inVideo" : "call.inVoice");
    case "ended":
      switch (info.endReason) {
        case "rejected":
          return t("call.endedRejected");
        case "cancelled":
          return t("call.endedCancelled");
        case "remote-ended":
          return t("call.endedRemote");
        case "failed":
          return t("call.endedFailed");
        default:
          return t("call.ended");
      }
    default:
      return "";
  }
}

export function qualityText(quality: ConnectionQuality): string {
  switch (quality) {
    case "good":
      return t("quality.good");
    case "fair":
      return t("quality.fair");
    case "poor":
      return t("quality.poor");
    default:
      return t("quality.unknown");
  }
}

export function categoryLabel(category: AnnouncementCategory): string {
  return t(`category.${category}.label`);
}

export function categoryPlaceholder(category: AnnouncementCategory): string {
  return t(`category.${category}.placeholder`);
}
