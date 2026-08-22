import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../src/components/Button";

describe("Button", () => {
  it("renders children and responds to click", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>加入群聊</Button>);
    const btn = screen.getByRole("button", { name: "加入群聊" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("meets the 48dp minimum touch target on every variant", () => {
    const variants = ["primary", "secondary", "danger"] as const;
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>按钮</Button>);
      const btn = screen.getByRole("button", { name: "按钮" });
      expect(btn.style.minHeight).toBe("48px");
      expect(btn.style.minWidth).toBe("48px");
      unmount();
    }
  });

  it("never applies a box-shadow (flat design requirement)", () => {
    render(<Button>无阴影</Button>);
    const btn = screen.getByRole("button", { name: "无阴影" });
    expect(btn.style.boxShadow).toBe("none");
  });
});
