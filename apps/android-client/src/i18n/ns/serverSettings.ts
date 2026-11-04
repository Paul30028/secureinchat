import type { Messages } from "../index";

export const zh: Messages = {
  "serverSettings.back": "返回",
  "serverSettings.backAriaLabel": "返回",
  "serverSettings.title": "服务器设置",
  "serverSettings.description":
    "填写你们团队的中继服务器地址。改完保存后，下次连接就会用新地址，不需要重新安装应用。",
  "serverSettings.urlPlaceholder": "wss://ws.example.com",
  "serverSettings.urlAriaLabel": "中继服务器地址输入框",
  "serverSettings.saved": "已保存",
  "serverSettings.save": "保存",
  "serverSettings.reset": "恢复默认（{defaultUrl}）",
  "serverSettings.hint":
    "提示：如果这个页面是通过 https:// 打开的，服务器地址必须用 wss://，浏览器会拦截不加密的 ws:// 连接。",
};

export const en: Messages = {
  "serverSettings.back": "Back",
  "serverSettings.backAriaLabel": "Back",
  "serverSettings.title": "Server settings",
  "serverSettings.description":
    "Enter your team's relay server address. After saving, the next connection will use the new address and you won't need to reinstall the app.",
  "serverSettings.urlPlaceholder": "wss://ws.example.com",
  "serverSettings.urlAriaLabel": "Relay server address input",
  "serverSettings.saved": "Saved",
  "serverSettings.save": "Save",
  "serverSettings.reset": "Restore default ({defaultUrl})",
  "serverSettings.hint":
    "Note: if this page was opened over https://, the server address must use wss://. The browser will block unencrypted ws:// connections.",
};

export const es: Messages = {
  "serverSettings.back": "Volver",
  "serverSettings.backAriaLabel": "Volver",
  "serverSettings.title": "Configuración del servidor",
  "serverSettings.description":
    "Ingresa la dirección del servidor de retransmisión de tu equipo. Después de guardar, la próxima conexión usará la nueva dirección y no necesitarás reinstalar la aplicación.",
  "serverSettings.urlPlaceholder": "wss://ws.example.com",
  "serverSettings.urlAriaLabel": "Campo de dirección del servidor de retransmisión",
  "serverSettings.saved": "Guardado",
  "serverSettings.save": "Guardar",
  "serverSettings.reset": "Restaurar predeterminado ({defaultUrl})",
  "serverSettings.hint":
    "Nota: si esta página se abrió mediante https://, la dirección del servidor debe usar wss://. El navegador bloqueará las conexiones ws:// sin cifrar.",
};
