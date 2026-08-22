/**
 * @提醒。
 *
 * 多人群里刷屏时，跟自己相关的消息会被淹掉。@某人 让被点到的人一眼看到。
 *
 * 完全在客户端做：@的名字就写在消息正文里，中继只看到密文，不知道谁被 @ 了。
 * 也就是说没有服务端推送——被 @ 的人打开应用才会看到高亮，这是盲中继的
 * 必然结果，不是没做完。
 */

/** @全体 的特殊标记 */
export const MENTION_ALL = "全体";

export interface MentionSegment {
  type: "text" | "mention";
  value: string;
}

/**
 * 把正文拆成普通文字和 @提及。
 *
 * 匹配 @ 后面的连续非空白字符。中文昵称里没有空格，英文昵称也很少有——
 * 支持带空格的名字需要用户输入时加分隔符，对小团体来说不值这个复杂度。
 */
export function parseMentions(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  const pattern = /@([^\s@]+)/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }
    segments.push({ type: "mention", value: match[1]! });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

/** 这条消息有没有点到我。@全体 算所有人。 */
export function mentionsMe(text: string, myNickname: string | undefined): boolean {
  if (!myNickname?.trim()) return false;
  const mine = myNickname.trim();

  return parseMentions(text).some(
    (s) => s.type === "mention" && (s.value === mine || s.value === MENTION_ALL)
  );
}

/** 群里可以 @ 的对象：见过的成员，加上"全体" */
export function mentionCandidates(names: (string | undefined)[]): string[] {
  const unique = new Set<string>([MENTION_ALL]);
  for (const n of names) {
    const trimmed = n?.trim();
    if (trimmed) unique.add(trimmed);
  }
  return [...unique];
}

/**
 * 在输入框里补全 @。返回插入后的完整文本和新的光标位置。
 * 后面补一个空格——不然接着打字会被当成名字的一部分。
 */
export function applyMention(text: string, caret: number, name: string): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const atIndex = before.lastIndexOf("@");
  if (atIndex === -1) {
    const inserted = `@${name} `;
    return { text: before + inserted + text.slice(caret), caret: caret + inserted.length };
  }
  const replaced = `@${name} `;
  const next = text.slice(0, atIndex) + replaced + text.slice(caret);
  return { text: next, caret: atIndex + replaced.length };
}

/** 光标前是不是正在输入 @xxx——决定要不要弹候选列表 */
export function activeMentionQuery(text: string, caret: number): string | null {
  const before = text.slice(0, caret);
  const atIndex = before.lastIndexOf("@");
  if (atIndex === -1) return null;

  const fragment = before.slice(atIndex + 1);
  // 已经打了空格就说明这个 @ 输完了
  if (/[\s@]/.test(fragment)) return null;
  return fragment;
}
