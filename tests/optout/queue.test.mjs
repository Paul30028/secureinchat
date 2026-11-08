import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createQueue,
  canTransition,
  assertTransition,
  QUEUE_KEY
} from '../../extension/optout/src/queue.js';

function memoryStorage() {
  const data = new Map();
  return {
    async get(key) {
      return data.get(key);
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) {
        data.set(key, value);
      }
    },
    async remove(key) {
      data.delete(key);
    },
    dump() {
      return Object.fromEntries(data);
    }
  };
}

function makeQueue() {
  let tick = 1000;
  return createQueue({
    storage: memoryStorage(),
    now: () => {
      tick += 1;
      return tick;
    }
  });
}

test('one site at a time, in insertion order', async () => {
  const queue = makeQueue();
  const first = await queue.enqueue({
    ruleId: 'mock-site-a',
    ruleName: 'A',
    host: '127.0.0.1'
  });
  await queue.enqueue({ ruleId: 'mock-site-b', ruleName: 'B', host: '127.0.0.1' });

  assert.equal(first.status, 'pending');
  assert.equal((await queue.next()).ruleId, 'mock-site-a');
  assert.equal((await queue.list()).length, 2);
});

test('happy path: pending -> filled -> submitted -> done', async () => {
  const queue = makeQueue();
  const item = await queue.enqueue({ ruleId: 'mock-site-a', host: '127.0.0.1' });
  await queue.transition(item.id, 'filled-awaiting-user');
  await queue.transition(item.id, 'submitted-awaiting-email');
  const done = await queue.transition(item.id, 'done');
  assert.equal(done.status, 'done');
  assert.equal(await queue.next(), null);
  assert.equal(canTransition('done', 'pending'), false);
});

test('needs-id path and terminal failure', async () => {
  const queue = makeQueue();
  const item = await queue.enqueue({ ruleId: 'mock-site-b', host: '127.0.0.1' });
  const needsId = await queue.transition(item.id, 'needs-id');
  assert.equal(needsId.status, 'needs-id');
  await queue.transition(item.id, 'filled-awaiting-user');
  const failed = await queue.transition(item.id, 'failed', '页面结构变了');
  assert.equal(failed.note, '页面结构变了');
  assert.equal(await queue.next(), null);
  await assert.rejects(
    () => queue.transition(item.id, 'pending'),
    (error) => error.code === 'INVALID_TRANSITION'
  );
});

test('illegal transitions are rejected and do not mutate state', async () => {
  const queue = makeQueue();
  const item = await queue.enqueue({ ruleId: 'mock-site-a', host: '127.0.0.1' });
  await assert.rejects(
    () => queue.transition(item.id, 'done'),
    (error) => error.code === 'INVALID_TRANSITION'
  );
  assert.equal((await queue.list())[0].status, 'pending');
  assert.throws(() => assertTransition('filled-awaiting-user', 'done'));
  assert.equal(canTransition('pending', 'failed'), true);
});

test('duplicate active items are deduplicated; clear empties everything', async () => {
  const queue = makeQueue();
  const first = await queue.enqueue({ ruleId: 'mock-site-a', host: '127.0.0.1' });
  const again = await queue.enqueue({ ruleId: 'mock-site-a', host: '127.0.0.1' });
  assert.equal(again.id, first.id);
  assert.equal((await queue.list()).length, 1);

  await queue.clear();
  assert.deepEqual(await queue.list(), []);
  assert.equal(await queue.next(), null);

  const storage = memoryStorage();
  await storage.set({ [QUEUE_KEY]: { v: 1, items: [] } });
  assert.ok(storage.dump()[QUEUE_KEY]);
});
