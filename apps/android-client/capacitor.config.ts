import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // 第五节要求：新旧 APK 必须能同时安装，开发期用独立包名
  appId: "com.sic.invitechat.next",
  appName: "邀群密聊",
  webDir: "dist",
};

export default config;
