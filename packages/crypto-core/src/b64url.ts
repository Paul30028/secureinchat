/** 包内用的 base64url 工具(不从 index 导出;协议包有自己的一份)。 */

export function toB64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 非法输入抛错;调用方在验签路径上统一 catch 成 false。 */
export function fromB64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("not base64url");
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function sha256B64Url(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return toB64Url(new Uint8Array(digest));
}

const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;
const ECDSA_SHA256 = { name: "ECDSA", hash: "SHA-256" } as const;

/** 用原始公钥(65 字节未压缩点)验 P1363 签名。任何异常都返回 false。 */
export async function verifyP256(
  publicKeyRawB64Url: string,
  signatureB64Url: string,
  data: Uint8Array
): Promise<boolean> {
  try {
    const raw = fromB64Url(publicKeyRawB64Url);
    const sig = fromB64Url(signatureB64Url);
    if (raw.length !== 65 || raw[0] !== 0x04 || sig.length !== 64) return false;
    const key = await crypto.subtle.importKey("raw", raw as BufferSource, ECDSA, false, ["verify"]);
    return await crypto.subtle.verify(ECDSA_SHA256, key, sig as BufferSource, data as BufferSource);
  } catch {
    return false;
  }
}

export async function signP256(privateKey: CryptoKey, data: Uint8Array): Promise<string> {
  const sig = await crypto.subtle.sign(ECDSA_SHA256, privateKey, data as BufferSource);
  return toB64Url(new Uint8Array(sig));
}

/** 公钥的短 ID:SHA-256(原始公钥字节) 的 base64url。用于在信封里指明「哪把管理员钥匙签的」。 */
export async function keyIdOf(publicKeyRawB64Url: string): Promise<string> {
  return sha256B64Url(fromB64Url(publicKeyRawB64Url));
}

export function isP256PublicKeyB64Url(s: unknown): s is string {
  if (typeof s !== "string") return false;
  try {
    const raw = fromB64Url(s);
    return raw.length === 65 && raw[0] === 0x04;
  } catch {
    return false;
  }
}
