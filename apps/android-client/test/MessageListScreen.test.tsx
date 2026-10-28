import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageListScreen } from "../src/screens/MessageListScreen";
import type { TodayContent } from "../src/screens/TodayScreen";

function renderScreen(overrides: {
  screenSecurityEnabled?: boolean;
  onToggleScreenSecurity?: () => void;
  biometricEnabled?: boolean;
  onToggleBiometric?: () => void;
  lockEnabled?: boolean;
} = {}) {
  const onToggleScreenSecurity = overrides.onToggleScreenSecurity ?? vi.fn();
  const props = {
    groups: [],
    onOpenGroup: vi.fn(),
    onOpenGroupSettings: vi.fn(),
    onJoinAnotherGroup: vi.fn(),
    todayContent: {} as TodayContent,
    isAdmin: false,
    onOpenAdmin: vi.fn(),
    onAdminUnlocked: vi.fn(),
    onOpenAdminRecovery: vi.fn(),
    onOpenLockSetup: vi.fn(),
    onOpenDiagnostics: vi.fn(),
    onOpenDevices: vi.fn(),
    onOpenEditProfile: vi.fn(),
    deviceId: "device-1",
    nickname: "测试昵称",
    onOpenServerSettings: vi.fn(),
    relayUrl: "wss://relay.example",
    initialTab: "me" as const,
    screenSecurityEnabled: overrides.screenSecurityEnabled ?? false,
    onToggleScreenSecurity,
    biometricEnabled: overrides.biometricEnabled,
    onToggleBiometric: overrides.onToggleBiometric,
    lockEnabled: overrides.lockEnabled,
  };
  render(<MessageListScreen {...props} />);
  return { onToggleScreenSecurity };
}

describe("MessageListScreen 截屏保护开关", () => {
  it("点按「截屏保护」触发 onToggleScreenSecurity", () => {
    const { onToggleScreenSecurity } = renderScreen();
    const button = screen.getByText("截屏保护").closest("button");
    expect(button).not.toBeNull();
    fireEvent.click(button as HTMLButtonElement);
    expect(onToggleScreenSecurity).toHaveBeenCalledTimes(1);
  });

  it("关闭时显示关闭说明", () => {
    renderScreen({ screenSecurityEnabled: false });
    expect(screen.getByText("已关闭：开启后无法截图转发邀请卡片")).toBeInTheDocument();
  });

  it("开启时显示开启说明", () => {
    renderScreen({ screenSecurityEnabled: true });
    expect(
      screen.getByText("已开启：本应用界面无法截屏或录屏，最近任务里显示空白")
    ).toBeInTheDocument();
  });
});

describe("MessageListScreen 指纹/面部解锁开关", () => {
  it("不传 onToggleBiometric 时没有这一行", () => {
    renderScreen();
    expect(screen.queryByText("用指纹或面部解锁")).not.toBeInTheDocument();
  });

  it("传入且应用锁已启用时，点击调用 onToggleBiometric", () => {
    const onToggleBiometric = vi.fn();
    renderScreen({ onToggleBiometric, lockEnabled: true, biometricEnabled: false });
    const button = screen.getByText("用指纹或面部解锁").closest("button");
    expect(button).not.toBeNull();
    fireEvent.click(button as HTMLButtonElement);
    expect(onToggleBiometric).toHaveBeenCalledTimes(1);
  });

  it("开启时显示边界说明", () => {
    renderScreen({ onToggleBiometric: vi.fn(), lockEnabled: true, biometricEnabled: true });
    expect(
      screen.getByText("已开启：指纹或面部只用于在本机解开应用锁；没有 PIN 时不能单独使用。")
    ).toBeInTheDocument();
  });

  it("关闭时显示关闭说明", () => {
    renderScreen({ onToggleBiometric: vi.fn(), lockEnabled: true, biometricEnabled: false });
    expect(
      screen.getByText("已关闭：开启后可用指纹或面部解锁应用锁，PIN 始终可用")
    ).toBeInTheDocument();
  });

  it("未启用应用锁时点击引导去设置应用密码，不调用 onToggleBiometric", () => {
    const onToggleBiometric = vi.fn();
    renderScreen({ onToggleBiometric, lockEnabled: false, biometricEnabled: false });
    expect(
      screen.getByText("先设置应用密码，才能开启指纹或面部解锁")
    ).toBeInTheDocument();
    const button = screen.getByText("用指纹或面部解锁").closest("button");
    fireEvent.click(button as HTMLButtonElement);
    expect(onToggleBiometric).not.toHaveBeenCalled();
  });
});
