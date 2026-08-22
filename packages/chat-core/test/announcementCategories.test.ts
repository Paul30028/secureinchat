import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_CATEGORIES,
  CATEGORY_META,
  CATEGORY_ORDER,
  isAnnouncementCategory,
  labelForCategory,
} from "../src/announcementCategories";
import { decodeEnvelope, encodeEnvelope, type MessageEnvelope } from "../src/messageEnvelope";

describe("announcement categories", () => {
  it("covers the columns the group actually publishes daily", () => {
    expect(labelForCategory("scripture")).toBe("今日经文");
    expect(labelForCategory("devotional")).toBe("灵修短语");
    expect(labelForCategory("hymn")).toBe("赞美圣诗");
    expect(labelForCategory("notice")).toBe("通知");
  });

  it("orders spiritual content before administrative notices", () => {
    expect(CATEGORY_ORDER.indexOf("scripture")).toBeLessThan(CATEGORY_ORDER.indexOf("notice"));
    expect(CATEGORY_ORDER.indexOf("devotional")).toBeLessThan(CATEGORY_ORDER.indexOf("notice"));
    expect(CATEGORY_ORDER.indexOf("hymn")).toBeLessThan(CATEGORY_ORDER.indexOf("notice"));
  });

  it("lists every category exactly once in the display order", () => {
    expect([...CATEGORY_ORDER].sort()).toEqual([...ANNOUNCEMENT_CATEGORIES].sort());
  });

  it("gives every category a publishing hint so an admin knows what belongs there", () => {
    for (const key of ANNOUNCEMENT_CATEGORIES) {
      expect(CATEGORY_META[key].placeholder.length).toBeGreaterThan(0);
    }
  });

  it("recognises valid categories and rejects anything else", () => {
    expect(isAnnouncementCategory("scripture")).toBe(true);
    expect(isAnnouncementCategory("sermon")).toBe(false);
    expect(isAnnouncementCategory(undefined)).toBe(false);
    expect(isAnnouncementCategory(42)).toBe(false);
  });
});

describe("announcement envelope with category", () => {
  it("round-trips the category", () => {
    const env: MessageEnvelope = {
      kind: "announcement",
      id: "a1",
      category: "scripture",
      title: "诗篇 133:1",
      body: "看哪，弟兄和睦同居，是何等地善，何等地美！",
      sentAtMs: 1,
    };
    expect(decodeEnvelope(encodeEnvelope(env))).toEqual(env);
  });

  it("still decodes an announcement sent by an older client without a category", () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ kind: "announcement", id: "a1", title: "旧公告", body: "内容", sentAtMs: 1 })
    );
    const decoded = decodeEnvelope(bytes);
    expect(decoded.kind).toBe("announcement");
    if (decoded.kind === "announcement") expect(decoded.category).toBeUndefined();
  });
});
