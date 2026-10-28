import { colors, touchTarget, InviteShareCard } from "@secureinchat/ui";

export interface GroupInviteScreenProps {
  /** 群名。加载完成前 / 找不到群时为 undefined。 */
  groupName?: string | undefined;
  /** 重新生成的邀请串。加载完成前 / 出错时为 undefined。 */
  inviteCode?: string | undefined;
  /** 生成失败时的提示。有值时只显示错误，不显示空卡片。 */
  error?: string | undefined;
  onCopy: () => void;
  onBack: () => void;
}

/**
 * 重新打开邀请卡片。邀请串用 JoinedGroup 里当前的密钥材料和 epoch 现算，
 * 不单独保存——轮换过密钥后这里自然是最新的，旧卡片随之失效。
 *
 * 调用方负责生成 inviteCode，这个组件只负责展示和复制。
 */
export function GroupInviteScreen({
  groupName,
  inviteCode,
  error,
  onCopy,
  onBack,
}: GroupInviteScreenProps) {
  return (
    <div style={{ minHeight: "100%", background: colors.ivory, padding: 24, overflowY: "auto" }}>
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
          minHeight: touchTarget.minDp,
        }}
      >
        ← 返回
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 16px" }}>
        {/* 群名已经印在下面的卡片上，标题只说这一页是干什么的 */}
        邀请新成员
      </h1>

      {error ? (
        <p
          role="alert"
          style={{
            color: "#A33",
            fontSize: 13,
            lineHeight: 1.7,
            margin: "0 0 12px",
            whiteSpace: "pre-line",
          }}
        >
          {error}
        </p>
      ) : !inviteCode || !groupName ? (
        <p style={{ fontSize: 12, color: "#8A8A82", margin: 0 }}>正在生成邀请卡片...</p>
      ) : (
        <>
          <InviteShareCard groupName={groupName} inviteCode={inviteCode} onCopy={onCopy} />
          <p
            style={{
              fontSize: 11,
              color: "#9A9A94",
              lineHeight: 1.7,
              marginTop: 14,
              marginBottom: 0,
            }}
          >
            拿到这张卡片的人都能加入本群并读到之后的消息。只发给你信任的人。
            要移出某人，在「群内设备」里更换群密钥，旧卡片随之失效。
          </p>
        </>
      )}
    </div>
  );
}
