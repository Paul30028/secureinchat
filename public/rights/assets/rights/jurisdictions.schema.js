// Data-rights jurisdiction schema.
//
// Real jurisdiction records live in ./jurisdictions.js. Test fixtures live in
// tests/optout/fixtures/jurisdictions.js so that fictional entries can never be
// shipped as legal information.
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
  'deadlineNote',
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
  if (value.deadlineNote !== undefined && !isNonEmptyString(value.deadlineNote)) {
    errors.push('deadlineNote must be a non-empty string when present');
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

  if (!Array.isArray(value.sources)) {
    errors.push('sources must be an array');
  } else if (value.verified === true && value.sources.length === 0) {
    errors.push('verified jurisdictions must cite at least one source');
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
      if (value.verified === true && !isNonEmptyString(source.quote)) {
        errors.push(`sources[${index}].quote must be a non-empty quote for verified data`);
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

/**
 * Look up an id in an explicit list. Real records live in ./jurisdictions.js;
 * callers must pass the list or import the helper from that module.
 */
export function getJurisdiction(id, list = []) {
  if (!Array.isArray(list)) {
    return null;
  }
  return list.find((entry) => entry && entry.id === id) || null;
}
