import { decryptAead, encryptAead, type AeadCiphertext } from "@secureinchat/crypto-core";
import type { StorageBackend } from "./storageBackend";

/**
 * 业务代码（chat-core 等）只应该看到这一层：get/set/delete 一个逻辑 key，
 * 底下自动做 AEAD 加密，AAD 绑定 key 名字本身——防止攻击者把 A 条目的密文
 * 挪到 B 条目的位置上（"密文搬家"攻击）。
 *
 * 主密钥不由这个类生成或持有生命周期——由调用方从 KeystorePort 拿到的
 * 设备密钥材料派生后传进来，这个类只管拿密钥做 AEAD，不管密钥怎么来的。
 */
export class EncryptedKeyValueStore {
  constructor(
    private readonly backend: StorageBackend,
    private readonly masterKey: CryptoKey
  ) {}

  async set(key: string, plaintext: Uint8Array): Promise<void> {
    const aad = this.aadFor(key);
    const { iv, ciphertext } = await encryptAead(this.masterKey, plaintext, aad);
    // 落盘格式： [1 byte iv 长度][iv][ciphertext]。不用 JSON，避免多一层编码开销和歧义。
    const packed = new Uint8Array(1 + iv.byteLength + ciphertext.byteLength);
    packed[0] = iv.byteLength;
    packed.set(iv, 1);
    packed.set(ciphertext, 1 + iv.byteLength);
    await this.backend.set(key, packed);
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    const packed = await this.backend.get(key);
    if (!packed) return undefined;
    const ivLen = packed[0]!;
    const iv = packed.slice(1, 1 + ivLen);
    const ciphertext = packed.slice(1 + ivLen);
    const aad = this.aadFor(key);
    const input: AeadCiphertext = { iv, ciphertext };
    // 解密失败（篡改/密钥错误/AAD 不匹配）直接向上抛错误，不静默返回 undefined——
    // 调用方需要知道"这条数据不可信"，而不是误以为"这个 key 从未写入过"。
    return decryptAead(this.masterKey, input, aad);
  }

  async delete(key: string): Promise<void> {
    await this.backend.delete(key);
  }

  async listKeys(prefix?: string): Promise<string[]> {
    return this.backend.listKeys(prefix);
  }

  private aadFor(key: string): Uint8Array {
    return new TextEncoder().encode(`secureinchat:kv:${key}`);
  }
}
