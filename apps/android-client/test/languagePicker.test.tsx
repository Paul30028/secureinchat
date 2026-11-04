import { afterEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { I18nRoot, LOCALE_STORAGE_KEY, readLocaleChoice, useT, writeLocaleChoice } from "../src/i18n";
import { LanguagePicker } from "../src/screens/LanguagePicker";

function Title() {
  const t = useT();
  return <h1>{t("language.title")}</h1>;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("LanguagePicker", () => {
  it("is hidden without I18nRoot (nothing it could change)", () => {
    const { container } = render(<LanguagePicker />);
    expect(container.querySelector("select")).toBeNull();
  });

  it("switches the whole tree and remembers the choice on this device", () => {
    render(
      <I18nRoot>
        <Title />
        <LanguagePicker />
      </I18nRoot>,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "es" } });
    expect(screen.getByRole("heading").textContent).toBe("Idioma");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("es");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zh" } });
    expect(screen.getByRole("heading").textContent).toBe("语言");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "auto" } });
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });

  it("starts from the stored choice", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    render(
      <I18nRoot>
        <Title />
      </I18nRoot>,
    );
    expect(screen.getByRole("heading").textContent).toBe("Language");
  });
});

describe("readLocaleChoice / writeLocaleChoice", () => {
  it("ignores unknown values and storage errors", () => {
    expect(readLocaleChoice({ getItem: () => "fr" })).toBe("auto");
    expect(readLocaleChoice({ getItem: () => { throw new Error("blocked"); } })).toBe("auto");
    expect(readLocaleChoice(undefined)).toBe("auto");
    expect(() =>
      writeLocaleChoice({ setItem: () => { throw new Error("full"); }, removeItem: () => undefined }, "en"),
    ).not.toThrow();
  });
});
