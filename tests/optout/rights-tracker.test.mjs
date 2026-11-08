import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  createTracker,
  canTransition,
  REQUESTS_KEY
} from '../../extension/optout/src/rights/tracker.js';
import { TEST_JURISDICTIONS } from '../../extension/optout/src/rights/jurisdictions.schema.js';

const TEST_A = TEST_JURISDICTIONS[0];
const TEST_B = TEST_JURISDICTIONS[1];
const PASSPHRASE = 'correct horse battery staple';

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

function makeTracker(storage = memoryStorage()) {
  let tick = Date.parse('2028-01-01T00:00:00Z');
  const tracker = createTracker({
    crypto: webcrypto,
    storage,
    now: () => {
      tick += 1000;
      return tick;
    }
  });
  return { tracker, storage };
}

test('request records are encrypted with the profile-store envelope', async () => {
  const { tracker, storage } = makeTracker();
  await tracker.setup(PASSPHRASE);
  const record = await tracker.create({
    company: 'Acme Secret Co',
    jurisdiction: 'TEST-A',
    right: 'erasure'
  });
  assert.equal(record.status, 'draft');

  const serialized = JSON.stringify(storage.dump());
  assert.equal(serialized.includes('Acme Secret Co'), false);
  assert.equal(serialized.includes('TEST-A'), false);
  assert.ok(storage.dump()[REQUESTS_KEY].cipher.data.length > 0);
  assert.ok(storage.dump()[REQUESTS_KEY].kdf.iterations >= 310000);

  tracker.lock();
  assert.throws(() => tracker.list(), (error) => error.code === 'LOCKED');
  const restored = await tracker.unlock(PASSPHRASE);
  assert.equal(restored.requests.length, 1);
  assert.equal(restored.requests[0].company, 'Acme Secret Co');
  await assert.rejects(
    () => tracker.unlock('wrong passphrase'),
    (error) => error.code === 'WRONG_PASSPHRASE'
  );
});

test('status machine enforces valid transitions', async () => {
  const { tracker } = makeTracker();
  await tracker.setup(PASSPHRASE);
  const record = await tracker.create({
    company: 'Acme Test Co',
    jurisdiction: 'TEST-B',
    right: 'optout-sale'
  });

  await assert.rejects(
    () => tracker.transition(record.id, 'answered'),
    (error) => error.code === 'INVALID_TRANSITION'
  );
  assert.equal(canTransition('draft', 'sent'), true);
  assert.equal(canTransition('sent', 'escalated'), false);
  assert.equal(canTransition('overdue', 'escalated'), true);
  assert.equal(canTransition('answered', 'sent'), false);

  await tracker.send(record.id, {
    sentDate: '2028-02-25',
    jurisdiction: TEST_B,
    allowUnverified: true
  });
  await assert.rejects(
    () => tracker.send(record.id, { sentDate: '2028-02-26', allowUnverified: true }),
    (error) => error.code === 'INVALID_TRANSITION'
  );
  const answered = await tracker.markAnswered(record.id);
  assert.equal(answered.status, 'answered');
  await assert.rejects(
    () => tracker.escalate(record.id),
    (error) => error.code === 'INVALID_TRANSITION'
  );
  const closed = await tracker.close(record.id);
  assert.equal(closed.status, 'closed');
});

test('send stores business-day deadlines and unverified data is refused by default', async () => {
  const { tracker } = makeTracker();
  await tracker.setup(PASSPHRASE);
  const record = await tracker.create({
    company: 'Acme Test Co',
    jurisdiction: 'TEST-B',
    right: 'optout-sale'
  });

  await assert.rejects(
    () => tracker.send(record.id, { sentDate: '2028-02-25', jurisdiction: TEST_B }),
    (error) => error.code === 'UNVERIFIED_JURISDICTION'
  );

  const sent = await tracker.send(record.id, {
    sentDate: '2028-02-25',
    jurisdiction: TEST_B,
    allowUnverified: true
  });
  assert.equal(sent.status, 'sent');
  assert.equal(sent.deadlines.dueDate, '2028-03-10');
  assert.equal(sent.deadlines.extendedDueDate, null);
  assert.equal(sent.deadlines.reminderDate, '2028-03-07');
});

test('refresh flips sent to overdue and reminders appear at the right time', async () => {
  const { tracker } = makeTracker();
  await tracker.setup(PASSPHRASE);
  const record = await tracker.create({
    company: 'Acme Test Co',
    jurisdiction: 'TEST-B',
    right: 'optout-sale'
  });
  await tracker.send(record.id, {
    sentDate: '2028-02-25',
    jurisdiction: TEST_B,
    allowUnverified: true
  });

  assert.deepEqual(tracker.reminders('2028-03-06'), []);
  assert.equal(tracker.reminders('2028-03-07')[0].kind, 'reminder');
  assert.deepEqual(await tracker.refresh('2028-03-10'), []);
  const changed = await tracker.refresh('2028-03-11');
  assert.equal(changed.length, 1);
  assert.equal(changed[0].status, 'overdue');
  assert.equal(tracker.reminders('2028-03-11')[0].kind, 'overdue');
  assert.equal(tracker.get(record.id).status, 'overdue');

  const escalated = await tracker.escalate(record.id, { at: '2028-03-12' });
  assert.equal(escalated.status, 'escalated');
  const answered = await tracker.markAnswered(record.id);
  assert.equal(answered.status, 'answered');
});

test('records survive lock/unlock and deleteAll removes ciphertext', async () => {
  const { tracker, storage } = makeTracker();
  await tracker.setup(PASSPHRASE);
  const first = await tracker.create({
    company: 'Acme Test Co',
    jurisdiction: 'TEST-A',
    right: 'access'
  });
  tracker.lock();
  await tracker.unlock(PASSPHRASE);
  assert.equal(tracker.get(first.id).right, 'access');

  await tracker.deleteAll();
  assert.deepEqual(storage.dump(), {});
  assert.equal(tracker.isUnlocked(), false);
  await assert.rejects(
    () => tracker.unlock(PASSPHRASE),
    (error) => error.code === 'NOT_INITIALIZED'
  );
});
