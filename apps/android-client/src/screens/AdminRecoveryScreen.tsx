import { useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";
import { restoreAdminKeyFromRecoveryCode, AdminRecoveryError } from "@secureinchat/crypto-core";
import { saveAdminKey } from "../adminKeys";
import { useT } from "../i18n";

export interface AdminRecoveryScreenProps {
  /** 已加入的群及其管理员公钥，用来判断这串恢复码属于哪个群 */
  groups: { groupId: string; groupName: string; adminPublicKey?: string | undefined }[];
  onRecovered: (groupId: string, groupName: string) => void;
  onBack: () => void;
}

/**
 * 用恢复码找回管理员权限。
 *
 * 换手机之后，管理员私钥不在新设备上，也就发不了公告。粘贴建群时抄下来的
 * 恢复码即可还原。
 *
 * 不需要用户选"这是哪个群的码"——从恢复码算出公钥，和已加入各群的管理员
 * 公钥比对就知道了。对不上就是这个码不属于你加入的任何一个群。
 */
export function AdminRecoveryScreen({ groups, onRecovered, onBack }: AdminRecoveryScreenProps) {
  const t = useT();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  async function handleRestore() {
    setError(null);
    setIsRestoring(true);
    try {
      const restored = await restoreAdminKeyFromRecoveryCode(code);
      const match = groups.find((g) => g.adminPublicKey === restored.publicKeyRawB64Url);
      if (!match) {
        setError(t("adminRecovery.errorNoMatch"));
        return;
      }
      await saveAdminKey(match.groupId, code.trim());
      onRecovered(match.groupId, match.groupName);
    } catch (err) {
      setError(err instanceof AdminRecoveryError ? err.message : t("adminRecovery.errorFailed"));
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, padding: 24 }}>
      <button
        onClick={onBack}
        aria-label={t("adminRecovery.backAria")}
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
        ← {t("adminRecovery.back")}
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 8px" }}>
        {t("adminRecovery.title")}
      </h1>
      <p style={{ fontSize: 12, color: "#8A8A82", lineHeight: 1.7, margin: "0 0 16px" }}>
        {t("adminRecovery.intro")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder={t("adminRecovery.codePlaceholder")}
          aria-label={t("adminRecovery.codeAria")}
          rows={4}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            border: `0.5px solid ${error ? "#A33" : colors.sageMint}`,
            borderRadius: 14,
            padding: "10px 14px",
            fontSize: 12,
            fontFamily: "monospace",
            background: colors.ivory,
            color: colors.textPrimary,
            boxShadow: "none",
            resize: "vertical",
          }}
        />

        {error ? (
          <p role="alert" style={{ color: "#A33", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            {error}
          </p>
        ) : null}

        <Button
          variant="primary"
          onClick={() => void handleRestore()}
          disabled={isRestoring || code.trim().length === 0}
        >
          {isRestoring ? t("adminRecovery.restoring") : t("adminRecovery.restore")}
        </Button>
      </div>

      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, marginTop: 20 }}>
        {t("adminRecovery.warning")}
      </p>
    </div>
  );
}
