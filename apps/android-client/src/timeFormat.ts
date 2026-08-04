/**
 * 消息时间的显示格式。
 *
 * 之前所有消息都写死显示"刚刚"——不管是一秒前还是三天前。`sentAtMs` 其实
 * 一直都存着（消息信封里带、本地历史里也存），只是渲染时没用上。
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** 聊天气泡上的时间：今天显示 HH:MM，昨天显示"昨天 HH:MM"，更早显示 M月D日 HH:MM */
export function formatMessageTime(sentAtMs: number, now: number = Date.now()): string {
  const then = new Date(sentAtMs);
  const nowDate = new Date(now);
  const time = `${pad(then.getHours())}:${pad(then.getMinutes())}`;

  if (isSameDay(then, nowDate)) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(then, yesterday)) return `昨天 ${time}`;

  return `${then.getMonth() + 1}月${then.getDate()}日 ${time}`;
}

/** 消息列表上的相对时间：更粗，够用就行 */
export function formatListTime(sentAtMs: number, now: number = Date.now()): string {
  const diff = now - sentAtMs;
  if (diff < MINUTE) return "刚刚";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`;

  const then = new Date(sentAtMs);
  const nowDate = new Date(now);
  if (isSameDay(then, nowDate)) return `${pad(then.getHours())}:${pad(then.getMinutes())}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(then, yesterday)) return "昨天";

  return `${then.getMonth() + 1}月${then.getDate()}日`;
}
