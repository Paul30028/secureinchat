import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { saveTextFile } from "../src/documentSave";

/**
 * jsdom 里 Capacitor.isNativePlatform() 返回 false，所以只会走 Web 分支。
 * 原生分支由真机验证；这里锁定的是「Web 分支用 a[download] 并返回 saved」
 * 以及「函数不会在取消语义上撒谎」。
 */
describe("saveTextFile 非原生平台", () => {
  let clickCount: number;
  let capturedDownload: string | null;
  let capturedHref: string | null;

  beforeEach(() => {
    clickCount = 0;
    capturedDownload = null;
    capturedHref = null;
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === "a") {
        const anchor = el as HTMLAnchorElement;
        anchor.click = () => {
          clickCount += 1;
        };
        // 记录 download / href，用来断言文件名和 blob URL 被设置过
        Object.defineProperty(anchor, "download", {
          configurable: true,
          get: () => capturedDownload,
          set: (v: string) => {
            capturedDownload = v;
          },
        });
        Object.defineProperty(anchor, "href", {
          configurable: true,
          get: () => capturedHref,
          set: (v: string) => {
            capturedHref = v;
          },
        });
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("使用浏览器下载并返回 saved", async () => {
    const result = await saveTextFile("backup.json", "application/json", "{\"x\":1}");
    expect(result).toBe("saved");
    expect(clickCount).toBe(1);
    expect(capturedDownload).toBe("backup.json");
    expect(capturedHref).not.toBeNull();
    expect(capturedHref).toMatch(/^blob:/);
  });
});
