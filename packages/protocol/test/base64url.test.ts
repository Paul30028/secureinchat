import { describe, expect, it } from "vitest";
import { decodeBase64UrlToBytes } from "../src/base64url";

describe("decodeBase64UrlToBytes", () => {
  it("round-trips bytes encoded elsewhere as base64url", () => {
    // "hello" -> base64url "aGVsbG8" (no padding)
    const bytes = decodeBase64UrlToBytes("aGVsbG8");
    expect(new TextDecoder().decode(bytes)).toBe("hello");
  });

  it("handles base64url characters (- and _) that differ from standard base64", () => {
    // bytes [0xfb, 0xff] -> standard base64 "+/8=" -> base64url "-_8"
    const bytes = decodeBase64UrlToBytes("-_8");
    expect(Array.from(bytes)).toEqual([0xfb, 0xff]);
  });
});
