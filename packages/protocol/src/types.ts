/**
 * 协议无关的公共类型。业务层（chat-core）只依赖这里的类型，
 * 不直接依赖 sic1/ 或 sic2/ 的内部结构。
 */

export type ProtocolVersion = "SIC1" | "SIC2";

/** 邀请串解析后的结构化结果（不区分具体协议版本，供 UI 层直接使用） */
export interface ParsedInvite {
  readonly version: ProtocolVersion;
  /** 是否为兼容模式（旧协议）。UI 必须据此显示"兼容模式"标记。 */
  readonly isCompatMode: boolean;
  /** 服务器用于校验入群资格的短码，管理员可轮换，不影响群密钥 */
  readonly serverJoinCode: string;
  /**
   * 群组的稳定标识符——和 serverJoinCode 是两个不同的概念：serverJoinCode 可以被
   * 管理员轮换（换一批新邀请码），但 groupId 必须保持不变，否则群密钥派生
   * （crypto-core 的 deriveGroupEpochKey 拿 groupId 当盐值）会跟着变，等于换了一个
   * "新群"。SIC1（旧协议）没有这个概念，只有 SIC2 才带。
   */
  readonly groupId?: string;
  /**
   * 群名。放在邀请串里而不是问服务器要——中继是盲的，它不知道群叫什么，
   * 也不应该知道。创建者把群名写进邀请串，加入者解析出来就能显示正确的名字。
   * SIC1（旧协议）没有这个字段。
   */
  readonly groupName?: string;
  /**
   * 管理员公钥。建群者生成，写进邀请串让所有成员都能验证公告签名。
   * 没有这个字段的群（旧邀请串）无法验证公告，客户端会当作"不可验证"处理。
   */
  readonly adminPublicKeyRawB64Url?: string;
  /** 客户端本地派生群密钥所需的原始材料（未解密前的 opaque bytes，base64url 编码） */
  readonly keyMaterialB64Url: string;
  /** SIC2 起才有：群 epoch，用于密钥轮换与重放校验 */
  readonly epoch?: number;
  /** SIC2 起才有：邀请过期时间（unix ms） */
  readonly expiresAtMs?: number;
  /** SIC2 起才有：剩余可用次数 */
  readonly remainingUses?: number;
}

export class InviteParseError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | "empty"
      | "bad-prefix"
      | "malformed-segments"
      | "invalid-base64url"
      | "invalid-json"
      | "expired"
      | "exhausted"
  ) {
    super(message);
    this.name = "InviteParseError";
  }
}

/**
 * 一个协议适配器封装"某一个具体协议版本"的编解码能力。
 * chat-core 在会话建立时选定一个适配器实例，之后不再关心版本分支。
 */
export interface ProtocolAdapter {
  readonly version: ProtocolVersion;
  readonly isCompatMode: boolean;
  parseInvite(raw: string): ParsedInvite;
  buildInvite(input: BuildInviteInput): string;
}

export interface BuildInviteInput {
  serverJoinCode: string;
  keyMaterialB64Url: string;
  /** SIC2 必须提供；SIC1 没有这个概念，传了也会被忽略 */
  groupId?: string;
  /** 群名，会明文放进邀请串（拿到邀请串的人本来就要加入这个群） */
  groupName?: string;
  /** 管理员公钥，用于验证公告签名 */
  adminPublicKeyRawB64Url?: string;
  epoch?: number;
  expiresAtMs?: number;
  remainingUses?: number;
}
