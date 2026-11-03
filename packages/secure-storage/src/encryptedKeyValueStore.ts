import { decryptAead, encryptAead, type AeadCiphertext } from "@secureinchat/crypto-core";
import type { StorageBackend } from "./storageBackend";

/**
 * 业务代码（chat-core 等）只应该看到这一层：get/set/delete 一个逻辑 key，
 * 底下自动做 AEAD 加密，AAD 绑定 key 名字本身——防止攻击者把 A 条目的密文
 * 挪到 B 条目的位置上（"密文搬家"攻击）。
 *
 * 主密钥不由这个类生成或持有生命周期——由调用方从 KeystorePort 拿到的
 * 设备密钥材料派生后传进来，这个类只管拿密钥做 AEAD，不管密钥怎么来的。
 *
 * C10-A：可以再传一把"旧主密钥"（legacyKey）。换主密钥期间，读的时候先试
 * 当前密钥、失败再试旧密钥；写永远用当前密钥。后台的 migrateLegacy() 把
 * 旧密钥加密的条目逐个改写成当前密钥加密。每个条目的写入是单 key 原子操作，
 * 中途断电后每个条目要么是旧密钥、要么是新密钥加密，两种都读得出来。
 */
export class EncryptedKeyValueStore {
  // 所有写操作（set / delete / 迁移的单条改写）排成一队：迁移"读旧值 → 改写"
  // 之间不会插进一次 set，否则迁移会把刚写入的新值换回旧值。
  private writeQueue: Promise<unknown> = Promise.resolve();
  private legacyKey: CryptoKey | undefined;

  constructor(
    private readonly backend: StorageBackend,
    private readonly masterKey: CryptoKey,
    legacyKey?: CryptoKey
  ) {
    this.legacyKey = legacyKey;
  }

  /** 是否还有旧主密钥待迁移完成 */
  get hasLegacyKey(): boolean {
    return this.legacyKey !== undefined;
  }

  async set(key: string, plaintext: Uint8Array): Promise<void> {
    await this.serialized(() => this.writeEncrypted(key, plaintext));
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    const packed = await this.backend.get(key);
    if (!packed) return undefined;
    // 解密失败（篡改/密钥错误/AAD 不匹配）直接向上抛错误，不静默返回 undefined——
    // 调用方需要知道"这条数据不可信"，而不是误以为"这个 key 从未写入过"。
    return this.decryptPacked(key, packed);
  }

  async delete(key: string): Promise<void> {
    await this.serialized(() => this.backend.delete(key));
  }

  async listKeys(prefix?: string): Promise<string[]> {
    return this.backend.listKeys(prefix);
  }

  /**
   * 把旧主密钥加密的条目改写成当前主密钥加密。可以重复调用、可以在任意一步中断：
   * 已改写的条目下次用当前密钥直接解开，跳过。
   *
   * 两把密钥都解不开的条目不动：同一个后端里还有不经过这一层的明文设置
   * （应用锁、昵称等），它们本来就不是密文。
   *
   * 返回改写了几条、跳过了几条。全部完成后调用方再删除旧密钥，并调用
   * dropLegacyKey()。
   */
  async migrateLegacy(): Promise<{ migrated: number; skipped: number }> {
    const legacy = this.legacyKey;
    if (!legacy) return { migrated: 0, skipped: 0 };
    let migrated = 0;
    let skipped = 0;
    for (const key of await this.backend.listKeys()) {
      const done = await this.serialized(async () => {
        const packed = await this.backend.get(key);
        if (!packed) return false;
        if (await this.tryDecrypt(this.masterKey, key, packed)) return false;
        const plain = await this.tryDecrypt(legacy, key, packed);
        if (!plain) return false;
        await this.writeEncrypted(key, plain);
        return true;
      });
      if (done) migrated++;
      else skipped++;
    }
    return { migrated, skipped };
  }

  /** 迁移完成、旧密钥已删除后调用：之后读取不再尝试旧密钥。 */
  dropLegacyKey(): void {
    this.legacyKey = undefined;
  }

  private async decryptPacked(key: string, packed: Uint8Array): Promise<Uint8Array> {
    const legacy = this.legacyKey;
    if (!legacy) return decryptAead(this.masterKey, unpack(packed), this.aadFor(key));
    const plain = await this.tryDecrypt(this.masterKey, key, packed);
    if (plain) return plain;
    // 旧密钥也解不开就把旧密钥的错误抛出去（和单密钥时一样是"数据不可信"）
    return decryptAead(legacy, unpack(packed), this.aadFor(key));
  }

  private async tryDecrypt(k: CryptoKey, key: string, packed: Uint8Array): Promise<Uint8Array | undefined> {
    try {
      return await decryptAead(k, unpack(packed), this.aadFor(key));
    } catch {
      return undefined;
    }
  }

  private async writeEncrypted(key: string, plaintext: Uint8Array): Promise<void> {
    const aad = this.aadFor(key);
    const { iv, ciphertext } = await encryptAead(this.masterKey, plaintext, aad);
    // 落盘格式： [1 byte iv 长度][iv][ciphertext]。不用 JSON，避免多一层编码开销和歧义。
    const packed = new Uint8Array(1 + iv.byteLength + ciphertext.byteLength);
    packed[0] = iv.byteLength;
    packed.set(iv, 1);
    packed.set(ciphertext, 1 + iv.byteLength);
    await this.backend.set(key, packed);
  }

  private serialized<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(fn, fn);
    // 队列本身不因为某一步失败而断掉
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  private aadFor(key: string): Uint8Array {
    return new TextEncoder().encode(`secureinchat:kv:${key}`);
  }
}

function unpack(packed: Uint8Array): AeadCiphertext {
  const ivLen = packed[0]!;
  return { iv: packed.slice(1, 1 + ivLen), ciphertext: packed.slice(1 + ivLen) };
}
