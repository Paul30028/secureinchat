/**
 * 媒体端到端加密的能力检测。
 *
 * 十几个人的会议需要 SFU,而普通 SFU 要解密媒体才能转发——服务器就能看到
 * 整场会议。浏览器有两个特性可以绕开这一点,让 SFU 转发**已加密的帧**:
 *
 *   - Encoded Transform(新标准,`RTCRtpSender.transform`)
 *   - Insertable Streams(旧的实验性接口,`createEncodedStreams`)
 *
 * 支持任一个,就能做到"十几人会议 + 服务器看不到内容"。都不支持的话,
 * 只有两个选择:人数降到 8 以内走 mesh,或者接受服务器能看到会议。
 *
 * 这个检测的意义:**在买机器、部署 SFU 之前就知道走哪条路**,而不是做完
 * 才发现加密方案在实际设备上跑不了。
 */

export type MediaEncryptionSupport =
  | { supported: true; api: "encoded-transform" | "insertable-streams" }
  | { supported: false; reason: string };

export function detectMediaEncryptionSupport(): MediaEncryptionSupport {
  if (typeof RTCPeerConnection === "undefined") {
    return { supported: false, reason: "这个环境不支持 WebRTC" };
  }

  // 新标准:RTCRtpSender.transform
  const senderProto = (globalThis as { RTCRtpSender?: { prototype?: object } }).RTCRtpSender?.prototype;
  if (senderProto && "transform" in senderProto) {
    return { supported: true, api: "encoded-transform" };
  }

  // 旧接口:createEncodedStreams(Chrome 86+ 带 flag,后来默认开)
  if (senderProto && "createEncodedStreams" in senderProto) {
    return { supported: true, api: "insertable-streams" };
  }

  return {
    supported: false,
    reason: "这台设备的浏览器内核不支持媒体帧加密（需要较新的 Chromium）",
  };
}

export function describeMediaEncryptionSupport(result: MediaEncryptionSupport): string {
  if (!result.supported) {
    return `${result.reason}。十几人会议只能选择：人数降到 8 人以内，或者接受服务器能看到会议内容。`;
  }
  const apiName = result.api === "encoded-transform" ? "Encoded Transform" : "Insertable Streams";
  return `支持媒体帧加密（${apiName}）。十几人会议可以做到服务器看不到内容。`;
}
