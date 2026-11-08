// Local data-rights request tracker with a status machine and deadline checks.
//
// Records are stored in the same encrypted envelope format as the opt-out
// profile store (PBKDF2 + AES-GCM, see ../profile-store.js). The passphrase and
// record plaintext never leave the device. No network access.

import {
  deriveKey,
  encryptJson,
  decryptJson,
  randomBytes,
  KDF_ITERATIONS,
  KDF_HASH,
  SALT_BYTES,
  MIN_PASSPHRASE_LENGTH
} from '../profile-store.js';
import {
  computeDeadlines,
  isPastDue,
  isReminderDue,
  effectiveDueDate,
  isValidIsoDate
} from './deadlines.js';
import {
  RIGHTS,
  getJurisdiction,
  validateJurisdiction
} from './jurisdictions.schema.js';

export const REQUESTS_KEY = 'optout.rights.requests.v1';

export const REQUEST_STATUSES = Object.freeze([
  'draft',
  'sent',
  'answered',
  'overdue',
  'escalated',
  'closed'
]);

const TRANSITIONS = Object.freeze({
  draft: ['sent', 'closed'],
  sent: ['answered', 'overdue', 'closed'],
  overdue: ['answered', 'escalated', 'closed'],
  escalated: ['answered', 'closed'],
  answered: ['closed'],
  closed: []
});

export class TrackerError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'TrackerError';
    this.code = code;
  }
}

export function isRequestStatus(status) {
  return REQUEST_STATUSES.includes(status);
}

export function canTransition(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
}

export function assertTransition(from, to) {
  if (!isRequestStatus(from) || !isRequestStatus(to)) {
    throw new TrackerError('UNKNOWN_STATUS', `Unknown request status: ${from} -> ${to}`);
  }
  if (!canTransition(from, to)) {
    throw new TrackerError('INVALID_TRANSITION', `Invalid request transition: ${from} -> ${to}`);
  }
}

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
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

function emptyState() {
  return { v: 1, requests: [] };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TrackerError('INVALID_RECORD', `${field} is required`);
  }
  return value.trim();
}

function normalizeState(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const requests = Array.isArray(source.requests) ? source.requests : [];
  return {
    v: 1,
    requests: requests.filter(
      (item) => item && typeof item === 'object' && isRequestStatus(item.status)
    )
  };
}

/**
 * @param {object} options
 * @param {Crypto} options.crypto WebCrypto (browser) or node:crypto.webcrypto
 * @param {{get:Function,set:Function,remove:Function}} options.storage async storage adapter
 * @param {string} [options.storageKey]
 * @param {() => number} [options.now] clock in milliseconds
 * @param {number} [options.iterations]
 */
export function createTracker({
  crypto,
  storage,
  storageKey = REQUESTS_KEY,
  now = () => Date.now(),
  iterations = KDF_ITERATIONS
}) {
  if (!crypto || !crypto.subtle) {
    throw new TrackerError('NO_WEBCRYPTO', 'WebCrypto is required');
  }
  if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
    throw new TrackerError('NO_STORAGE', 'A storage adapter is required');
  }
  if (!Number.isInteger(iterations) || iterations < KDF_ITERATIONS) {
    throw new TrackerError(
      'WEAK_KDF',
      `PBKDF2 iterations must be at least ${KDF_ITERATIONS}`
    );
  }

  let key = null;
  let salt = null;
  let activeIterations = iterations;
  let state = emptyState();

  function clockIso() {
    const value = now();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new TrackerError('INVALID_CLOCK', 'now() must return a valid timestamp');
    }
    return date.toISOString();
  }

  function requireUnlocked() {
    if (!key) {
      throw new TrackerError('LOCKED', 'Unlock the request tracker first');
    }
  }

  async function readBlob() {
    const blob = await storage.get(storageKey);
    return blob && typeof blob === 'object' ? blob : null;
  }

  async function isInitialized() {
    return (await readBlob()) !== null;
  }

  async function persist() {
    if (!key || !salt) {
      throw new TrackerError('LOCKED', 'Unlock the request tracker first');
    }
    const cipher = await encryptJson(crypto, key, state);
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
  }

  async function setup(passphrase) {
    if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE_LENGTH) {
      throw new TrackerError(
        'WEAK_PASSPHRASE',
        `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`
      );
    }
    if (await isInitialized()) {
      throw new TrackerError('ALREADY_INITIALIZED', 'Request tracker already exists');
    }
    salt = randomBytes(crypto, SALT_BYTES);
    activeIterations = iterations;
    key = await deriveKey(crypto, passphrase, salt, activeIterations);
    state = emptyState();
    await persist();
    return true;
  }

  async function unlock(passphrase) {
    if (typeof passphrase !== 'string' || passphrase.length === 0) {
      throw new TrackerError('NO_PASSPHRASE', 'Passphrase is required');
    }
    const blob = await readBlob();
    if (!blob || !blob.kdf || !blob.cipher) {
      key = null;
      salt = null;
      throw new TrackerError('NOT_INITIALIZED', 'No encrypted request tracker exists yet');
    }
    const blobIterations = Number(blob.kdf.iterations);
    if (!Number.isInteger(blobIterations) || blobIterations < KDF_ITERATIONS) {
      throw new TrackerError('CORRUPT_BLOB', 'Stored KDF settings are invalid');
    }
    const candidateSalt = fromBase64(blob.kdf.salt);
    const candidateKey = await deriveKey(crypto, passphrase, candidateSalt, blobIterations);
    try {
      const decrypted = await decryptJson(crypto, candidateKey, blob.cipher);
      key = candidateKey;
      salt = candidateSalt;
      activeIterations = blobIterations;
      state = normalizeState(decrypted);
      return clone(state);
    } catch {
      key = null;
      salt = null;
      throw new TrackerError(
        'WRONG_PASSPHRASE',
        'Passphrase is incorrect or the stored records are damaged'
      );
    }
  }

  function lock() {
    key = null;
    salt = null;
    state = emptyState();
  }

  function isUnlocked() {
    return key !== null;
  }

  function list() {
    requireUnlocked();
    return clone(state.requests);
  }

  function get(id) {
    requireUnlocked();
    const record = state.requests.find((item) => item.id === id);
    return record ? clone(record) : null;
  }

  async function create({ company, jurisdiction, right, note = '' }) {
    requireUnlocked();
    const companyName = cleanText(company, 'company');
    const jurisdictionId = cleanText(jurisdiction, 'jurisdiction');
    if (!RIGHTS.includes(right)) {
      throw new TrackerError('UNKNOWN_RIGHT', `Unknown right: ${String(right)}`);
    }
    const timestamp = clockIso();
    const id = `req-${Array.from(randomBytes(crypto, 6))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')}`;
    const record = {
      id,
      company: companyName,
      jurisdiction: jurisdictionId,
      right,
      sentDate: null,
      status: 'draft',
      deadlines: null,
      note: typeof note === 'string' ? note.trim() : '',
      createdAt: timestamp,
      updatedAt: timestamp,
      events: [{ type: 'created', at: timestamp, note: '' }]
    };
    state.requests.push(record);
    await persist();
    return clone(record);
  }

  async function send(
    id,
    { sentDate, jurisdiction = null, allowUnverified = false, holidays = [] } = {}
  ) {
    requireUnlocked();
    const record = state.requests.find((item) => item.id === id);
    if (!record) {
      throw new TrackerError('NOT_FOUND', 'Request not found');
    }
    assertTransition(record.status, 'sent');
    if (!isValidIsoDate(sentDate)) {
      throw new TrackerError('INVALID_DATE', 'sentDate must be a YYYY-MM-DD date');
    }
    const data = jurisdiction || getJurisdiction(record.jurisdiction);
    if (!data) {
      throw new TrackerError('UNKNOWN_JURISDICTION', 'Jurisdiction data is required');
    }
    const validation = validateJurisdiction(data);
    if (!validation.ok) {
      throw new TrackerError(
        'INVALID_JURISDICTION',
        `Invalid jurisdiction data: ${validation.errors.join('; ')}`
      );
    }
    if (data.verified !== true && !allowUnverified) {
      throw new TrackerError(
        'UNVERIFIED_JURISDICTION',
        'Refusing to schedule a real request from unverified jurisdiction data'
      );
    }
    if (!data.rights.includes(record.right)) {
      throw new TrackerError(
        'RIGHT_NOT_AVAILABLE',
        `Right "${record.right}" is not available in ${data.id}`
      );
    }
    const deadlines = computeDeadlines({
      sentDate,
      responseDays: data.responseDays,
      dayType: data.dayType,
      extendableDays: data.extendableDays,
      holidays
    });
    record.sentDate = sentDate;
    record.deadlines = deadlines;
    record.status = 'sent';
    record.updatedAt = clockIso();
    record.events.push({ type: 'sent', at: sentDate, note: '' });
    await persist();
    return clone(record);
  }

  async function transition(id, to, { at = null, note = '' } = {}) {
    requireUnlocked();
    const record = state.requests.find((item) => item.id === id);
    if (!record) {
      throw new TrackerError('NOT_FOUND', 'Request not found');
    }
    assertTransition(record.status, to);
    record.status = to;
    record.updatedAt = clockIso();
    record.events.push({
      type: to,
      at: at || clockIso(),
      note: typeof note === 'string' ? note.trim() : ''
    });
    await persist();
    return clone(record);
  }

  function markAnswered(id, options = {}) {
    return transition(id, 'answered', options);
  }

  function escalate(id, options = {}) {
    return transition(id, 'escalated', options);
  }

  function close(id, options = {}) {
    return transition(id, 'closed', options);
  }

  /** Mark stale sent requests as overdue. Returns the requests that changed. */
  async function refresh(today) {
    requireUnlocked();
    if (!isValidIsoDate(today)) {
      throw new TrackerError('INVALID_DATE', 'today must be a YYYY-MM-DD date');
    }
    const changed = [];
    for (const record of state.requests) {
      if (record.status === 'sent' && record.deadlines && isPastDue(record.deadlines, today)) {
        record.status = 'overdue';
        record.updatedAt = clockIso();
        record.events.push({ type: 'overdue', at: today, note: '' });
        changed.push(clone(record));
      }
    }
    if (changed.length > 0) {
      await persist();
    }
    return changed;
  }

  /** Local reminders: deadline approaching or already missed. */
  function reminders(today) {
    requireUnlocked();
    if (!isValidIsoDate(today)) {
      throw new TrackerError('INVALID_DATE', 'today must be a YYYY-MM-DD date');
    }
    const out = [];
    for (const record of state.requests) {
      if (!record.deadlines) {
        continue;
      }
      let kind = null;
      if (record.status === 'sent' && isPastDue(record.deadlines, today)) {
        kind = 'overdue';
      } else if (record.status === 'overdue') {
        kind = 'overdue';
      } else if (record.status === 'sent' && isReminderDue(record.deadlines, today)) {
        kind = 'reminder';
      }
      if (kind) {
        out.push({
          id: record.id,
          company: record.company,
          jurisdiction: record.jurisdiction,
          right: record.right,
          kind,
          dueDate: effectiveDueDate(record.deadlines),
          reminderDate: record.deadlines.reminderDate
        });
      }
    }
    return out;
  }

  async function remove(id) {
    requireUnlocked();
    const before = state.requests.length;
    state.requests = state.requests.filter((item) => item.id !== id);
    if (state.requests.length === before) {
      throw new TrackerError('NOT_FOUND', 'Request not found');
    }
    await persist();
    return true;
  }

  async function deleteAll() {
    key = null;
    salt = null;
    state = emptyState();
    if (typeof storage.remove === 'function') {
      await storage.remove(storageKey);
    }
    return true;
  }

  return {
    setup,
    unlock,
    lock,
    isUnlocked,
    isInitialized,
    load: () => {
      requireUnlocked();
      return clone(state);
    },
    list,
    get,
    create,
    send,
    transition,
    markAnswered,
    escalate,
    close,
    refresh,
    reminders,
    remove,
    deleteAll
  };
}
