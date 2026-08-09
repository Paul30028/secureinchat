import { buildSic2Invite, type ParsedInvite } from "@secureinchat/protocol";

/**
 * 群密钥轮换（epoch rotation）。
 *
 * 这是"移出成员"真正生效的机制。中继按设计不知道谁是成员、也不保存消息，
 * 所以没有"把某人踢出房间"这种服务端操作——即使有，被踢的人手上的群密钥
 * 依然能解密他之前收到的、以及任何仍用旧密钥加密的消息。
 *
 * 真正的做法是换钥匙：生成全新的密钥材料，epoch 加一，把新邀请码发给留下的人。
 * 之后的消息用新密钥加密，拿着旧密钥的人再也读不到。
 *
 * ⚠️ 两个必须说清楚的限制：
 * 1. 轮换**不能**让对方读不到他已经收到的历史消息——那些明文早就在他设备上了。
 *    轮换保护的是"以后的消息"。
 * 2. 谁拿到新邀请码谁就能进来。所以轮换之后要把新码只发给该留下的人，
 *    发错了等于没轮换。
 */

export interface RotationResult {
  /** 新的密钥材料（base64url） */
  keyMaterialB64Url: string;
  /** 新的 epoch，比原来大 1 */
  epoch: number;
  /** 发给留下的成员的新邀请码 */
  inviteCode: string;
}

export interface RotateGroupInput {
  groupId: string;
  groupName: string;
  /** 当前 epoch，新的会是它加一 */
  currentEpoch: number;
  /** 管理员公钥保持不变——轮换换的是群密钥，不是管理员身份 */
  adminPublicKeyRawB64Url?: string | undefined;
  serverJoinCode: string;
}

function randomKeyMaterial(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function rotateGroupKey(input: RotateGroupInput): RotationResult {
  const keyMaterialB64Url = randomKeyMaterial();
  const epoch = input.currentEpoch + 1;

  const inviteCode = buildSic2Invite({
    serverJoinCode: input.serverJoinCode,
    groupId: input.groupId,
    groupName: input.groupName,
    keyMaterialB64Url,
    epoch,
    ...(input.adminPublicKeyRawB64Url
      ? { adminPublicKeyRawB64Url: input.adminPublicKeyRawB64Url }
      : {}),
  });

  return { keyMaterialB64Url, epoch, inviteCode };
}

/**
 * 收到一个同群但 epoch 更高的邀请时，应该采纳它（有人轮换了密钥）。
 * epoch 相同或更低的要忽略——否则重放一个旧邀请码就能把大家降级回旧密钥，
 * 让被移除的人重新读得到消息。
 */
export function shouldAdoptInvite(current: { groupId: string; epoch: number }, incoming: ParsedInvite): boolean {
  if (incoming.groupId !== current.groupId) return false;
  return (incoming.epoch ?? 0) > current.epoch;
}
