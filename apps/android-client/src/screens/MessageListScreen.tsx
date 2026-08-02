import { useState } from "react";
import { colors, MessageListItem, BottomNav, type BottomNavKey } from "@secureinchat/ui";

export interface MessageListScreenProps {
  /** 加群成功后展示哪个群——真正的多群列表要接 chat-core 的会话状态，
   *  这里先只展示"刚加入的这一个群"，证明导航链路和组件拼装是通的 */
  joinedGroupName: string;
  onOpenChat: () => void;
}

/** 消息列表页。数据是占位的（没有接多群状态管理），点进去是真的聊天页。 */
export function MessageListScreen({ joinedGroupName, onOpenChat }: MessageListScreenProps) {
  const [activeTab, setActiveTab] = useState<BottomNavKey>("messages");

  return (
    <div style={{ minHeight: "100vh", background: colors.ivory, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 16px 8px", fontSize: 16, fontWeight: 500, color: colors.deepInkGreen }}>
        邀群密聊
      </div>

      <div style={{ flex: 1, padding: "0 12px" }}>
        {activeTab === "messages" ? (
          <MessageListItem name={joinedGroupName} previewText="欢迎加入！" timeLabel="刚刚" onClick={onOpenChat} />
        ) : (
          <div style={{ padding: 24, textAlign: "center", color: "#8A8A82", fontSize: 13 }}>
            {activeTab === "announcements" ? "公告页尚未接入" : "我的页尚未接入"}
          </div>
        )}
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
