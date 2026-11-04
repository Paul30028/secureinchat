import type { EncryptedKeyValueStore } from "@secureinchat/secure-storage";
import { randomUUID, type KeystorePort } from "@secureinchat/crypto-core";
import { assertValidGroupId } from "./groupId";

/**
 * 每个群一个独立设备身份（包 1 / P1d）。
 *
 * 原来一台手机只有一个 deviceId 和一把签名密钥，连所有群都用它，中继因此能看出
 * 「同一台手机在 A 群和 B 群」。新加入或新建的群改用群专属的 deviceId 和密钥对，
 * 一个群出事不会把这个人的其他群牵连出来。老群（identityScope 缺省）保持原样。
 *
 * 边界：这只去掉了显式标识。中继仍能看到同一个 IP 在同一时间连接多个群；
 * 按 IP 和时间关联需要网络层手段，这里不处理。
 */

export function storageKeyForGroupIdentity(groupId: string): string {
  return `identity:${groupId}`;
}

export function keystoreAliasForGroup(groupId: string): string {
  return `device-identity:signing-key:${groupId}`;
}

export interface GroupIdentity {
  deviceId: string;
  keystoreAlias: string;
}

/**
 * 只在密钥不存在时生成。不能直接调 generateDeviceKeyPair：KeystorePort 没规定
 * 「已存在时复用还是覆盖」，覆盖的话这个群的身份会悄悄换掉，中继和群友都会认不出来。
 */
async function ensureKeyPair(keystore: KeystorePort, alias: string): Promise<void> {
  try {
    await keystore.exportPublicKeyRaw(alias);
  } catch {
    await keystore.generateDeviceKeyPair(alias);
  }
}

/**
 * 幂等：已存在就返回原来的；否则生成新的。
 * 先生成密钥、再写 deviceId：中途失败时存储里没有记录，下次调用会重新生成，
 * 不会留下「有 id 没密钥」的身份。
 */
export async function getOrCreateGroupIdentity(
  store: EncryptedKeyValueStore,
  keystore: KeystorePort,
  groupId: string
): Promise<GroupIdentity> {
  assertValidGroupId(groupId);
  const keystoreAlias = keystoreAliasForGroup(groupId);
  const existing = await store.get(storageKeyForGroupIdentity(groupId));
  if (existing) {
    const parsed = JSON.parse(new TextDecoder().decode(existing)) as { deviceId?: unknown };
    if (typeof parsed.deviceId === "string" && parsed.deviceId) {
      await ensureKeyPair(keystore, keystoreAlias); // 密钥被单独删掉过时补上
      return { deviceId: parsed.deviceId, keystoreAlias };
    }
  }
  await ensureKeyPair(keystore, keystoreAlias);
  const deviceId = `device-${randomUUID()}`;
  await store.set(storageKeyForGroupIdentity(groupId), new TextEncoder().encode(JSON.stringify({ deviceId })));
  return { deviceId, keystoreAlias };
}

/** 删除群身份（签名密钥和 deviceId）。可重复调用。 */
export async function forgetGroupIdentity(
  store: EncryptedKeyValueStore,
  keystore: KeystorePort,
  groupId: string
): Promise<void> {
  assertValidGroupId(groupId);
  await keystore.deleteKeyPair(keystoreAliasForGroup(groupId));
  await store.delete(storageKeyForGroupIdentity(groupId));
}
