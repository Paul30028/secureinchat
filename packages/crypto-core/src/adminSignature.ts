/**
 * 管理员签名。
 *
 * 为什么不能靠服务端校验：公告和普通消息一样封在加密载荷里，中继按设计看不见
 * 内容，也就分不出哪条是公告——除非破坏盲中继原则。所以授权只能放在密码学层：
 *
 *   建群者生成一对管理员密钥 → 公钥写进邀请串（所有成员都拿得到）
 *   → 发公告时用私钥签名 → 收到的人验签，验不过就不当公告
 *
 * 这样即使有人自己解锁了本地的管理员界面，发出去的公告也会被所有人的客户端
 * 拒绝，因为他没有私钥。中继完全不参与，也不需要知道谁是管理员。
 */

export interface AdminKeyPair {
  privateKey: CryptoKey;
  publicKeyRawB64Url: string;
}

const ALGO = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_ALGO = { name: "ECDSA", hash: "SHA-256" } as const;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 建群时调用一次。私钥不可导出——只有建群的这台设备能签名，
 *  连它自己的业务代码也拿不到原始私钥字节。 */
export async function generateAdminKeyPair(): Promise<AdminKeyPair> {
  const pair = (await crypto.subtle.generateKey(ALGO, false, ["sign", "verify"])) as CryptoKeyPair;
  const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
  return { privateKey: pair.privateKey, publicKeyRawB64Url: toBase64Url(new Uint8Array(raw)) };
}

/**
 * 被签名的内容。把栏目和正文都算进去——否则拿一条合法签名换个栏目重放就成立了。
 * groupId 也算进去，防止把 A 群的公告原样搬到 B 群。
 */
export function announcementSigningInput(input: {
  groupId: string;
  category: string;
  title: string;
  body: string;
  sentAtMs: number;
}): Uint8Array {
  const canonical = JSON.stringify([input.groupId, input.category, input.title, input.body, input.sentAtMs]);
  return new TextEncoder().encode(canonical);
}

export async function signAnnouncement(
  privateKey: CryptoKey,
  input: Parameters<typeof announcementSigningInput>[0]
): Promise<string> {
  const sig = await crypto.subtle.sign(SIGN_ALGO, privateKey, announcementSigningInput(input) as BufferSource);
  return toBase64Url(new Uint8Array(sig));
}

/** 验签失败一律返回 false，不抛错——收到一条伪造公告不该让应用崩溃 */
export async function verifyAnnouncement(
  publicKeyRawB64Url: string,
  signatureB64Url: string,
  input: Parameters<typeof announcementSigningInput>[0]
): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey("raw", fromBase64Url(publicKeyRawB64Url) as BufferSource, ALGO, false, [
      "verify",
    ]);
    return await crypto.subtle.verify(
      SIGN_ALGO,
      publicKey,
      fromBase64Url(signatureB64Url) as BufferSource,
      announcementSigningInput(input) as BufferSource
    );
  } catch {
    return false;
  }
}
