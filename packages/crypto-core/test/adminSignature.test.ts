import { describe, expect, it } from "vitest";
import {
  generateAdminKeyPair,
  signAnnouncement,
  verifyAnnouncement,
  announcementSigningInput,
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
