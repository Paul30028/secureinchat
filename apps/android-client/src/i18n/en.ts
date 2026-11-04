/**
 * English. 缺的键回退到中文；test/i18n.test.ts 检查是否齐全、占位符是否一致。
 */
import type { Translation } from "./index";

export const en: Translation = {
  "common.cancel": "Cancel",
  "common.parenthetical": " ({text})",
  "app.name": "SecureInChat",
  "time.yesterdayAt": "Yesterday {time}",
  "time.dateAt": "{date}, {time}",
  "time.justNow": "Just now",
  "time.minutesAgo": { one: "{count} min ago", other: "{count} min ago" },
  "time.yesterday": "Yesterday",
  "capability.noIndexedDb": "This device does not support local storage (IndexedDB)",
  "capability.noCrypto": "Encryption is not available",
  "capability.noCryptoDetail": "The page must be opened over HTTPS (or localhost); otherwise the browser does not provide its encryption API.",
  "capability.dbOpenFailed": "Could not open the database",
  "capability.writeFailed": "Write failed",
  "capability.webviewTooOld": "This device's browser engine is too old to store encryption keys",
  "capability.webviewTooOldDetail": "Update \"Android System WebView\" and Chrome in the app store, then try again.",
  "relayUrl.empty": "The address cannot be empty",
  "relayUrl.malformed": "Invalid address. Example: wss://ws.example.com",
  "relayUrl.badScheme": "The address must start with ws:// or wss://",
  "relayUrl.mixedContent": "This page uses HTTPS, so the browser blocks ws:// connections. Use wss:// instead.",
  "media.image": "Photo",
  "media.voice": "Voice message",
  "media.file": "File",
  "media.preview": "[{label}] {fileName}",
  "biometric.title": "Unlock SecureInChat",
  "biometric.subtitle": "Use your fingerprint or face",
  "pin.tooShort": { one: "The PIN must have at least {count} digit", other: "The PIN must have at least {count} digits" },
  "pin.digitsOnly": "The PIN can only contain digits",
  "pin.repeated": "Don't use the same digit repeated",
  "keystore.genericError": "Hardware keystore error",
  "nickname.empty": "The name cannot be empty",
  "nickname.tooLong": { one: "The name can have at most {count} character", other: "The name can have at most {count} characters" },
  "nickname.firstPerson": "Choose a name others will recognize — it's what everyone in the group sees",
  "nickname.fallback": "User {short}",
  // @@END
};
