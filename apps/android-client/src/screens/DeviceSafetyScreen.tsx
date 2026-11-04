import { useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";
import { useT } from "../i18n";

/**
 * 设备安全（包 1）：空手过境（P1b）和「这台手机曾离开过我」（P1c）。
 *
 * 原则：真删，不藏。不做伪装界面、假密码这类东西——藏起来的数据被找到时，
 * 对用户的风险更大。删完不留任何「删过哪些群」的记录。
 */

export interface SafetyGroup {
  groupId: string;
  groupName: string;
  /** 本机持有这个群的管理员身份 */
  isAdmin: boolean;
}

export interface DeviceSafetyScreenProps {
  groups: SafetyGroup[];
  onBack: () => void;
  /** 删除选中的群在本机的全部数据，返回实际删掉的群数 */
  onPurgeGroups: (groupIds: string[]) => Promise<number>;
  /** 删除本机全部数据（含设备主密钥），之后 App 会重新启动 */
  onWipeAll: () => Promise<void>;
}

type Mode = "home" | "travel" | "travelDone" | "compromised";

const p = { fontSize: 13, color: colors.textPrimary, lineHeight: 1.7, margin: 0 };
const note = { fontSize: 12, color: "#8A8A82", lineHeight: 1.7, margin: 0 };
const warn = { fontSize: 12, color: "#A33", lineHeight: 1.7, margin: 0 };
const card = {
  minHeight: touchTarget.minDp,
  textAlign: "left" as const,
  background: "transparent",
  border: `0.5px solid ${colors.sageMint}`,
  borderRadius: 12,
  padding: "12px 14px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
};

export function DeviceSafetyScreen({ groups, onBack, onPurgeGroups, onWipeAll }: DeviceSafetyScreenProps) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("home");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purgedCount, setPurgedCount] = useState(0);
  const [confirmText, setConfirmText] = useState("");

  // 确认词随语言变化（中文「清除」/ 英文 "WIPE" / 西语 "BORRAR"）。
  // 比较前去掉首尾空格，避免用户误输入空白导致按钮一直灰着。
  const confirmWord = t("deviceSafety.compromised.confirmWord");

  const selectedAdmin = groups.filter((g) => g.isAdmin && selected.includes(g.groupId));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function purge() {
    setBusy(true);
    setError(null);
    try {
      const n = await onPurgeGroups(selected);
      setPurgedCount(n);
      setSelected([]);
      setMode("travelDone");
    } catch {
      setError(t("deviceSafety.travel.error"));
    } finally {
      setBusy(false);
    }
  }

  async function wipe() {
    setBusy(true);
    setError(null);
    try {
      await onWipeAll();
    } catch {
      setError(t("deviceSafety.compromised.error"));
      setBusy(false);
    }
  }

  const back = () => (mode === "home" ? onBack() : (setMode("home"), setError(null), setConfirmText("")));

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, padding: 24, overflowY: "auto" }}>
      <button
        onClick={back}
        aria-label={t("deviceSafety.backAria")}
        style={{
          background: "transparent",
          border: "none",
          boxShadow: "none",
          color: colors.deepInkGreen,
          fontSize: 14,
          marginBottom: 16,
          cursor: "pointer",
          minHeight: touchTarget.minDp,
        }}
      >
        ← {t("deviceSafety.back")}
      </button>

      {mode === "home" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>
            {t("deviceSafety.home.title")}
          </h1>
          <p style={note}>{t("deviceSafety.home.intro")}</p>
          <button style={card} onClick={() => setMode("travel")}>
            <span style={{ fontSize: 14, color: colors.textPrimary }}>{t("deviceSafety.home.travelTitle")}</span>
            <span style={{ fontSize: 11, color: "#9A9A94" }}>{t("deviceSafety.home.travelSubtitle")}</span>
          </button>
          <button style={card} onClick={() => setMode("compromised")}>
            <span style={{ fontSize: 14, color: colors.textPrimary }}>{t("deviceSafety.home.compromisedTitle")}</span>
            <span style={{ fontSize: 11, color: "#9A9A94" }}>{t("deviceSafety.home.compromisedSubtitle")}</span>
          </button>
        </div>
      )}

      {mode === "travel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>
            {t("deviceSafety.travel.title")}
          </h1>
          <p style={p}>{t("deviceSafety.travel.intro")}</p>
          <p style={note}>{t("deviceSafety.travel.outro")}</p>
          {groups.length === 0 ? (
            <p style={note}>{t("deviceSafety.travel.noGroups")}</p>
          ) : (
            <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <legend style={{ ...note, marginBottom: 8 }}>{t("deviceSafety.travel.selectLegend")}</legend>
              {groups.map((g) => (
                <label
                  key={g.groupId}
                  style={{ ...card, flexDirection: "row", alignItems: "center", gap: 12, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(g.groupId)}
                    onChange={() => toggle(g.groupId)}
                    style={{ width: 20, height: 20 }}
                  />
                  <span style={{ fontSize: 14, color: colors.textPrimary }}>
                    {g.groupName}
                    {g.isAdmin ? (
                      <span style={{ fontSize: 11, color: "#8A8A82" }}>{t("deviceSafety.travel.adminTag")}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {selectedAdmin.length > 0 && (
            <p style={warn} role="alert">
              {t("deviceSafety.travel.adminWarning", {
                groups: selectedAdmin.map((g) => g.groupName).join("、"),
              })}
            </p>
          )}
          {error && <p style={warn} role="alert">{error}</p>}
          <Button disabled={selected.length === 0 || busy} onClick={() => void purge()}>
            {busy
              ? t("deviceSafety.travel.purging")
              : t("deviceSafety.travel.purgeButton", { count: selected.length })}
          </Button>
        </div>
      )}

      {mode === "travelDone" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>
            {t("deviceSafety.travel.doneTitle", { count: purgedCount })}
          </h1>
          <p style={note}>{t("deviceSafety.travel.doneHint")}</p>
          <Button onClick={onBack}>{t("deviceSafety.travel.doneButton")}</Button>
        </div>
      )}

      {mode === "compromised" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: 0 }}>
            {t("deviceSafety.compromised.title")}
          </h1>
          <p style={p}>{t("deviceSafety.compromised.intro")}</p>
          <p style={p}>{t("deviceSafety.compromised.stepsIntro")}</p>
          <ol style={{ ...p, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>{t("deviceSafety.compromised.step1")}</li>
            <li>{t("deviceSafety.compromised.step2")}</li>
            <li>{t("deviceSafety.compromised.step3")}</li>
            <li>{t("deviceSafety.compromised.step4")}</li>
          </ol>
          <p style={note}>{t("deviceSafety.compromised.note")}</p>
          <label style={{ ...note, display: "flex", flexDirection: "column", gap: 6 }}>
            {t("deviceSafety.compromised.confirmLabel", { word: confirmWord })}
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={{
                minHeight: touchTarget.minDp,
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 14,
                padding: "0 16px",
                fontSize: 14,
                background: colors.ivory,
                color: colors.textPrimary,
              }}
            />
          </label>
          {error && <p style={warn} role="alert">{error}</p>}
          <Button disabled={confirmText.trim() !== confirmWord || busy} onClick={() => void wipe()}>
            {busy ? t("deviceSafety.compromised.wiping") : t("deviceSafety.compromised.wipeButton")}
          </Button>
        </div>
      )}
    </div>
  );
}
