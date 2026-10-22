"use strict";

(() => {
  const values = {
    language: () => navigator.language || "Not available",

    timezone: () => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
          || "Not available";
      } catch {
        return "Not available";
      }
    },

    screen: () => {
      if (!window.screen) return "Not available";
      return `${window.screen.width} × ${window.screen.height}`;
    },

    motion: () => {
      if (typeof window.matchMedia !== "function") {
        return "Not supported";
      }

      return window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "Reduced motion enabled"
        : "No reduced-motion preference";
    }
  };

  Object.entries(values).forEach(([key, readValue]) => {
    const element = document.querySelector(`[data-readout="${key}"]`);

    if (!element) return;

    try {
      element.textContent = readValue();
    } catch {
      element.textContent = "Not available";
    }
  });
})();
