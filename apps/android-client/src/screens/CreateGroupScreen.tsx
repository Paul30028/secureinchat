import { useState } from "react";
import { colors, touchTarget, Button, CopyableCode } from "@secureinchat/ui";
import { buildSic2Invite } from "@secureinchat/protocol";
import { randomUUID } from "@secureinchat/crypto-core";

export interface CreateGroupScreenProps {
  onCreated: (input: {
    groupId: string;
    groupName: string;
    keyMaterialB64Url: string;
    inviteCode: string;
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
export function CreateGroupScreen({ onCreated, onBack }: CreateGroupScreenProps) {
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [pendingKeyMaterial, setPendingKeyMaterial] = useState<string | null>(null);
  const [isEntering, setIsEntering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleCreate() {
    const groupId = `group-${randomUUID()}`;
    const keyMaterialB64Url = randomBase64UrlKeyMaterial();
    const code = buildSic2Invite({
      serverJoinCode: randomUUID().slice(0, 8).toUpperCase(),
      groupId,
      keyMaterialB64Url,
      epoch: 0,
    });
    setPendingGroupId(groupId);
    setPendingKeyMaterial(keyMaterialB64Url);
    setInviteCode(code);
  }

  async function handleEnter() {
    if (!pendingGroupId || !pendingKeyMaterial || !inviteCode) return;
    setIsEntering(true);
    setErrorMessage(null);
    try {
      await onCreated({
        groupId: pendingGroupId,
        groupName: groupName || "新群聊",
        keyMaterialB64Url: pendingKeyMaterial,
        inviteCode,
      });
    } catch (err) {
      setIsEntering(false);
      setErrorMessage(`进入群聊失败：${err instanceof Error ? err.message : "请重试"}`);
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
          <Button variant="primary" onClick={handleCreate} disabled={groupName.trim().length === 0}>
            创建群聊
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 13, color: "#8A8A82" }}>
            {groupName} 已创建。把下面的邀请码发给你想邀请的人，他们粘贴进"输入邀请码"就能加入。
          </p>
          <CopyableCode value={inviteCode} label="邀请码" />
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
