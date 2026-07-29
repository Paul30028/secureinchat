import { describe, expect, it } from "vitest";
import { colors, radii, touchTarget } from "../src/tokens";

const HEX_RE = /^#[0-9A-F]{6}$/;

describe("design tokens", () => {
  it("every color is a valid 6-digit uppercase hex value", () => {
    for (const [name, value] of Object.entries(colors)) {
      expect(value, `${name} should be a valid hex color`).toMatch(HEX_RE);
    }
  });

  it("touch targets meet the required 48dp minimum", () => {
    expect(touchTarget.minDp).toBeGreaterThanOrEqual(48);
  });

  it("card radii are ordered large >= medium >= small", () => {
    expect(radii.cardLarge).toBeGreaterThanOrEqual(radii.cardMedium);
    expect(radii.cardMedium).toBeGreaterThanOrEqual(radii.cardSmall);
  });
});
