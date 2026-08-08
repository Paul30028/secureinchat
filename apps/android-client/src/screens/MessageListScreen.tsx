import { useState } from "react";
import { colors, MessageListItem, BottomNav, Button, touchTarget, type BottomNavKey } from "@secureinchat/ui";
import { TodayScreen, type TodayContent } from "./TodayScreen";
import { registerTap, INITIAL_TAP_STATE, type TapState } from "../adminAccess";
import { formatListTime } from "../timeFormat";
import { APP_VERSION } from "../version";

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
  todayContent: TodayContent;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  /** 版本号连点 7 次后触发 */
  onAdminUnlocked: () => void;
  deviceId: string;
  nickname?: string | undefined;
  onOpenServerSettings: () => void;
  relayUrl: string;
  /** 默认打开哪个 tab，不传就是公告 */
  initialTab?: BottomNavKey | undefined;
}

/** 消息列表页 + 公告/我的两个 tab。单群试用版：消息列表只有当前这一个群。 */
export function MessageListScreen({
  groups,
  onOpenGroup,
  onJoinAnotherGroup,
  todayContent,
  isAdmin,
  onOpenAdmin,
  onAdminUnlocked,
  deviceId,
  nickname,
  onOpenServerSettings,
  relayUrl,
  initialTab,
}: MessageListScreenProps) {
  // 公告每天更新，是很多人打开这个应用的第一个理由——所以默认落在这里，
  // 而不是像通用 IM 那样落在会话列表。
  const [activeTab, setActiveTab] = useState<BottomNavKey>(initialTab ?? "announcements");
  const [tapState, setTapState] = useState<TapState>(INITIAL_TAP_STATE);
  const [tapHint, setTapHint] = useState<string | null>(null);

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
            {groups.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 16px 24px" }}>
                <div style={{ fontSize: 15, color: colors.textPrimary, marginBottom: 6 }}>还没有加入任何群聊</div>
                <div style={{ fontSize: 12, color: "#8A8A82", lineHeight: 1.7 }}>
                  这个应用只能通过邀请码加入，
                  <br />
                  没有搜索、没有好友列表、也不需要手机号。
                </div>
              </div>
            ) : null}
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
          <TodayScreen content={todayContent} isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} />
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
            <button
              onClick={onOpenServerSettings}
              style={{
                minHeight: touchTarget.minDp,
                marginTop: 12,
                textAlign: "left",
                background: "transparent",
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 12,
                padding: "10px 14px",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 14, color: colors.textPrimary }}>服务器设置</div>
              <div style={{ fontSize: 11, color: "#9A9A94", fontFamily: "monospace", wordBreak: "break-all" }}>
                {relayUrl}
              </div>
            </button>

            <button
              onClick={() => {
                const result = registerTap(tapState);
                setTapState(result.state);
                if (result.unlocked) {
                  setTapHint("管理员入口已开启");
                  onAdminUnlocked();
                } else if (result.remaining <= 3) {
                  // 到最后三次才给提示——否则误触也会看到莫名其妙的倒数
                  setTapHint(`还差 ${result.remaining} 次`);
                } else {
                  setTapHint(null);
                }
              }}
              style={{
                minHeight: touchTarget.minDp,
                textAlign: "left",
                background: "transparent",
                border: "none",
                boxShadow: "none",
                color: "#9A9A94",
                fontSize: 11,
                cursor: "default",
                marginTop: 12,
              }}
            >
              版本 {APP_VERSION}
              {tapHint ? <span style={{ marginLeft: 8, color: colors.wheatGold }}>{tapHint}</span> : null}
            </button>

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
