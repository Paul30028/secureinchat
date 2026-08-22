/**
 * 从邀请串携带的原始群密钥材料，派生出某个 epoch 下实际使用的 AES-256-GCM 密钥。
 *
 * 用 HKDF 而不是旧仓库的 PBKDF2：邀请串里的密钥材料本身已经是高熵随机字节
 * （不是用户输入的口令），HKDF 更适合"从已有高熵密钥材料派生多个子密钥"，
 * 而且天然支持用 info 参数把 epoch 绑进派生结果——epoch 轮换直接体现为
 * "同一份群密钥材料在不同 epoch 下派生出不同的实际密钥"，不需要重新分发邀请串。
 *
 * PBKDF2 仍保留给"需要从用户设置的应用锁密码派生本地存储保护密钥"的场景
 * （见 secure-storage 包），两者用途不同，不要混用。
 */

async function importHkdfIkm(rawMaterial: Uint8Array): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  return subtle.importKey("raw", rawMaterial as BufferSource, "HKDF", false, ["deriveKey", "deriveBits"]);
}

export interface DeriveGroupKeyInput {
  /** 邀请串携带的原始群密钥材料（不是密码，是随机字节） */
  rawKeyMaterial: Uint8Array;
  /** 群组 id，作为 salt 的一部分，防止不同群复用派生结果 */
  groupId: string;
  /** 当前 epoch（每次成员移除后递增），绑定进 info，天然做到"轮换即换密钥" */
  epoch: number;
}

/** 派生出某个 epoch 下的群消息加密密钥（AES-256-GCM） */
export async function deriveGroupEpochKey(input: DeriveGroupKeyInput): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const ikm = await importHkdfIkm(input.rawKeyMaterial);
  const salt = new TextEncoder().encode(`secureinchat:group-salt:${input.groupId}`);
  const info = new TextEncoder().encode(`secureinchat:epoch:${input.epoch}`);
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info },
    ikm,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * 派生出某个文件的独立文件密钥（见十、文件传输：每个文件生成独立随机文件密钥）。
 * 与群消息密钥用不同的 info 前缀，避免同一份 group key material 在不同用途间被复用。
 */
export async function deriveFileKey(input: {
  rawKeyMaterial: Uint8Array;
  groupId: string;
  epoch: number;
  fileId: string;
}): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const ikm = await importHkdfIkm(input.rawKeyMaterial);
  const salt = new TextEncoder().encode(`secureinchat:file-salt:${input.groupId}:${input.epoch}`);
  const info = new TextEncoder().encode(`secureinchat:file:${input.fileId}`);
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info },
    ikm,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
