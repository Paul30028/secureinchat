import type { ButtonHTMLAttributes, ReactNode } from "react";
import { colors, radii, touchTarget } from "../tokens";

/**
 * 每页只有一个突出主按钮（第六节要求）——variant="primary" 只应该在一屏里出现一次，
 * 这个约束靠使用规范而不是组件本身强制，组件层面只负责视觉正确。
 *
 * 不用 box-shadow：设计上是磨砂卡片 + 轻描边，不是投影卡片。
 */
export type ButtonVariant = "primary" | "secondary" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, { background: string; color: string; border: string }> = {
  primary: { background: colors.deepInkGreen, color: colors.ivory, border: "none" },
  secondary: { background: "transparent", color: colors.deepInkGreen, border: `1px solid ${colors.wheatGold}` },
  danger: { background: "#A33", color: colors.ivory, border: "none" },
};

export function Button({ variant = "primary", children, style, ...rest }: ButtonProps) {
  const v = variantStyles[variant];
  return (
    <button
      {...rest}
      style={{
        minHeight: touchTarget.minDp,
        minWidth: touchTarget.minDp,
        borderRadius: radii.cardSmall,
        background: v.background,
        color: v.color,
        border: v.border,
        fontSize: 14,
        padding: "0 20px",
        boxShadow: "none",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
