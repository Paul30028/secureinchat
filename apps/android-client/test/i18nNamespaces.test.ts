import { describe, expect, it } from "vitest";
import { NAMESPACES } from "../src/i18n";

/** 每个界面的词条文件：en、es 必须和 zh 键完全一致，值不为空，占位符一致；不同文件之间不能有重复的键。 */
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("i18n namespace files", () => {
  const entries = Object.entries(NAMESPACES);

  it.each(entries)("%s: en and es have exactly the zh keys, non-empty, same placeholders", (_path, mod) => {
    const zhKeys = Object.keys(mod.zh).sort();
    for (const loc of ["en", "es"] as const) {
      expect(Object.keys(mod[loc]).sort()).toEqual(zhKeys);
      for (const k of zhKeys) {
        expect(mod[loc][k]?.trim()).not.toBe("");
        expect(placeholders(mod[loc][k]!)).toEqual(placeholders(mod.zh[k]!));
      }
    }
  });

  it("no key is defined in two files", () => {
    const seen = new Map<string, string>();
    for (const [path, mod] of entries) {
      for (const k of Object.keys(mod.zh)) {
        expect(seen.get(k), `${k} is in both ${seen.get(k)} and ${path}`).toBeUndefined();
        seen.set(k, path);
      }
    }
  });
});
