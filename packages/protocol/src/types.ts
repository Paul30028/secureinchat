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
  epoch?: number;
  expiresAtMs?: number;
  remainingUses?: number;
}
