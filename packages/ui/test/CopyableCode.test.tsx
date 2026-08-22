import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CopyableCode } from "../src/components/CopyableCode";

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("CopyableCode", () => {
  it("renders the value", () => {
    render(<CopyableCode value="SIC2.abc123" />);
    expect(screen.getByText("SIC2.abc123")).toBeInTheDocument();
  });

  it("renders the label when provided", () => {
    render(<CopyableCode value="x" label="邀请码" />);
    expect(screen.getByText("邀请码")).toBeInTheDocument();
  });

  it("copies the value to the clipboard when the button is clicked", async () => {
    render(<CopyableCode value="SIC2.abc123" />);
    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("SIC2.abc123"));
  });

  it("shows '已复制' feedback after a successful copy", async () => {
    render(<CopyableCode value="x" />);
    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    expect(await screen.findByRole("button", { name: "已复制" })).toBeInTheDocument();
  });

  it("does not crash when clipboard access is rejected", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<CopyableCode value="x" />);
    fireEvent.click(screen.getByRole("button", { name: "复制" }));
    // Should still be showing the normal "复制" label, not crash or hang.
    await waitFor(() => expect(screen.getByRole("button", { name: "复制" })).toBeInTheDocument());
  });

  it("the copy button meets the 48dp minimum touch target", () => {
    render(<CopyableCode value="x" />);
    expect(screen.getByRole("button", { name: "复制" }).style.minHeight).toBe("48px");
  });
});
