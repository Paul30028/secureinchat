import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * 保存一段文本到文件。
 *
 * Android 原生：走我们自己的 DocumentSave 插件（Intent.ACTION_CREATE_DOCUMENT），
 * Capacitor 的 Android WebView 默认不处理 blob: URL 的下载，a[download] 在真机上
 * 点了什么都不发生。
 *
 * Web：保持原来的 a[download] 逻辑，浏览器会处理下载。
 *
 * 返回值区分「用户取消」和「保存成功」：调用方据此决定是否清空密码、是否显示
 * 成功文案。原生层写入失败会 reject，这里不吞掉。
 */

interface DocumentSaveResult {
  saved: boolean;
  /** 系统返回的显示名；拿不到时是请求的文件名 */
  name?: string;
}

interface DocumentSavePlugin {
  save(o: { fileName: string; mimeType: string; text: string }): Promise<DocumentSaveResult>;
}

const DocumentSave = registerPlugin<DocumentSavePlugin>("DocumentSave");

function downloadTextInBrowser(filename: string, mimeType: string, text: string): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟释放：某些浏览器在 click 后同步 revoke 会导致下载失败
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveTextFile(
  fileName: string,
  mimeType: string,
  text: string
): Promise<"saved" | "cancelled"> {
  if (Capacitor.isNativePlatform()) {
    const result = await DocumentSave.save({ fileName, mimeType, text });
    return result.saved ? "saved" : "cancelled";
  }
  downloadTextInBrowser(fileName, mimeType, text);
  return "saved";
}
