/**
 * Spanish (Español). 缺的键回退到中文；test/i18n.test.ts 检查是否齐全、占位符是否一致。
 */
import type { Translation } from "./index";

export const es: Translation = {
  "common.cancel": "Cancelar",
  "common.parenthetical": " ({text})",
  "app.name": "SecureInChat",
  "time.yesterdayAt": "Ayer {time}",
  "time.dateAt": "{date}, {time}",
  "time.justNow": "Ahora",
  "time.minutesAgo": { one: "hace {count} min", other: "hace {count} min" },
  "time.yesterday": "Ayer",
  "capability.noIndexedDb": "Este dispositivo no admite almacenamiento local (IndexedDB)",
  "capability.noCrypto": "El cifrado no está disponible",
  "capability.noCryptoDetail": "La página debe abrirse por HTTPS (o localhost); de lo contrario, el navegador no ofrece su API de cifrado.",
  "capability.dbOpenFailed": "No se pudo abrir la base de datos",
  "capability.writeFailed": "Error de escritura",
  "capability.webviewTooOld": "El motor del navegador de este dispositivo es demasiado antiguo para guardar claves de cifrado",
  "capability.webviewTooOldDetail": "Actualiza «Android System WebView» y Chrome en la tienda de aplicaciones y vuelve a intentarlo.",
  "relayUrl.empty": "La dirección no puede estar vacía",
  "relayUrl.malformed": "Dirección no válida. Ejemplo: wss://ws.example.com",
  "relayUrl.badScheme": "La dirección debe empezar por ws:// o wss://",
  "relayUrl.mixedContent": "Esta página usa HTTPS, así que el navegador bloquea las conexiones ws://. Usa wss://.",
  "media.image": "Foto",
  "media.voice": "Mensaje de voz",
  "media.file": "Archivo",
  "media.preview": "[{label}] {fileName}",
  "biometric.title": "Desbloquear SecureInChat",
  "biometric.subtitle": "Usa tu huella o tu rostro",
  "pin.tooShort": { one: "El PIN debe tener al menos {count} dígito", other: "El PIN debe tener al menos {count} dígitos" },
  "pin.digitsOnly": "El PIN solo puede contener números",
  "pin.repeated": "No uses el mismo número repetido",
  "keystore.genericError": "Error del almacén de claves de hardware",
  "nickname.empty": "El nombre no puede estar vacío",
  "nickname.tooLong": { one: "El nombre puede tener como máximo {count} carácter", other: "El nombre puede tener como máximo {count} caracteres" },
  "nickname.firstPerson": "Elige un nombre que los demás reconozcan: es lo que ve todo el grupo",
  "nickname.fallback": "Usuario {short}",
  // @@END
};
