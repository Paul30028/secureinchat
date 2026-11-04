/**
 * 共享包（chat-core、webrtc）给出的是结构化状态；给用户看的文字在这里按当前语言生成。
 * 共享包里原来的中文 describe* 函数保留给其他调用方，App 不再用它们。
 */
import {
  MIN_BACKUP_PASSWORD_LENGTH,
  progressPercent,
  type AnnouncementCategory,
  type BackupError,
  type ConnectionQuality,
  type ConnectionStatus,
  type ProbeFailure,
  type SendProgress,
} from "@secureinchat/chat-core";
import type { CallKind, CallStateInfo, MediaEncryptionSupport } from "@secureinchat/webrtc";
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

/** 备份出错：按错误代码显示当前语言的文字；不是 BackupError 时用调用方给的兜底文字 */
export function backupErrorText(err: unknown, fallback: string): string {
  const code = (err as Partial<BackupError> | null)?.code;
  switch (code) {
    case "password-too-short":
      return t("backup.passwordTooShort", { count: MIN_BACKUP_PASSWORD_LENGTH });
    case "wrong-password":
      return t("backup.wrongPassword");
    case "encrypt-failed":
      return t("backup.encryptFailed");
    case "not-json":
    case "bad-format":
    case "bad-kdf":
    case "bad-base64":
    case "bad-content":
      return t("backup.badFile");
    case "incomplete":
      return t("backup.incomplete");
    case "bad-iterations":
      return t("backup.badFile");
    default:
      return fallback;
  }
}

export function probeFailureText(code: ProbeFailure): string {
  return t(`probe.${code}`);
}

export function connectionStatusText(status: ConnectionStatus): string {
  return t(`status.${status}`);
}

export function mediaEncryptionText(result: MediaEncryptionSupport): string {
  if (!result.supported) {
    return t("conference.e2eeUnsupported", {
      reason: t(result.code === "no-webrtc" ? "conference.noWebrtc" : "conference.noFrameEncryption"),
    });
  }
  return t("conference.e2eeSupported", {
    api: result.api === "encoded-transform" ? "Encoded Transform" : "Insertable Streams",
  });
}
