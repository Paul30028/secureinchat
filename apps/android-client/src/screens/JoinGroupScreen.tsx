import { useState } from "react";
import { colors, touchTarget, Button, Avatar } from "@secureinchat/ui";

export interface JoinGroupScreenProps {
  onSubmitInviteCode: (raw: string) => void;
  onCreateGroup: () => void;
  onBack: () => void;
}

/** 启动页。对应设计稿"01 启动"+"02 公告与进入"的简化合并——公告卡片、
 *  今日经文这些内容型模块不在这次范围内，先把"输入邀请码进群"这条主干打通。 */
export function JoinGroupScreen({ onSubmitInviteCode, onCreateGroup, onBack }: JoinGroupScreenProps) {
  const [code, setCode] = useState("");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.ivory,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
      }}
    >
      <button
        onClick={onBack}
        aria-label="返回"
        style={{
          alignSelf: "flex-start",
          background: "transparent",
          border: "none",
          boxShadow: "none",
          color: colors.deepInkGreen,
          fontSize: 14,
          cursor: "pointer",
          minHeight: touchTarget.minDp,
        }}
      >
        ← 返回
      </button>
      <Avatar name="邀群密聊" size="large" />
      <span style={{ fontSize: 20, fontWeight: 500, color: colors.deepInkGreen }}>邀群密聊</span>
      <span style={{ fontSize: 12, color: "#8A8A82" }}>安全 · 隐私 · 专属</span>

      <div style={{ width: "100%", maxWidth: 320, marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="输入邀请码"
          aria-label="邀请码输入框"
          style={{
            minHeight: touchTarget.minDp,
            border: `0.5px solid ${colors.sageMint}`,
            borderRadius: 14,
            padding: "0 16px",
            fontSize: 14,
            background: colors.ivory,
            color: colors.textPrimary,
            boxShadow: "none",
          }}
        />
        <Button
          variant="primary"
          onClick={() => onSubmitInviteCode(code)}
          disabled={code.trim().length === 0}
          style={{ width: "100%" }}
        >
          加入群聊
        </Button>
        <Button variant="secondary" onClick={onCreateGroup} style={{ width: "100%" }}>
          创建群聊
        </Button>

      </div>
    </div>
  );
}
