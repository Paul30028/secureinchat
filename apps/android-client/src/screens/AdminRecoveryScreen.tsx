import { useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";
import { restoreAdminKeyFromRecoveryCode, AdminRecoveryError } from "@secureinchat/crypto-core";
import { saveAdminKey } from "../adminKeys";

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
        setError("这串恢复码不属于你已加入的任何群聊。请确认抄写完整，或先加入该群。");
        return;
      }
      await saveAdminKey(match.groupId, restored.privateKey);
      onRecovered(match.groupId, match.groupName);
    } catch (err) {
      setError(err instanceof AdminRecoveryError ? err.message : "恢复失败，请重试");
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, padding: 24 }}>
      <button
        onClick={onBack}
        aria-label="返回"
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
        ← 返回
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 8px" }}>
        恢复管理员权限
      </h1>
      <p style={{ fontSize: 12, color: "#8A8A82", lineHeight: 1.7, margin: "0 0 16px" }}>
        换了手机之后，粘贴创建群聊时保存的恢复码，就能继续发布每日内容。
        恢复码以 SICADMIN1. 开头。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="SICADMIN1...."
          aria-label="管理员恢复码输入框"
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
          {isRestoring ? "恢复中..." : "恢复"}
        </Button>
      </div>

      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, marginTop: 20 }}>
        恢复码等同于管理员身份，任何拿到它的人都能以管理员名义发布内容，请妥善保管。
      </p>
    </div>
  );
}
