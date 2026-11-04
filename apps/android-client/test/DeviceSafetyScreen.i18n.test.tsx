import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeviceSafetyScreen, type SafetyGroup } from "../src/screens/DeviceSafetyScreen";
import { I18nProvider } from "../src/i18n";

const groups: SafetyGroup[] = [
  { groupId: "g1", groupName: "读书会", isAdmin: false },
  { groupId: "g2", groupName: "社区互助", isAdmin: true },
];

function setup(locale: "en" | "es") {
  const props = {
    groups,
    onBack: vi.fn(),
    onPurgeGroups: vi.fn().mockResolvedValue(1),
    // 故意 reject，用来验证错误提示也走翻译；
    // 但第一次进确认页后我们不点，验证 disabled 状态即可。
    onWipeAll: vi.fn().mockResolvedValue(undefined),
  };
  render(
    <I18nProvider locale={locale}>
      <DeviceSafetyScreen {...props} />
    </I18nProvider>,
  );
  return props;
}

// 按钮名通过 getByRole 精确匹配，避免标题和按钮文字都相同导致 getByText 多匹配。
describe("DeviceSafetyScreen — Spanish (es)", () => {
  it("renders the Spanish title and home cards", () => {
    setup("es");
    expect(screen.getByRole("heading", { name: "Seguridad del dispositivo" })).toBeInTheDocument();
    expect(screen.getByText("Cruzar la frontera sin nada")).toBeInTheDocument();
    expect(screen.getByText("Este teléfono estuvo fuera de mis manos")).toBeInTheDocument();
  });

  it("requires the Spanish confirmation word BORRAR, not Chinese 清除", () => {
    setup("es");
    fireEvent.click(screen.getByText("Este teléfono estuvo fuera de mis manos"));

    const wipe = screen.getByRole("button", { name: "Borrar todos los datos de este teléfono" });
    expect(wipe).toBeDisabled();

    // 中文确认词在该语言下无效
    fireEvent.change(screen.getByLabelText(/BORRAR/), { target: { value: "清除" } });
    expect(wipe).toBeDisabled();

    // 首尾空格无所谓
    fireEvent.change(screen.getByLabelText(/BORRAR/), { target: { value: "  BORRAR  " } });
    expect(wipe).toBeEnabled();
  });

  it("translates the travel screen and admin warning", () => {
    setup("es");
    fireEvent.click(screen.getByText("Cruzar la frontera sin nada"));
    expect(screen.getByRole("heading", { name: "Cruzar la frontera sin nada" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/社区互助/));
    expect(screen.getByRole("alert")).toHaveTextContent("Eres administrador de 社区互助");
  });
});

describe("DeviceSafetyScreen — English (en)", () => {
  it("renders the English title and home cards", () => {
    setup("en");
    expect(screen.getByRole("heading", { name: "Device safety" })).toBeInTheDocument();
    expect(screen.getByText("Cross borders empty-handed")).toBeInTheDocument();
    expect(screen.getByText("This phone was out of my hands")).toBeInTheDocument();
  });

  it("requires the English confirmation word WIPE, not Chinese 清除", () => {
    setup("en");
    fireEvent.click(screen.getByText("This phone was out of my hands"));

    const wipe = screen.getByRole("button", { name: "Wipe all data on this phone" });
    expect(wipe).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/WIPE/), { target: { value: "清除" } });
    expect(wipe).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/WIPE/), { target: { value: " WIPE " } });
    expect(wipe).toBeEnabled();
  });

  it("pluralizes / interpolates the group count in the travel button", () => {
    setup("en");
    fireEvent.click(screen.getByText("Cross borders empty-handed"));
    expect(screen.getByRole("button", { name: /Delete 0 selected groups/ })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/读书会/));
    expect(screen.getByRole("button", { name: /Delete 1 selected groups/ })).toBeInTheDocument();
  });
});
