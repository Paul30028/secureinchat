import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    // 这些测试跑的是真实加密：每个用例都要派生设备密钥、加解密消息，
    // 应用锁还要跑 PBKDF2 21 万次迭代。本地够快，但 CI 的机器慢得多，
    // 默认 5 秒会误报成失败。放宽超时，而不是为了迁就 CI 去弱化加密强度。
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
