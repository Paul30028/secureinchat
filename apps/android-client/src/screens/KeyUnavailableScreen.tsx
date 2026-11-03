import { useState } from "react";
import { colors, Button } from "@secureinchat/ui";
import type { HardwareKeyErrorKind } from "@secureinchat/secure-storage";

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
    return "保护本机数据的硬件密钥不在这台手机上了。常见原因：清除过应用数据、重装过应用，或者应用数据是从另一台手机恢复过来的。";
  }
  if (kind === "invalidated") {
    return "保护本机数据的硬件密钥已被系统作废（例如系统升级或安全设置变化）。";
  }
  return "系统密钥库没能解开本机数据。";
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
      setError(err instanceof Error ? err.message : "操作失败，请重试");
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
        本机数据无法解密
      </div>
      <div style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 1.8 }}>{reasonText(kind)}</div>
      {kind === "failed" && detail ? (
        <div style={{ fontSize: 12, color: "#8A8A82", lineHeight: 1.6 }}>{detail}</div>
      ) : null}
      <div style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 1.8 }}>
        本机的群和消息已经无法解开。导出过备份的话，可以清空本机数据，再从备份恢复；没有备份，就需要重新加入各个群。
      </div>

      {confirming ? (
        <>
          <div style={{ fontSize: 13, color: "#A33", lineHeight: 1.8 }}>
            将删除本机所有群和消息（它们已经无法解开）。应用锁、昵称等设置会保留。确定吗？
          </div>
          <Button variant="danger" disabled={busy} onClick={() => void run(onResetAndRestore)}>
            确定清空，去恢复备份
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            取消
          </Button>
        </>
      ) : (
        <>
          <Button variant="primary" disabled={busy} onClick={() => void run(onRetry)}>
            重试
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirming(true)}>
            清空本机数据，从备份恢复
          </Button>
        </>
      )}
      {error ? <div style={{ fontSize: 12, color: "#A33", lineHeight: 1.6 }}>{error}</div> : null}
    </div>
  );
}
