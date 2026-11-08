// Local-only opt-out queue. One site is worked at a time, in insertion order.
// Nothing in this module talks to a network.

export const QUEUE_KEY = 'optout.queue.v1';

export const STATUSES = Object.freeze([
  'pending',
  'filled-awaiting-user',
  'submitted-awaiting-email',
  'needs-id',
  'done',
  'failed'
]);

export const TERMINAL_STATUSES = Object.freeze(['done', 'failed']);

const TRANSITIONS = Object.freeze({
  pending: ['filled-awaiting-user', 'needs-id', 'failed'],
  'needs-id': ['filled-awaiting-user', 'failed'],
  'filled-awaiting-user': ['submitted-awaiting-email', 'failed'],
  'submitted-awaiting-email': ['done', 'failed'],
  done: [],
  failed: []
});

export class QueueError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'QueueError';
    this.code = code;
  }
}

export function isStatus(status) {
  return STATUSES.includes(status);
}

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
}

export function assertTransition(from, to) {
  if (!isStatus(from) || !isStatus(to)) {
    throw new QueueError('UNKNOWN_STATUS', `Unknown queue status: ${from} -> ${to}`);
  }
  if (!canTransition(from, to)) {
    throw new QueueError(
      'INVALID_TRANSITION',
      `Invalid queue transition: ${from} -> ${to}`
    );
  }
}

function emptyQueue() {
  return { v: 1, items: [] };
}

export function createQueue({ storage, storageKey = QUEUE_KEY, now = () => Date.now() }) {
  if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
    throw new QueueError('NO_STORAGE', 'A storage adapter is required');
  }

  async function read() {
    const raw = await storage.get(storageKey);
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) {
      return emptyQueue();
    }
    return { v: 1, items: raw.items.filter((item) => item && isStatus(item.status)) };
  }

  async function write(data) {
    await storage.set({ [storageKey]: data });
    return data;
  }

  async function list() {
    const data = await read();
    return data.items.map((item) => ({ ...item }));
  }

  async function next() {
    const data = await read();
    return data.items.find((item) => !isTerminal(item.status)) || null;
  }

  async function enqueue({ ruleId, ruleName, host, status = 'pending', note = '' }) {
    if (!ruleId || typeof ruleId !== 'string') {
      throw new QueueError('INVALID_ITEM', 'ruleId is required');
    }
    if (!isStatus(status)) {
      throw new QueueError('UNKNOWN_STATUS', `Unknown queue status: ${status}`);
    }
    const data = await read();
    const existing = data.items.find(
      (item) => item.ruleId === ruleId && item.host === host && !isTerminal(item.status)
    );
    if (existing) {
      return { ...existing };
    }
    const timestamp = now();
    const item = {
      id: `${ruleId}:${host}:${timestamp}`,
      ruleId,
      ruleName: typeof ruleName === 'string' ? ruleName : ruleId,
      host: typeof host === 'string' ? host : '',
      status,
      note: typeof note === 'string' ? note : '',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    data.items.push(item);
    await write(data);
    return { ...item };
  }

  async function transition(id, to, note = '') {
    const data = await read();
    const item = data.items.find((entry) => entry.id === id);
    if (!item) {
      throw new QueueError('NOT_FOUND', 'Queue item not found');
    }
    assertTransition(item.status, to);
    item.status = to;
    if (typeof note === 'string') {
      item.note = note;
    }
    item.updatedAt = now();
    await write(data);
    return { ...item };
  }

  async function remove(id) {
    const data = await read();
    const before = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);
    if (data.items.length === before) {
      throw new QueueError('NOT_FOUND', 'Queue item not found');
    }
    await write(data);
    return true;
  }

  async function clear() {
    await write(emptyQueue());
    return true;
  }

  return { list, next, enqueue, transition, remove, clear };
}
