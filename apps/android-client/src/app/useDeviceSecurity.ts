/**
 * 这台设备的安全设置和启动自检（从 App.tsx 拆出，K6）：
 * 截屏保护、应用锁、指纹解锁、加密存储能力自检、本机主密钥能否打开（C10-A）。
 */
import { useEffect, useState } from "react";
import { MasterKeyUnavailableError, type MasterKeyProtection } from "@secureinchat/secure-storage";
import { isLockEnabled } from "../appLock";
import { checkCryptoStorage, type CapabilityResult } from "../capabilityCheck";
import { getDeviceStore, getMasterKeyProtection } from "../deviceIdentity";
import {
  isScreenSecurityEnabled,
  setScreenSecurityEnabled,
  applyScreenSecurity,
  screenSecuritySupported,
} from "../screenSecurity";
import {
  biometricAvailable,
  authenticateBiometric,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
} from "../biometricUnlock";

export function useDeviceSecurity() {
  // 截屏保护：启动时读本机偏好并应用到窗口。
  // 默认关闭——邀请卡片就是为了截图转发；开启后本应用界面无法截屏。
  const [screenSecurityEnabled, setScreenSecurityEnabledState] = useState(false);

  useEffect(() => {
    if (!screenSecuritySupported()) return;
    void (async () => {
      const enabled = await isScreenSecurityEnabled();
      setScreenSecurityEnabledState(enabled);
      await applyScreenSecurity(enabled);
    })();
  }, []);

  const handleToggleScreenSecurity = () => {
    const next = !screenSecurityEnabled;
    setScreenSecurityEnabledState(next);
    void (async () => {
      await setScreenSecurityEnabled(next);
      await applyScreenSecurity(next);
    })();
  };
  /** null = 还没查完是否启用了应用锁 */
  const [locked, setLocked] = useState<boolean | null>(null);
  /** 应用锁是否已启用——解锁后 locked 变 false，但应用锁本身仍启用着 */
  const [lockEnabled, setLockEnabledState] = useState(false);
  const [capability, setCapability] = useState<CapabilityResult | null>(null);

  useEffect(() => {
    void checkCryptoStorage().then(setCapability);
  }, []);

  // C10-A：本机主密钥能不能打开。解不开时单独一屏说明，不让后面的每一步以看不懂的方式失败。
  const [keyProblem, setKeyProblem] = useState<MasterKeyUnavailableError | null>(null);
  const [dataProtection, setDataProtection] = useState<MasterKeyProtection | null>(null);
  async function probeMasterKey(): Promise<boolean> {
    try {
      await getDeviceStore();
      setKeyProblem(null);
      setDataProtection(getMasterKeyProtection());
      return true;
    } catch (err) {
      if (err instanceof MasterKeyUnavailableError) {
        setKeyProblem(err);
        return false;
      }
      throw err;
    }
  }
  useEffect(() => {
    void probeMasterKey().catch(() => undefined);
  }, []);
  const [showLockSetup, setShowLockSetup] = useState(false);

  useEffect(() => {
    void isLockEnabled().then((enabled) => {
      setLocked(enabled);
      setLockEnabledState(enabled);
    });
  }, []);

  // 指纹/面部解锁：只有原生平台且系统可用时才读偏好。
  // 不可用时 MessageListScreen 不显示这一行（不做假功能）。
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    void (async () => {
      const available = await biometricAvailable();
      setBiometricSupported(available);
      if (!available) {
        setBiometricEnabled(false);
        return;
      }
      setBiometricEnabled(await isBiometricUnlockEnabled());
    })();
  }, []);

  const handleToggleBiometric = () => {
    if (!lockEnabled) {
      setShowLockSetup(true);
      return;
    }
    if (biometricEnabled) {
      setBiometricEnabled(false);
      void setBiometricUnlockEnabled(false);
      return;
    }
    void (async () => {
      // 开启前先验证一次，避免用户开了却从没验证过
      const ok = await authenticateBiometric();
      if (!ok) return;
      setBiometricEnabled(true);
      await setBiometricUnlockEnabled(true);
    })();
  };

  return {
    screenSecurityEnabled,
    handleToggleScreenSecurity,
    locked,
    setLocked,
    lockEnabled,
    setLockEnabledState,
    capability,
    keyProblem,
    dataProtection,
    probeMasterKey,
    showLockSetup,
    setShowLockSetup,
    biometricSupported,
    biometricEnabled,
    setBiometricEnabled,
    handleToggleBiometric,
  };
}
