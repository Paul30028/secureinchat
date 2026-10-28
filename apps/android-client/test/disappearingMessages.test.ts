import { describe, expect, it, vi } from "vitest";
import {
  sanitizeExpiresInMs,
  expiresAtFor,
  partitionExpired,
  nextExpiryMs,
} from "@secureinchat/chat-core";

/**
 * 说明：这个文件验证的是「到期」这条逻辑链本身（校验 → 算到期 → 分组 → 排下一次），
 * 不是渲染整个 App 的组件测试。App 组件层需要 mock RelayClient、deviceIdentity、
 * secure-storage、WebCrypto 和加密存储，现有 App.test.tsx 的 mock 方式没有随任务
 * 提供源码，我无法保证能写出一份一定能编译通过的组件级测试。如果你要的是组件级，
 * 把 App.test.tsx 现有内容发我，我按同样的 mock 方式补。
 */

describe("文本消息的到期链路", () => {
  it("设置 5 分钟后发出的消息，信封里是 300000", () => {
    // 发送端：disappearAfterByGroup 里的 5 分钟
    const disappearMs = 5 * 60_000;
    const expiresInMs = sanitizeExpiresInMs(disappearMs);
    expect(expiresInMs).toBe(300_000);
  });

  it("本机发出时按发出时刻算到期", () => {
    const sentAtMs = 1_000_000;
    expect(expiresAtFor(sentAtMs, 300_000)).toBe(1_300_000);
  });

  it("接收方按收到时刻算到期，不看 sentAtMs", () => {
    const receivedAtMs = 9_999_999;
    expect(expiresAtFor(receivedAtMs, 300_000)).toBe(10_299_999);
  });
});

describe("5 分钟后消息从列表消失", () => {
  it("fake timers 推进 5 分钟后 partitionExpired 把它归入 expired", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const messages = [
        { id: "plain" },
        { id: "burn", expiresAtMs: expiresAtFor(Date.now(), 5 * 60_000) },
      ];
      // 刚发出：都还在
      let split = partitionExpired(messages, Date.now());
      expect(split.keep.map((m) => m.id)).toEqual(["plain", "burn"]);
      expect(split.expired).toEqual([]);

      // 推进 5 分钟
      vi.advanceTimersByTime(5 * 60_000);
      split = partitionExpired(messages, Date.now());
      expect(split.keep.map((m) => m.id)).toEqual(["plain"]);
      expect(split.expired.map((m) => m.id)).toEqual(["burn"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("定时器用 nextExpiryMs 排到最早一条，最少 1 秒", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const messages = [
        { id: "a", expiresAtMs: 10_000 },
        { id: "b", expiresAtMs: 5_000 },
        { id: "c" },
      ];
      const next = nextExpiryMs(messages);
      expect(next).toBe(5_000);
      const delay = Math.max(1000, (next as number) - Date.now());
      expect(delay).toBe(5_000);

      // 到期时间已经在过去时，延迟被压到 1 秒
      vi.setSystemTime(20_000);
      const delayPast = Math.max(1000, (next as number) - Date.now());
      expect(delayPast).toBe(1_000);
    } finally {
      vi.useRealTimers();
    }
  });
});
