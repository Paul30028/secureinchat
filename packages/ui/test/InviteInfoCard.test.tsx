import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InviteInfoCard, type InviteInfo } from "../src/components/InviteInfoCard";

const validInvite: InviteInfo = {
  status: "valid",
  groupName: "同心同行",
  memberCount: 4,
  inviterName: "李阳",
  expiryLabel: "有效期剩 2 天 18 小时",
};

describe("InviteInfoCard — valid invite", () => {
  it("shows group name, member count, and inviter", () => {
    render(<InviteInfoCard invite={validInvite} onConfirm={() => {}} />);
    expect(screen.getByText("同心同行")).toBeInTheDocument();
    expect(screen.getByText("4人 · 邀请制加密群聊")).toBeInTheDocument();
    expect(screen.getByText("邀请人：李阳")).toBeInTheDocument();
  });

  it("shows the formatted expiry label without computing its own countdown", () => {
    render(<InviteInfoCard invite={validInvite} onConfirm={() => {}} />);
    expect(screen.getByText(/有效期剩 2 天 18 小时/)).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(<InviteInfoCard invite={validInvite} onConfirm={onConfirm} />);
    screen.getByRole("button", { name: "确认加入" }).click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables the button and changes label while confirming", () => {
    render(<InviteInfoCard invite={validInvite} onConfirm={() => {}} isConfirming />);
    const btn = screen.getByRole("button", { name: "正在加入..." });
    expect(btn).toBeDisabled();
  });

  it("the confirm button meets the 48dp minimum touch target", () => {
    render(<InviteInfoCard invite={validInvite} onConfirm={() => {}} />);
    expect(screen.getByRole("button", { name: "确认加入" }).style.minHeight).toBe("48px");
  });
});

describe("InviteInfoCard — invalid invite", () => {
  it("shows the failure message and does NOT render a confirm button", () => {
    render(<InviteInfoCard invite={{ status: "invalid", reason: "expired" }} onConfirm={() => {}} />);
    expect(screen.getByText("邀请已失效")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "确认加入" })).not.toBeInTheDocument();
  });

  it.each([
    ["expired", /已过期或已被撤销/],
    ["revoked", /已被撤销/],
    ["exhausted", /可用次数已用尽/],
    ["malformed", /格式不正确/],
  ] as const)("shows the correct message for reason=%s", (reason, expectedText) => {
    render(<InviteInfoCard invite={{ status: "invalid", reason }} onConfirm={() => {}} />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it("uses role=alert so assistive tech announces the failure", () => {
    render(<InviteInfoCard invite={{ status: "invalid", reason: "expired" }} onConfirm={() => {}} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
