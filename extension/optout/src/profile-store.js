// SecureInChat Opt-Out -- local encrypted profile store.
// Pure module: the caller injects WebCrypto and a tiny async storage adapter.
// The passphrase is never stored, logged, or sent anywhere.
//
// Stored blob shape:
//   {
//     v: 1,
//     kdf: { salt: <base64>, iterations: 310000, hash: "SHA-256" },
//     cipher: { iv: <base64>, data: <base64> }
//   }

export const STORAGE_KEY = 'optout.profile.v1';
export const KDF_ITERATIONS = 310000;
export const KDF_HASH = 'SHA-256';
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const MIN_PASSPHRASE_LENGTH = 8;

export const PROFILE_FIELDS = Object.freeze([
  'fullName',
  'previousNames',
  'city',
  'state',
  'ageRange',
  'phone',
  'email'
]);

export class ProfileStoreError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ProfileStoreError';
    this.code = code;
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function randomBytes(crypto, length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function deriveKey(crypto, passphrase, salt, iterations = KDF_ITERATIONS) {
  if (!crypto || !crypto.subtle) {
    throw new ProfileStoreError('NO_WEBCRYPTO', 'WebCrypto is required');
  }
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: KDF_HASH
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson(crypto, key, value) {
  const iv = randomBytes(crypto, IV_BYTES);
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptJson(crypto, key, cipher) {
  const iv = fromBase64(cipher.iv);
  const data = fromBase64(cipher.data);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return JSON.parse(decoder.decode(new Uint8Array(plaintext)));
}

export function normalizeProfile(profile) {
  const source = profile && typeof profile === 'object' ? profile : {};
  const out = {};
  for (const field of PROFILE_FIELDS) {
    const raw = source[field];
    if (field === 'previousNames') {
      if (Array.isArray(raw)) {
        out[field] = raw.map((item) => String(item).trim()).filter(Boolean);
      } else if (typeof raw === 'string') {
        out[field] = raw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      } else {
        out[field] = [];
      }
    } else {
      out[field] = raw === undefined || raw === null ? '' : String(raw).trim();
    }
  }
  return out;
}

export function createProfileStore({
  crypto,
  storage,
  storageKey = STORAGE_KEY,
  iterations = KDF_ITERATIONS
}) {
  if (!crypto || !crypto.subtle) {
    throw new ProfileStoreError('NO_WEBCRYPTO', 'WebCrypto is required');
  }
  if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
    throw new ProfileStoreError('NO_STORAGE', 'A storage adapter is required');
  }
  if (!Number.isInteger(iterations) || iterations < KDF_ITERATIONS) {
    throw new ProfileStoreError(
      'WEAK_KDF',
      `PBKDF2 iterations must be at least ${KDF_ITERATIONS}`
    );
  }

  let key = null;
  let salt = null;
  let activeIterations = iterations;

  async function readBlob() {
    const blob = await storage.get(storageKey);
    return blob && typeof blob === 'object' ? blob : null;
  }

  async function isInitialized() {
    return (await readBlob()) !== null;
  }

  async function setup(passphrase) {
    if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE_LENGTH) {
      throw new ProfileStoreError(
        'WEAK_PASSPHRASE',
        `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`
      );
    }
    if (await isInitialized()) {
      throw new ProfileStoreError('ALREADY_INITIALIZED', 'Profile store already exists');
    }
    salt = randomBytes(crypto, SALT_BYTES);
    activeIterations = iterations;
    key = await deriveKey(crypto, passphrase, salt, activeIterations);
    return true;
  }

  async function unlock(passphrase) {
    if (typeof passphrase !== 'string' || passphrase.length === 0) {
      throw new ProfileStoreError('NO_PASSPHRASE', 'Passphrase is required');
    }
    const blob = await readBlob();
    if (!blob || !blob.kdf || !blob.cipher) {
      key = null;
      salt = null;
      throw new ProfileStoreError('NOT_INITIALIZED', 'No encrypted profile exists yet');
    }
    const blobIterations = Number(blob.kdf.iterations);
    if (!Number.isInteger(blobIterations) || blobIterations < KDF_ITERATIONS) {
      throw new ProfileStoreError('CORRUPT_BLOB', 'Stored KDF settings are invalid');
    }
    const candidateSalt = fromBase64(blob.kdf.salt);
    const candidateKey = await deriveKey(
      crypto,
      passphrase,
      candidateSalt,
      blobIterations
    );
    try {
      const profile = await decryptJson(crypto, candidateKey, blob.cipher);
      key = candidateKey;
      salt = candidateSalt;
      activeIterations = blobIterations;
      return normalizeProfile(profile);
    } catch {
      key = null;
      salt = null;
      throw new ProfileStoreError(
        'WRONG_PASSPHRASE',
        'Passphrase is incorrect or the stored profile is damaged'
      );
    }
  }

  function lock() {
    key = null;
    salt = null;
  }

  function isUnlocked() {
    return key !== null;
  }

  async function save(profile) {
    if (!key) {
      throw new ProfileStoreError('LOCKED', 'Unlock the profile store first');
    }
    if (!salt) {
      throw new ProfileStoreError('NO_SALT', 'Derive a key before saving');
    }
    const normalized = normalizeProfile(profile);
    const cipher = await encryptJson(crypto, key, normalized);
    const blob = {
      v: 1,
      kdf: {
        salt: toBase64(salt),
        iterations: activeIterations,
        hash: KDF_HASH
      },
      cipher
    };
    await storage.set({ [storageKey]: blob });
    return normalized;
  }

  async function load() {
    if (!key) {
      throw new ProfileStoreError('LOCKED', 'Unlock the profile store first');
    }
    const blob = await readBlob();
    if (!blob || !blob.cipher) {
      throw new ProfileStoreError('NOT_INITIALIZED', 'No encrypted profile exists yet');
    }
    try {
      const profile = await decryptJson(crypto, key, blob.cipher);
      return normalizeProfile(profile);
    } catch {
      key = null;
      salt = null;
      throw new ProfileStoreError('CORRUPT_BLOB', 'Stored profile could not be decrypted');
    }
  }

  async function deleteAll() {
    key = null;
    salt = null;
    await storage.remove(storageKey);
    return true;
  }

  return {
    setup,
    unlock,
    lock,
    isUnlocked,
    isInitialized,
    save,
    load,
    deleteAll
  };
}
