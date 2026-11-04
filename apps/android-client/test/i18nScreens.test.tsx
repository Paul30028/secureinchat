/**
 * K6：英文和西班牙语界面里不应该出现任何中文（漏迁移的文字会以中文回退的形式露出来）。
 * 只检查这些界面自己的文字；测试数据里不放中文。
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { App } from "../src/App";
import { setLocale, type Locale } from "../src/i18n";
import { __resetForTests } from "../src/deviceIdentity";
import { disableLock } from "../src/appLock";
import { saveNickname, clearNickname } from "../src/profile";
import { BackupScreen } from "../src/screens/BackupScreen";
import { GroupSettingsScreen } from "../src/screens/GroupSettingsScreen";
import { LockScreen } from "../src/screens/LockScreen";
import { JoinGroupScreen } from "../src/screens/JoinGroupScreen";
import { CreateGroupScreen } from "../src/screens/CreateGroupScreen";
import { ConnectionDiagnosticsScreen } from "../src/screens/ConnectionDiagnosticsScreen";
import { KeyUnavailableScreen } from "../src/screens/KeyUnavailableScreen";
import { AdminPublishScreen } from "../src/screens/AdminPublishScreen";
import { ConnectedDevicesScreen } from "../src/screens/ConnectedDevicesScreen";
import { ServerSettingsScreen } from "../src/screens/ServerSettingsScreen";
import { ProfileSetupScreen } from "../src/screens/ProfileSetupScreen";
import { EMPTY_LATENCY_STATS } from "@secureinchat/chat-core";

const CJK = /[　-〿一-鿿＀-￯]/;

/** 页面上所有可见文字和无障碍标签、占位符里的中文片段 */
function chineseOnPage(): string[] {
  const found: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent ?? "";
    if (CJK.test(text)) found.push(text.trim());
  }
  for (const el of document.body.querySelectorAll("*")) {
    for (const attr of ["aria-label", "placeholder", "title", "alt"]) {
      const v = el.getAttribute(attr);
      if (v && CJK.test(v)) found.push(`${attr}=${v}`);
    }
  }
  // 语言选择里的「中文」选项本来就该用中文写
  return found.filter((s) => s !== "中文");
}

const noop = () => undefined;
const asyncNoop = async () => undefined;

const SCREENS: [string, () => JSX.Element][] = [
  ["backup", () => <BackupScreen onBack={noop} onExport={async () => ""} onPreviewRestore={async () => ({ groups: 0, messages: 0, skipped: 0 })} onConfirmRestore={asyncNoop} />],
  ["group settings", () => <GroupSettingsScreen groupName="Team" memberCount={3} onRename={asyncNoop} onLeave={asyncNoop} onBack={noop} onShowInvite={noop} disappearAfterMs={0} onSetDisappearAfter={noop} />],
  ["lock setup", () => <LockScreen mode="setup" onUnlocked={noop} onCancel={noop} />],
  ["lock unlock", () => <LockScreen mode="unlock" onUnlocked={noop} />],
  ["join", () => <JoinGroupScreen onSubmitInviteCode={noop} onCreateGroup={noop} onScanQr={noop} onBack={noop} />],
  ["create group", () => <CreateGroupScreen relayUrl="wss://relay.example" onBack={noop} onCreated={asyncNoop} />],
  ["diagnostics", () => <ConnectionDiagnosticsScreen relayUrl="wss://relay.example" iceConfig={{ iceServers: [], iceTransportPolicy: "all", hasTurn: false }} status="reconnecting" latency={EMPTY_LATENCY_STATS} disconnects={[]} onBack={noop} />],
  ["key missing", () => <KeyUnavailableScreen kind="missing" onRetry={asyncNoop} onResetAndRestore={asyncNoop} />],
  ["admin publish", () => <AdminPublishScreen content={{}} onPublish={asyncNoop} onRotateKey={async () => "code"} progress={null} onLockAdmin={noop} onBack={noop} />],
  ["devices", () => <ConnectedDevicesScreen groupName="Team" devices={[]} onlineNow={[]} myDeviceId="device-1" onBack={noop} />],
  ["server settings", () => <ServerSettingsScreen defaultUrl="wss://relay.example" onSaved={noop} onBack={noop} />],
  ["profile setup", () => <ProfileSetupScreen onDone={asyncNoop} />],
];

describe.each<Locale>(["en", "es"])("no Chinese left in %s", (locale) => {
  beforeEach(() => setLocale(locale));

  it.each(SCREENS)("%s screen", (_name, make) => {
    render(make());
    expect(chineseOnPage()).toEqual([]);
  });
});

describe("whole app in another language", () => {
  beforeEach(async () => {
    const { IDBFactory } = await import("fake-indexeddb");
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    __resetForTests();
    await disableLock();
    await saveNickname("Ana");
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  });

  async function renderApp() {
    render(<App />);
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
  }

  it("shows the list, announcements and Me tabs in English without Chinese", async () => {
    setLocale("en");
    await renderApp();
    await screen.findByText("Me");
    expect(chineseOnPage()).toEqual([]);
    fireEvent.click(screen.getByText("Chats"));
    await screen.findByText("You haven't joined any group yet");
    expect(chineseOnPage()).toEqual([]);
    fireEvent.click(screen.getByText("Me"));
    await screen.findByText("Language");
    expect(chineseOnPage()).toEqual([]);
  });

  it("switching language on the Me tab re-renders everything at once and is remembered", async () => {
    setLocale("en");
    await renderApp();
    fireEvent.click(await screen.findByText("Me"));
    const select = (await screen.findByText("Language")).parentElement!.querySelector("select")!;
    fireEvent.change(select, { target: { value: "es" } });
    await screen.findByText("Idioma · Language");
    expect(screen.getByText("Yo")).toBeInTheDocument(); // 底部导航（ui 包）也换了
    expect(screen.getByText("Copia de seguridad y restauración")).toBeInTheDocument();
    expect(chineseOnPage()).toEqual([]);
    expect(localStorage.getItem("settings:locale")).toBe("es");

    fireEvent.change(select, { target: { value: "zh" } });
    await screen.findByText("语言 · Language");
    expect(screen.getByText("我的")).toBeInTheDocument();
  });

  it("first-run name screen is translated too", async () => {
    await clearNickname();
    setLocale("es");
    await renderApp();
    // 首次设置昵称只在用户要加群/建群时才出现；从加群页进入建群触发
    fireEvent.click(await screen.findByText("Chats"));
    fireEvent.click(await screen.findByText("+ Unirse a otro grupo o crearlo"));
    fireEvent.click(await screen.findByText("Crear un grupo"));
    await screen.findByText("Elige tu nombre");
    expect(chineseOnPage()).toEqual([]);
  });
});

// 防止 jsdom 里没有的 API 让 App 挂掉时测试误报为「没有中文」
vi.setConfig({ testTimeout: 30_000 });
