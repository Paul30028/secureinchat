import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "../src/components/Avatar";

describe("Avatar", () => {
  it("renders an img when src is provided", () => {
    render(<Avatar src="https://example.com/pic.jpg" name="张溪" />);
    const img = screen.getByRole("img", { name: "张溪" }) as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.src).toBe("https://example.com/pic.jpg");
  });

  it("falls back to the first character of the name when no src is given", () => {
    render(<Avatar name="张溪" />);
    expect(screen.getByText("张")).toBeInTheDocument();
  });

  it("falls back to a placeholder character for an empty name", () => {
    render(<Avatar name="   " />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("never applies a box-shadow (flat design requirement)", () => {
    render(<Avatar name="张溪" />);
    const el = screen.getByLabelText("张溪");
    expect(el.style.boxShadow).toBe("none");
  });

  it("applies the correct pixel size per size variant", () => {
    const { unmount } = render(<Avatar name="A" size="small" />);
    expect(screen.getByLabelText("A").style.width).toBe("32px");
    unmount();

    render(<Avatar name="A" size="large" />);
    expect(screen.getByLabelText("A").style.width).toBe("64px");
  });
});
