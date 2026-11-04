import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeviceSafetyScreen, type SafetyGroup } from "../src/screens/DeviceSafetyScreen";

const groups: SafetyGroup[] = [
  { groupId: "g1", groupName: "读书会", isAdmin: false },
  { groupId: "g2", groupName: "社区互助", isAdmin: true },
];

function setup(overrides: Partial<Parameters<typeof DeviceSafetyScreen>[0]> = {}) {
  const props = {
    groups,
    onBack: vi.fn(),
    onPurgeGroups: vi.fn().mockResolvedValue(1),
    onWipeAll: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<DeviceSafetyScreen {...props} />);
  return props;
}

describe("DeviceSafetyScreen — travel mode", () => {
  it("deletes only the selected groups", async () => {
    const props = setup();
    fireEvent.click(screen.getByText("空手过境"));
    const button = screen.getByRole("button", { name: /删除选中的 0 个群/ });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/读书会/));
    fireEvent.click(screen.getByRole("button", { name: /删除选中的 1 个群/ }));

    await waitFor(() => expect(props.onPurgeGroups).toHaveBeenCalledWith(["g1"]));
    expect(await screen.findByText("已删除 1 个群")).toBeInTheDocument();
  });

  it("warns an admin that the admin identity goes too", () => {
    setup();
    fireEvent.click(screen.getByText("空手过境"));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByLabelText(/社区互助/));
    expect(screen.getByRole("alert")).toHaveTextContent("管理员恢复码保存在别处");
  });

  it("shows an error and stays on the screen if deletion fails", async () => {
    setup({ onPurgeGroups: vi.fn().mockRejectedValue(new Error("x")) });
    fireEvent.click(screen.getByText("空手过境"));
    fireEvent.click(screen.getByLabelText(/读书会/));
    fireEvent.click(screen.getByRole("button", { name: /删除选中的 1 个群/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("删除没有完成");
  });
});

describe("DeviceSafetyScreen — phone was out of my hands", () => {
  it("needs the confirmation word before wiping", async () => {
    const props = setup();
    fireEvent.click(screen.getByText("这台手机曾离开过我"));
    const wipe = screen.getByRole("button", { name: "清除这台手机上的全部数据" });
    expect(wipe).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/确认/), { target: { value: "清 除" } });
    expect(wipe).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/确认/), { target: { value: "清除" } });
    expect(wipe).toBeEnabled();

    fireEvent.click(wipe);
    await waitFor(() => expect(props.onWipeAll).toHaveBeenCalledTimes(1));
  });

  it("says plainly when the wipe failed", async () => {
    setup({ onWipeAll: vi.fn().mockRejectedValue(new Error("blocked")) });
    fireEvent.click(screen.getByText("这台手机曾离开过我"));
    fireEvent.change(screen.getByLabelText(/确认/), { target: { value: "清除" } });
    fireEvent.click(screen.getByRole("button", { name: "清除这台手机上的全部数据" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("系统设置里清除本应用的数据");
  });
});
