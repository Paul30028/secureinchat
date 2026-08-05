import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InviteShareCard } from "../src/components/InviteShareCard";

const CODE = "SIC2.eyJ2IjoyLCJzamMiOiJBQkNEIn0";

describe("InviteShareCard", () => {
  it("shows the group name and the full invite code", async () => {
    render(<InviteShareCard groupName="读书会" inviteCode={CODE} onCopy={() => {}} />);
    expect(screen.getByText("读书会")).toBeInTheDocument();
    expect(screen.getByText(CODE)).toBeInTheDocument();
  });

  it("renders a QR code for the invite", async () => {
    render(<InviteShareCard groupName="读书会" inviteCode={CODE} onCopy={() => {}} />);
    const holder = screen.getByLabelText("邀请二维码");
    // 二维码是异步生成的
    await waitFor(() => expect(holder.querySelector("svg")).not.toBeNull());
  });

  it("shows the expiry label when given, and omits the line entirely when not", async () => {
    const { unmount } = render(
      <InviteShareCard groupName="读书会" inviteCode={CODE} expiryLabel="有效期剩 2 天" onCopy={() => {}} />
    );
    expect(screen.getByText(/有效期剩 2 天/)).toBeInTheDocument();
    unmount();

    render(<InviteShareCard groupName="读书会" inviteCode={CODE} onCopy={() => {}} />);
    expect(screen.queryByText(/有效期/)).not.toBeInTheDocument();
  });

  it("calls onCopy and confirms visually", async () => {
    const onCopy = vi.fn();
    render(<InviteShareCard groupName="读书会" inviteCode={CODE} onCopy={onCopy} />);
    fireEvent.click(screen.getByRole("button", { name: "复制邀请码" }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "已复制" })).toBeInTheDocument();
  });

  it("warns that whoever holds the code can decrypt the group", () => {
    render(<InviteShareCard groupName="读书会" inviteCode={CODE} onCopy={() => {}} />);
    expect(screen.getByText(/拿到这串邀请码的人就能加入并解密群消息/)).toBeInTheDocument();
  });

  it("meets the 48dp minimum touch target on the copy button", () => {
    render(<InviteShareCard groupName="读书会" inviteCode={CODE} onCopy={() => {}} />);
    expect(screen.getByRole("button", { name: "复制邀请码" }).style.minHeight).toBe("48px");
  });

  it("still shows the invite code if QR generation fails", async () => {
    // 传一个超长到无法编码的内容，迫使 qrcode 抛错
    const huge = "SIC2." + "x".repeat(10_000);
    render(<InviteShareCard groupName="读书会" inviteCode={huge} onCopy={() => {}} />);

    expect(await screen.findByText(/二维码生成失败/)).toBeInTheDocument();
    expect(screen.getByText(huge)).toBeInTheDocument();
  });
});
