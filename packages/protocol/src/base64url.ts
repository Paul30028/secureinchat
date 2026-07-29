const B64URL_RE = /^[A-Za-z0-9_-]+$/;

export function isValidBase64Url(s: string): boolean {
  return s.length > 0 && B64URL_RE.test(s);
}

export function base64UrlToBase64(s: string): string {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  return padded.replace(/-/g, "+").replace(/_/g, "/");
}

export function base64ToBase64Url(s: string): string {
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function encodeJsonToBase64Url(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = btoa(binary);
  return base64ToBase64Url(b64);
}

export function decodeBase64UrlToJson<T>(s: string): T {
  const b64 = base64UrlToBase64(s);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}
