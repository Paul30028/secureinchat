import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GroupInviteScreen } from "../src/screens/GroupInviteScreen";

describe("GroupInviteScreen", () => {
  it("渲染出群名和边界说明", () => {
    render(
      <GroupInviteScreen
        groupName="测试群"
        inviteCode="SIC2:test-invite-code"
        onCopy={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "邀请新成员" })).toBeInTheDocument();
    expect(screen.getByText("测试群")).toBeInTheDocument();
    expect(screen.getByText(/拿到这张卡片的人都能加入本群/)).toBeInTheDocument();
    expect(screen.getByText(/旧卡片随之失效/)).toBeInTheDocument();
  });

  it("点复制调用 onCopy", () => {
    const onCopy = vi.fn();
    render(
      <GroupInviteScreen
        groupName="测试群"
        inviteCode="SIC2:test-invite-code"
        onCopy={onCopy}
        onBack={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("复制邀请码"));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("生成失败时只显示错误，不显示邀请卡片", () => {
    render(
      <GroupInviteScreen
        error="找不到这个群的密钥材料"
        onCopy={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText("找不到这个群的密钥材料")).toBeInTheDocument();
    expect(screen.queryByText("复制邀请码")).not.toBeInTheDocument();
  });
});
