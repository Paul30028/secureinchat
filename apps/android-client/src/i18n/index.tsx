import { createContext, useContext, useState, type ReactNode } from "react";
import { messages as zhMessages } from "./zh";
import { messages as enMessages } from "./en";
import { messages as esMessages } from "./es";

/**
 * 翻译核心：零依赖（只用 TS + React + Intl）。
 *
 * 为什么不引 i18next/react-intl：这个页面只有几十条文案，第三方库带来
 * 打包体积、API 学习成本、以及"另一套需要同步维护的类型"。用一个小模块
 * 就够，而且 zh 作为基准语言，用测试保证 en/es 与它键集合一致。
 */

export type Locale = "zh" | "en" | "es";

/** 按界面里希望的展示顺序列出。 */
export const SUPPORTED_LOCALES: readonly Locale[] = ["zh", "en", "es"];

/** 项目默认语言：没有匹配、或老测试没有 Provider 时都用它。 */
export const DEFAULT_LOCALE: Locale = "zh";

/** 词条表：键 → 文本。参数占位符写 `{name}`。 */
export type Messages = Record<string, string>;

/**
 * 各界面自己的词条放在 `ns/<界面>.ts`，导出 zh / en / es 三个对象。
 * 用 import.meta.glob 自动收集：并行翻译多个界面时，不用改同一个文件，避免冲突。
 */
export interface NamespaceModule {
  zh: Messages;
  en: Messages;
  es: Messages;
}
export const NAMESPACES = import.meta.glob<NamespaceModule>("./ns/*.ts", { eager: true });

function merged(locale: Locale, base: Messages): Messages {
  const out: Messages = { ...base };
  for (const mod of Object.values(NAMESPACES)) Object.assign(out, mod[locale]);
  return out;
}

const MESSAGES: Record<Locale, Messages> = {
  zh: merged("zh", zhMessages),
  en: merged("en", enMessages),
  es: merged("es", esMessages),
};

function isLocale(x: string): x is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(x);
}

/**
 * 从 navigator.languages 选出界面语言。
 *
 * 只取语言主标签（"zh-CN" → "zh"），因为我们现在只有三种语言的词条，
 * 地区变体（中西、墨西哥西语）不影响翻译。按列表顺序取第一个能匹配的；
 * 都不匹配返回默认语言（中文），而不是抛错——App 必须能够启动。
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const lang of languages) {
    const base = lang.split("-")[0]?.toLowerCase() ?? "";
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/**
 * 取当前浏览器语言。用于 Provider 不传 locale 的情况。
 * 在 SSR / 无 window 环境下退回默认语言。
 */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined" || !Array.isArray(navigator.languages)) {
    return DEFAULT_LOCALE;
  }
  return detectLocale(navigator.languages);
}

/** 格式化数字参数：使用当前语言，保证阿拉伯数字分组/小数点符号符合习惯。 */
function formatParam(locale: Locale, value: string | number): string {
  if (typeof value !== "number") return value;
  // 某些运行环境（极少见的裁剪 ICU）可能不支持某个 locale，
  // 这时 Intl.NumberFormat 会抛 RangeError。为了不让界面挂掉，
  // 按 base locale 再试，最后退回最简单的方式。
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    try {
      const base = new Intl.NumberFormat().resolvedOptions().locale.split("-")[0] ?? "en";
      return new Intl.NumberFormat(base).format(value);
    } catch {
      return String(value);
    }
  }
}

/** 把 {name} 替换为参数值。未提供参数时保留原样，便于从界面上一眼看到缺了哪个参数。 */
function applyParams(text: string, locale: Locale, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{([^{}]+)\}/g, (match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) return match;
    const value = params[name];
    return value === undefined ? match : formatParam(locale, value);
  });
}

/**
 * 查词：当前语言 → 中文 → 键本身。
 *
 * 回退到中文是项目默认语言的承诺：一个键漏翻，界面还是能显示出意思；
 * 中文也没有时返回键本身（而不是抛错），这样界面上直接能看到缺了哪个键，
 * 便于开发时定位问题，而不是把整个页面炸掉。
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
  messages: Record<Locale, Messages> = MESSAGES,
): string {
  const found =
    messages[locale]?.[key] ??
    messages[DEFAULT_LOCALE]?.[key];
  if (found === undefined) return key;
  return applyParams(found, locale, params);
}

// —— React 部分 ——

interface I18nContextValue {
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Provider 缺席时的默认值：中文。
 * 老界面和老测试（比如 DeviceSafetyScreen.test.tsx）不包 Provider，
 * 也应当能用中文正常渲染。
 */
const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: (key, params) => translate(DEFAULT_LOCALE, key, params),
});

export interface I18nProviderProps {
  /** 不传则根据浏览器语言自动选择。 */
  locale?: Locale | undefined;
  children: ReactNode;
}

export function I18nProvider({ locale, children }: I18nProviderProps) {
  const resolved = locale ?? detectBrowserLocale();
  // 每次 render 重建 t 没关系（闭包很轻）；用 useMemo 反而要注意 locale 的稳定性。
  const value: I18nContextValue = {
    locale: resolved,
    t: (key, params) => translate(resolved, key, params),
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue["t"] {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

// —— 语言选择（设置里的「语言」）——

/** 用户的选择："auto" 表示跟随系统语言。 */
export type LocaleChoice = Locale | "auto";

/** 只存在这台设备的本地存储里，不上传。值是 "zh" | "en" | "es"；没有值就是跟随系统。 */
export const LOCALE_STORAGE_KEY = "sic.locale";

export function readLocaleChoice(storage: Pick<Storage, "getItem"> | undefined): LocaleChoice {
  try {
    const v = storage?.getItem(LOCALE_STORAGE_KEY) ?? null;
    return v !== null && isLocale(v) ? v : "auto";
  } catch {
    // 隐私模式或存储被禁用时会抛错：退回跟随系统，App 照常启动。
    return "auto";
  }
}

export function writeLocaleChoice(storage: Pick<Storage, "setItem" | "removeItem"> | undefined, choice: LocaleChoice): void {
  try {
    if (choice === "auto") storage?.removeItem(LOCALE_STORAGE_KEY);
    else storage?.setItem(LOCALE_STORAGE_KEY, choice);
  } catch {
    // 存不下就只在本次运行生效。
  }
}

interface LocaleChoiceValue {
  choice: LocaleChoice;
  setChoice: (choice: LocaleChoice) => void;
}

/** 没有 I18nRoot 时为 null：设置页据此不显示语言选项（没有能力支撑的按钮不显示）。 */
const LocaleChoiceContext = createContext<LocaleChoiceValue | null>(null);

function browserStorage(): Storage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** App 的根：记住用户选的语言，并提供给 I18nProvider。 */
export function I18nRoot({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<LocaleChoice>(() => readLocaleChoice(browserStorage()));
  const setChoice = (next: LocaleChoice) => {
    writeLocaleChoice(browserStorage(), next);
    setChoiceState(next);
  };
  return (
    <LocaleChoiceContext.Provider value={{ choice, setChoice }}>
      <I18nProvider locale={choice === "auto" ? undefined : choice}>{children}</I18nProvider>
    </LocaleChoiceContext.Provider>
  );
}

export function useLocaleChoice(): LocaleChoiceValue | null {
  return useContext(LocaleChoiceContext);
}
