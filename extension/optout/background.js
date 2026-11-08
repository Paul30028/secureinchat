// SecureInChat Opt-Out service worker.
// Owns only the local queue and badge. It never receives the user's profile,
// never stores the passphrase, and makes no network requests.

import { createQueue } from './src/queue.js';

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

const queue = createQueue({ storage });

async function updateBadge() {
  try {
    const items = await queue.list();
    const active = items.filter(
      (item) => item.status !== 'done' && item.status !== 'failed'
    ).length;
    await chrome.action.setBadgeBackgroundColor({ color: '#1f6f4a' });
    await chrome.action.setBadgeText({ text: active > 0 ? String(active) : '' });
  } catch {
    await chrome.action.setBadgeText({ text: '' });
  }
}

async function notifyProgress(message, sender) {
  if (!message || typeof message.ruleId !== 'string') {
    return;
  }
  const items = await queue.list();
  let senderHost = null;
  try {
    if (sender && sender.tab && sender.tab.url) {
      senderHost = new URL(sender.tab.url).hostname;
    }
  } catch {
    senderHost = null;
  }
  const target = items.find((item) => {
    if (item.ruleId !== message.ruleId) {
      return false;
    }
    if (item.status === 'done' || item.status === 'failed') {
      return false;
    }
    if (senderHost && item.host && item.host !== senderHost) {
      return false;
    }
    return true;
  });
  if (!target) {
    return;
  }
  const nextStatus = message.status;
  if (nextStatus === 'filled-awaiting-user' || nextStatus === 'needs-id' || nextStatus === 'failed') {
    try {
      await queue.transition(target.id, nextStatus, message.note || '');
    } catch {
      // A late progress message must never break the page the user is on.
    }
  }
  await updateBadge();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message && message.type) {
      case 'queue:list': {
        const items = await queue.list();
        sendResponse({ ok: true, items, next: items.find((item) => item.status !== 'done' && item.status !== 'failed') || null });
        break;
      }
      case 'queue:enqueue': {
        const item = await queue.enqueue(message.item || {});
        await updateBadge();
        sendResponse({ ok: true, item });
        break;
      }
      case 'queue:status': {
        const item = await queue.transition(message.id, message.status, message.note || '');
        await updateBadge();
        sendResponse({ ok: true, item });
        break;
      }
      case 'queue:remove': {
        await queue.remove(message.id);
        await updateBadge();
        sendResponse({ ok: true });
        break;
      }
      case 'queue:clear': {
        await queue.clear();
        await updateBadge();
        sendResponse({ ok: true });
        break;
      }
      case 'optout:progress': {
        await notifyProgress(message, sender);
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'unknown message' });
    }
  })().catch((error) => {
    sendResponse({ ok: false, error: error && error.message ? error.message : 'failed' });
  });
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  updateBadge();
});

updateBadge();
