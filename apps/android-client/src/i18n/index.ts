/**
 * 自写的翻译层（K6）。不引入第三方 i18n 库。
 *
 * - 中文（zh.ts）是源语言，也是所有键的唯一定义处：键的类型从它推出来，
 *   写错键名 typecheck 就会报错。
 * - 英文、西班牙语可以缺键；缺的键回退到中文，界面不会出现空白或键名。
 *   是否缺键由 test/i18n.test.ts 检查，发布前应补齐。
 * - 占位符写成 {name}；需要单复数的地方，译文可以写成 { one, other }，
 *   按 Intl.PluralRules 和参数 count 选形式（中文没有单复数，只写字符串）。
 * - 日期和数字用 Intl，按当前语言格式化。
 *
 * 当前语言是模块级状态，不放 React context：非组件模块（时间格式、昵称校验、
 * 能力自检）也要出文字。界面通过 useLocale() 订阅，切换语言时整棵树重渲染。
 */
import { useSyncExternalStore } from "react";
import { zh, type MessageKey } from "./zh";
import { en } from "./en";
import { es } from "./es";

export type Locale = "zh" | "en" | "es";
export const LOCALES: readonly Locale[] = ["zh", "en", "es"];
/** 每种语言用它自己的文字显示名字，方便看不懂当前界面语言的人找到自己的语言 */
export const LOCALE_NAMES: Record<Locale, string> = { zh: "中文", en: "English", es: "Español" };

export type { MessageKey };
export type PluralText = { one: string; other: string; zero?: string; two?: string; few?: string; many?: string };
export type Translation = Partial<Record<MessageKey, string | PluralText>>;
export type Params = Record<string, string | number>;

const DICTIONARIES: Record<Locale, Translation> = { zh, en, es };
/** 回退语言。缺键时显示中文——中文是唯一保证完整的一份 */
export const FALLBACK_LOCALE: Locale = "zh";

/** 用户在设置里选的语言；null = 跟随系统。存 localStorage：同步可读，启动时不会先闪一下别的语言 */
const PREFERENCE_KEY = "settings:locale";

let current: Locale = FALLBACK_LOCALE;
const listeners = new Set<() => void>();

/**
 * 系统语言 → 支持的语言。按用户的语言偏好顺序找第一个支持的；
 * 都不支持时用英文：对既不说中文也不说西班牙语的人，英文比中文更可能看得懂。
 */
export function detectLocale(languages: readonly string[] | undefined): Locale {
  for (const tag of languages ?? []) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (base === "zh" || base === "en" || base === "es") return base;
  }
  return "en";
}

function systemLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  if (navigator.languages && navigator.languages.length > 0) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

function isLocale(value: unknown): value is Locale {
  return value === "zh" || value === "en" || value === "es";
}

/** 读用户保存的语言偏好；没选过或读不到返回 null（跟随系统） */
export function loadLocalePreference(): Locale | null {
  try {
    const saved = globalThis.localStorage?.getItem(PREFERENCE_KEY);
    return isLocale(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** 保存语言偏好并立即切换。传 null 表示改回跟随系统 */
export function saveLocalePreference(locale: Locale | null): void {
  try {
    if (locale) globalThis.localStorage?.setItem(PREFERENCE_KEY, locale);
    else globalThis.localStorage?.removeItem(PREFERENCE_KEY);
  } catch {
    // 存不了（隐私模式等）也照样切换，只是下次启动回到系统语言
  }
  setLocale(locale ?? detectLocale(systemLanguages()));
}

/** 启动时调用一次：有偏好用偏好，没有就跟随系统 */
export function initLocale(): Locale {
  setLocale(loadLocalePreference() ?? detectLocale(systemLanguages()));
  return current;
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  if (typeof document !== "undefined") document.documentElement.lang = BCP47[locale];
  for (const l of listeners) l();
}

/** 给 Intl 和 <html lang> 用的语言标签 */
export const BCP47: Record<Locale, string> = { zh: "zh-CN", en: "en", es: "es" };

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 组件里订阅当前语言；语言一变就重渲染 */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

function interpolate(text: string, params: Params | undefined): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    return typeof value === "number" ? formatNumber(value) : value;
  });
}

function pickPlural(entry: PluralText, locale: Locale, count: number): string {
  const category = new Intl.PluralRules(BCP47[locale]).select(count) as keyof PluralText;
  return entry[category] ?? entry.other;
}

/**
 * 在指定的几份词典里查（测试用；正常代码用 t）。
 * 顺序：当前语言 → 中文 → 键名本身（只在开发时写了不存在的键才会出现，typecheck 会先拦下）。
 */
export function translateWith(
  dictionaries: Record<Locale, Translation>,
  locale: Locale,
  key: MessageKey,
  params?: Params
): string {
  const entry = dictionaries[locale][key] ?? dictionaries[FALLBACK_LOCALE][key];
  if (entry === undefined) return key;
  if (typeof entry === "string") return interpolate(entry, params);
  const count = typeof params?.["count"] === "number" ? params["count"] : 0;
  const usedLocale = dictionaries[locale][key] !== undefined ? locale : FALLBACK_LOCALE;
  return interpolate(pickPlural(entry, usedLocale, count), params);
}

/** 取当前语言的文字 */
export function t(key: MessageKey, params?: Params): string {
  return translateWith(DICTIONARIES, current, key, params);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(BCP47[current]).format(n);
}

/** 测试用：让「缺键回退」能在不改真实词典的前提下测 */
export const __dictionaries = DICTIONARIES;
