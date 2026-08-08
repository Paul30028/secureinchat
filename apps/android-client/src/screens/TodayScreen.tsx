import { colors, radii } from "@secureinchat/ui";
import { CATEGORY_ORDER, CATEGORY_META, type AnnouncementCategory } from "@secureinchat/chat-core";

export interface CategoryEntry {
  title: string;
  body: string;
  /** 音频已经解密组装好之后的本地播放地址（赞美圣诗用） */
  audioUrl?: string | undefined;
  /** 音频还在接收中时的进度文案 */
  audioPending?: string | undefined;
}

export type TodayContent = Partial<Record<AnnouncementCategory, CategoryEntry>>;

export interface TodayScreenProps {
  content: TodayContent;
  /** 管理员解锁后才显示发布入口 */
  isAdmin: boolean;
  onOpenAdmin: () => void;
}

function ColumnCard({ label, entry }: { label: string; entry?: CategoryEntry | undefined }) {
  return (
    <div
      style={{
        background: colors.ivory,
        border: `0.5px solid ${colors.sageMint}`,
        borderRadius: radii.cardMedium,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 12, color: colors.wheatGold, marginBottom: entry ? 8 : 0 }}>{label}</div>
      {entry ? (
        <>
          {entry.title ? (
            <div style={{ fontSize: 15, fontWeight: 500, color: colors.textPrimary, marginBottom: 6 }}>
              {entry.title}
            </div>
          ) : null}
          <div style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            {entry.body}
          </div>
          {entry.audioUrl ? (
            <audio
              controls
              src={entry.audioUrl}
              aria-label="播放圣诗"
              style={{ width: "100%", marginTop: 10, height: 36 }}
            />
          ) : entry.audioPending ? (
            <div style={{ fontSize: 12, color: "#9A9A94", marginTop: 8 }}>{entry.audioPending}</div>
          ) : null}
        </>
      ) : (
        <div style={{ fontSize: 12, color: "#9A9A94", marginTop: 6 }}>今天还没有内容</div>
      )}
    </div>
  );
}

/**
 * 「今日」——打开应用第一眼看到的内容。
 *
 * 这是和其他 IM 最大的区别：别的软件打开是会话列表，这里打开是今天的内容。
 * 公告每天更新且不需要回看历史，所以每个栏目只显示今天这一条，没有列表、
 * 没有分页、没有"查看更多"。
 *
 * 普通成员这一页是纯只读的——发布入口只有管理员解锁后才出现。
 */
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function todayLabel(now = new Date()): string {
  return `${now.getMonth() + 1}月${now.getDate()}日 星期${WEEKDAYS[now.getDay()]}`;
}

export function TodayScreen({ content, isAdmin, onOpenAdmin }: TodayScreenProps) {
  const hasAnything = CATEGORY_ORDER.some((key) => content[key]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0 16px" }}>
      {/* 日期让"今日"名副其实——没有它，昨天的内容和今天的看起来一模一样 */}
      <div style={{ fontSize: 12, color: "#8A8A82", padding: "0 2px 2px" }}>{todayLabel()}</div>
      {!hasAnything ? (
        <div style={{ textAlign: "center", padding: "32px 16px 24px" }}>
          <div style={{ fontSize: 14, color: colors.textPrimary }}>今天还没有内容</div>
          <div style={{ fontSize: 12, color: "#8A8A82", marginTop: 6 }}>
            管理员发布后，群里所有人都会在这里看到
          </div>
        </div>
      ) : (
        CATEGORY_ORDER.map((key) => (
          <ColumnCard key={key} label={CATEGORY_META[key].label} entry={content[key]} />
        ))
      )}

      {isAdmin ? (
        <button
          onClick={onOpenAdmin}
          style={{
            minHeight: 48,
            marginTop: 8,
            background: "transparent",
            border: `0.5px dashed ${colors.sageMint}`,
            borderRadius: 14,
            color: colors.deepInkGreen,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          发布今日内容
        </button>
      ) : null}
    </div>
  );
}
