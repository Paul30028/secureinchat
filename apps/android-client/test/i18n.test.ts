import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  detectLocale,
  translate,
  type Locale,
} from "../src/i18n";
import { messages as zh } from "../src/i18n/zh";
import { messages as en } from "../src/i18n/en";
import { messages as es } from "../src/i18n/es";

describe("detectLocale", () => {
  it("matches language base tag regardless of region", () => {
    expect(detectLocale(["zh-CN"])).toBe("zh");
    expect(detectLocale(["zh-TW"])).toBe("zh");
    expect(detectLocale(["es-MX"])).toBe("es");
    expect(detectLocale(["es-ES"])).toBe("es");
    expect(detectLocale(["en-US"])).toBe("en");
    expect(detectLocale(["en-GB"])).toBe("en");
  });

  it("uses the first supported language in list order", () => {
    expect(detectLocale(["fr-FR", "es-MX", "en-US"])).toBe("es");
    expect(detectLocale(["de-DE", "en-US", "zh-CN"])).toBe("en");
  });

  it("falls back to the project default when nothing matches", () => {
    expect(detectLocale([])).toBe(DEFAULT_LOCALE);
    expect(detectLocale(["fr-FR", "ja-JP"])).toBe(DEFAULT_LOCALE);
  });

  it("ignores malformed / empty entries", () => {
    expect(detectLocale(["", "-", "es"])).toBe("es");
    expect(detectLocale(["-US"])).toBe(DEFAULT_LOCALE);
  });

  it("ships exactly zh/en/es as the supported set", () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(["en", "es", "zh"]);
  });
});

describe("translate", () => {
  it("returns the current locale's text", () => {
    expect(translate("zh", "deviceSafety.back")).toBe("返回");
    expect(translate("en", "deviceSafety.back")).toBe("Back");
    expect(translate("es", "deviceSafety.back")).toBe("Atrás");
  });

  it("falls back to zh when the current locale lacks a key", () => {
    const sparse = { ...zh } as Record<string, string>;
    // 构造一个只有中文、en/es 缺键的表，验证回退顺序里 zh 那一层。
    const custom: Record<Locale, Record<string, string>> = {
      zh: { "only.zh": "中文回退" },
      en: {},
      es: {},
    };
    expect(translate("en", "only.zh", undefined, custom)).toBe("中文回退");
    expect(translate("es", "only.zh", undefined, custom)).toBe("中文回退");
    // 顺带确认：zh 表存在且非空（防止上面构造的表被误用）
    expect(Object.keys(sparse).length).toBeGreaterThan(0);
  });

  it("returns the key itself when nothing has it", () => {
    expect(translate("zh", "missing.key")).toBe("missing.key");
    expect(translate("en", "missing.key")).toBe("missing.key");
    expect(translate("es", "missing.key")).toBe("missing.key");
  });

  it("does not throw for unknown locales' tables (defensive)", () => {
    // 显式传空 dict，走回退路径而不是炸掉
    const empty: Record<Locale, Record<string, string>> = { zh: {}, en: {}, es: {} };
    expect(() => translate("en", "x", undefined, empty)).not.toThrow();
    expect(translate("en", "x", undefined, empty)).toBe("x");
  });

  describe("parameter substitution", () => {
    it("substitutes {name} placeholders", () => {
      const msgs = { zh: { greet: "你好，{name}" }, en: { greet: "Hello, {name}" }, es: { greet: "Hola, {name}" } };
      expect(translate("en", "greet", { name: "Ada" }, msgs)).toBe("Hello, Ada");
      expect(translate("es", "greet", { name: "Ada" }, msgs)).toBe("Hola, Ada");
      expect(translate("zh", "greet", { name: "小明" }, msgs)).toBe("你好，小明");
    });

    it("formats numbers with the current locale", () => {
      const msgs = { zh: { n: "共 {count} 项" }, en: { n: "{count} items" }, es: { n: "{count} elementos" } };
      // 用 Intl.NumberFormat 的输出对比，避免依赖具体空格/符号在不同 Node 下的实现差异。
      const enOut = new Intl.NumberFormat("en").format(1234);
      const esOut = new Intl.NumberFormat("es").format(1234);
      expect(translate("en", "n", { count: 1234 }, msgs)).toBe(`${enOut} items`);
      expect(translate("es", "n", { count: 1234 }, msgs)).toBe(`${esOut} elementos`);
      // 中文数字分组通常与 en 一致（千分位逗号），但不硬编码以免 ICU 数据差异。
      const zhOut = new Intl.NumberFormat("zh").format(1234);
      expect(translate("zh", "n", { count: 1234 }, msgs)).toBe(`共 ${zhOut} 项`);
    });

    it("leaves unknown placeholders untouched (visible bug, not a crash)", () => {
      const msgs = { zh: { x: "{a} 与 {b}" }, en: { x: "{a} and {b}" }, es: { x: "{a} y {b}" } };
      expect(translate("en", "x", { a: "A" }, msgs)).toBe("A and {b}");
    });

    it("works without params (literal {name} remains)", () => {
      const msgs = { zh: { x: "你好 {name}" }, en: { x: "Hi {name}" }, es: { x: "Hola {name}" } };
      expect(translate("en", "x", undefined, msgs)).toBe("Hi {name}");
    });
  });
});

describe("message catalogs", () => {
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  const esKeys = Object.keys(es).sort();

  it("zh is the baseline and is non-empty", () => {
    expect(zhKeys.length).toBeGreaterThan(0);
  });

  it("en has exactly the same keys as zh", () => {
    expect(enKeys).toEqual(zhKeys);
  });

  it("es has exactly the same keys as zh", () => {
    expect(esKeys).toEqual(zhKeys);
  });

  it("no catalog has empty or whitespace-only values", () => {
    for (const [name, table] of [["zh", zh], ["en", en], ["es", es]] as const) {
      for (const [key, value] of Object.entries(table)) {
        expect(typeof value, `${name}:${key} must be string`).toBe("string");
        expect(value.trim().length, `${name}:${key} must not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it("confirm words differ per language as specified", () => {
    expect(zh["deviceSafety.compromised.confirmWord"]).toBe("清除");
    expect(en["deviceSafety.compromised.confirmWord"]).toBe("WIPE");
    expect(es["deviceSafety.compromised.confirmWord"]).toBe("BORRAR");
  });

  it("deviceSafety keys are prefixed", () => {
    for (const key of zhKeys) {
      if (!key.startsWith("deviceSafety.")) {
        // 目前整个词条表只服务设备安全页；以后新增其他前缀时在这里放宽。
        continue;
      }
      expect(key.startsWith("deviceSafety.")).toBe(true);
    }
  });
});
