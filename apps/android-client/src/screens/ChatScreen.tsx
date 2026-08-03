import { useRef, useState } from "react";
import { colors, ChatBubble, Composer, touchTarget } from "@secureinchat/ui";
import { MediaBubbleContent, AnnouncementCard, type MediaContent } from "./MediaBubbleContent";

export interface DisplayMessage {
  id: string;
  isOwn: boolean;
  fromDeviceId?: string;
  /** 文本消息 */
  text?: string;
  /** 媒体消息：图片/语音/文件——bytes 已经在本地解密组装好，用 objectUrl 渲染 */
  media?: MediaContent;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
}

export interface ChatScreenProps {
  groupName: string;
  messages: DisplayMessage[];
  announcement?: Announcement | undefined;
  onSend: (text: string) => Promise<void>;
  onSendFile: (file: File, mediaKind: "image" | "voice" | "file") => Promise<void>;
  sendError?: string | undefined;
  /** 正在接收中的文件进度，例如 "photo.jpg 3/12" */
  incomingProgress?: { fileId: string; fileName: string; receivedChunks: number; totalChunks: number }[] | undefined;
  /** 同群里已知的其他设备——没有服务端成员列表，只能从收到过的消息里推断 */
  knownPeers: string[];
  onStartCall: (kind: "voice" | "video", peerDeviceId: string) => void;
  onBack: () => void;
}

/**
 * 纯展示的聊天页——消息数组和发送逻辑都由 App 层传进来，这个组件本身不持有
 * 会话状态、不订阅 RelayClient。录音是唯一的例外：MediaRecorder 是纯本地的
 * 浏览器 API，录完直接交给 onSendFile，没必要把这个瞬时状态提到 App 层。
 */
const callBtnStyle = {
  minHeight: touchTarget.minDp,
  minWidth: touchTarget.minDp,
  background: "transparent",
  border: "none",
  boxShadow: "none",
  fontSize: 18,
  cursor: "pointer",
} as const;

export function ChatScreen({
  groupName,
  messages,
  announcement,
  onSend,
  onSendFile,
  sendError,
  incomingProgress,
  knownPeers,
  onStartCall,
  onBack,
}: ChatScreenProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  async function startRecording() {
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const parts: Blob[] = [];
      recorder.ondataavailable = (e) => parts.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(parts, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        await onSendFile(file, "voice");
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      // 权限被拒绝 / 设备不支持——明确告诉用户，不要静默失败
      setRecordError("无法录音，请检查麦克风权限");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.ivory, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px" }}>
        <button
          onClick={onBack}
          aria-label="返回"
          style={{ background: "transparent", border: "none", boxShadow: "none", color: colors.deepInkGreen, cursor: "pointer" }}
        >
          ←
        </button>
        <span style={{ fontSize: 16, fontWeight: 500, color: colors.deepInkGreen, flex: 1 }}>{groupName}</span>
        {knownPeers.length > 0 ? (
          <>
            <button
              onClick={() => onStartCall("voice", knownPeers[knownPeers.length - 1]!)}
              aria-label="语音通话"
              style={callBtnStyle}
            >
              📞
            </button>
            <button
              onClick={() => onStartCall("video", knownPeers[knownPeers.length - 1]!)}
              aria-label="视频通话"
              style={callBtnStyle}
            >
              🎥
            </button>
          </>
        ) : null}
      </div>

      <div style={{ flex: 1, padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        {announcement ? <AnnouncementCard title={announcement.title} body={announcement.body} /> : null}

        {messages.length === 0 && !announcement ? (
          <p style={{ textAlign: "center", color: "#9A9A94", fontSize: 12, marginTop: 24 }}>还没有消息，说点什么吧</p>
        ) : (
          messages.map((m) => (
            <ChatBubble key={m.id} isOwn={m.isOwn} timeLabel="刚刚" senderName={m.isOwn ? undefined : m.fromDeviceId}>
              {m.media ? <MediaBubbleContent media={m.media} isOwn={m.isOwn} /> : m.text}
            </ChatBubble>
          ))
        )}

        {incomingProgress?.map((p) => (
          <div key={p.fileId} style={{ fontSize: 11, color: "#9A9A94", textAlign: "center" }}>
            正在接收 {p.fileName}（{p.receivedChunks}/{p.totalChunks}）
          </div>
        ))}
      </div>

      {sendError ? (
        <p role="alert" style={{ color: "#A33", fontSize: 12, textAlign: "center", margin: "0 0 4px" }}>
          {sendError}
        </p>
      ) : null}
      {recordError ? (
        <p role="alert" style={{ color: "#A33", fontSize: 12, textAlign: "center", margin: "0 0 4px" }}>
          {recordError}
        </p>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px" }}>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          aria-label="选择图片"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await onSendFile(file, "image");
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          aria-label="选择文件"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await onSendFile(file, "file");
            e.target.value = "";
          }}
        />
        <button
          onClick={() => imageInputRef.current?.click()}
          aria-label="发送图片"
          style={{
            minHeight: touchTarget.minDp,
            minWidth: touchTarget.minDp,
            background: "transparent",
            border: "none",
            boxShadow: "none",
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          🖼️
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="发送文件"
          style={{
            minHeight: touchTarget.minDp,
            minWidth: touchTarget.minDp,
            background: "transparent",
            border: "none",
            boxShadow: "none",
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          📎
        </button>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          aria-label={isRecording ? "停止录音并发送" : "录制语音"}
          style={{
            minHeight: touchTarget.minDp,
            minWidth: touchTarget.minDp,
            background: "transparent",
            border: "none",
            boxShadow: "none",
            fontSize: 18,
            cursor: "pointer",
            color: isRecording ? "#A33" : colors.deepInkGreen,
          }}
        >
          {isRecording ? "⏹" : "🎤"}
        </button>
        <div style={{ flex: 1 }}>
          <Composer onSend={onSend} />
        </div>
      </div>
    </div>
  );
}
