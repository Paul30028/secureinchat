import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "../src/components/Card";
import { radii } from "../src/tokens";

describe("Card", () => {
  it("renders children with the ivory background and no shadow", () => {
    render(<Card>内容</Card>);
    const card = screen.getByText("内容");
    // jsdom normalizes inline hex colors to rgb() — compare against that form.
    expect(card.style.background).toBe("rgb(235, 236, 229)");
    expect(card.style.boxShadow).toBe("none");
  });

  it("uses the large radius token when size='large'", () => {
    render(<Card size="large">大卡片</Card>);
    const card = screen.getByText("大卡片");
    expect(card.style.borderRadius).toBe(`${radii.cardLarge}px`);
  });

  it("defaults to medium radius", () => {
    render(<Card>默认</Card>);
    const card = screen.getByText("默认");
    expect(card.style.borderRadius).toBe(`${radii.cardMedium}px`);
  });
});
