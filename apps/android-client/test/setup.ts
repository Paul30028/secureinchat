import "fake-indexeddb/auto";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { setLocale } from "../src/i18n";

// 现有测试都按中文界面断言。jsdom 的 navigator.language 是 en-US，
// 所以每个用例前固定成中文；测其他语言的用例自己切换。
beforeEach(() => {
  setLocale("zh");
});

// jsdom 没有实现 URL.createObjectURL / revokeObjectURL，也没有实现
// Blob/File 的 arrayBuffer()——但这些在所有现代浏览器（含 Android WebView）
// 里都是标准可用的。这是测试环境的缺口，不是被测代码的问题。
if (typeof URL.createObjectURL !== "function") {
  let counter = 0;
  URL.createObjectURL = () => `blob:mock/${counter++}`;
  URL.revokeObjectURL = () => {};
}

if (typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

afterEach(() => {
  cleanup();
});
