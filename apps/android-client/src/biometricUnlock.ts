import { Capacitor, registerPlugin } from "@capacitor/core";
import { IndexedDbStorageBackend } from "@secureinchat/secure-storage";

/**
 * 应用锁的指纹/面部解锁。
 *
 * 只是"解锁的便捷方式"：成功等同于输对了 PIN，PIN 始终是唯一的后备。
 * 不读取、不保存任何生物特征数据——系统框架负责验证，我们只拿到成功/失败。
 *
 * API 29 以下、设备没有录入生物特征、硬件不可用时，这里全部返回 false，
 * 上层据此不显示任何开关或按钮（不做假功能）。
 *
 * Web 端没有对应的系统能力，所有函数直接返回 false，不假装生效。
 */

const PREF_KEY = "biometricunlock:v1";

const backend = new IndexedDbStorageBackend();

interface BiometricAvailabilityResult {
  available: boolean;
  reason?: string;
}

interface BiometricAuthResult {
  ok: boolean;
  code?: number;
  message?: string;
}

interface BiometricPlugin {
  isAvailable(): Promise<BiometricAvailabilityResult>;
  authenticate(o: { title: string; subtitle: string; cancelLabel: string }): Promise<BiometricAuthResult>;
}

const Biometric = registerPlugin<BiometricPlugin>("Biometric");

/** 只有在原生平台、且系统确实能验证生物特征时才返回 true。 */
export async function biometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await Biometric.isAvailable();
    return result.available === true;
  } catch {
    return false;
  }
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
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

export async function setBiometricUnlockEnabled(v: boolean): Promise<void> {
  await backend.set(PREF_KEY, new TextEncoder().encode(JSON.stringify({ enabled: v })));
}

/**
 * 弹一次系统验证。成功返回 true，失败/取消/不支持都返回 false（不抛）。
 * 取消和单次不匹配都不计入 PIN 错误次数——由调用方保证。
 */
export async function authenticateBiometric(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await Biometric.authenticate({
      title: "解锁邀群密聊",
      subtitle: "用指纹或面部解锁",
      cancelLabel: "取消",
    });
    return result.ok === true;
  } catch {
    return false;
  }
}
