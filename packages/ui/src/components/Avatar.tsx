import { colors } from "../tokens";

export type AvatarSize = "small" | "medium" | "large";

const sizeByVariant: Record<AvatarSize, number> = {
  small: 32,
  medium: 44,
  large: 64,
};

export interface AvatarProps {
  /** 图片地址；不传或加载失败时回退到取名字首字的圆形占位 */
  src?: string | undefined;
  /** 用来生成回退首字和 alt 文本 */
  name: string;
  size?: AvatarSize;
}

/** 圆形头像。设计上明确不用阴影——磨砂卡片+细描边的风格延伸到这里。 */
export function Avatar({ src, name, size = "medium" }: AvatarProps) {
  const px = sizeByVariant[size];
  const initial = name.trim().charAt(0) || "?";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={px}
        height={px}
        style={{
          width: px,
          height: px,
          borderRadius: "50%",
          objectFit: "cover",
          boxShadow: "none",
          border: `0.5px solid ${colors.sageMint}`,
        }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      style={{
        width: px,
        height: px,
        borderRadius: "50%",
        background: colors.sageMint,
        color: colors.deepInkGreen,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: px * 0.42,
        fontWeight: 500,
        boxShadow: "none",
      }}
    >
      {initial}
    </div>
  );
}
