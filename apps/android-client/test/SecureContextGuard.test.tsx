import "fake-indexeddb/auto";
import { describe, expect, it, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../src/App";
import { isSecureContextAvailable } from "../src/SecureContextGuard";

const realSubtle = globalThis.crypto.subtle;

afterEach(() => {
  Object.defineProperty(globalThis.crypto, "subtle", { value: realSubtle, configurable: true });
});

describe("secure context guard", () => {
  it("reports available when crypto.subtle exists", () => {
    expect(isSecureContextAvailable()).toBe(true);
  });

  it("reports unavailable when crypto.subtle is missing", () => {
    Object.defineProperty(globalThis.crypto, "subtle", { value: undefined, configurable: true });
    expect(isSecureContextAvailable()).toBe(false);
  });

  it("App renders an explanatory notice instead of the normal UI when crypto.subtle is missing", () => {
    Object.defineProperty(globalThis.crypto, "subtle", { value: undefined, configurable: true });
    render(<App />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("无法启用加密")).toBeInTheDocument();
    // The normal entry UI must NOT be reachable — we don't want anyone typing an
    // invite code into an app that can't actually encrypt anything.
    expect(screen.queryByLabelText("邀请码输入框")).not.toBeInTheDocument();
  });
});
