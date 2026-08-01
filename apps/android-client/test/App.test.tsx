import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { buildSic1Invite, buildSic2Invite } from "@secureinchat/protocol";
import { App } from "../src/App";

function futureExpiry(): number {
  return Date.now() + 1000 * 60 * 60 * 24;
}

describe("App navigation", () => {
  it("starts on the splash screen with an invite code input", () => {
    render(<App />);
    expect(screen.getByLabelText("邀请码输入框")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "加入群聊" })).toBeInTheDocument();
  });

  it("navigates to the invite screen showing a valid-invite card for a well-formed SIC2 code", () => {
    render(<App />);
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: "group-1",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });

    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));

    expect(screen.getByText("确认加入")).toBeInTheDocument();
    expect(screen.getByText("邀请人：李阳")).toBeInTheDocument();
  });

  it("navigates to the invite screen showing an invalid-invite card for a malformed code", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: "not-a-real-invite-code" } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));

    expect(screen.getByText("邀请已失效")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "确认加入" })).not.toBeInTheDocument();
  });

  it("maps an expired invite specifically to the 'expired' reason message", () => {
    render(<App />);
    const expiredCode = buildSic2Invite({
      serverJoinCode: "X",
      groupId: "group-1",
      keyMaterialB64Url: "abc",
      epoch: 0,
      expiresAtMs: Date.now() - 1000,
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: expiredCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));

    expect(screen.getByText(/已过期或已被撤销/)).toBeInTheDocument();
  });

  it("going back from the invite screen returns to splash", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: "bad-code" } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    expect(screen.getByText("邀请已失效")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(screen.getByLabelText("邀请码输入框")).toBeInTheDocument();
  });

  it("confirming a valid invite navigates to the message list screen with the group visible", async () => {
    render(<App />);
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: "group-1",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入" }));

    expect(await screen.findByText("欢迎加入！")).toBeInTheDocument();
    expect(screen.getByText("同心同行")).toBeInTheDocument();
  });

  it("the message list screen's bottom nav switches tabs", async () => {
    render(<App />);
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: "group-1",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入" }));

    await screen.findByText("欢迎加入！"); // wait for the async join to complete and screen to switch (unique to the message-list screen; the invite screen also shows the group name)
    fireEvent.click(screen.getByText("我的"));
    expect(screen.getByText("我的页尚未接入")).toBeInTheDocument();
  });

  it("the invite-code submit button is disabled for empty input", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "加入群聊" })).toBeDisabled();
  });

  it("shows the loading label while the join (key derivation + storage) is in flight", async () => {
    render(<App />);
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: "group-1",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入" }));

    // Immediately after the click, before the async derivation resolves, the button
    // should already reflect the in-flight state (this is a real state transition,
    // not just a screen switch).
    expect(screen.getByText("正在加入...")).toBeInTheDocument();
    await screen.findByText("欢迎加入！");
  });

  it("shows a specific error message and stays on the invite screen for a SIC1 (no groupId) invite", async () => {
    render(<App />);
    const sic1Code = buildSic1Invite({ serverJoinCode: "ABCD", keyMaterialB64Url: "abc123" });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: sic1Code } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入" }));

    expect(await screen.findByText("这个邀请是旧版兼容格式，暂不支持加密入群")).toBeInTheDocument();
    // Must NOT have navigated to the message list on failure.
    expect(screen.queryByText("欢迎加入！")).not.toBeInTheDocument();
  });
});
