import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { colors, radii, touchTarget } from "../tokens";

export interface InviteShareCardProps {
  groupName: string;
  /** 完整的 SIC2 邀请串 */
  inviteCode: string;
  /** 已格式化的有效期文案，没有就不显示 */
  expiryLabel?: string | undefined;
  onCopy: () => void;
}

/**
 * 可截图分享的邀请卡片。
 *
 * 为什么不只是一个"复制"按钮：这个产品的邀请多半发生在线下——聚会上、
 * 微信群里。一张能直接截图转发的卡片比一串要手动复制粘贴的文本自然得多，
 * 而且二维码让对方不用手打。邀请码是这个 App 唯一的入口，值得比一个
 * 输入框更重的呈现。
 *
 * 二维码在本地生成，不经过任何服务器。
 */
export function InviteShareCard({ groupName, inviteCode, expiryLabel, onCopy }: InviteShareCardProps) {
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(inviteCode, {
      type: "svg",
      margin: 1,
      // 邀请串比较长，用中等容错换更小的码面，扫起来更容易
      errorCorrectionLevel: "M",
      color: { dark: colors.deepInkGreen, light: colors.ivory },
    })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch(() => {
        // 生成失败不该让整张卡片废掉——下面的邀请码文本仍然可用
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{
        background: colors.ivory,
        border: `0.5px solid ${colors.sageMint}`,
        borderRadius: radii.cardLarge,
        padding: "20px 18px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary }}>{groupName}</div>
      <div style={{ fontSize: 12, color: "#8A8A82" }}>邀请制加密群聊</div>

      <div
        aria-label="邀请二维码"
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "4px 0",
        }}
        // 二维码是本地用 qrcode 库生成的字符串，不是外部输入
        dangerouslySetInnerHTML={qrSvg ? { __html: qrSvg } : undefined}
      >
        {!qrSvg ? (
          <span style={{ fontSize: 12, color: "#9A9A94" }}>
            {qrError ? "二维码生成失败，请用下方邀请码" : "正在生成二维码..."}
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: 11, color: "#8A8A82", textAlign: "center", lineHeight: 1.6 }}>
        让对方扫码，或复制下面的邀请码发给他
        {expiryLabel ? (
          <>
            <br />
            {expiryLabel}
          </>
        ) : null}
      </div>

      <code
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          color: "#8A8A82",
          wordBreak: "break-all",
          background: `${colors.sageMint}33`,
          borderRadius: radii.cardSmall,
          padding: "8px 10px",
          width: "100%",
          boxSizing: "border-box",
          maxHeight: 60,
          overflow: "hidden",
        }}
      >
        {inviteCode}
      </code>

      <button
        onClick={handleCopy}
        style={{
          minHeight: touchTarget.minDp,
          width: "100%",
          background: copied ? "transparent" : colors.deepInkGreen,
          color: copied ? colors.deepInkGreen : colors.ivory,
          border: copied ? `1px solid ${colors.wheatGold}` : "none",
          borderRadius: radii.cardSmall,
          fontSize: 14,
          cursor: "pointer",
          boxShadow: "none",
        }}
      >
        {copied ? "已复制" : "复制邀请码"}
      </button>

      <div style={{ fontSize: 10, color: "#9A9A94", textAlign: "center" }}>
        拿到这串邀请码的人就能加入并解密群消息，请只发给要邀请的人
      </div>
    </div>
  );
}
