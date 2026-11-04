import { describe, expect, it } from "vitest";
import {
  buildBackupPayload,
  encryptBackup,
  decryptBackup,
  mergeRestore,
  BackupError,
  MIN_BACKUP_PASSWORD_LENGTH,
  type BackupPayload,
} from "../src/backup";
import { base64UrlToBytes, bytesToBase64Url } from "../src/fileTransfer";
import type { JoinedGroup } from "../src/groupStore";
import type { StoredMessage } from "../src/messageStore";

/** 测试里把 PBKDF2 迭代调小：600000 次派生每次要几百毫秒，整套测试会太慢。 */
const TEST_ITER = 1000;
const TEST_PASSWORD = "0123456789"; // 正好 10 位，满足最短长度

function makeGroup(id: string): JoinedGroup {
  return {
    groupId: id,
    groupName: `群 ${id}`,
    keyMaterialB64Url: `key-${id}`,
    epoch: 0,
    joinedAtMs: 1_000,
    lastReadAtMs: 2_000,
  };
}

function makeMessage(id: string, sentAtMs: number, text?: string): StoredMessage {
  return {
    id,
    isOwn: false,
    sentAtMs,
    text: text ?? `消息 ${id}`,
  };
}

describe("buildBackupPayload", () => {
  it("排除已过期和仍在倒计时的消息", () => {
    const now = 10_000;
    const messages: StoredMessage[] = [
      makeMessage("normal", 100),
      { ...makeMessage("expiring", 200), expiresAtMs: now + 5_000 }, // 计时中
      { ...makeMessage("expired", 300), expiresAtMs: now - 1_000 }, // 已过期
    ];
    const payload = buildBackupPayload([], { g1: messages }, undefined, now);
    expect(payload.messagesByGroup["g1"]?.map((m) => m.id)).toEqual(["normal"]);
  });

  it("不带昵称时 payload 里没有 nickname 字段", () => {
    const payload = buildBackupPayload([], {}, undefined, 0);
    expect(payload).not.toHaveProperty("nickname");
  });

  it("带昵称时原样保留", () => {
    const payload = buildBackupPayload([], {}, "测试昵称", 0);
    expect(payload.nickname).toBe("测试昵称");
  });
});

describe("encryptBackup / decryptBackup", () => {
  it("往返一致", async () => {
    const payload: BackupPayload = {
      createdAtMs: 12_345,
      nickname: "测试",
      groups: [makeGroup("g1")],
      messagesByGroup: {
        g1: [makeMessage("a", 100), makeMessage("b", 200)],
      },
    };
    const text = await encryptBackup(payload, TEST_PASSWORD, TEST_ITER);
    const back = await decryptBackup(text, TEST_PASSWORD);
    expect(back).toEqual(payload);
  });

  it("密码太短时拒绝加密", async () => {
    const payload: BackupPayload = { createdAtMs: 0, groups: [], messagesByGroup: {} };
    const short = "x".repeat(MIN_BACKUP_PASSWORD_LENGTH - 1);
    await expect(encryptBackup(payload, short, TEST_ITER)).rejects.toBeInstanceOf(BackupError);
    await expect(encryptBackup(payload, short, TEST_ITER)).rejects.toMatchObject({ code: "password-too-short" });
  });

  it("错密码解密失败，抛 BackupError", async () => {
    const payload: BackupPayload = { createdAtMs: 0, groups: [], messagesByGroup: {} };
    const text = await encryptBackup(payload, TEST_PASSWORD, TEST_ITER);
    await expect(decryptBackup(text, "wrong-password")).rejects.toBeInstanceOf(BackupError);
    await expect(decryptBackup(text, "wrong-password")).rejects.toMatchObject({ code: "wrong-password" });
    await expect(decryptBackup(text, "wrong-password")).rejects.toThrow(
      "密码不对，或文件已损坏"
    );
  });

  it("改密文一个字节就解密失败", async () => {
    const payload: BackupPayload = { createdAtMs: 0, groups: [], messagesByGroup: {} };
    const text = await encryptBackup(payload, TEST_PASSWORD, TEST_ITER);
    const parsed = JSON.parse(text) as { ct: string };
    const bytes = base64UrlToBytes(parsed.ct);
    bytes[0] = bytes[0]! ^ 0xff;
    const tampered = JSON.stringify({ ...parsed, ct: bytesToBase64Url(bytes) });
    await expect(decryptBackup(tampered, TEST_PASSWORD)).rejects.toBeInstanceOf(BackupError);
  });

  it("格式字段不对时报错", async () => {
    await expect(decryptBackup("not json at all", TEST_PASSWORD)).rejects.toMatchObject({ code: "not-json" });
    await expect(
      decryptBackup(JSON.stringify({ format: "wrong", v: 1 }), TEST_PASSWORD)
    ).rejects.toBeInstanceOf(BackupError);
    await expect(
      decryptBackup(JSON.stringify({ format: "sic-backup", v: 999 }), TEST_PASSWORD)
    ).rejects.toBeInstanceOf(BackupError);
  });

  it("kdf 字段缺失或非法时报错", async () => {
    const broken = JSON.stringify({
      format: "sic-backup",
      v: 1,
      iv: "AAAA",
      ct: "AAAA",
    });
    await expect(decryptBackup(broken, TEST_PASSWORD)).rejects.toBeInstanceOf(BackupError);

    const badIter = JSON.stringify({
      format: "sic-backup",
      v: 1,
      kdf: { name: "PBKDF2", hash: "SHA-256", iter: -1, salt: "AAAA" },
      iv: "AAAA",
      ct: "AAAA",
    });
    await expect(decryptBackup(badIter, TEST_PASSWORD)).rejects.toBeInstanceOf(BackupError);
  });
});

describe("mergeRestore", () => {
  it("合并群：本机已有的保留，备份里多出来的加进来", () => {
    const existing: JoinedGroup[] = [makeGroup("g1")];
    const payload: BackupPayload = {
      createdAtMs: 0,
      groups: [makeGroup("g1"), makeGroup("g2")],
      messagesByGroup: {},
    };
    const result = mergeRestore(existing, {}, payload);
    expect(result.groups.map((g) => g.groupId).sort()).toEqual(["g1", "g2"]);
  });

  it("本机已有的群：消息也不动，只报告为跳过", () => {
    const existingGroups: JoinedGroup[] = [makeGroup("g1")];
    const existingMsgs: Record<string, StoredMessage[]> = { g1: [makeMessage("a", 100)] };
    const payload: BackupPayload = {
      createdAtMs: 0,
      groups: [makeGroup("g1"), makeGroup("g2")],
      messagesByGroup: { g1: [makeMessage("old", 50)], g2: [makeMessage("b", 2), makeMessage("b", 2), makeMessage("a2", 1)] },
    };
    const result = mergeRestore(existingGroups, existingMsgs, payload);
    expect(result.messagesByGroup["g1"]).toBe(existingMsgs["g1"]);
    expect(result.messagesByGroup["g2"]?.map((m) => m.id)).toEqual(["a2", "b"]);
    expect(result.addedGroupIds).toEqual(["g2"]);
    expect(result.skippedGroupIds).toEqual(["g1"]);
    expect(result.addedMessages).toBe(2);
  });

  it("备份里有、本机没有的群，消息也一起合并", () => {
    const payload: BackupPayload = {
      createdAtMs: 0,
      groups: [makeGroup("g2")],
      messagesByGroup: {
        g2: [makeMessage("d", 50)],
      },
    };
    const result = mergeRestore([], {}, payload);
    expect(result.groups.map((g) => g.groupId)).toEqual(["g2"]);
    expect(result.messagesByGroup["g2"]?.map((m) => m.id)).toEqual(["d"]);
  });

  it("超过 300 条被截断，保留最新的 300 条", () => {
    const many: StoredMessage[] = Array.from({ length: 350 }, (_, i) => makeMessage(`m${i}`, i));
    const payload: BackupPayload = {
      createdAtMs: 0,
      groups: [makeGroup("g1")],
      messagesByGroup: { g1: many },
    };
    const result = mergeRestore([], {}, payload);
    const g1 = result.messagesByGroup["g1"];
    expect(g1).toHaveLength(300);
    expect(g1?.[0]?.id).toBe("m50");
    expect(g1?.[299]?.id).toBe("m349");
  });

  it("旧备份不能把本机的群降回旧 epoch 或旧密钥", () => {
    const local: JoinedGroup = { ...makeGroup("g1"), keyMaterialB64Url: "new-key", epoch: 3, groupName: "本机名" };
    const stale: JoinedGroup = { ...makeGroup("g1"), keyMaterialB64Url: "old-key", epoch: 1, groupName: "旧名" };
    const result = mergeRestore([local], {}, { createdAtMs: 0, groups: [stale], messagesByGroup: {} });
    expect(result.groups).toEqual([local]);
  });

  it("结构不对的群和消息被丢弃", () => {
    const payload = {
      createdAtMs: 0,
      groups: [makeGroup("g1"), { groupId: "bad" }, null, { ...makeGroup("g3"), epoch: -1 }],
      messagesByGroup: {
        g1: [makeMessage("ok", 1), { id: 5 }, null, { id: "x" }],
      },
    } as unknown as BackupPayload;
    const result = mergeRestore([], {}, payload);
    expect(result.groups.map((g) => g.groupId)).toEqual(["g1"]);
    expect(result.messagesByGroup["g1"]?.map((m) => m.id)).toEqual(["ok"]);
  });

  it("不属于任何群的消息不写入", () => {
    const result = mergeRestore([], {}, { createdAtMs: 0, groups: [], messagesByGroup: { ghost: [makeMessage("a", 1)] } });
    expect(result.messagesByGroup["ghost"]).toBeUndefined();
  });

  it("文件里带倒计时的消息恢复时也被丢弃", () => {
    const timed: StoredMessage = { ...makeMessage("t", 5), expiresAtMs: 9_999_999_999_999 };
    const result = mergeRestore([], {}, { createdAtMs: 0, groups: [makeGroup("g1")], messagesByGroup: { g1: [timed, makeMessage("n", 6)] } });
    expect(result.messagesByGroup["g1"]?.map((m) => m.id)).toEqual(["n"]);
  });
});
