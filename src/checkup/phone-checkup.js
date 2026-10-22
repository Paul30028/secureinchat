/* Local-only checklist behavior. No storage, cookies, network or analytics. */
"use strict";

(() => {
  const root = document.querySelector("[data-phone-checkup]");
  if (!root) return;

  const items = Array.from(root.querySelectorAll(".phone-check-item"));
  const count = root.querySelector("[data-completed-count]");
  const progress = root.querySelector("[data-progress]");
  const nextText = root.querySelector("[data-next-step]");
  const resetButton = root.querySelector("[data-reset-checklist]");
  const isChinese = document.documentElement.lang.toLowerCase().startsWith("zh");

  const wording = isChinese
    ? {
        count: (done, total) => `已完成 ${done} / ${total} 项`,
        nextTitle: "建议下一步",
        completeTitle: "你已检查全部六项",
        completeText: "你已逐项完成自查。请根据每项说明，在设备、运营商或相关账号中完成仍需采取的措施。此清单不会验证设置是否实际生效。",
        emptyTitle: "建议下一步",
        emptyText: "先检查 SIM 卡 PIN 设置，并在启用前了解运营商提供的恢复方法。",
        progressLabel: (done, total) => `手机号隐私检查进度：${done} / ${total}`
      }
    : {
        count: (done, total) => `${done} of ${total} completed`,
        nextTitle: "Suggested next step",
        completeTitle: "All six checks reviewed",
        completeText: "You have reviewed every item. Use the guidance above to finish any actions that still apply in your device, carrier account or messaging apps. This checklist does not verify that a setting is actually enabled.",
        emptyTitle: "Suggested next step",
        emptyText: "Start by reviewing the SIM PIN setting and understanding the recovery process before enabling it.",
        progressLabel: (done, total) => `Phone privacy checklist progress: ${done} of ${total}`
      };

  const nextTitle = root.querySelector("#next-step-title");

  function update() {
    const completed = items.filter((item) => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      return checkbox && checkbox.checked;
    }).length;

    if (count) count.textContent = wording.count(completed, items.length);
    if (progress) {
      progress.max = items.length;
      progress.value = completed;
      progress.setAttribute("aria-label", wording.progressLabel(completed, items.length));
    }

    if (!nextTitle || !nextText) return;

    if (completed === items.length) {
      nextTitle.textContent = wording.completeTitle;
      nextText.textContent = wording.completeText;
      return;
    }

    nextTitle.textContent = wording.nextTitle;
    const nextItem = items.find((item) => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      return checkbox && !checkbox.checked;
    });

    if (!nextItem) {
      nextText.textContent = wording.emptyText;
      return;
    }

    const localizedText = isChinese
      ? nextItem.getAttribute("data-next-zh")
      : nextItem.getAttribute("data-next-en");
    nextText.textContent = localizedText || wording.emptyText;
  }

  root.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === "checkbox") {
      update();
    }
  });

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      items.forEach((item) => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = false;
      });
      update();
      const firstCheckbox = root.querySelector('.phone-check-item input[type="checkbox"]');
      if (firstCheckbox) firstCheckbox.focus();
    });
  }

  update();
})();
