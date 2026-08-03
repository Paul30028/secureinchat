import { colors, radii } from "@secureinchat/ui";

/**
 * 浏览器的 Web Crypto（`crypto.subtle`）只在安全上下文下可用——HTTPS 或
 * localhost。用 `http://192.168.x.x` 之类的局域网地址打开时它是 undefined，
 * 整个加密链路会以很难看懂的方式失败。与其让用户看到白屏或一句
 * "Cannot read properties of undefined"，不如直接说清楚发生了什么、怎么办。
 */
export function isSecureContextAvailable(): boolean {
  return typeof globalThis.crypto?.subtle !== "undefined";
}

export function InsecureContextNotice() {
  return (
    <div
      role="alert"
      style={{
        minHeight: "100vh",
        background: colors.ivory,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 360,
          border: `0.5px solid ${colors.sageMint}`,
          borderRadius: radii.cardLarge,
          padding: "20px 18px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 500, color: colors.textPrimary, margin: "0 0 12px" }}>
          无法启用加密
        </h1>
        <p style={{ fontSize: 13, color: "#8A8A82", lineHeight: 1.7, margin: 0 }}>
          浏览器只在 HTTPS 或 localhost 下提供加密能力。当前地址不满足这个条件，
          为了不在没有加密保护的情况下传输消息，应用不会启动。
        </p>
        <p style={{ fontSize: 13, color: "#8A8A82", lineHeight: 1.7, margin: "12px 0 0" }}>
          请改用 <code style={{ fontFamily: "monospace" }}>https://</code> 地址访问，
          或在本机用 <code style={{ fontFamily: "monospace" }}>localhost</code> 打开。
        </p>
      </div>
    </div>
  );
}
