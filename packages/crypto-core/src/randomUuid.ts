/**
 * 生成 UUID v4。
 *
 * 为什么不直接用 `crypto.randomUUID()`：它是 Chrome 92（2021 年 7 月）才加的，
 * 而 Android 设备上的 System WebView 版本由厂商和系统更新决定，实际会遇到
 * 更老的版本——真机上就报过 `crypto.randomUUID is not a function`。
 * `crypto.getRandomValues` 老得多、覆盖面广得多，用它自己拼一个同样规格的
 * v4 UUID，随机性来源完全一样（都是 CSPRNG），不是降级方案。
 */
export function randomUUID(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") {
    return c.randomUUID();
  }
  if (!c?.getRandomValues) {
    throw new Error("当前环境不支持 crypto.getRandomValues，无法生成安全随机数");
  }

  const bytes = c.getRandomValues(new Uint8Array(16));
  // RFC 4122：第 6 字节高 4 位设为 0100（版本 4），
  // 第 8 字节高 2 位设为 10（variant）
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex: string[] = [];
  for (const b of bytes) hex.push(b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}
