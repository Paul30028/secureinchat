import { describe, expect, it, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { buildSic1Invite, buildSic2Invite } from "@secureinchat/protocol";
import { App } from "../src/App";

/**
 * jsdom 没有真的网络，App 里的 RelayClient 连不上真的服务器——这里用一个假的
 * WebSocket 模拟"服务端行为合规"的握手响应（下发 auth_challenge，收到
 * register_device/auth_response 就回 auth_ok），这样才能测到"确认加入"之后
 * 真正连接成功、进入消息列表这条链路。真正的协议正确性（握手细节、加解密）
 * 已经在 packages/chat-core 的跨进程集成测试里用真实 Python relay 测过了，
 * 这里只关心 App 层面的状态流转对不对。
 */
class MockRelayWebSocket {
  static lastInstance: MockRelayWebSocket | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(_url: string) {
    MockRelayWebSocket.lastInstance = this;
    setTimeout(() => {
      this.onmessage?.({ data: JSON.stringify({ type: "auth_challenge", nonce: "test-nonce" }) });
    }, 0);
  }

  send(raw: string) {
    const frame = JSON.parse(raw);
    if (frame.type === "register_device" || frame.type === "auth_response") {
      setTimeout(() => {
        this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
      }, 0);
    }
  }

  close() {}
}

beforeAll(() => {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockRelayWebSocket;
});

function futureExpiry(): number {
  return Date.now() + 1000 * 60 * 60 * 24;
}

/** 走一遍"粘贴邀请码 → 确认加入"，停在消息列表页。新加的几个测试都从这里开始。 */
async function joinTestGroup() {
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
  await screen.findByText("欢迎加入！");
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
    expect(screen.getByText("本机身份")).toBeInTheDocument();
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

  it("opening the joined group from the message list navigates to a real chat screen", async () => {
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
    await screen.findByText("欢迎加入！");

    fireEvent.click(screen.getByText("同心同行")); // tap the message list item
    expect(await screen.findByLabelText("消息输入框")).toBeInTheDocument();
    expect(screen.getByText("还没有消息，说点什么吧")).toBeInTheDocument();
  });

  it("sending a message in the chat screen shows it as an own bubble", async () => {
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
    await screen.findByText("欢迎加入！");
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "大家好" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("大家好")).toBeInTheDocument();
    expect(screen.queryByText("还没有消息，说点什么吧")).not.toBeInTheDocument();
  });

  it("going back from the chat screen returns to the message list", async () => {
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
    await screen.findByText("欢迎加入！");
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(await screen.findByText("欢迎加入！")).toBeInTheDocument();
  });

  it("falls back to authenticate when register_device is rejected as already-registered", async () => {
    // register_device always fails as "already registered"; auth_response always succeeds.
    // This proves App retries with the other auth mode instead of just failing outright —
    // real scenario: same persisted device identity reconnecting while the relay
    // process (and its in-memory DeviceRegistry) is still up from a previous connection.
    class AlreadyRegisteredThenOkWebSocket {
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;
      constructor(_url: string) {
        setTimeout(() => {
          this.onmessage?.({ data: JSON.stringify({ type: "auth_challenge", nonce: "test-nonce" }) });
        }, 0);
      }
      send(raw: string) {
        const frame = JSON.parse(raw);
        if (frame.type === "register_device") {
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({ type: "auth_failed", reason: "device already registered" }),
            });
          }, 0);
        } else if (frame.type === "auth_response") {
          setTimeout(() => {
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          }, 0);
        }
      }
      close() {}
    }

    const original = (globalThis as unknown as { WebSocket: unknown }).WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = AlreadyRegisteredThenOkWebSocket;
    try {
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
    } finally {
      (globalThis as unknown as { WebSocket: unknown }).WebSocket = original;
    }
  });

  it("creating a group generates a shareable invite code and can enter the resulting chat", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));

    fireEvent.change(screen.getByLabelText("群聊名称输入框"), { target: { value: "周末爬山小队" } });
    fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));

    // A SIC2 invite code should now be displayed for sharing.
    const codeEl = await screen.findByText(/^SIC2\./);
    expect(codeEl.textContent).toMatch(/^SIC2\./);

    fireEvent.click(screen.getByRole("button", { name: "进入群聊" }));
    expect(await screen.findByText("周末爬山小队")).toBeInTheDocument();
    expect(screen.getByText("欢迎加入！")).toBeInTheDocument();
  });

  it("the group name defaults to '新群聊' if left blank is prevented by the disabled create button", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));
    expect(screen.getByRole("button", { name: "创建群聊" })).toBeDisabled();
  });

  it("going back from create-group returns to splash", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(screen.getByLabelText("邀请码输入框")).toBeInTheDocument();
  });

  it("messages survive navigating from chat back to the message list and back to chat", async () => {
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
    await screen.findByText("欢迎加入！");
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "第一条消息" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await screen.findByText("第一条消息");

    // Navigate away (this used to unmount ChatScreen and lose its local state).
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    await screen.findByText("欢迎加入！");

    // Navigate back in — the earlier message must still be there.
    fireEvent.click(screen.getByText("同心同行"));
    expect(await screen.findByText("第一条消息")).toBeInTheDocument();
  });

  it("publishing an announcement shows it in the announcements tab and in the chat", async () => {
    render(<App />);
    await joinTestGroup();

    fireEvent.click(screen.getByText("公告"));
    expect(screen.getByText("还没有公告")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("公告标题输入框"), { target: { value: "每日宣言" } });
    fireEvent.change(screen.getByLabelText("公告内容输入框"), { target: { value: "今晚七点线上交流" } });
    fireEvent.click(screen.getByRole("button", { name: "发布公告" }));

    expect(await screen.findByText("每日宣言")).toBeInTheDocument();
    expect(screen.getByText("今晚七点线上交流")).toBeInTheDocument();

    // It should also appear at the top of the chat screen.
    fireEvent.click(screen.getByText("消息"));
    fireEvent.click(screen.getByText("同心同行"));
    expect(await screen.findByText("每日宣言")).toBeInTheDocument();
  });

  it("the publish button is disabled until both title and body are filled in", async () => {
    render(<App />);
    await joinTestGroup();
    fireEvent.click(screen.getByText("公告"));

    expect(screen.getByRole("button", { name: "发布公告" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("公告标题输入框"), { target: { value: "只有标题" } });
    expect(screen.getByRole("button", { name: "发布公告" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("公告内容输入框"), { target: { value: "有内容了" } });
    expect(screen.getByRole("button", { name: "发布公告" })).toBeEnabled();
  });

  it("sending an image renders it as a media bubble in the chat", async () => {
    render(<App />);
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    const file = new File([new Uint8Array([1, 2, 3, 4])], "photo.jpg", { type: "image/jpeg" });
    const input = screen.getByLabelText("选择图片");
    fireEvent.change(input, { target: { files: [file] } });

    const img = (await screen.findByAltText("photo.jpg")) as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
  });

  it("sending a generic file renders a downloadable file bubble", async () => {
    render(<App />);
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    const file = new File([new Uint8Array(2048)], "提纲.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("选择文件"), { target: { files: [file] } });

    expect(await screen.findByText("提纲.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB · 已加密/)).toBeInTheDocument();
  });

  it("the chat screen exposes image, file, and voice controls", async () => {
    render(<App />);
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    expect(screen.getByLabelText("发送图片")).toBeInTheDocument();
    expect(screen.getByLabelText("发送文件")).toBeInTheDocument();
    expect(screen.getByLabelText("录制语音")).toBeInTheDocument();
  });

  it("hides call buttons until a peer is known (nobody to call yet)", async () => {
    render(<App />);
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    // No message has been received from anyone, so there's no known peer —
    // showing a call button here would be a button that can't do anything.
    expect(screen.queryByLabelText("语音通话")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("视频通话")).not.toBeInTheDocument();
  });
});

describe("connection status banner", () => {
  it("shows a reconnecting banner with the pending message count when the socket drops", async () => {
    render(<App />);
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    // 正常连接时不该有横幅打扰用户
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // 模拟掉线：触发 mock socket 的 onclose
    const socket = MockRelayWebSocket.lastInstance;
    expect(socket).toBeDefined();
    socket!.onclose?.();

    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "断线时发的" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    const banner = await screen.findByRole("status");
    expect(banner.textContent).toContain("正在自动重连");
    expect(banner.textContent).toContain("1 条消息等待发送");
  });
});
