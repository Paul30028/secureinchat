import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageListScreen } from "../src/screens/MessageListScreen";
import type { TodayContent } from "../src/screens/TodayScreen";

function renderScreen(overrides: {
  screenSecurityEnabled?: boolean;
  onToggleScreenSecurity?: () => void;
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
