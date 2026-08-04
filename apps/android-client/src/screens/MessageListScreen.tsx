import { useState } from "react";
import { colors, MessageListItem, BottomNav, Button, touchTarget, type BottomNavKey } from "@secureinchat/ui";
import { AnnouncementCard } from "./MediaBubbleContent";
import { formatListTime } from "../timeFormat";
import type { Announcement } from "./ChatScreen";

export interface GroupListItem {
  groupId: string;
  groupName: string;
  unread: number;
  onlineCount: number;
  lastMessage?: { preview: string; sentAtMs: number } | undefined;
}

export interface MessageListScreenProps {
  groups: GroupListItem[];
  onOpenGroup: (groupId: string) => void;
  /** 去加入/创建另一个群 */
  onJoinAnotherGroup: () => void;
  announcement?: Announcement | undefined;
  onPublishAnnouncement: (title: string, body: string) => Promise<void>;
  deviceId: string;
  nickname?: string | undefined;
}

/** 消息列表页 + 公告/我的两个 tab。单群试用版：消息列表只有当前这一个群。 */
export function MessageListScreen({
  groups,
  onOpenGroup,
  onJoinAnotherGroup,
  announcement,
  onPublishAnnouncement,
  deviceId,
  nickname,
}: MessageListScreenProps) {
  const [activeTab, setActiveTab] = useState<BottomNavKey>("messages");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  async function handlePublish() {
    setIsPublishing(true);
    try {
      await onPublishAnnouncement(title.trim(), body.trim());
      setTitle("");
      setBody("");
    } finally {
      setIsPublishing(false);
    }
  }

  const inputStyle = {
    minHeight: touchTarget.minDp,
    border: `0.5px solid ${colors.sageMint}`,
    borderRadius: 14,
    padding: "8px 16px",
    fontSize: 14,
    background: colors.ivory,
    color: colors.textPrimary,
    boxShadow: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.ivory, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 8px", fontSize: 16, fontWeight: 500, color: colors.deepInkGreen }}>
        邀群密聊
      </div>

      <div style={{ flex: 1, padding: "0 12px" }}>
        {activeTab === "messages" ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {groups.map((g) => (
              <div key={g.groupId}>
                <MessageListItem
                  name={g.groupName}
                  previewText={g.lastMessage ? g.lastMessage.preview : "还没有消息"}
                  timeLabel={g.lastMessage ? formatListTime(g.lastMessage.sentAtMs) : ""}
                  unreadCount={g.unread}
                  onClick={() => onOpenGroup(g.groupId)}
                />
                <div style={{ padding: "0 6px 6px 60px", fontSize: 11, color: "#9A9A94" }}>
                  {g.onlineCount > 0 ? `${g.onlineCount} 位成员在线` : "群里暂时只有你在线"}
                </div>
              </div>
            ))}

            <button
              onClick={onJoinAnotherGroup}
              style={{
                minHeight: touchTarget.minDp,
                marginTop: 12,
                background: "transparent",
                border: `0.5px dashed ${colors.sageMint}`,
                borderRadius: 14,
                color: colors.deepInkGreen,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              + 加入或创建其他群聊
            </button>
          </div>
        ) : activeTab === "announcements" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
            {announcement ? (
              <AnnouncementCard title={announcement.title} body={announcement.body} />
            ) : (
              <p style={{ fontSize: 12, color: "#9A9A94", textAlign: "center", padding: "16px 0" }}>
                还没有公告
              </p>
            )}

            <div style={{ borderTop: `0.5px solid ${colors.sageMint}`, paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: "#8A8A82", marginBottom: 8 }}>发布每日公告</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="公告标题"
                  aria-label="公告标题输入框"
                  style={inputStyle}
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="公告内容"
                  aria-label="公告内容输入框"
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                <Button
                  variant="primary"
                  onClick={handlePublish}
                  disabled={isPublishing || title.trim().length === 0 || body.trim().length === 0}
                >
                  {isPublishing ? "发布中..." : "发布公告"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {nickname ? (
              <>
                <div style={{ fontSize: 13, color: colors.textPrimary }}>昵称</div>
                <div style={{ fontSize: 15, color: colors.deepInkGreen }}>{nickname}</div>
              </>
            ) : null}
            <div style={{ fontSize: 13, color: colors.textPrimary, marginTop: 8 }}>本机身份</div>
            <div style={{ fontSize: 11, color: "#8A8A82", wordBreak: "break-all", fontFamily: "monospace" }}>
              {deviceId}
            </div>
            <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.6, marginTop: 8 }}>
              设备身份、群密钥和聊天记录都加密保存在本机。清除应用数据会全部丢失，
              且无法从服务器恢复——中继按设计不保存任何聊天内容。
            </p>
          </div>
        )}
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
