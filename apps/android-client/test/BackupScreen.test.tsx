import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BackupScreen } from "../src/screens/BackupScreen";
import { saveTextFile } from "../src/documentSave";

// 保存动作走原生插件，jsdom 里没有；mock 掉整个模块，由每个用例控制返回。
vi.mock("../src/documentSave", () => ({
  saveTextFile: vi.fn(),
}));

const saveMock = vi.mocked(saveTextFile);

beforeEach(() => {
  saveMock.mockReset();
});

function renderScreen(overrides: {
  onExport?: (password: string) => Promise<string>;
  onPreviewRestore?: (text: string, password: string) => Promise<{ groups: number; messages: number }>;
  onConfirmRestore?: () => Promise<void>;
} = {}) {
  const onExport = overrides.onExport ?? vi.fn().mockResolvedValue("{\"format\":\"sic-backup\"}");
  const onPreviewRestore = overrides.onPreviewRestore ?? vi.fn().mockResolvedValue({ groups: 2, messages: 5 });
  const onConfirmRestore = overrides.onConfirmRestore ?? vi.fn().mockResolvedValue(undefined);
  render(
    <BackupScreen
      onBack={vi.fn()}
      onExport={onExport}
      onPreviewRestore={onPreviewRestore}
      onConfirmRestore={onConfirmRestore}
    />
  );
  return { onExport, onPreviewRestore, onConfirmRestore };
}

function fillPasswords(password: string) {
  fireEvent.change(screen.getByLabelText("备份密码输入框"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("再次输入备份密码"), { target: { value: password } });
}

describe("BackupScreen 导出", () => {
  it("两次密码不一致时显示提示，不调用 onExport", () => {
    saveMock.mockResolvedValue("saved");
    const { onExport } = renderScreen();
    fireEvent.change(screen.getByLabelText("备份密码输入框"), { target: { value: "1234567890" } });
    fireEvent.change(screen.getByLabelText("再次输入备份密码"), { target: { value: "1234567891" } });
    fireEvent.click(screen.getByText("生成备份文件"));
    expect(screen.getByRole("alert")).toHaveTextContent("两次输入的密码不一致");
    expect(onExport).not.toHaveBeenCalled();
  });

  it("密码太短时显示提示，不调用 onExport", () => {
    saveMock.mockResolvedValue("saved");
    const { onExport } = renderScreen();
    fillPasswords("short");
    fireEvent.click(screen.getByText("生成备份文件"));
    expect(screen.getByRole("alert")).toHaveTextContent("至少 10 个字符");
    expect(onExport).not.toHaveBeenCalled();
  });

  it("保存成功时调用 onExport 和 saveTextFile，显示「备份已保存」并清空密码", async () => {
    saveMock.mockResolvedValue("saved");
    const onExport = vi.fn().mockResolvedValue("{\"format\":\"sic-backup\"}");
    renderScreen({ onExport });
    fillPasswords("0123456789");
    fireEvent.click(screen.getByText("生成备份文件"));

    await waitFor(() => expect(onExport).toHaveBeenCalledWith("0123456789"));
    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith(
        expect.stringMatching(/^secureinchat-backup-\d{8}\.json$/),
        "application/json",
        "{\"format\":\"sic-backup\"}"
      )
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("备份已保存")
    );
    expect((screen.getByLabelText("备份密码输入框") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("再次输入备份密码") as HTMLInputElement).value).toBe("");
  });

  it("用户取消时既不显示成功也不显示错误，密码保留，按钮可点", async () => {
    saveMock.mockResolvedValue("cancelled");
    const onExport = vi.fn().mockResolvedValue("{\"format\":\"sic-backup\"}");
    renderScreen({ onExport });
    fillPasswords("0123456789");
    fireEvent.click(screen.getByText("生成备份文件"));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect((screen.getByLabelText("备份密码输入框") as HTMLInputElement).value).toBe("0123456789");
    expect((screen.getByLabelText("再次输入备份密码") as HTMLInputElement).value).toBe("0123456789");
    expect(screen.getByText("生成备份文件")).not.toBeDisabled();
  });

  it("保存失败时显示错误，密码保留", async () => {
    saveMock.mockRejectedValue(new Error("写入文件失败：存储空间不足"));
    renderScreen();
    fillPasswords("0123456789");
    fireEvent.click(screen.getByText("生成备份文件"));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("写入文件失败：存储空间不足")
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect((screen.getByLabelText("备份密码输入框") as HTMLInputElement).value).toBe("0123456789");
  });
});

describe("BackupScreen 恢复", () => {
  it("错密码时显示解密失败的提示", async () => {
    const onPreviewRestore = vi
      .fn()
      .mockRejectedValue(new Error("密码不对，或文件已损坏"));
    renderScreen({ onPreviewRestore });

    // 切到恢复 tab
    fireEvent.click(screen.getByText("从备份恢复"));

    // 选文件（jsdom 里用 fireEvent.change 模拟）
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    const input = screen.getByLabelText("选择备份文件");
    fireEvent.change(input, { target: { files: [file] } });
    // 读文件是异步的：等「已选择」出现，说明内容已读进来
    await screen.findByText("已选择：backup.json");

    fireEvent.change(screen.getByLabelText("恢复密码输入框"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByText("解密并预览"));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("密码不对，或文件已损坏")
    );
  });

  it("解密成功后显示将恢复的群和消息数量；确认后调用 onConfirmRestore", async () => {
    const onPreviewRestore = vi.fn().mockResolvedValue({ groups: 3, messages: 12 });
    const onConfirmRestore = vi.fn().mockResolvedValue(undefined);
    renderScreen({ onPreviewRestore, onConfirmRestore });

    fireEvent.click(screen.getByText("从备份恢复"));
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    const input = screen.getByLabelText("选择备份文件");
    fireEvent.change(input, { target: { files: [file] } });
    // 读文件是异步的：等「已选择」出现，说明内容已读进来
    await screen.findByText("已选择：backup.json");
    fireEvent.change(screen.getByLabelText("恢复密码输入框"), { target: { value: "0123456789" } });
    fireEvent.click(screen.getByText("解密并预览"));

    await waitFor(() =>
      expect(screen.getByText("将恢复 3 个群、12 条消息。")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("确认恢复"));
    await waitFor(() => expect(onConfirmRestore).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("恢复完成")
    );
  });
});
