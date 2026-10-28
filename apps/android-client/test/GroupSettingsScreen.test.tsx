import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GroupSettingsScreen, disappearLabel } from "../src/screens/GroupSettingsScreen";

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
describe("GroupSettingsScreen 消息定时消失", () => {
  function renderWithDisappear(overrides: {
    disappearAfterMs?: number;
    onSetDisappearAfter?: (ms: number) => void;
  } = {}) {
    const onSetDisappearAfter = overrides.onSetDisappearAfter ?? vi.fn();
    render(
      <GroupSettingsScreen
        groupName="测试群"
        memberCount={1}
        onRename={vi.fn().mockResolvedValue(undefined)}
        onLeave={vi.fn().mockResolvedValue(undefined)}
        onBack={vi.fn()}
        disappearAfterMs={overrides.disappearAfterMs ?? 0}
        onSetDisappearAfter={onSetDisappearAfter}
      />
    );
    return { onSetDisappearAfter };
  }

  it("显示五个选项", () => {
    renderWithDisappear();
    for (const label of ["关闭", "5 分钟", "1 小时", "1 天", "7 天"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("点 5 分钟调用 onSetDisappearAfter(300000)", () => {
    const { onSetDisappearAfter } = renderWithDisappear();
    fireEvent.click(screen.getByText("5 分钟"));
    expect(onSetDisappearAfter).toHaveBeenCalledWith(300_000);
  });

  it("点关闭调用 onSetDisappearAfter(0)", () => {
    const { onSetDisappearAfter } = renderWithDisappear({ disappearAfterMs: 300_000 });
    fireEvent.click(screen.getByText("关闭"));
    expect(onSetDisappearAfter).toHaveBeenCalledWith(0);
  });

  it("当前值对应的按钮 aria-pressed 为 true", () => {
    renderWithDisappear({ disappearAfterMs: 86_400_000 });
    const dayButton = screen.getByText("1 天").closest("button");
    expect(dayButton?.getAttribute("aria-pressed")).toBe("true");
    const fiveMinButton = screen.getByText("5 分钟").closest("button");
    expect(fiveMinButton?.getAttribute("aria-pressed")).toBe("false");
  });

  it("不传 onSetDisappearAfter 时不显示这一段", () => {
    render(
      <GroupSettingsScreen
        groupName="测试群"
        memberCount={1}
        onRename={vi.fn().mockResolvedValue(undefined)}
        onLeave={vi.fn().mockResolvedValue(undefined)}
        onBack={vi.fn()}
      />
    );
    expect(screen.queryByText("消息定时消失")).not.toBeInTheDocument();
  });

  it("disappearLabel 映射正确", () => {
    expect(disappearLabel(0)).toBe("关闭");
    expect(disappearLabel(300_000)).toBe("5 分钟");
    expect(disappearLabel(3_600_000)).toBe("1 小时");
    expect(disappearLabel(86_400_000)).toBe("1 天");
    expect(disappearLabel(604_800_000)).toBe("7 天");
  });
});
