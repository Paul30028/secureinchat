// SecureInChat Opt-Out popup.
// The passphrase and decrypted profile live only in this page's memory.
// The background receives queue metadata, never profile values.

import {
  createProfileStore,
  normalizeProfile
} from './src/profile-store.js';
import {
  validateRules,
  hostMatchesPermission
} from './src/rules.js';

const storage = {
  async get(key) {
    const result = await chrome.storage.local.get(key);
    return result[key];
  },
  async set(items) {
    await chrome.storage.local.set(items);
  },
  async remove(key) {
    await chrome.storage.local.remove(key);
  }
};

const store = createProfileStore({ crypto: globalThis.crypto, storage });
const $ = (id) => document.getElementById(id);

const STATUS_LABELS = {
  pending: '待处理',
  'filled-awaiting-user': '已填好，等你提交',
  'submitted-awaiting-email': '已提交，等邮件确认',
  'needs-id': '需要你上传证件',
  done: '完成',
  failed: '失败'
};

const ERROR_TEXT = {
  WRONG_PASSPHRASE: '口令不对，或资料已损坏。',
  WEAK_PASSPHRASE: '口令至少 8 位。',
  ALREADY_INITIALIZED: '已经有加密资料库，请直接解锁。',
  NOT_INITIALIZED: '还没有加密资料库。',
  LOCKED: '请先解锁。',
  WEAK_KDF: '加密参数不安全，已拒绝。',
  NO_PASSPHRASE: '请输入口令。'
};

let initialized = false;
let rules = [];
let busy = false;

function text(tag, value, className) {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) {
    element.className = className;
  }
  return element;
}

function errorText(error) {
  const code = error && error.code;
  return ERROR_TEXT[code] || (error && error.message) || '操作失败。';
}

async function bg(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response || !response.ok) {
    throw new Error(response && response.error ? response.error : '后台没有响应');
  }
  return response;
}

function setGateError(message) {
  const element = $('gate-error');
  element.textContent = message || '';
  element.hidden = !message;
}

function renderGate(mode) {
  const unlock = mode === 'unlock';
  setGateError('');
  $('gate').hidden = false;
  $('workspace').hidden = true;
  $('lock-btn').hidden = true;
  $('gate-title').textContent = unlock ? '解锁资料库' : '设置口令';
  $('gate-hint').textContent = unlock
    ? '口令只用于本机解密，不保存、不上传。'
    : '口令不保存。忘记口令就只能删除全部资料。';
  $('confirm-row').hidden = unlock;
  $('passphrase-confirm').required = !unlock;
  $('gate-submit').textContent = unlock ? '解锁' : '创建加密资料库';
  $('passphrase').value = '';
  $('passphrase-confirm').value = '';
  $('passphrase').focus();
}

function fillForm(profile) {
  const normalized = normalizeProfile(profile);
  for (const input of document.querySelectorAll('[data-field]')) {
    const value = normalized[input.dataset.field];
    input.value = Array.isArray(value) ? value.join(', ') : value;
  }
}

function readForm() {
  const profile = {};
  for (const input of document.querySelectorAll('[data-field]')) {
    profile[input.dataset.field] = input.value;
  }
  return normalizeProfile(profile);
}

function showWorkspace(profile) {
  $('gate').hidden = true;
  $('workspace').hidden = false;
  $('lock-btn').hidden = false;
  fillForm(profile);
  refreshQueue();
}

async function handleGateSubmit(event) {
  event.preventDefault();
  if (busy) {
    return;
  }
  busy = true;
  setGateError('');
  const passphrase = $('passphrase').value;
  try {
    if (initialized) {
      const profile = await store.unlock(passphrase);
      $('passphrase').value = '';
      showWorkspace(profile);
    } else {
      if (passphrase !== $('passphrase-confirm').value) {
        throw new Error('两次输入的口令不一致。');
      }
      if (passphrase.length < 8) {
        throw new Error('口令至少 8 位。');
      }
      await store.setup(passphrase);
      const profile = readForm();
      await store.save(profile);
      $('passphrase').value = '';
      $('passphrase-confirm').value = '';
      initialized = true;
      showWorkspace(profile);
      $('profile-status').textContent = '已创建本地加密资料库。';
    }
  } catch (error) {
    setGateError(errorText(error));
  } finally {
    busy = false;
  }
}

async function handleSave(event) {
  event.preventDefault();
  if (!store.isUnlocked()) {
    return;
  }
  try {
    await store.save(readForm());
    $('profile-status').textContent = '已加密保存到本机。';
  } catch (error) {
    $('profile-status').textContent = errorText(error);
  }
}

async function handleLock() {
  store.lock();
  fillForm({});
  initialized = await store.isInitialized();
  renderGate(initialized ? 'unlock' : 'setup');
}

async function handleDeleteAll() {
  const ok = window.confirm('删除全部加密资料和本地队列？此操作不可撤销。');
  if (!ok) {
    return;
  }
  try {
    await store.deleteAll();
    await chrome.storage.local.remove('optout.pendingRun');
    await bg({ type: 'queue:clear' });
    initialized = false;
    fillForm({});
    await refreshQueue();
    renderGate('setup');
    $('gate-error').hidden = true;
  } catch (error) {
    $('profile-status').textContent = errorText(error);
  }
}

function queueActionButton(label, onClick, primary = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (primary) {
    button.className = 'primary';
  }
  button.addEventListener('click', onClick);
  return button;
}

async function changeStatus(id, status) {
  try {
    await bg({ type: 'queue:status', id, status });
    await refreshQueue();
  } catch (error) {
    $('run-status').textContent = errorText(error);
  }
}

function renderQueue(items) {
  const list = $('queue-list');
  list.textContent = '';
  $('queue-empty').hidden = items.length > 0;
  for (const item of items) {
    const li = document.createElement('li');
    const head = document.createElement('div');
    head.className = 'item-head';
    head.appendChild(text('span', item.ruleName || item.ruleId, 'item-name'));
    const label = STATUS_LABELS[item.status] || item.status;
    const badgeClass = item.status === 'failed'
      ? 'badge bad'
      : item.status === 'needs-id' || item.status === 'submitted-awaiting-email'
        ? 'badge warn'
        : 'badge';
    head.appendChild(text('span', label, badgeClass));
    li.appendChild(head);

    const meta = [item.host, item.note].filter(Boolean).join(' · ');
    if (meta) {
      li.appendChild(text('div', meta, 'item-meta'));
    }

    const actions = document.createElement('div');
    actions.className = 'item-actions';
    const removeButton = () =>
      queueActionButton('移出队列', async () => {
        try {
          await bg({ type: 'queue:remove', id: item.id });
          await refreshQueue();
        } catch (error) {
          $('run-status').textContent = errorText(error);
        }
      });
    if (item.status === 'filled-awaiting-user') {
      actions.appendChild(
        queueActionButton('我已提交，等邮件', () => changeStatus(item.id, 'submitted-awaiting-email'), true)
      );
      actions.appendChild(queueActionButton('失败', () => changeStatus(item.id, 'failed')));
      actions.appendChild(removeButton());
    } else if (item.status === 'submitted-awaiting-email') {
      actions.appendChild(queueActionButton('已收到确认', () => changeStatus(item.id, 'done'), true));
      actions.appendChild(queueActionButton('失败', () => changeStatus(item.id, 'failed')));
      actions.appendChild(removeButton());
    } else if (item.status === 'pending' || item.status === 'needs-id') {
      actions.appendChild(removeButton());
    } else if (item.status === 'done' || item.status === 'failed') {
      actions.appendChild(removeButton());
    }
    if (actions.childElementCount > 0) {
      li.appendChild(actions);
    }
    list.appendChild(li);
  }
}

async function refreshQueue() {
  try {
    const response = await bg({ type: 'queue:list' });
    renderQueue(response.items || []);
  } catch {
    renderQueue([]);
  }
}

function renderRules() {
  const list = $('rule-list');
  list.textContent = '';
  for (const rule of rules) {
    const li = document.createElement('li');
    const head = document.createElement('div');
    head.className = 'item-head';
    head.appendChild(text('span', rule.name, 'item-name'));
    const needs = rule.needs.length > 0 ? rule.needs.join(' / ') : '无额外步骤';
    head.appendChild(text('span', needs, 'badge warn'));
    li.appendChild(head);
    li.appendChild(text('div', rule.optOutUrl, 'item-meta'));

    const actions = document.createElement('div');
    actions.className = 'item-actions';
    actions.appendChild(queueActionButton('填入当前标签页', () => runRule(rule), true));
    li.appendChild(actions);
    list.appendChild(li);
  }
}

async function runRule(rule) {
  const status = $('run-status');
  status.textContent = '';
  if (busy) {
    return;
  }
  if (!store.isUnlocked()) {
    status.textContent = '请先解锁。';
    return;
  }
  busy = true;
  let enqueuedId = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url) {
      throw new Error('找不到当前标签页。请先打开目标站点，再点扩展。');
    }
    const url = new URL(tab.url);
    if (url.protocol !== 'https:' || !hostMatchesPermission(url.hostname, rule.hostPermission)) {
      throw new Error('当前标签页不在该规则允许的 https 站点内。');
    }

    // Best effort. Today's manifest intentionally declares no optional host
    // permissions yet; activeTab still covers the tab the user just invoked.
    try {
      await chrome.permissions.request({ origins: [rule.hostPermission] });
    } catch {
      // Keep going with activeTab; rules will gain declared origins later.
    }

    const profile = await store.load();
    const queueState = await bg({ type: 'queue:list' });
    const active = queueState.next;
    if (active && !(active.ruleId === rule.id && active.host === url.hostname)) {
      throw new Error('队列里还有上一家未完成，请先在页面上处理并更新它的状态。');
    }
    const enqueued = await bg({
      type: 'queue:enqueue',
      item: {
        ruleId: rule.id,
        ruleName: rule.name,
        host: url.hostname
      }
    });

    const config = {
      rule,
      profile,
      queueItemId: enqueued.item ? enqueued.item.id : ''
    };
    enqueuedId = config.queueItemId || null;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (payload) => {
        window.__OPTOUT_CONFIG__ = payload;
      },
      args: [config]
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/runner.js']
    });

    status.textContent = '已开始填写。填好后请在页面上核对并亲自提交；验证码与邮件确认也由你完成。';
    await refreshQueue();
  } catch (error) {
    if (enqueuedId) {
      try {
        const state = await bg({ type: 'queue:list' });
        const item = state.items.find((entry) => entry.id === enqueuedId);
        if (item && item.status === 'pending') {
          await bg({ type: 'queue:remove', id: enqueuedId });
        }
      } catch {
        // The queue is local; leave it untouched if the cleanup check fails.
      }
    }
    status.textContent = error && error.message ? error.message : '无法开始。';
  } finally {
    busy = false;
  }
}

async function loadRules() {
  try {
    const response = await fetch(chrome.runtime.getURL('rules/demo.json'));
    const data = await response.json();
    const checked = validateRules(data.rules);
    rules = checked.rules;
    if (rules.length === 0) {
      $('rule-list').appendChild(text('li', '没有通过校验的规则。', 'item-meta'));
      return;
    }
    renderRules();
  } catch {
    $('rule-list').appendChild(text('li', '规则读取失败。', 'item-meta'));
  }
}

async function init() {
  initialized = await store.isInitialized();
  renderGate(initialized ? 'unlock' : 'setup');
  await refreshQueue();
  await loadRules();

  $('gate-form').addEventListener('submit', handleGateSubmit);
  $('profile-form').addEventListener('submit', handleSave);
  $('lock-btn').addEventListener('click', handleLock);
  $('delete-btn').addEventListener('click', handleDeleteAll);

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'optout:progress') {
      refreshQueue();
    }
  });
}

init().catch((error) => {
  setGateError(errorText(error));
});
