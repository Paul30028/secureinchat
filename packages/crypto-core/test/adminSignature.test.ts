import { describe, expect, it } from "vitest";
import {
  generateAdminKeyPair,
  signAnnouncement,
  verifyAnnouncement,
  announcementSigningInput,
  restoreAdminKeyFromRecoveryCode,
  AdminRecoveryError,
} from "../src/adminSignature";

const base = {
  groupId: "g1",
  category: "scripture",
  title: "诗篇 133:1",
  body: "弟兄和睦同居",
  sentAtMs: 1000,
};

describe("admin announcement signatures", () => {
  it("verifies a genuine signature", async () => {
    const admin = await generateAdminKeyPair();
    const sig = await signAnnouncement(admin.privateKey, base);
    expect(await verifyAnnouncement(admin.publicKeyRawB64Url, sig, base)).toBe(true);
  });

  it("rejects a signature made by a different key — this is what stops a self-unlocked 'admin'", async () => {
    const realAdmin = await generateAdminKeyPair();
    const impostor = await generateAdminKeyPair();
    const sig = await signAnnouncement(impostor.privateKey, base);

    expect(await verifyAnnouncement(realAdmin.publicKeyRawB64Url, sig, base)).toBe(false);
  });

  it("rejects a tampered body", async () => {
    const admin = await generateAdminKeyPair();
    const sig = await signAnnouncement(admin.privateKey, base);
    expect(await verifyAnnouncement(admin.publicKeyRawB64Url, sig, { ...base, body: "改过的内容" })).toBe(false);
  });

  it("rejects replaying a valid signature under a different category", async () => {
    const admin = await generateAdminKeyPair();
    const sig = await signAnnouncement(admin.privateKey, base);
    expect(await verifyAnnouncement(admin.publicKeyRawB64Url, sig, { ...base, category: "notice" })).toBe(false);
  });

  it("rejects replaying an announcement into another group", async () => {
    const admin = await generateAdminKeyPair();
    const sig = await signAnnouncement(admin.privateKey, base);
    expect(await verifyAnnouncement(admin.publicKeyRawB64Url, sig, { ...base, groupId: "g2" })).toBe(false);
  });

  it("rejects a tampered timestamp", async () => {
    const admin = await generateAdminKeyPair();
    const sig = await signAnnouncement(admin.privateKey, base);
    expect(await verifyAnnouncement(admin.publicKeyRawB64Url, sig, { ...base, sentAtMs: 9999 })).toBe(false);
  });

  it("returns false rather than throwing on a malformed signature or key", async () => {
    const admin = await generateAdminKeyPair();
    expect(await verifyAnnouncement(admin.publicKeyRawB64Url, "not-a-signature", base)).toBe(false);
    expect(await verifyAnnouncement("not-a-key", "also-junk", base)).toBe(false);
  });

  it("exports a 65-byte uncompressed P-256 public key", async () => {
    const admin = await generateAdminKeyPair();
    const padded = admin.publicKeyRawB64Url + "=".repeat((4 - (admin.publicKeyRawB64Url.length % 4)) % 4);
    const bytes = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    expect(bytes.length).toBe(65);
    expect(bytes.charCodeAt(0)).toBe(0x04);
  });

  it("produces a stable canonical signing input", () => {
    const a = announcementSigningInput(base);
    const b = announcementSigningInput({ ...base });
    expect(new TextDecoder().decode(a)).toBe(new TextDecoder().decode(b));
  });
});

describe("admin recovery code", () => {
  it("a restored key produces signatures the original public key still verifies", async () => {
    const admin = await generateAdminKeyPair();
    const restored = await restoreAdminKeyFromRecoveryCode(admin.recoveryCode);

    const sig = await signAnnouncement(restored.privateKey, base);
    expect(await verifyAnnouncement(admin.publicKeyRawB64Url, sig, base)).toBe(true);
  });

  it("recovers the same public key, so existing invites keep working", async () => {
    const admin = await generateAdminKeyPair();
    const restored = await restoreAdminKeyFromRecoveryCode(admin.recoveryCode);
    expect(restored.publicKeyRawB64Url).toBe(admin.publicKeyRawB64Url);
  });

  it("the restored key is non-extractable — recovering doesn't leak it further", async () => {
    const admin = await generateAdminKeyPair();
    const restored = await restoreAdminKeyFromRecoveryCode(admin.recoveryCode);
    expect(restored.privateKey.extractable).toBe(false);
  });

  it("the key kept for daily use is non-extractable even though a code was produced", async () => {
    const admin = await generateAdminKeyPair();
    expect(admin.privateKey.extractable).toBe(false);
  });

  it("rejects a code with the wrong prefix", async () => {
    await expect(restoreAdminKeyFromRecoveryCode("SIC2.something")).rejects.toThrow(AdminRecoveryError);
  });

  it("rejects a truncated or garbled code rather than failing silently", async () => {
    const admin = await generateAdminKeyPair();
    const truncated = admin.recoveryCode.slice(0, admin.recoveryCode.length - 12);
    await expect(restoreAdminKeyFromRecoveryCode(truncated)).rejects.toThrow(AdminRecoveryError);
  });

  it("tolerates surrounding whitespace from copying", async () => {
    const admin = await generateAdminKeyPair();
    const restored = await restoreAdminKeyFromRecoveryCode(`  ${admin.recoveryCode}\n`);
    expect(restored.publicKeyRawB64Url).toBe(admin.publicKeyRawB64Url);
  });

  it("a code from a different group's admin does not verify against this group's public key", async () => {
    const groupA = await generateAdminKeyPair();
    const groupB = await generateAdminKeyPair();
    const restoredB = await restoreAdminKeyFromRecoveryCode(groupB.recoveryCode);

    const sig = await signAnnouncement(restoredB.privateKey, base);
    expect(await verifyAnnouncement(groupA.publicKeyRawB64Url, sig, base)).toBe(false);
  });
});

describe("audio attachment is covered by the signature", () => {
  it("verifies when the audio id matches", async () => {
    const admin = await generateAdminKeyPair();
    const withAudio = { ...base, category: "hymn", audioFileId: "file-1" };
    const sig = await signAnnouncement(admin.privateKey, withAudio);
    expect(await verifyAnnouncement(admin.publicKeyRawB64Url, sig, withAudio)).toBe(true);
  });

  it("rejects swapping the audio for a different file", async () => {
    const admin = await generateAdminKeyPair();
    const withAudio = { ...base, category: "hymn", audioFileId: "file-1" };
    const sig = await signAnnouncement(admin.privateKey, withAudio);
    expect(
      await verifyAnnouncement(admin.publicKeyRawB64Url, sig, { ...withAudio, audioFileId: "file-evil" })
    ).toBe(false);
  });

  it("rejects stripping the audio off a signed announcement", async () => {
    const admin = await generateAdminKeyPair();
    const withAudio = { ...base, category: "hymn", audioFileId: "file-1" };
    const sig = await signAnnouncement(admin.privateKey, withAudio);
    expect(await verifyAnnouncement(admin.publicKeyRawB64Url, sig, { ...withAudio, audioFileId: undefined })).toBe(
      false
    );
  });
});
