// Data-rights jurisdiction schema and test fixtures.
//
// IMPORTANT: the two entries below are fictional fixtures (TEST-A / TEST-B).
// They are NOT legal information and must never be shown to users as law.
// Real jurisdictions are supplied separately by the legal researcher and are
// only displayable when `verified: true`.
//
// Pure JS, no dependencies. Runs in browsers and Node.

export const RIGHTS = Object.freeze([
  'erasure',
  'access',
  'rectification',
  'optout-sale',
  'object'
]);

export const DAY_TYPES = Object.freeze(['calendar', 'business']);

export const JURISDICTION_FIELDS = Object.freeze([
  'id',
  'name',
  'law',
  'rights',
  'responseDays',
  'extendableDays',
  'dayType',
  'verificationNote',
  'regulator',
  'appliesWhen',
  'sources',
  'verified'
]);

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpUrl(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Structural validation only. It says nothing about whether the legal facts
 * are correct; use `isUsable` before showing anything as real law.
 *
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateJurisdiction(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['jurisdiction must be an object'] };
  }

  if (!isNonEmptyString(value.id) || !ID_PATTERN.test(value.id)) {
    errors.push('id must be a non-empty slug');
  }
  if (!isNonEmptyString(value.name)) {
    errors.push('name must be a non-empty string');
  }
  if (!isNonEmptyString(value.law)) {
    errors.push('law must be a non-empty string');
  }

  if (!Array.isArray(value.rights) || value.rights.length === 0) {
    errors.push('rights must be a non-empty array');
  } else {
    for (const right of value.rights) {
      if (!RIGHTS.includes(right)) {
        errors.push(`unknown right: ${String(right)}`);
      }
    }
    if (new Set(value.rights).size !== value.rights.length) {
      errors.push('rights must not contain duplicates');
    }
  }

  if (!Number.isInteger(value.responseDays) || value.responseDays <= 0) {
    errors.push('responseDays must be a positive integer');
  }
  if (!Number.isInteger(value.extendableDays) || value.extendableDays < 0) {
    errors.push('extendableDays must be a non-negative integer');
  }
  if (!DAY_TYPES.includes(value.dayType)) {
    errors.push('dayType must be calendar or business');
  }
  if (!isNonEmptyString(value.verificationNote)) {
    errors.push('verificationNote must be a non-empty string');
  }
  if (!isNonEmptyString(value.appliesWhen)) {
    errors.push('appliesWhen must be a non-empty string');
  }

  const regulator = value.regulator;
  if (!regulator || typeof regulator !== 'object') {
    errors.push('regulator must be an object');
  } else {
    if (!isNonEmptyString(regulator.name)) {
      errors.push('regulator.name must be a non-empty string');
    }
    if (!isHttpUrl(regulator.complaintUrl)) {
      errors.push('regulator.complaintUrl must be an http(s) URL');
    }
  }

  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    errors.push('sources must be a non-empty array');
  } else {
    value.sources.forEach((source, index) => {
      if (!source || typeof source !== 'object') {
        errors.push(`sources[${index}] must be an object`);
        return;
      }
      if (!isHttpUrl(source.url)) {
        errors.push(`sources[${index}].url must be an http(s) URL`);
      }
      if (!isNonEmptyString(source.checked)) {
        errors.push(`sources[${index}].checked must be a date string`);
      }
    });
  }

  if (typeof value.verified !== 'boolean') {
    errors.push('verified must be a boolean');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * True only when the record is structurally complete AND a human researcher
 * has marked it verified. The UI must use this before rendering a jurisdiction
 * as real legal guidance.
 */
export function isUsable(value) {
  return validateJurisdiction(value).ok && value.verified === true;
}

export class JurisdictionError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'JurisdictionError';
    this.code = code;
  }
}

export function assertUsable(value) {
  const result = validateJurisdiction(value);
  if (!result.ok) {
    throw new JurisdictionError(
      'INVALID_JURISDICTION',
      `Invalid jurisdiction data: ${result.errors.join('; ')}`
    );
  }
  if (value.verified !== true) {
    throw new JurisdictionError(
      'UNVERIFIED_JURISDICTION',
      'This jurisdiction is not verified for real-world display'
    );
  }
  return true;
}

const TEST_A = Object.freeze({
  id: 'TEST-A',
  name: 'Testland A (fictional)',
  law: 'TEST-A Data Protection Act (fictional test data)',
  rights: Object.freeze(['erasure', 'access', 'rectification']),
  responseDays: 30,
  extendableDays: 30,
  dayType: 'calendar',
  verificationNote: 'Fictional fixture for engine tests. Not legal information.',
  regulator: Object.freeze({
    name: 'Testland A Privacy Authority (fictional)',
    complaintUrl: 'https://example.test/test-a/complaint'
  }),
  appliesWhen: 'Fictional test only. Never show as real law.',
  sources: Object.freeze([
    Object.freeze({
      url: 'https://example.test/test-a/law',
      checked: '2026-11-08'
    })
  ]),
  verified: false
});

const TEST_B = Object.freeze({
  id: 'TEST-B',
  name: 'Testland B (fictional)',
  law: 'TEST-B Consumer Privacy Act (fictional test data)',
  rights: Object.freeze(['optout-sale', 'object', 'rectification']),
  responseDays: 10,
  extendableDays: 0,
  dayType: 'business',
  verificationNote: 'Fictional fixture for engine tests. Not legal information.',
  regulator: Object.freeze({
    name: 'Testland B Consumer Agency (fictional)',
    complaintUrl: 'https://example.test/test-b/complaint'
  }),
  appliesWhen: 'Fictional test only. Never show as real law.',
  sources: Object.freeze([
    Object.freeze({
      url: 'https://example.test/test-b/law',
      checked: '2026-11-08'
    })
  ]),
  verified: false
});

export const TEST_JURISDICTIONS = Object.freeze([TEST_A, TEST_B]);

export function getJurisdiction(id, list = TEST_JURISDICTIONS) {
  if (!Array.isArray(list)) {
    return null;
  }
  return list.find((entry) => entry && entry.id === id) || null;
}
