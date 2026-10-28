import { Capacitor, registerPlugin } from "@capacitor/core";
import { IndexedDbStorageBackend } from "@secureinchat/secure-storage";

/**
 * 截屏保护（Android FLAG_SECURE）。
 *
 * 默认关闭——邀请卡片就是为了截图转发，开了会截不到。打开后本应用界面
 * 无法截屏或录屏，最近任务里显示空白。这是本机偏好，不同步到其他设备。
 *
 * Web 端没有对应的系统能力，applyScreenSecurity 直接返回 false，
 * 不假装生效。
 */

const PREF_KEY = "screensecurity:v1";

const backend = new IndexedDbStorageBackend();

interface ScreenSecurityPlugin {
  setSecure(o: { enabled: boolean }): Promise<void>;
}

const ScreenSecurity = registerPlugin<ScreenSecurityPlugin>("ScreenSecurity");

/** 只有原生 App 里才有截屏保护；Web 端界面上不出现这个开关。 */
export function screenSecuritySupported(): boolean {
  return Capacitor.isNativePlatform();
}

export async function isScreenSecurityEnabled(): Promise<boolean> {
  try {
    const bytes = await backend.get(PREF_KEY);
    if (!bytes) return false;
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof parsed !== "object" || parsed === null) return false;
    return (parsed as { enabled?: unknown }).enabled === true;
  } catch {
    // 坏 JSON / 读取失败——当 false，不能让应用起不来
    return false;
  }
}

export async function setScreenSecurityEnabled(v: boolean): Promise<void> {
  await backend.set(PREF_KEY, new TextEncoder().encode(JSON.stringify({ enabled: v })));
}

/**
 * 把开关应用到当前窗口。返回是否真的生效：
 * - Web 端 / 测试环境：返回 false（没有系统能力）
 * - 原生插件报错：吞掉错误但返回 false（截屏保护不是关键路径）
 */
export async function applyScreenSecurity(enabled: boolean): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await ScreenSecurity.setSecure({ enabled });
    return true;
  } catch {
    return false;
  }
}
