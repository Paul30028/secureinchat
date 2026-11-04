import { describe, expect, it, afterEach } from "vitest";
import {
  t,
  setLocale,
  getLocale,
  detectLocale,
  translateWith,
  saveLocalePreference,
  loadLocalePreference,
  initLocale,
  LOCALES,
  __dictionaries,
  type Locale,
  type MessageKey,
  type Translation,
} from "../src/i18n";
import { zh } from "../src/i18n/zh";
import { formatMessageTime, formatListTime } from "../src/timeFormat";
import { validateNickname } from "../src/profile";

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
}

describe("translation lookup", () => {
  it("falls back to Chinese when a key is missing in the current language", () => {
    // 合成词典：英文缺 b，西班牙语全缺——不改真实词典
    const dicts = {
      zh: { "common.cancel": "取消", "app.name": "邀群密聊" },
      en: { "common.cancel": "Cancel" },
      es: {},
    } as Record<Locale, Translation>;
    expect(translateWith(dicts, "en", "common.cancel")).toBe("Cancel");
    expect(translateWith(dicts, "en", "app.name")).toBe("邀群密聊");
    expect(translateWith(dicts, "es", "common.cancel")).toBe("取消");
  });

  it("returns the key itself only when even Chinese lacks it (never an empty string)", () => {
    const dicts = { zh: {}, en: {}, es: {} } as Record<Locale, Translation>;
    expect(translateWith(dicts, "en", "common.cancel")).toBe("common.cancel");
  });

  it("fills {placeholders} and leaves unknown ones visible", () => {
    setLocale("zh");
    expect(t("nickname.fallback", { short: "ab12cd" })).toBe("用户ab12cd");
    const dicts = { zh: { "app.name": "{a} and {b}" }, en: {}, es: {} } as Record<Locale, Translation>;
    expect(translateWith(dicts, "zh", "app.name", { a: "x" })).toBe("x and {b}");
  });

  it("chooses singular or plural by count", () => {
    setLocale("en");
    expect(t("pin.tooShort", { count: 1 })).toBe("The PIN must have at least 1 digit");
    expect(t("pin.tooShort", { count: 4 })).toBe("The PIN must have at least 4 digits");
    setLocale("es");
    expect(t("pin.tooShort", { count: 4 })).toBe("El PIN debe tener al menos 4 dígitos");
    setLocale("zh");
    expect(t("pin.tooShort", { count: 4 })).toBe("密码至少 4 位");
  });

  it("switches language for code outside React too", () => {
    setLocale("es");
    expect(getLocale()).toBe("es");
    expect(validateNickname("")).toEqual({ ok: false, reason: "El nombre no puede estar vacío" });
    expect(validateNickname("yo").ok).toBe(false);
  });
});

describe("dictionaries", () => {
  const keys = Object.keys(zh) as MessageKey[];

  for (const locale of LOCALES.filter((l) => l !== "zh")) {
    it(`${locale} has every key (missing keys would show Chinese)`, () => {
      const missing = keys.filter((k) => __dictionaries[locale][k] === undefined);
      expect(missing).toEqual([]);
    });

    it(`${locale} has no keys that Chinese doesn't define`, () => {
      const extra = Object.keys(__dictionaries[locale]).filter((k) => !(k in zh));
      expect(extra).toEqual([]);
    });

    it(`${locale} uses the same placeholders as Chinese`, () => {
      const wrong: string[] = [];
      for (const k of keys) {
        const entry = __dictionaries[locale][k];
        if (entry === undefined) continue;
        const forms = typeof entry === "string" ? [entry] : Object.values(entry);
        for (const form of forms) {
          if (form === undefined) continue;
          // 单复数形式可以省略 {count}（例如英文「one」写成 "a minute"），其余必须一致
          const expected = placeholders(zh[k]).filter((p) => typeof entry === "string" || p !== "count");
          const got = placeholders(form).filter((p) => typeof entry === "string" || p !== "count");
          if (JSON.stringify(expected) !== JSON.stringify(got)) wrong.push(`${k}: ${form}`);
        }
      }
      expect(wrong).toEqual([]);
    });
  }

  it("no translation is an empty string", () => {
    const empty: string[] = [];
    for (const locale of LOCALES) {
      for (const [k, v] of Object.entries(__dictionaries[locale])) {
        if (v === "" || (typeof v === "object" && Object.values(v).some((f) => f === ""))) empty.push(`${locale}:${k}`);
      }
    }
    expect(empty).toEqual([]);
  });
});

describe("language choice", () => {
  it("maps system languages to a supported one, in preference order", () => {
    expect(detectLocale(["zh-TW"])).toBe("zh");
    expect(detectLocale(["zh-Hans-CN", "en"])).toBe("zh");
    expect(detectLocale(["es-MX"])).toBe("es");
    expect(detectLocale(["fr-FR", "es-ES", "en"])).toBe("es");
    expect(detectLocale(["en-GB"])).toBe("en");
  });

  it("uses English for unsupported languages and when nothing is known", () => {
    expect(detectLocale(["fr-FR", "de"])).toBe("en");
    expect(detectLocale([])).toBe("en");
    expect(detectLocale(undefined)).toBe("en");
  });

  it("remembers the user's choice across restarts and can go back to the system language", () => {
    saveLocalePreference("es");
    expect(loadLocalePreference()).toBe("es");
    setLocale("zh");
    expect(initLocale()).toBe("es");
    saveLocalePreference(null);
    expect(loadLocalePreference()).toBeNull();
    // jsdom 的系统语言是 en-US
    expect(getLocale()).toBe("en");
  });

  it("ignores a garbage stored value", () => {
    localStorage.setItem("settings:locale", "klingon");
    expect(loadLocalePreference()).toBeNull();
  });

  it("sets <html lang> so screen readers use the right voice", () => {
    setLocale("es");
    expect(document.documentElement.lang).toBe("es");
    setLocale("zh");
    expect(document.documentElement.lang).toBe("zh-CN");
  });
});

describe("dates and times follow the language", () => {
  const NOW = new Date(2026, 7, 4, 15, 30, 0).getTime();
  const yesterday = new Date(2026, 7, 3, 22, 15, 0).getTime();
  const older = new Date(2026, 6, 20, 8, 0, 0).getTime();

  it("English", () => {
    setLocale("en");
    expect(formatMessageTime(yesterday, NOW)).toMatch(/^Yesterday 10:15\sPM$/);
    expect(formatMessageTime(older, NOW)).toMatch(/^Jul 20, 08:00\sAM$/);
    expect(formatListTime(NOW - 25 * 60_000, NOW)).toBe("25 min ago");
    expect(formatListTime(NOW - 10_000, NOW)).toBe("Just now");
  });

  it("Spanish", () => {
    setLocale("es");
    expect(formatMessageTime(yesterday, NOW)).toBe("Ayer 22:15");
    expect(formatListTime(older, NOW)).toBe("20 jul");
    expect(formatListTime(NOW - 25 * 60_000, NOW)).toBe("hace 25 min");
  });
});
