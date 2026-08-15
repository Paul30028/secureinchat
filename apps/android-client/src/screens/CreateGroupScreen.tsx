import { useState } from "react";
import { colors, touchTarget, Button, InviteShareCard } from "@secureinchat/ui";
import { buildSic2Invite } from "@secureinchat/protocol";
import { randomUUID, generateAdminKeyPair } from "@secureinchat/crypto-core";
import { copyToClipboard } from "@secureinchat/chat-core";

export interface CreateGroupScreenProps {
  /** 当前生效的中继地址，连不上时要显示出来——否则不知道它在连哪里 */
  relayUrl: string;
  onCreated: (input: {
    groupId: string;
    groupName: string;
    keyMaterialB64Url: string;
    inviteCode: string;
    /** 管理员凭据（恢复码那串）。存文本而不是 CryptoKey 对象——
     *  老 WebView 存不了 CryptoKey，一失败建群就断在这一步。 */
    adminRecoveryCode: string;
  }) => Promise<void>;
  onBack: () => void;
}

function randomBase64UrlKeyMaterial(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 创建群聊。relay 现在没配 membership/invite_registry（见
 * docs/deployment/DEPLOY_RELAY.md 的已知限制），"创建群"本质上是客户端本地
 * 生成一对 groupId + 随机密钥材料，谁拿到这串邀请码谁就能派生出同一把群密钥、
 * 连上同一个 groupId——服务端目前不做"这个群是否真的存在/谁有权创建"的校验。
 * 等成员资格收紧之后，创建群需要额外一步向服务端登记邀请码，这里先不冒充已实现。
 */
export function CreateGroupScreen({ relayUrl, onCreated, onBack }: CreateGroupScreenProps) {
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [pendingKeyMaterial, setPendingKeyMaterial] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate() {
    const groupId = `group-${randomUUID()}`;
    const keyMaterialB64Url = randomBase64UrlKeyMaterial();
    // 建群时生成管理员密钥：公钥进邀请串（人人可验证），私钥只留在本机
    const admin = await generateAdminKeyPair();
    const code = buildSic2Invite({
      serverJoinCode: randomUUID().slice(0, 8).toUpperCase(),
      groupId,
      groupName: groupName.trim(),
      adminPublicKeyRawB64Url: admin.publicKeyRawB64Url,
      keyMaterialB64Url,
      epoch: 0,
    });
    setPendingGroupId(groupId);
    setPendingKeyMaterial(keyMaterialB64Url);
    setRecoveryCode(admin.recoveryCode);
    setInviteCode(code);
  }

  async function handleEnter() {
    if (!pendingGroupId || !pendingKeyMaterial || !inviteCode || !recoveryCode) return;
    setIsEntering(true);
    setErrorMessage(null);
    try {
      await onCreated({
        groupId: pendingGroupId,
        groupName: groupName || "新群聊",
        keyMaterialB64Url: pendingKeyMaterial,
        inviteCode,
        adminRecoveryCode: recoveryCode,
      });
    } catch (err) {
      setIsEntering(false);
      // 把地址一起显示出来。连不上时最需要知道的就是"它在连哪台服务器"——
      // 只说"失败了"没法判断是服务器没起、地址填错、还是网络问题。
      setErrorMessage(
        `进入群聊失败：${err instanceof Error ? err.message : "请重试"}\n服务器：${relayUrl}`
      );
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.ivory, padding: 24 }}>
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
          minHeight: 48,
        }}
      >
        ← 返回
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 16px" }}>创建群聊</h1>

      {!inviteCode ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="群聊名称"
            aria-label="群聊名称输入框"
            style={{
              minHeight: touchTarget.minDp,
              border: `0.5px solid ${colors.sageMint}`,
              borderRadius: 14,
              padding: "0 16px",
              fontSize: 14,
              background: colors.ivory,
              color: colors.textPrimary,
              boxShadow: "none",
            }}
          />
          <Button variant="primary" onClick={() => void handleCreate()} disabled={groupName.trim().length === 0}>
            创建群聊
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 12, color: "#8A8A82", textAlign: "center" }}>
            截图这张卡片发出去，或让对方扫码加入
          </p>
          {recoveryCode ? (
            <div
              style={{
                border: `1px solid ${colors.wheatGold}`,
                borderRadius: 14,
                padding: "14px 16px",
                background: `${colors.sageMint}22`,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500, color: colors.textPrimary, marginBottom: 6 }}>
                管理员恢复码
              </div>
              <p style={{ fontSize: 12, color: "#8A8A82", lineHeight: 1.7, margin: "0 0 10px" }}>
                只有你能发布这个群的每日内容，凭据就保存在这台手机上。
                <strong style={{ fontWeight: 500, color: colors.textPrimary }}>
                  换手机或手机丢失后，只有这串码能恢复
                </strong>
                ，请抄下来收好。它只显示这一次。
              </p>
              <code
                style={{
                  display: "block",
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: colors.textPrimary,
                  wordBreak: "break-all",
                  background: colors.ivory,
                  border: `0.5px solid ${colors.sageMint}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 10,
                }}
              >
                {recoveryCode}
              </code>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" onClick={() => void copyToClipboard(recoveryCode)} style={{ flex: 1 }}>
                  复制
                </Button>
                <Button
                  variant={recoverySaved ? "secondary" : "primary"}
                  onClick={() => setRecoverySaved(true)}
                  style={{ flex: 1 }}
                >
                  {recoverySaved ? "已保存 ✓" : "我已保存"}
                </Button>
              </div>
            </div>
          ) : null}

          <InviteShareCard
            groupName={groupName || "新群聊"}
            inviteCode={inviteCode}
            onCopy={() => void copyToClipboard(inviteCode)}
          />
          <Button variant="primary" onClick={handleEnter} disabled={isEntering}>
            {isEntering ? "正在进入..." : "进入群聊"}
          </Button>
          {errorMessage ? (
            <p role="alert" style={{ color: "#A33", fontSize: 12, textAlign: "center" }}>
              {errorMessage}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
