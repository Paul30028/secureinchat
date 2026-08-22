import { describe, expect, it, afterEach } from "vitest";
import {
  detectMediaEncryptionSupport,
  describeMediaEncryptionSupport,
} from "../src/mediaEncryptionSupport";

const realPc = (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection;
const realSender = (globalThis as { RTCRtpSender?: unknown }).RTCRtpSender;

function setSenderProto(proto: object | undefined) {
  if (proto === undefined) {
    delete (globalThis as { RTCRtpSender?: unknown }).RTCRtpSender;
    return;
  }
  (globalThis as { RTCRtpSender?: unknown }).RTCRtpSender = { prototype: proto };
}

afterEach(() => {
  if (realPc === undefined) delete (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection;
  else (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = realPc;
  if (realSender === undefined) delete (globalThis as { RTCRtpSender?: unknown }).RTCRtpSender;
  else (globalThis as { RTCRtpSender?: unknown }).RTCRtpSender = realSender;
});

describe("detectMediaEncryptionSupport", () => {
  it("reports no WebRTC at all", () => {
    delete (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection;
    const result = detectMediaEncryptionSupport();

    expect(result.supported).toBe(false);
    if (!result.supported) expect(result.reason).toContain("WebRTC");
  });

  it("detects the current standard (Encoded Transform)", () => {
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = class {};
    setSenderProto({ transform: undefined });

    const result = detectMediaEncryptionSupport();
    expect(result).toEqual({ supported: true, api: "encoded-transform" });
  });

  it("detects the older Insertable Streams API", () => {
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = class {};
    setSenderProto({ createEncodedStreams: () => undefined });

    const result = detectMediaEncryptionSupport();
    expect(result).toEqual({ supported: true, api: "insertable-streams" });
  });

  it("prefers the standard API when both are present", () => {
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = class {};
    setSenderProto({ transform: undefined, createEncodedStreams: () => undefined });

    const result = detectMediaEncryptionSupport();
    if (result.supported) expect(result.api).toBe("encoded-transform");
  });

  it("reports unsupported when WebRTC exists but neither API does", () => {
    (globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = class {};
    setSenderProto({});

    const result = detectMediaEncryptionSupport();
    expect(result.supported).toBe(false);
    if (!result.supported) expect(result.reason).toContain("Chromium");
  });
});

describe("describeMediaEncryptionSupport", () => {
  it("spells out the two options when unsupported, rather than just saying no", () => {
    const text = describeMediaEncryptionSupport({ supported: false, reason: "内核太旧" });
    expect(text).toContain("8 人以内");
    expect(text).toContain("服务器能看到");
  });

  it("says plainly what supported means for a dozen-person meeting", () => {
    const text = describeMediaEncryptionSupport({ supported: true, api: "encoded-transform" });
    expect(text).toContain("服务器看不到");
  });
});
