import { useState } from "react";
import { colors, radii, touchTarget } from "../tokens";

export interface CopyableCodeProps {
  value: string;
  label?: string;
}

/** 展示一段可复制的文本（邀请码之类）。复制成功后按钮文案短暂变成"已复制"，
 *  不用弹窗/toast——这个组件本身不引入额外的全局提示系统。 */
export function CopyableCode({ value, label }: CopyableCodeProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板权限被拒绝或不支持——不崩溃，按钮就是不给反馈，用户还能手动选中复制
    }
  }

  return (
    <div>
      {label ? <div style={{ fontSize: 12, color: "#8A8A82", marginBottom: 6 }}>{label}</div> : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: colors.ivory,
          border: `0.5px solid ${colors.sageMint}`,
          borderRadius: radii.cardSmall,
          padding: "8px 12px",
        }}
      >
        <code
          style={{
            flex: 1,
            fontSize: 12,
            color: colors.textPrimary,
            wordBreak: "break-all",
            fontFamily: "monospace",
          }}
        >
          {value}
        </code>
        <button
          onClick={handleCopy}
          style={{
            minHeight: touchTarget.minDp,
            minWidth: 60,
            background: "transparent",
            border: "none",
            boxShadow: "none",
            color: colors.deepInkGreen,
            fontSize: 13,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
    </div>
  );
}
