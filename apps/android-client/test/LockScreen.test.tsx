import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LockScreen } from "../src/screens/LockScreen";

describe("LockScreen 指纹/面部解锁", () => {
  it("biometricEnabled 为 true 时挂载后自动调用一次 onBiometricUnlock", async () => {
    const onBiometricUnlock = vi.fn().mockResolvedValue(false);
    render(
      <LockScreen
        mode="unlock"
        onUnlocked={vi.fn()}
        biometricEnabled={true}
        onBiometricUnlock={onBiometricUnlock}
      />
    );
    await waitFor(() => expect(onBiometricUnlock).toHaveBeenCalledTimes(1));
  });

  it("验证成功时调用 onUnlocked", async () => {
    const onBiometricUnlock = vi.fn().mockResolvedValue(true);
    const onUnlocked = vi.fn();
    render(
      <LockScreen
        mode="unlock"
        onUnlocked={onUnlocked}
        biometricEnabled={true}
        onBiometricUnlock={onBiometricUnlock}
      />
    );
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
  });

  it("验证失败时不调用 onUnlocked，PIN 输入框仍在", async () => {
    const onBiometricUnlock = vi.fn().mockResolvedValue(false);
    const onUnlocked = vi.fn();
    render(
      <LockScreen
        mode="unlock"
        onUnlocked={onUnlocked}
        biometricEnabled={true}
        onBiometricUnlock={onBiometricUnlock}
      />
    );
    await waitFor(() => expect(onBiometricUnlock).toHaveBeenCalledTimes(1));
    expect(onUnlocked).not.toHaveBeenCalled();
    expect(screen.getByLabelText("应用密码输入框")).toBeInTheDocument();
  });

  it("点击「用指纹解锁」按钮再次调用 onBiometricUnlock", async () => {
    const onBiometricUnlock = vi.fn().mockResolvedValue(false);
    render(
      <LockScreen
        mode="unlock"
        onUnlocked={vi.fn()}
        biometricEnabled={true}
        onBiometricUnlock={onBiometricUnlock}
      />
    );
    await waitFor(() => expect(onBiometricUnlock).toHaveBeenCalledTimes(1));
    const button = screen.getByText("用指纹解锁");
    fireEvent.click(button);
    await waitFor(() => expect(onBiometricUnlock).toHaveBeenCalledTimes(2));
  });

  it("biometricEnabled 为 false 时没有按钮，也不自动调用", async () => {
    const onBiometricUnlock = vi.fn().mockResolvedValue(true);
    render(
      <LockScreen
        mode="unlock"
        onUnlocked={vi.fn()}
        biometricEnabled={false}
        onBiometricUnlock={onBiometricUnlock}
      />
    );
    expect(screen.queryByText("用指纹解锁")).not.toBeInTheDocument();
    // 给异步一次机会，确认确实没被调用
    await Promise.resolve();
    expect(onBiometricUnlock).not.toHaveBeenCalled();
  });
});
