import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GroupSettingsScreen } from "../src/screens/GroupSettingsScreen";

function renderScreen(overrides: { onShowInvite?: () => void } = {}) {
  const onShowInvite = overrides.onShowInvite;
  render(
    <GroupSettingsScreen
      groupName="测试群"
      memberCount={3}
      onRename={vi.fn().mockResolvedValue(undefined)}
      onLeave={vi.fn().mockResolvedValue(undefined)}
      onBack={vi.fn()}
      {...(onShowInvite ? { onShowInvite } : {})}
    />
  );
}

describe("GroupSettingsScreen 邀请新成员", () => {
  it("不传 onShowInvite 时没有这一行", () => {
    renderScreen();
    expect(screen.queryByText("邀请新成员")).not.toBeInTheDocument();
  });

  it("传入时显示，点击调用 onShowInvite", () => {
    const onShowInvite = vi.fn();
    renderScreen({ onShowInvite });
    const button = screen.getByText("邀请新成员").closest("button");
    expect(button).not.toBeNull();
    fireEvent.click(button as HTMLButtonElement);
    expect(onShowInvite).toHaveBeenCalledTimes(1);
  });
});
