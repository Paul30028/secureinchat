import { useState } from "react";
import { colors, touchTarget, Button, Avatar } from "@secureinchat/ui";
import { useT } from "../i18n";

export interface JoinGroupScreenProps {
  onSubmitInviteCode: (raw: string) => void;
  onCreateGroup: () => void;
  onBack: () => void;
  onScanQr: () => void;
}

/** 启动页。对应设计稿"01 启动"+"02 公告与进入"的简化合并——公告卡片、
 *  今日经文这些内容型模块不在这次范围内，先把"输入邀请码进群"这条主干打通。 */
export function JoinGroupScreen({ onSubmitInviteCode, onCreateGroup, onBack, onScanQr }: JoinGroupScreenProps) {
  const t = useT();
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
        aria-label={t("joinGroup.back")}
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
        ← {t("joinGroup.back")}
      </button>
      <Avatar name={t("joinGroup.appName")} size="large" />
      <span style={{ fontSize: 20, fontWeight: 500, color: colors.deepInkGreen }}>{t("joinGroup.appName")}</span>
      <span style={{ fontSize: 12, color: "#8A8A82" }}>{t("joinGroup.tagline")}</span>

      <div style={{ width: "100%", maxWidth: 320, marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("joinGroup.codePlaceholder")}
          aria-label={t("joinGroup.codeAriaLabel")}
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
        {/* 扫码是主路径——小团体多半是当面加入，扫一下比手动粘贴一长串快得多 */}
        <Button variant="primary" onClick={onScanQr} style={{ width: "100%" }}>
          {t("joinGroup.scanQr")}
        </Button>

        <Button
          variant="secondary"
          onClick={() => onSubmitInviteCode(code)}
          disabled={code.trim().length === 0}
          style={{ width: "100%" }}
        >
          {t("joinGroup.joinWithCode")}
        </Button>
        <Button variant="secondary" onClick={onCreateGroup} style={{ width: "100%" }}>
          {t("joinGroup.createGroup")}
        </Button>

      </div>
    </div>
  );
}
