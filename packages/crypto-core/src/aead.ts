/**
 * AES-256-GCM 封装。业务代码（chat-core / secure-storage）只能通过这里的
 * encryptAead / decryptAead 接触密文，不允许自己拼 IV 或直接调用 crypto.subtle。
 *
 * 关联附加数据（AAD）用来绑定"这段密文属于哪个上下文"——例如文件分片必须绑定
 * fileId + chunkIndex + groupEpoch（见十、文件传输 的要求），消息必须绑定
 * senderId + sequenceNo + epoch，防止密文被挪用到别的上下文重放。
 */

const AEAD_ALGO = "AES-GCM";
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12; // 96-bit nonce，AES-GCM 推荐长度

export interface AeadCiphertext {
  /** 12 字节随机 nonce，每次加密必须重新生成，绝不复用 */
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

function getSubtle(): SubtleCrypto {
  const c = (globalThis.crypto ?? undefined) as Crypto | undefined;
  if (!c?.subtle) {
    throw new Error("Web Crypto (crypto.subtle) 在当前运行时不可用");
  }
  return c.subtle;
}

function getRandomBytes(length: number): Uint8Array {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) {
    throw new Error("crypto.getRandomValues 在当前运行时不可用");
  }
  return c.getRandomValues(new Uint8Array(length));
}

/** 生成一把随机的 AES-256-GCM 密钥（用于每个文件独立密钥等场景） */
export async function generateAeadKey(): Promise<CryptoKey> {
  const subtle = getSubtle();
  return subtle.generateKey({ name: AEAD_ALGO, length: KEY_LENGTH_BITS }, true, ["encrypt", "decrypt"]);
}

export async function importAeadKeyRaw(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.byteLength !== KEY_LENGTH_BITS / 8) {
    throw new Error(`AES-256-GCM 密钥必须是 ${KEY_LENGTH_BITS / 8} 字节，实际为 ${rawKey.byteLength}`);
  }
  const subtle = getSubtle();
  return subtle.importKey("raw", rawKey as BufferSource, { name: AEAD_ALGO }, true, ["encrypt", "decrypt"]);
}

export async function exportAeadKeyRaw(key: CryptoKey): Promise<Uint8Array> {
  const subtle = getSubtle();
  const raw = await subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export async function encryptAead(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad: Uint8Array
): Promise<AeadCiphertext> {
  const subtle = getSubtle();
  const iv = getRandomBytes(IV_LENGTH_BYTES);
  const ctBuffer = await subtle.encrypt(
    { name: AEAD_ALGO, iv: iv as BufferSource, additionalData: aad as BufferSource },
    key,
    plaintext as BufferSource
  );
  return { iv, ciphertext: new Uint8Array(ctBuffer) };
}

export async function decryptAead(
  key: CryptoKey,
  input: AeadCiphertext,
  aad: Uint8Array
): Promise<Uint8Array> {
  const subtle = getSubtle();
  try {
    const ptBuffer = await subtle.decrypt(
      { name: AEAD_ALGO, iv: input.iv as BufferSource, additionalData: aad as BufferSource },
      key,
      input.ciphertext as BufferSource
    );
    return new Uint8Array(ptBuffer);
  } catch {
    // 不区分"密钥错误" vs "被篡改" vs "AAD 不匹配"，避免向调用方泄露可用于
    // 侧信道分析的细节；上层只需要知道"这条密文不可信"。
    throw new Error("AEAD 解密失败：密文、密钥或关联数据不匹配（可能被篡改或用错上下文）");
  }
}
