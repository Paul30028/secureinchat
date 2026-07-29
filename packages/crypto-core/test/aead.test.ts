import { describe, expect, it } from "vitest";
import { decryptAead, encryptAead, exportAeadKeyRaw, generateAeadKey, importAeadKeyRaw } from "../src/aead";

describe("AEAD (AES-256-GCM)", () => {
  it("encrypts and decrypts round-trip", async () => {
    const key = await generateAeadKey();
    const plaintext = new TextEncoder().encode("测试消息 hello world");
    const aad = new TextEncoder().encode("ctx:group1:seq1:epoch0");
    const ct = await encryptAead(key, plaintext, aad);
    const pt = await decryptAead(key, ct, aad);
    expect(new TextDecoder().decode(pt)).toBe("测试消息 hello world");
  });

  it("uses a fresh random IV per call", async () => {
    const key = await generateAeadKey();
    const plaintext = new TextEncoder().encode("same message");
    const aad = new Uint8Array();
    const a = await encryptAead(key, plaintext, aad);
    const b = await encryptAead(key, plaintext, aad);
    expect(Buffer.from(a.iv).toString("hex")).not.toBe(Buffer.from(b.iv).toString("hex"));
    expect(Buffer.from(a.ciphertext).toString("hex")).not.toBe(Buffer.from(b.ciphertext).toString("hex"));
  });

  it("fails to decrypt with wrong AAD (context binding works)", async () => {
    const key = await generateAeadKey();
    const plaintext = new TextEncoder().encode("payload");
    const ct = await encryptAead(key, plaintext, new TextEncoder().encode("ctx-A"));
    await expect(decryptAead(key, ct, new TextEncoder().encode("ctx-B"))).rejects.toThrow();
  });

  it("fails to decrypt with tampered ciphertext", async () => {
    const key = await generateAeadKey();
    const plaintext = new TextEncoder().encode("payload");
    const aad = new Uint8Array();
    const ct = await encryptAead(key, plaintext, aad);
    const tampered = new Uint8Array(ct.ciphertext);
    tampered[0] = tampered[0]! ^ 0xff;
    await expect(decryptAead(key, { iv: ct.iv, ciphertext: tampered }, aad)).rejects.toThrow();
  });

  it("fails to decrypt with wrong key", async () => {
    const keyA = await generateAeadKey();
    const keyB = await generateAeadKey();
    const plaintext = new TextEncoder().encode("payload");
    const aad = new Uint8Array();
    const ct = await encryptAead(keyA, plaintext, aad);
    await expect(decryptAead(keyB, ct, aad)).rejects.toThrow();
  });

  it("round-trips raw key export/import", async () => {
    const key = await generateAeadKey();
    const raw = await exportAeadKeyRaw(key);
    expect(raw.byteLength).toBe(32);
    const imported = await importAeadKeyRaw(raw);
    const plaintext = new TextEncoder().encode("via imported key");
    const aad = new Uint8Array();
    const ct = await encryptAead(key, plaintext, aad);
    const pt = await decryptAead(imported, ct, aad);
    expect(new TextDecoder().decode(pt)).toBe("via imported key");
  });

  it("rejects raw keys of the wrong length", async () => {
    await expect(importAeadKeyRaw(new Uint8Array(16))).rejects.toThrow();
  });
});
