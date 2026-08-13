import { useRef, useState } from "react";
import { colors, ChatBubble, Composer, touchTarget } from "@secureinchat/ui";
import { MediaBubbleContent, AnnouncementCard, type MediaContent } from "./MediaBubbleContent";
import { formatMessageTime } from "../timeFormat";
import { MessageActionSheet, type MessageAction } from "./MessageActionSheet";

export interface DisplayMessage {
  id: string;
  isOwn: boolean;
  fromDeviceId?: string | undefined;
  /** 发送时间，用于显示真实时间而不是写死的"刚刚" */
  sentAtMs: number;
  /** 文本消息 */
  text?: string | undefined;
  /** 媒体消息：图片/语音/文件——bytes 已经在本地解密组装好，用 objectUrl 渲染 */
  media?: MediaContent | undefined;
  /** 断线时进了离线队列，重连后会自动补发 */
  queued?: boolean | undefined;
  /** 引用的消息（快照，不是 ID——对方可能已经删了原消息） */
  replyTo?: { senderName: string; excerpt: string } | undefined;
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
  onCopyMessage: (message: DisplayMessage) => void;
  onDeleteMessage: (messageId: string) => void;
  /** 选中要回复的消息；传 null 取消回复 */
  onSetReplyTarget: (message: DisplayMessage | null) => void;
  replyTarget?: DisplayMessage | null | undefined;
  onOpenSearch: () => void;
  onOpenGroupSettings: () => void;
  onSendFile: (file: File, mediaKind: "image" | "voice" | "file") => Promise<void>;
  sendError?: string | undefined;
  connectionStatus?: "connecting" | "connected" | "reconnecting" | "disconnected" | undefined;
  /** 断线期间排队等待发送的消息条数 */
  pendingCount?: number | undefined;
  /** 大文件发送进度 */
  sendProgress?: string | undefined;
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

const toolbarLabelStyle = { fontSize: 10, color: "#8A8A82" } as const;

function toolbarButtonStyle(color: string) {
  return {
    minHeight: touchTarget.minDp,
    minWidth: touchTarget.minDp,
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    background: "transparent",
    border: "none",
    boxShadow: "none",
    fontSize: 18,
    cursor: "pointer",
    color,
  };
}

export function ChatScreen({
  groupName,
  messages,
  announcement,
  onSend,
  onSendFile,
  onCopyMessage,
  onDeleteMessage,
  onSetReplyTarget,
  replyTarget,
  onOpenSearch,
  onOpenGroupSettings,
  sendError,
  connectionStatus,
  pendingCount,
  sendProgress,
  incomingProgress,
  knownPeers,
  onStartCall,
  onBack,
}: ChatScreenProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  /** 长按选中的消息，弹出操作面板 */
  const [actionTarget, setActionTarget] = useState<DisplayMessage | null>(null);
  /** 附件面板是否展开。默认收起，让"发送"是这一屏唯一突出的主按钮
   *  （对应需求第六节"每页只有一个突出主按钮"）。 */
  const [attachOpen, setAttachOpen] = useState(false);
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
        <button
          onClick={onOpenGroupSettings}
          aria-label="群设置"
          style={{
            flex: 1,
            textAlign: "left",
            background: "transparent",
            border: "none",
            boxShadow: "none",
            fontSize: 16,
            fontWeight: 500,
            color: colors.deepInkGreen,
            cursor: "pointer",
            minHeight: touchTarget.minDp,
          }}
        >
          {groupName}
        </button>
        <button
          onClick={onOpenSearch}
          aria-label="搜索消息"
          style={{ ...callBtnStyle, fontSize: 16 }}
        >
          🔍
        </button>
        {/* 通话按钮常驻显示。之前是"没有在线成员就整个隐藏"，结果用户
            以为功能不存在——现在改成禁用+说明，一眼能看出为什么点不了。 */}
        <button
          onClick={() => onStartCall("voice", knownPeers[knownPeers.length - 1]!)}
          disabled={knownPeers.length === 0}
          aria-label="语音通话"
          title={knownPeers.length === 0 ? "群里没有其他人在线" : "语音通话"}
          style={{ ...callBtnStyle, opacity: knownPeers.length === 0 ? 0.35 : 1 }}
        >
          📞
        </button>
        <button
          onClick={() => onStartCall("video", knownPeers[knownPeers.length - 1]!)}
          disabled={knownPeers.length === 0}
          aria-label="视频通话"
          title={knownPeers.length === 0 ? "群里没有其他人在线" : "视频通话"}
          style={{ ...callBtnStyle, opacity: knownPeers.length === 0 ? 0.35 : 1 }}
        >
          🎥
        </button>
      </div>

      {connectionStatus && connectionStatus !== "connected" ? (
        <div
          role="status"
          style={{
            background: `${colors.wheatGold}22`,
            color: colors.wheatGold,
            fontSize: 12,
            textAlign: "center",
            padding: "6px 12px",
          }}
        >
          {connectionStatus === "reconnecting"
            ? "连接已断开，正在自动重连..."
            : connectionStatus === "connecting"
              ? "正在连接..."
              : "已断开连接"}
          {pendingCount ? `（${pendingCount} 条消息等待发送）` : ""}
        </div>
      ) : null}

      <div style={{ flex: 1, padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        {announcement ? <AnnouncementCard title={announcement.title} body={announcement.body} /> : null}

        {messages.length === 0 && !announcement ? (
          <p style={{ textAlign: "center", color: "#9A9A94", fontSize: 12, marginTop: 24 }}>还没有消息，说点什么吧</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              onContextMenu={(e) => {
                // 长按在移动端触发 contextmenu；桌面端右键也走这里
                e.preventDefault();
                setActionTarget(m);
              }}
            >
              <ChatBubble
                isOwn={m.isOwn}
                timeLabel={formatMessageTime(m.sentAtMs)}
                senderName={m.isOwn ? undefined : m.fromDeviceId}
              >
                {m.replyTo ? (
                  <div
                    style={{
                      borderLeft: `2px solid ${m.isOwn ? "rgba(235,236,229,0.5)" : colors.sageMint}`,
                      paddingLeft: 8,
                      marginBottom: 6,
                      fontSize: 12,
                      opacity: 0.75,
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{m.replyTo.senderName}</div>
                    <div>{m.replyTo.excerpt}</div>
                  </div>
                ) : null}
                {m.media ? <MediaBubbleContent media={m.media} isOwn={m.isOwn} /> : m.text}
              </ChatBubble>
              {m.queued ? (
                <div style={{ textAlign: "right", fontSize: 11, color: colors.wheatGold, marginTop: 2 }}>
                  等待发送
                </div>
              ) : null}
            </div>
          ))
        )}

        {incomingProgress?.map((p) => (
          <div key={p.fileId} style={{ fontSize: 11, color: "#9A9A94", textAlign: "center" }}>
            正在接收 {p.fileName}（{p.receivedChunks}/{p.totalChunks}）
          </div>
        ))}
      </div>

      {sendProgress ? (
        <p role="status" style={{ color: colors.wheatGold, fontSize: 12, textAlign: "center", margin: "0 0 4px" }}>
          {sendProgress}
        </p>
      ) : null}
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

      {/* 底部分成两栏：上面是输入+发送，下面是功能栏。
          之前挤在一行里，输入框被压得很窄，功能图标也没有文字标签。 */}
      <div style={{ borderTop: `0.5px solid ${colors.sageMint}`, background: colors.ivory }}>
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

        {replyTarget ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: "6px 10px 0",
              padding: "6px 10px",
              background: `${colors.sageMint}44`,
              borderRadius: 10,
              fontSize: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: colors.deepInkGreen, fontWeight: 500 }}>
                回复 {replyTarget.isOwn ? "自己" : (replyTarget.fromDeviceId ?? "对方")}
              </div>
              <div
                style={{
                  color: "#8A8A82",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {replyTarget.text ?? replyTarget.media?.fileName ?? ""}
              </div>
            </div>
            <button
              onClick={() => onSetReplyTarget(null)}
              aria-label="取消回复"
              style={{
                minHeight: touchTarget.minDp,
                minWidth: touchTarget.minDp,
                background: "transparent",
                border: "none",
                boxShadow: "none",
                color: "#8A8A82",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px 0" }}>
          <button
            onClick={() => setAttachOpen((v) => !v)}
            aria-label={attachOpen ? "收起附件选项" : "添加图片或文件"}
            style={{
              minHeight: touchTarget.minDp,
              minWidth: touchTarget.minDp,
              background: "transparent",
              border: "none",
              boxShadow: "none",
              color: colors.deepInkGreen,
              fontSize: 22,
              cursor: "pointer",
              transform: attachOpen ? "rotate(45deg)" : "none",
              transition: "transform 120ms",
            }}
          >
            ＋
          </button>
          <div style={{ flex: 1 }}>
            <Composer onSend={onSend} onStartVoice={() => void startRecording()} />
          </div>
        </div>

        {attachOpen ? (
          <div style={{ display: "flex", alignItems: "stretch", padding: "0 6px 4px" }}>
            <button
              onClick={() => {
                setAttachOpen(false);
                imageInputRef.current?.click();
              }}
              aria-label="发送图片"
              style={toolbarButtonStyle(colors.deepInkGreen)}
            >
              🖼️
              <span style={toolbarLabelStyle}>图片</span>
            </button>
            <button
              onClick={() => {
                setAttachOpen(false);
                fileInputRef.current?.click();
              }}
              aria-label="发送文件"
              style={toolbarButtonStyle(colors.deepInkGreen)}
            >
              📎
              <span style={toolbarLabelStyle}>文件</span>
            </button>
          </div>
        ) : null}

        {isRecording ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px 6px" }}>
            <button
              onClick={stopRecording}
              aria-label="停止录音并发送"
              style={{
                minHeight: touchTarget.minDp,
                width: "100%",
                background: "#A33",
                color: colors.ivory,
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              ⏹ 录音中，点击结束并发送
            </button>
          </div>
        ) : null}
      </div>

      {actionTarget ? (
        <MessageActionSheet
          excerpt={actionTarget.text ?? actionTarget.media?.fileName ?? ""}
          canCopy={Boolean(actionTarget.text)}
          onCancel={() => setActionTarget(null)}
          onAction={(action: MessageAction) => {
            const target = actionTarget;
            setActionTarget(null);
            if (action === "copy") onCopyMessage(target);
            else if (action === "delete") onDeleteMessage(target.id);
            else onSetReplyTarget(target);
          }}
        />
      ) : null}
    </div>
  );
}
