import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  createProfileStore,
  KDF_ITERATIONS,
  STORAGE_KEY
} from '../../extension/optout/src/profile-store.js';

const PROFILE = {
  fullName: '张三',
  previousNames: ['张叁', 'San Zhang'],
  city: 'Austin',
  state: 'TX',
  ageRange: '30-39',
  phone: '+1 512 555 0100',
  email: 'zhangsan@example.test'
};

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
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

function makeStore(storage, options = {}) {
  return createProfileStore({
    crypto: webcrypto,
    storage,
    ...options
  });
}

test('profile encrypts and decrypts all fields; KDF metadata is strong', async () => {
  const storage = memoryStorage();
  const store = makeStore(storage);
  await store.setup('correct horse battery staple');
  await store.save(PROFILE);
  assert.equal(store.isUnlocked(), true);
  assert.deepEqual(await store.load(), PROFILE);

  const blob = storage.dump()[STORAGE_KEY];
  assert.equal(blob.v, 1);
  assert.ok(blob.kdf.iterations >= 310000);
  assert.equal(blob.kdf.iterations, KDF_ITERATIONS);
  assert.equal(blob.kdf.hash, 'SHA-256');
  assert.ok(blob.cipher.iv.length > 0);
  assert.ok(blob.cipher.data.length > 0);

  store.lock();
  assert.equal(store.isUnlocked(), false);
  assert.deepEqual(await store.unlock('correct horse battery staple'), PROFILE);
});

test('wrong passphrase fails and leaves the store locked', async () => {
  const storage = memoryStorage();
  const store = makeStore(storage);
  await store.setup('correct horse battery staple');
  await store.save(PROFILE);
  store.lock();

  await assert.rejects(
    () => store.unlock('wrong passphrase'),
    (error) => error.code === 'WRONG_PASSPHRASE'
  );
  assert.equal(store.isUnlocked(), false);
  await assert.rejects(() => store.load(), (error) => error.code === 'LOCKED');
  assert.deepEqual(await store.unlock('correct horse battery staple'), PROFILE);
});

test('salt and IV are random across stores and saves', async () => {
  const storageA = memoryStorage();
  const storageB = memoryStorage();
  const storeA = makeStore(storageA);
  const storeB = makeStore(storageB);

  await storeA.setup('same passphrase for both');
  await storeA.save(PROFILE);
  await storeB.setup('same passphrase for both');
  await storeB.save(PROFILE);

  const blobA = storageA.dump()[STORAGE_KEY];
  const blobB = storageB.dump()[STORAGE_KEY];
  assert.notEqual(blobA.kdf.salt, blobB.kdf.salt);
  assert.notEqual(blobA.cipher.data, blobB.cipher.data);

  const firstIv = blobA.cipher.iv;
  await storeA.save({ ...PROFILE, city: 'Dallas' });
  const secondBlob = storageA.dump()[STORAGE_KEY];
  assert.notEqual(secondBlob.cipher.iv, firstIv);
  assert.equal((await storeA.load()).city, 'Dallas');
});

test('delete all removes profile, key material and plaintext', async () => {
  const storage = memoryStorage();
  const store = makeStore(storage);
  await store.setup('correct horse battery staple');
  await store.save(PROFILE);

  const serialized = JSON.stringify(storage.dump());
  assert.equal(serialized.includes('correct horse battery staple'), false);
  assert.equal(serialized.includes('zhangsan@example.test'), false);

  await store.deleteAll();
  assert.equal(store.isUnlocked(), false);
  assert.equal(await store.isInitialized(), false);
  assert.deepEqual(storage.dump(), {});
  await assert.rejects(
    () => store.unlock('correct horse battery staple'),
    (error) => error.code === 'NOT_INITIALIZED'
  );
});

test('weak KDF settings and passphrases are rejected', async () => {
  assert.throws(
    () => makeStore(memoryStorage(), { iterations: 1000 }),
    (error) => error.code === 'WEAK_KDF'
  );
  const store = makeStore(memoryStorage());
  await assert.rejects(
    () => store.setup('short'),
    (error) => error.code === 'WEAK_PASSPHRASE'
  );
  await assert.rejects(
    () => store.save(PROFILE),
    (error) => error.code === 'LOCKED'
  );
});

test('a reopened store keeps the original KDF iteration count', async () => {
  const storage = memoryStorage();
  const store = makeStore(storage, { iterations: 400000 });
  await store.setup('correct horse battery staple');
  await store.save(PROFILE);
  store.lock();
  await store.unlock('correct horse battery staple');
  await store.save({ ...PROFILE, city: 'Dallas' });
  assert.equal(storage.dump()[STORAGE_KEY].kdf.iterations, 400000);
  assert.equal((await store.load()).city, 'Dallas');
});
