import { StrictMode } from "react";
import "./global.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { I18nRoot } from "./i18n";

const container = document.getElementById("root");
if (!container) {
  throw new Error("#root not found in index.html");
}

createRoot(container).render(
  <StrictMode>
    <I18nRoot>
      <App />
    </I18nRoot>
  </StrictMode>
);
