import { describe, expect, it } from "vitest";
import {
  parseMentions,
  mentionsMe,
  mentionCandidates,
  applyMention,
  activeMentionQuery,
  MENTION_ALL,
} from "../src/mentions";

describe("parseMentions", () => {
  it("returns plain text unchanged", () => {
    expect(parseMentions("今晚七点见")).toEqual([{ type: "text", value: "今晚七点见" }]);
  });

  it("splits out a mention", () => {
    expect(parseMentions("@李阳 记得来")).toEqual([
      { type: "mention", value: "李阳" },
      { type: "text", value: " 记得来" },
    ]);
  });

  it("handles a mention in the middle", () => {
    expect(parseMentions("麻烦 @张溪 确认")).toEqual([
      { type: "text", value: "麻烦 " },
      { type: "mention", value: "张溪" },
      { type: "text", value: " 确认" },
    ]);
  });

  it("handles several mentions", () => {
    const result = parseMentions("@李阳 @张溪 都看一下");
    expect(result.filter((s) => s.type === "mention").map((s) => s.value)).toEqual(["李阳", "张溪"]);
  });

  it("leaves an email-looking string alone rather than treating it as a mention target", () => {
    // 邮箱里 @ 前面没有空格，@ 后面是域名——这里只要求不崩、不吞字符
    const rebuilt = parseMentions("联系 a@b.com").map((s) => (s.type === "mention" ? `@${s.value}` : s.value)).join("");
    expect(rebuilt).toBe("联系 a@b.com");
  });

  it("never loses characters", () => {
    const text = "@李阳 你好 @张溪，请看 @全体";
    const rebuilt = parseMentions(text).map((s) => (s.type === "mention" ? `@${s.value}` : s.value)).join("");
    expect(rebuilt).toBe(text);
  });
});

describe("mentionsMe", () => {
  it("matches my nickname", () => {
    expect(mentionsMe("@李阳 记得来", "李阳")).toBe(true);
  });

  it("does not match someone else", () => {
    expect(mentionsMe("@张溪 记得来", "李阳")).toBe(false);
  });

  it("matches 全体", () => {
    expect(mentionsMe(`@${MENTION_ALL} 明天聚会`, "李阳")).toBe(true);
  });

  it("is false when I have no nickname set", () => {
    expect(mentionsMe("@李阳 记得来", undefined)).toBe(false);
    expect(mentionsMe("@李阳 记得来", "   ")).toBe(false);
  });

  it("does not match my name appearing without an @", () => {
    expect(mentionsMe("李阳今天没来", "李阳")).toBe(false);
  });

  it("does not match a name that merely starts with mine", () => {
    expect(mentionsMe("@李阳明 你看", "李阳")).toBe(false);
  });
});

describe("mentionCandidates", () => {
  it("always offers 全体", () => {
    expect(mentionCandidates([])).toEqual([MENTION_ALL]);
  });

  it("includes known names and drops blanks and duplicates", () => {
    expect(mentionCandidates(["李阳", undefined, "  ", "李阳", "张溪"])).toEqual([MENTION_ALL, "李阳", "张溪"]);
  });
});

describe("activeMentionQuery", () => {
  it("reports the fragment being typed after @", () => {
    expect(activeMentionQuery("你好 @李", 5)).toBe("李");
  });

  it("reports an empty fragment right after typing @", () => {
    expect(activeMentionQuery("你好 @", 4)).toBe("");
  });

  it("is null when there's no @ before the caret", () => {
    expect(activeMentionQuery("你好", 2)).toBeNull();
  });

  it("is null once a space follows the @ — that mention is finished", () => {
    expect(activeMentionQuery("@李阳 记得", 5)).toBeNull();
  });
});

describe("applyMention", () => {
  it("replaces the partial mention and adds a trailing space", () => {
    const result = applyMention("你好 @李", 5, "李阳");
    expect(result.text).toBe("你好 @李阳 ");
    expect(result.caret).toBe(result.text.length);
  });

  it("keeps text that follows the caret", () => {
    // 光标在 "@李" 之后（位置 2），后面是 " 记得来"
    const result = applyMention("@李 记得来", 2, "李阳");
    expect(result.text).toBe("@李阳  记得来");
    // 光标停在补全后的空格之后，可以直接接着打字
    expect(result.text.slice(0, result.caret)).toBe("@李阳 ");
  });

  it("inserts at the caret when there is no @ to replace", () => {
    const result = applyMention("你好", 2, "李阳");
    expect(result.text).toBe("你好@李阳 ");
  });
});
