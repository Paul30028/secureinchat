/**
 * 中文（源语言）。所有键在这里定义，键的类型由它推出。
 * 键名按「界面/模块.用途」命名。新文字先加在这里，再补英文和西班牙语。
 */
export const zh = {
  "common.cancel": "取消",
  "common.parenthetical": "（{text}）",
  "app.name": "邀群密聊",
  "time.yesterdayAt": "昨天 {time}",
  "time.dateAt": "{date} {time}",
  "time.justNow": "刚刚",
  "time.minutesAgo": "{count} 分钟前",
  "time.yesterday": "昨天",
  "capability.noIndexedDb": "这台设备不支持本地存储（IndexedDB）",
  "capability.noCrypto": "无法使用加密功能",
  "capability.noCryptoDetail": "页面必须通过 HTTPS 打开（或 localhost），否则浏览器不提供加密接口。",
  "capability.dbOpenFailed": "打开数据库失败",
  "capability.writeFailed": "写入失败",
  "capability.webviewTooOld": "这台设备的浏览器内核太旧，无法保存加密密钥",
  "capability.webviewTooOldDetail": "请到应用商店更新「Android System WebView」和 Chrome 后重试。",
  "relayUrl.empty": "地址不能为空",
  "relayUrl.malformed": "地址格式不正确，例如：wss://ws.example.com",
  "relayUrl.badScheme": "地址必须以 ws:// 或 wss:// 开头",
  "relayUrl.mixedContent": "当前页面是 HTTPS，浏览器会拦截 ws:// 连接，请改用 wss://",
  "media.image": "图片",
  "media.voice": "语音",
  "media.file": "文件",
  "media.preview": "[{label}] {fileName}",
  "biometric.title": "解锁邀群密聊",
  "biometric.subtitle": "用指纹或面部解锁",
  "pin.tooShort": "密码至少 {count} 位",
  "pin.digitsOnly": "密码只能是数字",
  "pin.repeated": "不要使用重复的数字",
  "keystore.genericError": "硬件密钥库出错",
  "nickname.empty": "昵称不能为空",
  "nickname.tooLong": "昵称最多 {count} 个字",
  "nickname.firstPerson": "换一个别人能认出你的名字——群里其他人看到的就是这个",
  "nickname.fallback": "用户{short}",
  // @@END
} as const satisfies Record<string, string>;

export type MessageKey = keyof typeof zh;
