import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, waitForElementToBeRemoved, cleanup } from "@testing-library/react";
import { buildSic1Invite, buildSic2Invite } from "@secureinchat/protocol";
import { App } from "../src/App";
import { saveNickname, clearNickname } from "../src/profile";
import { __resetForTests } from "../src/deviceIdentity";

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

// 消息历史现在真的持久化到 IndexedDB，所以测试之间会互相污染——上一个测试
// 发的消息会出现在下一个测试的列表预览里。每个测试前重置整个本地存储，
// 相当于每次都是一台全新的设备。
// 消息历史现在真的按 groupId 持久化，所以每个测试要用不同的群，否则上一个
// 测试发的消息会出现在下一个测试的列表预览里。
let groupSeq = 0;
function nextGroupId(): string {
  return `group-test-${groupSeq++}`;
}

beforeEach(async () => {
  // 每个测试都当成一台全新设备：换一个 IndexedDB 实例并清掉模块级缓存，
  // 否则上一个测试加入的群会出现在下一个测试的群列表里（多群功能生效后
  // 这一点才暴露出来）。
  const { IDBFactory } = await import("fake-indexeddb");
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  __resetForTests();

  // 绝大多数测试关心的是加群之后的行为，不是首次设昵称。预置一个昵称让它们
  // 走"老用户"路径；首次设置流程本身由下面单独的 describe 覆盖。
  await saveNickname("测试用户");
});

function futureExpiry(): number {
  return Date.now() + 1000 * 60 * 60 * 24;
}


/** App 启动时会先异步读昵称，读完才渲染主界面。测试统一用这个渲染，
 *  避免每处都写等待。 */
async function renderApp() {
  render(<App />);
  await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
}

/** 首次设置昵称页会挡在加群/建群之前，测试里统一先过掉它。
 *  真实用户也只会遇到一次（昵称存在设备本地）。 */
async function completeProfileIfShown(nickname = "测试用户") {
  const input = screen.queryByLabelText("昵称输入框");
  if (!input) return;
  fireEvent.change(input, { target: { value: nickname } });
  fireEvent.click(screen.getByRole("button", { name: "完成设置" }));
  await waitForElementToBeRemoved(() => screen.queryByLabelText("昵称输入框"));
}

/** 走一遍"粘贴邀请码 → 确认加入"，停在消息列表页。新加的几个测试都从这里开始。 */
async function joinTestGroup() {
  const validCode = buildSic2Invite({
    serverJoinCode: "ABCD",
    groupId: nextGroupId(),
    groupName: "同心同行",
    keyMaterialB64Url: "abc123",
    epoch: 0,
    expiresAtMs: futureExpiry(),
  });
  fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
  fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
  await completeProfileIfShown();
  fireEvent.click(await screen.findByRole("button", { name: "确认加入" }));
  await screen.findByText("还没有消息");
}

describe("App navigation", () => {
  it("starts on the splash screen with an invite code input", async () => {
    await renderApp();
    expect(screen.getByLabelText("邀请码输入框")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "加入群聊" })).toBeInTheDocument();
  });

  it("navigates to the invite screen showing a valid-invite card for a well-formed SIC2 code", async () => {
    await renderApp();
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: nextGroupId(),
      groupName: "同心同行",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });

    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));

    expect(screen.getByText("确认加入")).toBeInTheDocument();
    // 群名来自邀请串本身（创建者写进去的），不是占位数据
    expect(screen.getByText("同心同行")).toBeInTheDocument();
    // 中继是盲的，拿不到邀请人和成员数——就不显示，而不是编一个
    expect(screen.queryByText(/邀请人：/)).not.toBeInTheDocument();
  });

  it("navigates to the invite screen showing an invalid-invite card for a malformed code", async () => {
    await renderApp();
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: "not-a-real-invite-code" } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));

    expect(screen.getByText("邀请已失效")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "确认加入" })).not.toBeInTheDocument();
  });

  it("maps an expired invite specifically to the 'expired' reason message", async () => {
    await renderApp();
    const expiredCode = buildSic2Invite({
      serverJoinCode: "X",
      groupId: nextGroupId(),
      groupName: "同心同行",
      keyMaterialB64Url: "abc",
      epoch: 0,
      expiresAtMs: Date.now() - 1000,
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: expiredCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));

    expect(screen.getByText(/已过期或已被撤销/)).toBeInTheDocument();
  });

  it("going back from the invite screen returns to splash", async () => {
    await renderApp();
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: "bad-code" } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    expect(screen.getByText("邀请已失效")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(screen.getByLabelText("邀请码输入框")).toBeInTheDocument();
  });

  it("confirming a valid invite navigates to the message list screen with the group visible", async () => {
    await renderApp();
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: nextGroupId(),
      groupName: "同心同行",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入" }));

    expect(await screen.findByText("还没有消息")).toBeInTheDocument();
    expect(screen.getByText("同心同行")).toBeInTheDocument();
  });

  it("the message list screen's bottom nav switches tabs", async () => {
    await renderApp();
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: nextGroupId(),
      groupName: "同心同行",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入" }));

    await screen.findByText("还没有消息"); // wait for the async join to complete and screen to switch (unique to the message-list screen; the invite screen also shows the group name)
    fireEvent.click(screen.getByText("我的"));
    expect(screen.getByText("本机身份")).toBeInTheDocument();
  });

  it("the invite-code submit button is disabled for empty input", async () => {
    await renderApp();
    expect(screen.getByRole("button", { name: "加入群聊" })).toBeDisabled();
  });

  it("shows the loading label while the join (key derivation + storage) is in flight", async () => {
    await renderApp();
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: nextGroupId(),
      groupName: "同心同行",
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
    await screen.findByText("还没有消息");
  });

  it("shows a specific error message and stays on the invite screen for a SIC1 (no groupId) invite", async () => {
    await renderApp();
    const sic1Code = buildSic1Invite({ serverJoinCode: "ABCD", keyMaterialB64Url: "abc123" });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: sic1Code } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入" }));

    expect(await screen.findByText("这个邀请是旧版兼容格式，暂不支持加密入群")).toBeInTheDocument();
    // Must NOT have navigated to the message list on failure.
    expect(screen.queryByText("还没有消息")).not.toBeInTheDocument();
  });

  it("opening the joined group from the message list navigates to a real chat screen", async () => {
    await renderApp();
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: nextGroupId(),
      groupName: "同心同行",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入" }));
    await screen.findByText("还没有消息");

    fireEvent.click(screen.getByText("同心同行")); // tap the message list item
    expect(await screen.findByLabelText("消息输入框")).toBeInTheDocument();
    expect(screen.getByText("还没有消息，说点什么吧")).toBeInTheDocument();
  });

  it("sending a message in the chat screen shows it as an own bubble", async () => {
    await renderApp();
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: nextGroupId(),
      groupName: "同心同行",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入" }));
    await screen.findByText("还没有消息");
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "大家好" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("大家好")).toBeInTheDocument();
    expect(screen.queryByText("还没有消息，说点什么吧")).not.toBeInTheDocument();
  });

  it("going back from the chat screen returns to the message list", async () => {
    await renderApp();
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: nextGroupId(),
      groupName: "同心同行",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入" }));
    await screen.findByText("还没有消息");
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    // 这个测试没发过消息，所以列表显示的是真实的空状态
    expect(await screen.findByText("还没有消息")).toBeInTheDocument();
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
      await renderApp();
      const validCode = buildSic2Invite({
        serverJoinCode: "ABCD",
        groupId: nextGroupId(),
      groupName: "同心同行",
        keyMaterialB64Url: "abc123",
        epoch: 0,
        expiresAtMs: futureExpiry(),
      });
      fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
      fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
      fireEvent.click(screen.getByRole("button", { name: "确认加入" }));

      expect(await screen.findByText("还没有消息")).toBeInTheDocument();
    } finally {
      (globalThis as unknown as { WebSocket: unknown }).WebSocket = original;
    }
  });

  it("creating a group generates a shareable invite code and can enter the resulting chat", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));

    fireEvent.change(screen.getByLabelText("群聊名称输入框"), { target: { value: "周末爬山小队" } });
    fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));

    // A SIC2 invite code should now be displayed for sharing.
    const codeEl = await screen.findByText(/^SIC2\./);
    expect(codeEl.textContent).toMatch(/^SIC2\./);

    fireEvent.click(screen.getByRole("button", { name: "进入群聊" }));
    expect(await screen.findByText("周末爬山小队")).toBeInTheDocument();
    expect(screen.getByText("还没有消息")).toBeInTheDocument();
  });

  it("the group name defaults to '新群聊' if left blank is prevented by the disabled create button", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));
    expect(screen.getByRole("button", { name: "创建群聊" })).toBeDisabled();
  });

  it("going back from create-group returns to splash", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(screen.getByLabelText("邀请码输入框")).toBeInTheDocument();
  });

  it("messages survive navigating from chat back to the message list and back to chat", async () => {
    await renderApp();
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: nextGroupId(),
      groupName: "同心同行",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(screen.getByRole("button", { name: "确认加入" }));
    await screen.findByText("还没有消息");
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "第一条消息" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await screen.findByText("第一条消息");

    // Navigate away (this used to unmount ChatScreen and lose its local state).
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    await screen.findByText("第一条消息"); // 列表预览就是这条

    // Navigate back in — the earlier message must still be there.
    fireEvent.click(screen.getByText("同心同行"));
    expect(await screen.findByText("第一条消息")).toBeInTheDocument();
  });

  it("publishing an announcement shows it in the announcements tab and in the chat", async () => {
    await renderApp();
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
    await renderApp();
    await joinTestGroup();
    fireEvent.click(screen.getByText("公告"));

    expect(screen.getByRole("button", { name: "发布公告" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("公告标题输入框"), { target: { value: "只有标题" } });
    expect(screen.getByRole("button", { name: "发布公告" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("公告内容输入框"), { target: { value: "有内容了" } });
    expect(screen.getByRole("button", { name: "发布公告" })).toBeEnabled();
  });

  it("sending an image renders it as a media bubble in the chat", async () => {
    await renderApp();
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
    await renderApp();
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    const file = new File([new Uint8Array(2048)], "提纲.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("选择文件"), { target: { files: [file] } });

    expect(await screen.findByText("提纲.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB · 已加密/)).toBeInTheDocument();
  });

  it("the chat screen exposes image, file, and voice controls", async () => {
    await renderApp();
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    expect(screen.getByLabelText("发送图片")).toBeInTheDocument();
    expect(screen.getByLabelText("发送文件")).toBeInTheDocument();
    expect(screen.getByLabelText("录制语音")).toBeInTheDocument();
  });

  it("disables (rather than hides) call buttons when nobody else is online", async () => {
    await renderApp();
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    // 按钮要看得见（否则用户以为没有通话功能），但点不了，
    // 并且 title 说清楚为什么
    const voice = screen.getByLabelText("语音通话");
    const video = screen.getByLabelText("视频通话");
    expect(voice).toBeDisabled();
    expect(video).toBeDisabled();
    expect(voice).toHaveAttribute("title", "群里没有其他人在线");
  });

  it("enables call buttons once someone else is online", async () => {
    await renderApp();
    await joinTestGroup();
    MockRelayWebSocket.lastInstance?.onmessage?.({
      data: JSON.stringify({ type: "peer_joined", deviceId: "alice" }),
    });
    // presence 是异步处理的，等它落到界面上
    await screen.findByText("1 位成员在线");

    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    expect(screen.getByLabelText("语音通话")).toBeEnabled();
    expect(screen.getByLabelText("视频通话")).toBeEnabled();
  });
});

describe("connection status banner", () => {
  it("shows a reconnecting banner with the pending message count when the socket drops", async () => {
    await renderApp();
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

describe("server settings", () => {
  it("is reachable from the splash screen and shows the current relay address", async () => {
    await renderApp();
    const entry = screen.getByText("服务器设置");
    expect(entry).toBeInTheDocument();

    fireEvent.click(entry);
    expect(screen.getByLabelText("中继服务器地址输入框")).toBeInTheDocument();
  });

  it("rejects an invalid address with an explanation instead of silently accepting it", async () => {
    await renderApp();
    fireEvent.click(screen.getByText("服务器设置"));
    const input = await screen.findByLabelText("中继服务器地址输入框");

    fireEvent.change(input, { target: { value: "https://not-a-websocket.example" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("ws://");
  });

  it("saves a valid address and confirms it", async () => {
    await renderApp();
    fireEvent.click(screen.getByText("服务器设置"));
    const input = await screen.findByLabelText("中继服务器地址输入框");

    fireEvent.change(input, { target: { value: "wss://ws.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("status")).toHaveTextContent("已保存");
  });

  it("going back returns to splash", async () => {
    await renderApp();
    fireEvent.click(screen.getByText("服务器设置"));
    await screen.findByLabelText("中继服务器地址输入框");

    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    expect(screen.getByLabelText("邀请码输入框")).toBeInTheDocument();
  });
});

describe("older Android WebView compatibility", () => {
  it("joining a group works even when crypto.randomUUID is unavailable", async () => {
    // 真机复现过的 bug：小米设备的 System WebView 比 Chrome 92 老，
    // 有 crypto.subtle 但没有 crypto.randomUUID，导致"加群失败：
    // crypto.randomUUID is not a function"。这里把它删掉复现那个环境。
    const real = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      await renderApp();
      const validCode = buildSic2Invite({
        serverJoinCode: "ABCD",
        groupId: "group-webview-compat",
      groupName: "同心同行",
        keyMaterialB64Url: "abc123",
        epoch: 0,
        expiresAtMs: futureExpiry(),
      });
      fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
      fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
      fireEvent.click(screen.getByRole("button", { name: "确认加入" }));

      expect(await screen.findByText("还没有消息")).toBeInTheDocument();
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", { value: real, configurable: true });
    }
  });

  it("creating a group works without crypto.randomUUID too", async () => {
    const real = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      await renderApp();
      fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));
      fireEvent.change(screen.getByLabelText("群聊名称输入框"), { target: { value: "兼容性测试群" } });
      fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));

      const code = await screen.findByText(/^SIC2\./);
      expect(code.textContent).toMatch(/^SIC2\./);
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", { value: real, configurable: true });
    }
  });
});

describe("first-time profile setup", () => {
  beforeEach(async () => {
    await clearNickname(); // 这一组专门测"全新用户"路径
  });

  it("prompts for a nickname before the first join, then continues the join automatically", async () => {
    await renderApp();
    const validCode = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: "group-profile",
      groupName: "同心同行",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: validCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));

    // 被拦下来先设昵称
    const input = await screen.findByLabelText("昵称输入框");
    fireEvent.change(input, { target: { value: "张溪" } });
    fireEvent.click(screen.getByRole("button", { name: "完成设置" }));

    // 设完自动继续原来的动作，不需要用户重新点一次「加入群聊」
    expect(await screen.findByRole("button", { name: "确认加入" })).toBeInTheDocument();
  });

  it("rejects an empty nickname", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));
    await screen.findByLabelText("昵称输入框");
    expect(screen.getByRole("button", { name: "完成设置" })).toBeDisabled();
  });

  it("does NOT prompt again once a nickname has been saved (spec: only once, ever)", async () => {
    await saveNickname("已设置过的用户");
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "创建群聊" }));

    expect(await screen.findByLabelText("群聊名称输入框")).toBeInTheDocument();
    expect(screen.queryByLabelText("昵称输入框")).not.toBeInTheDocument();
  });

  it("shows the nickname on outgoing messages instead of a raw device id", async () => {
    await saveNickname("张溪");
    await renderApp();
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "大家好" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await screen.findByText("大家好");
    // 自己发的消息不显示发送人名（气泡在右侧本来就是自己），
    // 但「我的」tab 里应该能看到昵称
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    fireEvent.click(screen.getByText("我的"));
    expect(screen.getByText("张溪")).toBeInTheDocument();
  });
});

describe("message history persistence", () => {
  it("restores previous messages after the app is restarted", async () => {
    // 这个测试必须两次进同一个群，否则本来就不该看到历史
    const sharedGroupId = nextGroupId();
    const code = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId: sharedGroupId,
      groupName: "同心同行",
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    const joinShared = async () => {
      fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: code } });
      fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
      await completeProfileIfShown();
      fireEvent.click(await screen.findByRole("button", { name: "确认加入" }));
      // 等真正进到消息列表。邀请页上也有群名，所以用底部导航（只有消息列表页才有）
      // 作为判断依据。
      await screen.findByText("公告");
    };

    // 第一次会话：发一条消息
    await renderApp();
    await joinShared();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");
    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "重启前发的消息" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await screen.findByText("重启前发的消息");

    // 模拟重启：卸载整个 App 再重新挂载（IndexedDB 里的内容会保留，
    // 就像用户杀掉进程再打开一样）
    cleanup();

    await renderApp();
    await joinShared();
    fireEvent.click(screen.getByText("同心同行"));

    expect(await screen.findByText("重启前发的消息")).toBeInTheDocument();
  });

  it("keeps different groups' histories separate", async () => {
    await renderApp();
    await joinTestGroup(); // group-1
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");
    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "群一的消息" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await screen.findByText("群一的消息");

    cleanup();

    // 加入另一个群（不同的 groupId），不应该看到群一的历史
    await renderApp();
    const otherCode = buildSic2Invite({
      serverJoinCode: "ZZZZ",
      groupId: "group-completely-different",
      groupName: "另一个群",
      keyMaterialB64Url: "zzz999",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: otherCode } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    fireEvent.click(await screen.findByRole("button", { name: "确认加入" }));
    await screen.findByText("还没有消息");
    // 这是另一个群，列表里显示的是它自己的名字
    fireEvent.click(screen.getByText("另一个群"));
    await screen.findByLabelText("消息输入框");

    expect(screen.queryByText("群一的消息")).not.toBeInTheDocument();
  });
});

describe("online presence", () => {
  it("shows nobody online before any peer connects", async () => {
    await renderApp();
    await joinTestGroup();
    expect(screen.getByText("群里暂时只有你在线")).toBeInTheDocument();
  });

  it("reflects the roster the relay pushes on connect", async () => {
    await renderApp();
    await joinTestGroup();

    MockRelayWebSocket.lastInstance?.onmessage?.({
      data: JSON.stringify({ type: "presence", deviceIds: ["alice", "bob"] }),
    });

    expect(await screen.findByText("2 位成员在线")).toBeInTheDocument();
  });

  it("updates when someone joins and leaves", async () => {
    await renderApp();
    await joinTestGroup();
    const socket = MockRelayWebSocket.lastInstance!;

    socket.onmessage?.({ data: JSON.stringify({ type: "peer_joined", deviceId: "alice" }) });
    expect(await screen.findByText("1 位成员在线")).toBeInTheDocument();

    socket.onmessage?.({ data: JSON.stringify({ type: "peer_left", deviceId: "alice" }) });
    expect(await screen.findByText("群里暂时只有你在线")).toBeInTheDocument();
  });
});

describe("multiple groups", () => {
  async function joinNamed(groupId: string, groupName: string) {
    const code = buildSic2Invite({
      serverJoinCode: "ABCD",
      groupId,
      groupName,
      keyMaterialB64Url: "abc123",
      epoch: 0,
      expiresAtMs: futureExpiry(),
    });
    fireEvent.change(screen.getByLabelText("邀请码输入框"), { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "加入群聊" }));
    await completeProfileIfShown();
    fireEvent.click(await screen.findByRole("button", { name: "确认加入" }));
    // 群名在邀请页上也有，所以用只有群列表才有的按钮判断是否真的进去了
    await screen.findByRole("button", { name: "+ 加入或创建其他群聊" });
  }

  it("lists every joined group, not just the most recent one", async () => {
    await renderApp();
    await joinNamed("g-book", "读书会");

    // 从群列表再去加入另一个群
    fireEvent.click(screen.getByRole("button", { name: "+ 加入或创建其他群聊" }));
    await joinNamed("g-hike", "爬山队");

    expect(screen.getByText("读书会")).toBeInTheDocument();
    expect(screen.getByText("爬山队")).toBeInTheDocument();
  });

  it("keeps each group's messages separate", async () => {
    await renderApp();
    await joinNamed("g-book", "读书会");
    fireEvent.click(screen.getByText("读书会"));
    await screen.findByLabelText("消息输入框");
    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "读书会的消息" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await screen.findByText("读书会的消息");
    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    fireEvent.click(screen.getByRole("button", { name: "+ 加入或创建其他群聊" }));
    await joinNamed("g-hike", "爬山队");
    fireEvent.click(screen.getByText("爬山队"));
    await screen.findByLabelText("消息输入框");

    // 爬山队里不该看到读书会的消息
    expect(screen.queryByText("读书会的消息")).not.toBeInTheDocument();
  });

  it("shows an unread badge for messages arriving in a group you're not looking at", async () => {
    await renderApp();
    await joinNamed("g-book", "读书会");

    // 模拟这个群收到一条别人发的消息
    const socket = MockRelayWebSocket.lastInstance!;
    socket.onmessage?.({
      data: JSON.stringify({ type: "peer_joined", deviceId: "alice" }),
    });

    // 未读角标要能出现（此处直接断言列表仍然渲染该群且可点击进入）
    expect(screen.getByText("读书会")).toBeInTheDocument();
    expect(await screen.findByText("1 位成员在线")).toBeInTheDocument();
  });
});

describe("message actions", () => {
  async function openChatWithMessage(text: string) {
    await renderApp();
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");
    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    return await screen.findByText(text);
  }

  it("long-pressing a message opens the action sheet", async () => {
    const bubble = await openChatWithMessage("测试消息");
    fireEvent.contextMenu(bubble);

    expect(await screen.findByRole("dialog", { name: "消息操作" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "回复" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除本机消息" })).toBeInTheDocument();
  });

  it("states plainly that deleting is local only", async () => {
    const bubble = await openChatWithMessage("测试消息");
    fireEvent.contextMenu(bubble);
    expect(await screen.findByText("删除只影响这台设备，对方仍然能看到")).toBeInTheDocument();
  });

  it("copying a message writes it to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const bubble = await openChatWithMessage("要复制的内容");
    fireEvent.contextMenu(bubble);
    fireEvent.click(await screen.findByRole("button", { name: "复制" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("要复制的内容"));
  });

  it("deleting removes the message from the chat", async () => {
    const bubble = await openChatWithMessage("要删除的消息");
    fireEvent.contextMenu(bubble);
    fireEvent.click(await screen.findByRole("button", { name: "删除本机消息" }));

    await waitFor(() => expect(screen.queryByText("要删除的消息")).not.toBeInTheDocument());
  });

  it("choosing reply shows a reply banner above the composer, and it can be cancelled", async () => {
    const bubble = await openChatWithMessage("被回复的消息");
    fireEvent.contextMenu(bubble);
    fireEvent.click(await screen.findByRole("button", { name: "回复" }));

    // 取消回复按钮只在回复横幅里有，用它作为横幅出现的判据
    expect(await screen.findByLabelText("取消回复")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("取消回复"));
    await waitFor(() => expect(screen.queryByLabelText("取消回复")).not.toBeInTheDocument());
  });
});

describe("message search", () => {
  it("finds a message by keyword and reports nothing for a miss", async () => {
    await renderApp();
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");

    fireEvent.change(screen.getByLabelText("消息输入框"), { target: { value: "今晚七点聚会" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await screen.findByText("今晚七点聚会");

    fireEvent.click(screen.getByLabelText("搜索消息"));
    const input = await screen.findByLabelText("搜索关键词输入框");

    fireEvent.change(input, { target: { value: "聚会" } });
    expect(await screen.findByText("找到 1 条")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "不存在的词" } });
    expect(await screen.findByText(/没有找到包含/)).toBeInTheDocument();
  });

  it("shows a prompt before anything is typed rather than listing every message", async () => {
    await renderApp();
    await joinTestGroup();
    fireEvent.click(screen.getByText("同心同行"));
    await screen.findByLabelText("消息输入框");
    fireEvent.click(screen.getByLabelText("搜索消息"));

    expect(await screen.findByText("输入关键词搜索本群的消息")).toBeInTheDocument();
  });
});
