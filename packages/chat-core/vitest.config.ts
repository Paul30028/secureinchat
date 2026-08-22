import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 这个包的测试跑真实加密（密钥派生、AES-GCM、PBKDF2），比纯逻辑测试慢得多。
    // 本地够快，CI 的机器慢，默认 5 秒会误报成失败——放宽超时，
    // 而不是为了让测试跑得快去降低加密参数。
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
