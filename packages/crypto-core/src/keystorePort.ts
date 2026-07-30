/**
 * 私钥永远不应该以明文形式经过这一层——这个接口刻意设计成
 * "只能要求 Keystore 做操作，拿不到私钥原始字节"。
 *
 * 真实实现是一个 Capacitor 原生插件（Android Keystore / 优先 StrongBox），
 * 在 apps/android-client 里接入；本包只定义端口（interface）和一个
 * **仅供单元测试使用**的内存实现，绝不能被打进生产 Android 构建。
 */
export interface KeystorePort {
  /** 生成一个设备密钥对，返回不透明的 keyAlias，不返回私钥 */
  generateDeviceKeyPair(alias: string): Promise<string>;
  /** 用设备私钥对数据签名，私钥本身不出这个函数 */
  sign(alias: string, data: Uint8Array): Promise<Uint8Array>;
  /** 校验签名 */
  verify(alias: string, data: Uint8Array, signature: Uint8Array): Promise<boolean>;
  /**
   * 导出公钥的原始字节（未压缩点格式：0x04 || X || Y，P-256 下是 65 字节）。
   * 公钥不是秘密——这是服务端做设备认证必须要有的能力：注册/邀请环节把这个
   * 发给服务端，之后服务端才能独立验证客户端签的 proof，不需要共享密钥。
   * 私钥本身永远不会、也不能通过这个接口拿到。
   */
  exportPublicKeyRaw(alias: string): Promise<Uint8Array>;
  /** 是否有硬件级密钥支持（StrongBox / TEE），用于安全提示展示 */
  hasHardwareBackedKeystore(): Promise<boolean>;
}

/**
 * ⚠️ 仅供单元测试。私钥保存在进程内存里，没有任何硬件保护。
 * 任何非测试代码 import 这个类都是架构违规。
 */
export class TestOnlyInMemoryKeystore implements KeystorePort {
  private keys = new Map<string, CryptoKeyPair>();

  async generateDeviceKeyPair(alias: string): Promise<string> {
    const subtle = globalThis.crypto.subtle;
    const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    this.keys.set(alias, pair);
    return alias;
  }

  async sign(alias: string, data: Uint8Array): Promise<Uint8Array> {
    const pair = this.requireKey(alias);
    const subtle = globalThis.crypto.subtle;
    const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, data as BufferSource);
    return new Uint8Array(sig);
  }

  async verify(alias: string, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
    const pair = this.requireKey(alias);
    const subtle = globalThis.crypto.subtle;
    return subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pair.publicKey,
      signature as BufferSource,
      data as BufferSource
    );
  }

  async exportPublicKeyRaw(alias: string): Promise<Uint8Array> {
    const pair = this.requireKey(alias);
    const subtle = globalThis.crypto.subtle;
    const raw = await subtle.exportKey("raw", pair.publicKey);
    return new Uint8Array(raw);
  }

  async hasHardwareBackedKeystore(): Promise<boolean> {
    return false;
  }

  private requireKey(alias: string): CryptoKeyPair {
    const pair = this.keys.get(alias);
    if (!pair) throw new Error(`未找到别名为 ${alias} 的测试密钥对，先调用 generateDeviceKeyPair`);
    return pair;
  }
}
