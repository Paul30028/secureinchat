// Declarative rule schema + validator for SecureInChat Opt-Out.
// Rules are inert JSON. The extension never evaluates rule text as code and
// never loads a remote script. Anything that could execute or fetch is rejected.

import { PROFILE_FIELDS } from './profile-store.js';

export const ACTIONS = Object.freeze(['open', 'fill', 'click', 'waitFor', 'pause']);
export const NEEDS = Object.freeze(['email-confirm', 'captcha', 'id-upload', 'phone']);

const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const HOST_PERMISSION_RE = /^https:\/\/(\*\.)?([a-z0-9-]+\.)*[a-z0-9-]+\/\*$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const FORBIDDEN_PATTERNS = [
  { re: /<script\b/i, label: 'remote/inline script' },
  { re: /<iframe\b/i, label: 'iframe' },
  { re: /\bjavascript\s*:/i, label: 'javascript: URL' },
  { re: /\beval\s*\(/i, label: 'eval()' },
  { re: /\bnew\s+Function\b/i, label: 'Function constructor' },
  { re: /\bimport\s*\(/i, label: 'dynamic import' },
  { re: /\bfetch\s*\(/i, label: 'network fetch' },
  { re: /\bXMLHttpRequest\b/i, label: 'XMLHttpRequest' },
  { re: /\bsrc\s*=/i, label: 'src= injection' },
  { re: /\bdocument\.write\b/i, label: 'document.write' },
  { re: /(^|[^:])\/\//, label: 'protocol-relative URL' }
];

export class RuleValidationError extends Error {
  constructor(errors) {
    super(`Invalid opt-out rule: ${errors.join('; ')}`);
    this.name = 'RuleValidationError';
    this.code = 'INVALID_RULE';
    this.errors = errors;
  }
}

function isNonEmptyString(value, max = 500) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function scanStrings(value, path, errors) {
  if (typeof value === 'string') {
    if (CONTROL_RE.test(value)) {
      errors.push(`${path}: control characters are not allowed`);
    }
    for (const { re, label } of FORBIDDEN_PATTERNS) {
      if (re.test(value)) {
        errors.push(`${path}: ${label} is not allowed in a rule`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanStrings(entry, `${path}[${index}]`, errors));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      scanStrings(entry, `${path}.${key}`, errors);
    }
  }
}

export function hostMatchesPermission(hostname, hostPermission) {
  if (typeof hostname !== 'string' || typeof hostPermission !== 'string') {
    return false;
  }
  if (!HOST_PERMISSION_RE.test(hostPermission)) {
    return false;
  }
  const permissionHost = hostPermission
    .replace(/^https:\/\//, '')
    .replace(/\/\*$/, '')
    .toLowerCase();
  const host = hostname.toLowerCase();
  if (permissionHost.startsWith('*.')) {
    const base = permissionHost.slice(2);
    return host === base || host.endsWith(`.${base}`);
  }
  return host === permissionHost;
}

function validateUrl(value, path, errors) {
  if (!isNonEmptyString(value, 2048)) {
    errors.push(`${path}: must be a non-empty https URL`);
    return null;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    errors.push(`${path}: not a valid URL`);
    return null;
  }
  if (url.protocol !== 'https:') {
    errors.push(`${path}: only https:// URLs are allowed`);
    return null;
  }
  if (url.username || url.password) {
    errors.push(`${path}: credentials in URLs are not allowed`);
  }
  return url;
}

function validateSelector(value, path, errors, required = true) {
  if (!required && (value === undefined || value === null || value === '')) {
    return;
  }
  if (!isNonEmptyString(value, 300)) {
    errors.push(`${path}: selector must be a non-empty string (max 300)`);
  }
}

function validateStep(step, index, errors) {
  const path = `steps[${index}]`;
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  if (!ACTIONS.includes(step.action)) {
    errors.push(`${path}.action: must be one of ${ACTIONS.join(', ')}`);
    return;
  }
  if (step.note !== undefined && (!isNonEmptyString(step.note, 500))) {
    errors.push(`${path}.note: must be a non-empty string when present`);
  }

  if (step.action === 'fill') {
    validateSelector(step.selector, `${path}.selector`, errors);
    if (!PROFILE_FIELDS.includes(step.field)) {
      errors.push(`${path}.field: must be one of ${PROFILE_FIELDS.join(', ')}`);
    }
  } else if (step.action === 'click' || step.action === 'waitFor') {
    validateSelector(step.selector, `${path}.selector`, errors);
  } else if (step.action === 'open') {
    if (!isNonEmptyString(step.selector, 2048)) {
      errors.push(`${path}.selector: open requires a https URL or a selector`);
      return;
    }
    if (/^https:\/\//i.test(step.selector)) {
      validateUrl(step.selector, `${path}.selector`, errors);
    } else {
      validateSelector(step.selector, `${path}.selector`, errors);
    }
  } else if (step.action === 'pause') {
    if (!isNonEmptyString(step.note, 500)) {
      errors.push(`${path}.note: pause requires a note explaining what the user must do`);
    }
  }
}

export function validateRule(rule) {
  const errors = [];
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return { valid: false, errors: ['rule: must be an object'], rule: null };
  }

  scanStrings(rule, 'rule', errors);

  if (!isNonEmptyString(rule.id, 64) || !ID_RE.test(rule.id)) {
    errors.push('id: must match ^[a-z0-9][a-z0-9-]{1,63}$');
  }
  if (!isNonEmptyString(rule.name, 80)) {
    errors.push('name: must be a non-empty string (max 80)');
  }

  const optOutUrl = validateUrl(rule.optOutUrl, 'optOutUrl', errors);

  if (
    !isNonEmptyString(rule.hostPermission, 300) ||
    !HOST_PERMISSION_RE.test(rule.hostPermission)
  ) {
    errors.push('hostPermission: must look like https://example.com/*');
  } else if (
    optOutUrl &&
    !hostMatchesPermission(optOutUrl.hostname, rule.hostPermission)
  ) {
    errors.push('hostPermission: does not cover optOutUrl host');
  }

  if (!Array.isArray(rule.steps) || rule.steps.length === 0 || rule.steps.length > 50) {
    errors.push('steps: must be an array with 1 to 50 steps');
  } else {
    rule.steps.forEach((step, index) => validateStep(step, index, errors));
  }

  if (!rule.success || typeof rule.success !== 'object' || Array.isArray(rule.success)) {
    errors.push('success: must be an object with selector or textIncludes');
  } else {
    const hasSelector = isNonEmptyString(rule.success.selector, 300);
    const hasText = isNonEmptyString(rule.success.textIncludes, 300);
    if (!hasSelector && !hasText) {
      errors.push('success: requires selector or textIncludes');
    }
    if (hasSelector && hasText) {
      errors.push('success: use either selector or textIncludes, not both');
    }
  }

  if (!Array.isArray(rule.needs)) {
    errors.push(`needs: must be an array (allowed: ${NEEDS.join(', ')})`);
  } else {
    for (const need of rule.needs) {
      if (!NEEDS.includes(need)) {
        errors.push(`needs: unknown value ${JSON.stringify(need)}`);
      }
    }
  }

  if (typeof rule.droppable !== 'boolean') {
    errors.push('droppable: must be a boolean');
  }

  return { valid: errors.length === 0, errors, rule: errors.length === 0 ? rule : null };
}

export function assertValidRule(rule) {
  const result = validateRule(rule);
  if (!result.valid) {
    throw new RuleValidationError(result.errors);
  }
  return rule;
}

export function validateRules(rules) {
  if (!Array.isArray(rules)) {
    throw new RuleValidationError(['rules: must be an array']);
  }
  const seen = new Set();
  const results = rules.map((rule) => {
    const result = validateRule(rule);
    if (result.valid) {
      if (seen.has(rule.id)) {
        result.valid = false;
        result.rule = null;
        result.errors = [`id: duplicate rule id ${rule.id}`];
      } else {
        seen.add(rule.id);
      }
    }
    return result;
  });
  return {
    valid: results.every((result) => result.valid),
    results,
    rules: results.filter((result) => result.valid).map((result) => result.rule)
  };
}

export function findRuleForUrl(rules, url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') {
    return null;
  }
  for (const rule of rules) {
    const result = validateRule(rule);
    if (!result.valid) {
      continue;
    }
    if (hostMatchesPermission(parsed.hostname, rule.hostPermission)) {
      return rule;
    }
  }
  return null;
}
