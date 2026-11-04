/**
 * 「我的」页的语言设置（K6）：跟随系统 / 中文 / English / Español。
 * 选项用各语言自己的文字写，看不懂当前界面语言的人也能找到自己的语言。
 */
import { useState } from "react";
import { colors, touchTarget } from "@secureinchat/ui";
import {
  LOCALES,
  LOCALE_NAMES,
  loadLocalePreference,
  saveLocalePreference,
  t,
  useLocale,
  type Locale,
} from "../i18n";

export function LanguageSetting() {
  const locale = useLocale();
  const [preference, setPreference] = useState<Locale | null>(() => loadLocalePreference());
  // 标题后面总带一个英文 "Language"：切到看不懂的语言后，还能认出这一行改回来
  const title = locale === "en" ? t("settings.language") : `${t("settings.language")} · Language`;

  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        border: `0.5px solid ${colors.sageMint}`,
        borderRadius: 12,
        padding: "10px 14px",
      }}
    >
      <span style={{ fontSize: 11, color: "#9A9A94" }}>{title}</span>
      <select
        value={preference ?? "system"}
        onChange={(e) => {
          const value = e.target.value;
          const next = value === "system" ? null : (value as Locale);
          setPreference(next);
          saveLocalePreference(next);
        }}
        style={{
          minHeight: touchTarget.minDp,
          fontSize: 15,
          color: colors.deepInkGreen,
          background: "transparent",
          border: "none",
          padding: 0,
        }}
      >
        <option value="system">{t("settings.languageSystem")}</option>
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
