/**
 * 消息时间的显示格式。
 *
 * 之前所有消息都写死显示"刚刚"——不管是一秒前还是三天前。`sentAtMs` 其实
 * 一直都存着（消息信封里带、本地历史里也存），只是渲染时没用上。
 */

import { BCP47, getLocale, t } from "./i18n";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** 钟点：中文固定 24 小时制（和改版前一样显示 09:05）；英文、西班牙语按各自习惯 */
function clock(d: Date): string {
  const locale = getLocale();
  return new Intl.DateTimeFormat(BCP47[locale], {
    hour: "2-digit",
    minute: "2-digit",
    ...(locale === "zh" ? { hourCycle: "h23" as const } : {}),
  }).format(d);
}

/** 月日：中文「7月20日」，英文「Jul 20」，西班牙语「20 jul」 */
function monthDay(d: Date): string {
  return new Intl.DateTimeFormat(BCP47[getLocale()], { month: "short", day: "numeric" }).format(d);
}

/** 聊天气泡上的时间：今天显示钟点，昨天显示"昨天 钟点"，更早显示 月日 钟点 */
export function formatMessageTime(sentAtMs: number, now: number = Date.now()): string {
  const then = new Date(sentAtMs);
  const nowDate = new Date(now);
  const time = clock(then);

  if (isSameDay(then, nowDate)) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(then, yesterday)) return t("time.yesterdayAt", { time });

  return t("time.dateAt", { date: monthDay(then), time });
}

/** 消息列表上的相对时间：更粗，够用就行 */
export function formatListTime(sentAtMs: number, now: number = Date.now()): string {
  const diff = now - sentAtMs;
  if (diff < MINUTE) return t("time.justNow");
  if (diff < HOUR) return t("time.minutesAgo", { count: Math.floor(diff / MINUTE) });

  const then = new Date(sentAtMs);
  const nowDate = new Date(now);
  if (isSameDay(then, nowDate)) return clock(then);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(then, yesterday)) return t("time.yesterday");

  return monthDay(then);
}
