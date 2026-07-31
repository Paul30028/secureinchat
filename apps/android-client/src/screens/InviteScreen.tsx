import { colors, InviteInfoCard, type InviteInfo } from "@secureinchat/ui";

export interface InviteScreenProps {
  invite: InviteInfo;
  onConfirm: () => void;
  onBack: () => void;
}

/** 邀请验证页。真正的"确认加入"网络请求（consume 邀请码、拿群信息）不在这次范围内——
 *  这里只负责把已经解析好的 InviteInfo 渲染出来，并在确认后往下走。 */
export function InviteScreen({ invite, onConfirm, onBack }: InviteScreenProps) {
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
      <InviteInfoCard invite={invite} onConfirm={onConfirm} />
    </div>
  );
}
