import type { HTMLAttributes, ReactNode } from "react";
import { colors, radii } from "../tokens";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** 磨砂卡片用大圆角；次级信息块可以用中/小圆角，但同一页里不要混超过两级 */
  size?: "large" | "medium" | "small";
}

const radiusBySize = {
  large: radii.cardLarge,
  medium: radii.cardMedium,
  small: radii.cardSmall,
} as const;

/** 磨砂卡片：象牙白背景 + 细描边，明确不用 box-shadow（第六节视觉要求：轻阴影→这里改为无阴影+描边，
 *  与"图标不要有阴影"的反馈保持一致，全项目统一去阴影） */
export function Card({ children, size = "medium", style, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      style={{
        background: colors.ivory,
        border: `0.5px solid ${colors.sageMint}`,
        borderRadius: radiusBySize[size],
        boxShadow: "none",
        padding: "1rem 1.25rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
