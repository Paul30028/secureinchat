// SecureInChat Opt-Out page runner.
// Injected into the active tab after the user explicitly starts a rule.
// It only types into the page and never clicks a final submit, CAPTCHA,
// or any element that could send the form. It makes no network requests.
//
// Result (for tests and the popup):
//   window.__OPTOUT_RESULT__ = { status, reason, note, filled: [field...] }
// Field values are never included in results or messages.

(() => {
  'use strict';

  if (window.__OPTOUT_RUNNER_ACTIVE__) {
    return;
  }
  window.__OPTOUT_RUNNER_ACTIVE__ = true;

  const BANNER_ID = 'sichat-optout-banner';
  const BANNER_TEXT = '请你核对信息并亲自提交/完成验证';
  const WAIT_TIMEOUT_MS = 6000;
  const WAIT_INTERVAL_MS = 100;

  class StopRun extends Error {
    constructor(reason, note) {
      super(note || reason);
      this.name = 'StopRun';
      this.reason = reason;
      this.note = note || '';
    }
  }

  class StepError extends Error {
    constructor(message) {
      super(message);
      this.name = 'StepError';
    }
  }

  function setResult(result) {
    window.__OPTOUT_RESULT__ = { ...result, finishedAt: Date.now() };
    report(result);
  }

  function report(result) {
    if (!globalThis.chrome || !chrome.runtime || !chrome.runtime.id) {
      return;
    }
    try {
      Promise.resolve(
        chrome.runtime.sendMessage({
          type: 'optout:progress',
          ruleId: result.ruleId,
          status: result.status,
          reason: result.reason || '',
          note: result.note || ''
        })
      ).catch(() => {});
    } catch {
      // The popup may have closed; page state is already recorded locally.
    }
  }

  function showBanner(rule, note, kind) {
    const old = document.getElementById(BANNER_ID);
    if (old) {
      old.remove();
    }
    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.setAttribute('data-sichat-optout', 'banner');
    banner.setAttribute('role', 'status');
    banner.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:2147483647',
      'box-sizing:border-box',
      'padding:10px 14px',
      'background:#123b2c',
      'color:#f3fff9',
      'font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'border-bottom:2px solid #59c99a',
      'box-shadow:0 2px 10px rgba(0,0,0,.25)',
      'text-align:left'
    ].join(';');

    const title = document.createElement('strong');
    title.textContent = BANNER_TEXT;
    title.style.cssText = 'display:block;font-size:15px;margin-bottom:2px';
    banner.appendChild(title);

    const detail = document.createElement('span');
    detail.textContent = [
      rule && rule.name ? `站点：${rule.name}` : '',
      note || '',
      kind === 'failed' ? '自动填写中断，请你自己完成剩余步骤。' : ''
    ]
      .filter(Boolean)
      .join(' · ');
    if (detail.textContent) {
      detail.style.cssText = 'display:block;opacity:.9;font-size:12px';
      banner.appendChild(detail);
    }

    (document.body || document.documentElement).appendChild(banner);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function isVisible(element) {
    if (!element || element.disabled) {
      return false;
    }
    if (element.getClientRects().length === 0) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }

  async function waitForElement(selector, timeout = WAIT_TIMEOUT_MS) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      let element = null;
      try {
        element = document.querySelector(selector);
      } catch {
        throw new StepError(`无效的选择器：${selector}`);
      }
      if (element && isVisible(element)) {
        return element;
      }
      await sleep(WAIT_INTERVAL_MS);
    }
    throw new StepError(`等待元素超时：${selector}`);
  }

  function profileValue(profile, field) {
    const value = profile ? profile[field] : '';
    if (Array.isArray(value)) {
      return value.filter(Boolean).join('、');
    }
    return value === undefined || value === null ? '' : String(value);
  }

  function setNativeValue(element, value) {
    if (element.tagName === 'SELECT') {
      const option = Array.from(element.options).find(
        (entry) => entry.value === value || entry.textContent.trim() === value
      );
      element.value = option ? option.value : value;
    } else {
      const prototype = element.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function looksLikeCaptcha(element) {
    if (!element || element.nodeType !== 1) {
      return false;
    }
    const marker = [
      element.id,
      element.getAttribute('name') || '',
      typeof element.className === 'string' ? element.className : '',
      element.getAttribute('aria-label') || ''
    ]
      .join(' ')
      .toLowerCase();
    if (/captcha|recaptcha|hcaptcha|turnstile/.test(marker)) {
      return true;
    }
    return Boolean(
      element.closest(
        '#captcha, .captcha, [data-captcha], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"]'
      )
    );
  }

  function looksLikeFinalSubmit(element) {
    if (!element || element.nodeType !== 1) {
      return false;
    }
    const tag = element.tagName;
    const type = (element.getAttribute('type') || '').toLowerCase();
    const marker = [
      element.textContent || '',
      element.getAttribute('value') || '',
      element.getAttribute('aria-label') || '',
      element.id,
      element.getAttribute('name') || ''
    ]
      .join(' ')
      .toLowerCase();

    if (type === 'submit' || type === 'image') {
      return true;
    }
    if (tag === 'BUTTON' && type === '' && element.closest('form')) {
      return true;
    }
    if (type === 'button' || tag === 'A') {
      return /submit|send|remove|delete|opt.?out|confirm|提交|发送|删除|移除|确认|退出/.test(marker);
    }
    return false;
  }

  function pageHasCaptcha() {
    return Boolean(
      document.querySelector(
        '#captcha, .captcha, [data-captcha], iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="turnstile"]'
      )
    );
  }

  function successMatched(success) {
    if (!success) {
      return false;
    }
    if (success.selector) {
      try {
        return Boolean(document.querySelector(success.selector));
      } catch {
        return false;
      }
    }
    if (success.textIncludes) {
      return (document.body ? document.body.innerText : '').includes(success.textIncludes);
    }
    return false;
  }

  async function runStep(step) {
    if (!step || typeof step !== 'object') {
      throw new StepError('规则步骤为空');
    }
    switch (step.action) {
      case 'fill': {
        const element = await waitForElement(step.selector);
        if (looksLikeCaptcha(element)) {
          throw new StopRun('captcha', step.note || '页面要求验证码');
        }
        const value = profileValue(window.__OPTOUT_CONFIG__.profile, step.field);
        if (!value) {
          throw new StepError(`资料缺少字段：${step.field}`);
        }
        setNativeValue(element, value);
        return { filled: step.field };
      }
      case 'click': {
        const element = await waitForElement(step.selector);
        if (looksLikeCaptcha(element)) {
          throw new StopRun('captcha', step.note || '页面要求验证码');
        }
        if (looksLikeFinalSubmit(element)) {
          throw new StopRun('final-submit', step.note || '最终提交必须由你本人完成');
        }
        element.click();
        await sleep(150);
        return {};
      }
      case 'waitFor': {
        await waitForElement(step.selector);
        return {};
      }
      case 'open': {
        if (/^https:\/\//i.test(step.selector)) {
          window.location.assign(step.selector);
          throw new StopRun('navigating', step.note || '页面跳转后请重新开始该站点');
        }
        const element = await waitForElement(step.selector);
        if (looksLikeCaptcha(element) || looksLikeFinalSubmit(element)) {
          throw new StopRun('final-submit', step.note || '该操作必须由你本人完成');
        }
        element.click();
        await sleep(150);
        return {};
      }
      case 'pause': {
        throw new StopRun('pause', step.note || BANNER_TEXT);
      }
      default:
        throw new StepError(`未知动作：${step.action}`);
    }
  }

  async function loadConfig() {
    if (window.__OPTOUT_CONFIG__ && window.__OPTOUT_CONFIG__.rule) {
      return window.__OPTOUT_CONFIG__;
    }
    return null;
  }

  async function main() {
    const config = await loadConfig();
    const rule = config && config.rule;
    if (!config || !rule || !Array.isArray(rule.steps)) {
      return;
    }
    window.__OPTOUT_CONFIG__ = config;

    const filled = [];
    let status = 'filled-awaiting-user';
    let reason = 'complete';
    let note = '';
    let success = false;

    try {
      for (const step of rule.steps) {
        const result = await runStep(step);
        if (result && result.filled && !filled.includes(result.filled)) {
          filled.push(result.filled);
        }
      }
      success = successMatched(rule.success);
      if (Array.isArray(rule.needs) && rule.needs.includes('id-upload')) {
        status = 'needs-id';
        note = '需要你本人上传证件后继续';
        showBanner(rule, note, 'stop');
      } else if (Array.isArray(rule.needs) && rule.needs.includes('captcha') && pageHasCaptcha()) {
        reason = 'captcha';
        note = '页面含 CAPTCHA，请本人完成验证并提交';
        showBanner(rule, note, 'stop');
      } else {
        reason = 'awaiting-user';
        note = '已填好，请核对信息并亲自提交';
        showBanner(rule, note, 'stop');
      }
    } catch (error) {
      if (error instanceof StopRun) {
        reason = error.reason;
        note = error.note;
        status = error.reason === 'navigating' ? 'pending' : 'filled-awaiting-user';
        if (error.reason !== 'navigating') {
          showBanner(rule, note, 'stop');
        }
      } else {
        status = 'failed';
        reason = 'error';
        note = error && error.message ? error.message : '自动填写失败';
        showBanner(rule, note, 'failed');
      }
    }

    setResult({
      ruleId: rule.id,
      status,
      reason,
      note,
      filled,
      success
    });
  }

  main().catch((error) => {
    const config = window.__OPTOUT_CONFIG__ || {};
    setResult({
      ruleId: config.rule ? config.rule.id : '',
      status: 'failed',
      reason: 'error',
      note: error && error.message ? error.message : '自动填写失败',
      filled: [],
      success: false
    });
  }).finally(() => {
    delete window.__OPTOUT_CONFIG__;
  });
})();
