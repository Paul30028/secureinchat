import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KeyUnavailableScreen } from "../src/screens/KeyUnavailableScreen";
import { protectionText } from "../src/screens/MessageListScreen";

describe("KeyUnavailableScreen", () => {
  it("explains the missing-key case and offers retry", async () => {
    const onRetry = vi.fn(async () => undefined);
    render(<KeyUnavailableScreen kind="missing" onRetry={onRetry} onResetAndRestore={vi.fn()} />);
    expect(screen.getByText("本机数据无法解密")).toBeInTheDocument();
    expect(screen.getByText(/从另一台手机恢复过来/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("重试"));
    await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
  });

  it("never clears data without a second, explicit confirmation", async () => {
    const onReset = vi.fn(async () => undefined);
    render(<KeyUnavailableScreen kind="invalidated" onRetry={vi.fn()} onResetAndRestore={onReset} />);
    fireEvent.click(screen.getByText("清空本机数据，从备份恢复"));
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByText(/应用锁、昵称等设置会保留/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("取消"));
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("清空本机数据，从备份恢复"));
    fireEvent.click(screen.getByText("确定清空，去恢复备份"));
    await waitFor(() => expect(onReset).toHaveBeenCalledTimes(1));
  });

  it("shows the system's message only for the generic failure", () => {
    render(<KeyUnavailableScreen kind="failed" detail="Keystore: busy" onRetry={vi.fn()} onResetAndRestore={vi.fn()} />);
    expect(screen.getByText("Keystore: busy")).toBeInTheDocument();
  });

  it("shows an error if the reset fails, and stays on the screen", async () => {
    const onReset = vi.fn(async () => {
      throw new Error("磁盘满");
    });
    render(<KeyUnavailableScreen kind="missing" onRetry={vi.fn()} onResetAndRestore={onReset} />);
    fireEvent.click(screen.getByText("清空本机数据，从备份恢复"));
    fireEvent.click(screen.getByText("确定清空，去恢复备份"));
    expect(await screen.findByText("磁盘满")).toBeInTheDocument();
  });
});

describe("protectionText", () => {
  it("states the limit for every hardware level and never overclaims", () => {
    for (const p of ["strongbox", "tee", "software"] as const) {
      const s = protectionText(p);
      expect(s).toContain("不防");
      expect(s).not.toMatch(/Signal|绝对|完全/);
    }
  });

  it("is plain about no hardware protection", () => {
    expect(protectionText("webview")).toContain("没有硬件密钥保护");
  });

  it("only StrongBox claims the security chip", () => {
    expect(protectionText("strongbox")).toContain("StrongBox");
    expect(protectionText("tee")).not.toContain("StrongBox");
    expect(protectionText("software")).toContain("保护较弱");
  });
});
