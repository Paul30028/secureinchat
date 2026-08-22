/**
 * 公告栏目。
 *
 * 公告不是"一条通知"，而是几个每天更新的栏目——打开应用先看到的就是这些。
 * 每个栏目只保留今天这一条（Paul 确认不需要回看历史），所以数据结构非常简单：
 * 栏目 → 当前内容，新的覆盖旧的。
 */

export const ANNOUNCEMENT_CATEGORIES = ["scripture", "devotional", "hymn", "notice"] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export interface CategoryMeta {
  key: AnnouncementCategory;
  label: string;
  /** 发布界面里的输入提示，让管理员知道这一栏该放什么 */
  placeholder: string;
}

export const CATEGORY_META: Record<AnnouncementCategory, CategoryMeta> = {
  scripture: { key: "scripture", label: "今日经文", placeholder: "例如：诗篇 133:1" },
  devotional: { key: "devotional", label: "灵修短语", placeholder: "今天的一句话默想" },
  hymn: { key: "hymn", label: "赞美圣诗", placeholder: "诗歌名称，或一段歌词" },
  notice: { key: "notice", label: "通知", placeholder: "聚会时间、地点变更等事务性通知" },
};

/** 展示顺序：属灵内容在前，事务性通知在后 */
export const CATEGORY_ORDER: AnnouncementCategory[] = ["scripture", "devotional", "hymn", "notice"];

export function isAnnouncementCategory(value: unknown): value is AnnouncementCategory {
  return typeof value === "string" && (ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(value);
}

export function labelForCategory(category: AnnouncementCategory): string {
  return CATEGORY_META[category].label;
}
