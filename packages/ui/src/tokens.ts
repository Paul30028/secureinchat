/**
 * 设计 token —— 颜色值全部从你提供的设计稿（App 图标 + 界面 mockup）里实际取样，
 * 不是凭观感估的近似色。取样方法记录在 packages/ui/assets/design-source/README.md，
 * 换新设计稿时按同样方法重新取样、更新这里，不要手改数值却不更新来源说明。
 */

export const colors = {
  /** 图标卡片 / 界面背景的象牙白（取样自 App 图标卡片区域） */
  ivory: "#EBECE5",
  /** 图标内圈的鼠尾草绿 / 淡薄荷绿（取样自 App 图标圆形背景） */
  sageMint: "#D4DCD1",
  /** 麦穗金——图标与强调色（取样自麦穗高光区域的聚类均值） */
  wheatGold: "#B28F5D",
  /** 深墨绿——主按钮 / 标题文字（取样自启动页"加入群聊"按钮与标题色的聚类均值） */
  deepInkGreen: "#486549",
  /** 中性文字色，供正文使用，非取样值——先用一个与暖白背景对比度达标的深灰，
   *  待有更多界面截图后可替换为取样值 */
  textPrimary: "#2B2B28",
} as const;

export const radii = {
  /** 磨砂卡片的大圆角 */
  cardLarge: 24,
  cardMedium: 16,
  cardSmall: 12,
} as const;

export const touchTarget = {
  /** 你在第六节里明确要求的最小触控区域 */
  minDp: 48,
} as const;

export type ColorToken = keyof typeof colors;
