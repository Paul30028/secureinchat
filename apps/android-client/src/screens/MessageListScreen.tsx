import { useState } from "react";
import { colors, MessageListItem, BottomNav, Button, touchTarget, type BottomNavKey } from "@secureinchat/ui";
import { AnnouncementCard } from "./MediaBubbleContent";
import type { Announcement } from "./ChatScreen";

export interface MessageListScreenProps {
  joinedGroupName: string;
  onOpenChat: () => void;
  announcement?: Announcement | undefined;
  onPublishAnnouncement: (title: string, body: string) => Promise<void>;
  deviceId: string;
  nickname?: string | undefined;
}

/** 消息列表页 + 公告/我的两个 tab。单群试用版：消息列表只有当前这一个群。 */
export function MessageListScreen({
  joinedGroupName,
  onOpenChat,
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
          <MessageListItem
            name={joinedGroupName}
            previewText={announcement ? announcement.title : "欢迎加入！"}
            timeLabel="刚刚"
            onClick={onOpenChat}
          />
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
              试用版：设备身份和群密钥保存在本浏览器中，清除站点数据会丢失。
              个人资料、隐私与安全、数据与存储等设置项尚未接入。
            </p>
          </div>
        )}
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
