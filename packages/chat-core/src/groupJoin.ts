import { decodeBase64UrlToBytes, type ParsedInvite } from "@secureinchat/protocol";
import { deriveGroupEpochKey, exportAeadKeyRaw } from "@secureinchat/crypto-core";
import type { EncryptedKeyValueStore } from "@secureinchat/secure-storage";

/**
 * "确认加入"按钮背后真正发生的事：从邀请串的原始密钥材料，派生出这个群
 * 当前 epoch 的实际消息密钥，然后落盘（加密存储，见 secure-storage）。
 *
 * 只支持 SIC2——SIC1（兼容模式）邀请没有 groupId，本来就不该走真正的入群密钥
 * 派生流程（这也是架构文档里反复强调的：兼容模式不能虚报更高的安全等级）。
 */
export class MissingGroupIdError extends Error {
  constructor() {
    super("这个邀请没有 groupId（可能是 SIC1 兼容模式邀请），不支持派生入群密钥");
    this.name = "MissingGroupIdError";
  }
}

export interface JoinGroupResult {
  groupId: string;
  epoch: number;
  /** 落盘用的 key（供调用方知道去哪个 key 底下能取回这把群密钥，不是密钥本身） */
  storageKey: string;
  /** 这次派生出来的密钥本身——当次会话立即要用（比如连 RelayClient）不用再从
   *  存储里读一遍；下次重启应用要用还是得走 storageKey 从 store 里取。 */
  epochKey: CryptoKey;
}

export function storageKeyForGroupEpoch(groupId: string, epoch: number): string {
  return `group:${groupId}:epoch:${epoch}`;
}

export async function joinGroupFromInvite(
  invite: Pick<ParsedInvite, "groupId" | "keyMaterialB64Url" | "epoch">,
  store: EncryptedKeyValueStore
): Promise<JoinGroupResult> {
  if (!invite.groupId) {
    throw new MissingGroupIdError();
  }
  const groupId = invite.groupId;
  const epoch = invite.epoch ?? 0;

  const rawKeyMaterial = decodeBase64UrlToBytes(invite.keyMaterialB64Url);
  const epochKey = await deriveGroupEpochKey({ rawKeyMaterial, groupId, epoch });
  const rawEpochKeyBytes = await exportAeadKeyRaw(epochKey);

  const storageKey = storageKeyForGroupEpoch(groupId, epoch);
  await store.set(storageKey, rawEpochKeyBytes);

  return { groupId, epoch, storageKey, epochKey };
}
