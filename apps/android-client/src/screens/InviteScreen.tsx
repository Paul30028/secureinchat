import { colors, InviteInfoCard, type InviteInfo } from "@secureinchat/ui";

export interface InviteScreenProps {
  invite: InviteInfo;
  onConfirm: () => void;
  onBack: () => void;
  isConfirming?: boolean | undefined;
  /** 派生/存储群密钥失败时的提示——和"邀请本身无效"是两回事，分开展示 */
  errorMessage?: string | undefined;
}

/** 邀请验证页。真正的"确认加入"现在会调用 chat-core 的 joinGroupFromInvite，
 *  派生并落盘这个群的入群密钥——不再只是切个屏幕。 */
export function InviteScreen({ invite, onConfirm, onBack, isConfirming, errorMessage }: InviteScreenProps) {
  return (
    <div style={{ minHeight: "100vh", background: colors.ivory, padding: 24 }}>
      <button
        onClick={onBack}
        aria-label="返回"
        style={{
          background: "transparent",
          border: "none",
          boxShadow: "none",
          color: colors.deepInkGreen,
          fontSize: 14,
          marginBottom: 16,
          cursor: "pointer",
          minHeight: 48,
        }}
      >
        ← 返回
      </button>
      <InviteInfoCard invite={invite} onConfirm={onConfirm} isConfirming={isConfirming} />
      {errorMessage ? (
        <p role="alert" style={{ color: "#A33", fontSize: 13, textAlign: "center", marginTop: 12 }}>
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
