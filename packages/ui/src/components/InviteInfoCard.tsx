import { colors, radii, touchTarget } from "../tokens";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { Card } from "./Card";

export interface ValidInviteInfo {
  status: "valid";
  groupName: string;
  memberCount: number;
  inviterName: string;
  /** 已经格式化好的剩余有效期文案，比如"有效期剩 2 天 18 小时"——组件不自己算时间 */
  expiryLabel: string;
}

export interface InvalidInviteInfo {
  status: "invalid";
  /** "expired" | "revoked" | "exhausted" 等——用于选择提示文案，具体判断逻辑在
   *  调用方（protocol 包解析结果 / 服务端返回的 reason），这里只负责展示 */
  reason: "expired" | "revoked" | "exhausted" | "malformed";
}

export type InviteInfo = ValidInviteInfo | InvalidInviteInfo;

export interface InviteInfoCardProps {
  invite: InviteInfo;
  onConfirm: () => void;
  /** 确认按钮的加载态——避免用户在网络请求还没返回时重复点击 */
  isConfirming?: boolean;
}

const INVALID_REASON_LABEL: Record<InvalidInviteInfo["reason"], string> = {
  expired: "该邀请已过期或已被撤销，请联系邀请人获取新的邀请。",
  revoked: "该邀请已被撤销，请联系邀请人获取新的邀请。",
  exhausted: "该邀请的可用次数已用尽，请联系邀请人获取新的邀请。",
  malformed: "邀请码格式不正确，请检查后重新输入。",
};

/** 邀请验证卡片。有效/失效两种状态互斥——失效状态下不渲染"确认加入"按钮，
 *  避免用户点了却收到一个必然失败的请求。 */
export function InviteInfoCard({ invite, onConfirm, isConfirming }: InviteInfoCardProps) {
  if (invite.status === "invalid") {
    return (
      <Card size="large" style={{ textAlign: "center" }}>
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "8px 0",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 500, color: colors.textPrimary }}>邀请已失效</span>
          <span style={{ fontSize: 13, color: "#8A8A82", lineHeight: 1.6 }}>
            {INVALID_REASON_LABEL[invite.reason]}
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card size="large">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0" }}>
        <Avatar name={invite.groupName} size="large" />
        <span style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary }}>{invite.groupName}</span>
        <span style={{ fontSize: 13, color: "#8A8A82" }}>{invite.memberCount}人 · 邀请制加密群聊</span>

        <div
          style={{
            width: "100%",
            borderTop: `0.5px solid ${colors.sageMint}`,
            marginTop: 8,
            paddingTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13, color: "#8A8A82" }}>邀请人：{invite.inviterName}</span>
          <span
            style={{
              fontSize: 12,
              color: colors.wheatGold,
              background: `${colors.sageMint}55`,
              borderRadius: radii.cardSmall,
              padding: "2px 8px",
              alignSelf: "flex-start",
            }}
          >
            邀请有效，可加入 · {invite.expiryLabel}
          </span>
        </div>

        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={isConfirming}
          style={{ width: "100%", minHeight: touchTarget.minDp, marginTop: 12 }}
        >
          {isConfirming ? "正在加入..." : "确认加入"}
        </Button>
      </div>
    </Card>
  );
}
