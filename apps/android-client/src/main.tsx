import { StrictMode } from "react";
import "./global.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initLocale } from "./i18n";

// 先定语言再渲染，第一屏就是用户的语言
initLocale();

const container = document.getElementById("root");
if (!container) {
  throw new Error("#root not found in index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
