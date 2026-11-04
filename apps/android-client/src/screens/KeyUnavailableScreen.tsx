import { useState } from "react";
import { colors, Button } from "@secureinchat/ui";
import type { HardwareKeyErrorKind } from "@secureinchat/secure-storage";
import { t } from "../i18n";

/**
 * C10-A：本机数据存在，但保护它的主密钥解不开。
 *
 * 绝不悄悄换一把新密钥（那样旧数据就再也解不开了，而用户不知道发生了什么）。
 * 先说清楚原因和后果，让用户选：重试，或确认后清空本机加密数据、从备份恢复。
 */

export interface KeyUnavailableScreenProps {
  kind: HardwareKeyErrorKind;
  detail?: string | undefined;
  onRetry: () => Promise<void>;
  /** 用户确认后：清空本机加密数据并重新开始，然后打开备份页 */
  onResetAndRestore: () => Promise<void>;
}

function reasonText(kind: HardwareKeyErrorKind): string {
  if (kind === "missing") {
    return t("keyProblem.missing");
  }
  if (kind === "invalidated") {
    return t("keyProblem.invalidated");
  }
  return t("keyProblem.failed");
}

export function KeyUnavailableScreen({ kind, detail, onRetry, onResetAndRestore }: KeyUnavailableScreenProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#EBECE5",
        padding: 32,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <div role="heading" aria-level={1} style={{ fontSize: 16, fontWeight: 500, color: "#2B2B28" }}>
        {t("keyProblem.title")}
      </div>
      <div style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 1.8 }}>{reasonText(kind)}</div>
      {kind === "failed" && detail ? (
        <div style={{ fontSize: 12, color: "#8A8A82", lineHeight: 1.6 }}>{detail}</div>
      ) : null}
      <div style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 1.8 }}>
        {t("keyProblem.body")}
      </div>

      {confirming ? (
        <>
          <div style={{ fontSize: 13, color: "#A33", lineHeight: 1.8 }}>
            {t("keyProblem.confirm")}
          </div>
          <Button variant="danger" disabled={busy} onClick={() => void run(onResetAndRestore)}>
            {t("keyProblem.confirmButton")}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            {t("common.cancel")}
          </Button>
        </>
      ) : (
        <>
          <Button variant="primary" disabled={busy} onClick={() => void run(onRetry)}>
            {t("common.retry")}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(true)}>
            {t("keyProblem.reset")}
          </Button>
        </>
      )}
      {error ? <div style={{ fontSize: 12, color: "#A33", lineHeight: 1.6 }}>{error}</div> : null}
    </div>
  );
}
