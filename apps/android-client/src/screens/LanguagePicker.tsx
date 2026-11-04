import { SUPPORTED_LOCALES, useLocaleChoice, useT, type LocaleChoice } from "../i18n";

/**
 * 设置里的语言选择。没有 I18nRoot（例如单独渲染某个界面的测试）时不显示：
 * 选了也不会生效的控件不放出来。
 */
export function LanguagePicker() {
  const t = useT();
  const ctx = useLocaleChoice();
  if (!ctx) return null;
  const options: LocaleChoice[] = ["auto", ...SUPPORTED_LOCALES];
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8, padding: "10px 14px", minHeight: 48, fontSize: 14 }}>
      <span>{t("language.title")}</span>
      <select
        aria-label={t("language.title")}
        value={ctx.choice}
        onChange={(e) => ctx.setChoice(e.target.value as LocaleChoice)}
        style={{ minHeight: 40, fontSize: 14 }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {t(`language.${o}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
