// Plain-text request letters, follow-ups and regulator complaint drafts.
//
// No network, no dependencies. Every letter is assembled locally from the
// user's selected profile fields and the jurisdiction record's own `law`
// string. The module deliberately does not paraphrase or invent legal text.
// Unverified jurisdiction data is refused unless the caller passes
// `allowUnverified: true` (used only by tests/fixtures).

import {
  assertUsable,
  validateJurisdiction
} from './jurisdictions.schema.js';

export const MAILTO_MAX_LENGTH = 2000;

export const IDENTITY_LABELS = Object.freeze({
  fullName: 'Full name',
  previousNames: 'Previous names',
  city: 'City',
  state: 'State/Region',
  ageRange: 'Age range',
  phone: 'Phone',
  email: 'Email'
});

const RIGHT_PHRASES = Object.freeze({
  erasure: 'erase my personal data',
  access: 'access the personal data you hold about me',
  rectification: 'correct inaccurate personal data you hold about me',
  'optout-sale': 'opt out of the sale or sharing of my personal information',
  object: 'object to the processing of my personal data'
});

const EVENT_LABELS = Object.freeze({
  created: 'Request drafted',
  sent: 'Request sent',
  reminder: 'Reminder due',
  overdue: 'Response deadline passed',
  escalated: 'Escalated to regulator',
  answered: 'Company answered',
  closed: 'Request closed'
});

export class TemplateError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'TemplateError';
    this.code = code;
  }
}

function oneLine(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function requireText(value, field) {
  const text = oneLine(value);
  if (!text) {
    throw new TemplateError('MISSING_FIELD', `${field} is required`);
  }
  return text;
}

function requireJurisdiction(jurisdiction, allowUnverified) {
  if (allowUnverified) {
    const result = validateJurisdiction(jurisdiction);
    if (!result.ok) {
      throw new TemplateError(
        'INVALID_JURISDICTION',
        `Invalid jurisdiction data: ${result.errors.join('; ')}`
      );
    }
    return jurisdiction;
  }
  assertUsable(jurisdiction);
  return jurisdiction;
}

function requireRight(jurisdiction, right) {
  if (!Object.prototype.hasOwnProperty.call(RIGHT_PHRASES, right)) {
    throw new TemplateError('UNKNOWN_RIGHT', `Unknown right: ${String(right)}`);
  }
  if (!Array.isArray(jurisdiction.rights) || !jurisdiction.rights.includes(right)) {
    throw new TemplateError(
      'RIGHT_NOT_AVAILABLE',
      `Right "${right}" is not available in ${jurisdiction.id}`
    );
  }
  return RIGHT_PHRASES[right];
}

function selectedIdentityLines(profile, fields) {
  if (!Array.isArray(fields)) {
    throw new TemplateError('INVALID_FIELDS', 'fields must be an array');
  }
  const source = profile && typeof profile === 'object' ? profile : {};
  const lines = [];
  const seen = new Set();
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(IDENTITY_LABELS, field)) {
      throw new TemplateError('INVALID_FIELD', `Unknown identity field: ${String(field)}`);
    }
    if (seen.has(field)) {
      continue;
    }
    seen.add(field);
    const raw = source[field];
    const value = Array.isArray(raw)
      ? raw.map(oneLine).filter(Boolean).join(', ')
      : oneLine(raw);
    if (value) {
      lines.push(`- ${IDENTITY_LABELS[field]}: ${value}`);
    }
  }
  return lines;
}

function identityBlock(profile, fields) {
  const lines = selectedIdentityLines(profile, fields);
  if (lines.length === 0) {
    return [];
  }
  return ['Identity details I choose to share:', ...lines, ''];
}

function letterFooter() {
  return [
    'This letter was generated locally by SecureInChat Opt-Out. No copy was sent to any server.',
    'I am sending it myself from my own email account.'
  ];
}

/**
 * Initial rights request.
 * @returns {{subject: string, body: string}}
 */
export function renderRequestLetter({
  jurisdiction,
  right,
  company,
  profile,
  fields,
  allowUnverified = false
}) {
  const record = requireJurisdiction(jurisdiction, allowUnverified);
  const phrase = requireRight(record, right);
  const recipient = requireText(company, 'company');
  const lines = [
    `To: ${recipient} Privacy Office`,
    '',
    `I am writing to exercise my right to ${phrase} under ${record.law}.`,
    '',
    'Please confirm in writing that you have received this request and tell me what action you take.',
    '',
    ...identityBlock(profile, fields),
    'Please reply to this email address.',
    '',
    ...letterFooter()
  ];
  return {
    subject: `Data rights request (${record.law}) - ${recipient}`,
    body: lines.join('\n')
  };
}

/**
 * Follow-up letter for a request whose response date has passed.
 * @returns {{subject: string, body: string}}
 */
export function renderReminderLetter({
  jurisdiction,
  right,
  company,
  profile,
  fields,
  sentDate,
  dueDate,
  allowUnverified = false
}) {
  const record = requireJurisdiction(jurisdiction, allowUnverified);
  const phrase = requireRight(record, right);
  const recipient = requireText(company, 'company');
  const sent = requireText(sentDate, 'sentDate');
  const due = requireText(dueDate, 'dueDate');
  const lines = [
    `To: ${recipient} Privacy Office`,
    '',
    `On ${sent} I sent you a request under ${record.law} to ${phrase}.`,
    `The response date recorded for that request was ${due}. I have not received a response.`,
    '',
    'Please respond to my original request as soon as possible and confirm in writing what action you take.',
    '',
    ...identityBlock(profile, fields),
    'Please reply to this email address.',
    '',
    ...letterFooter()
  ];
  return {
    subject: `Follow-up: unanswered data rights request - ${recipient}`,
    body: lines.join('\n')
  };
}

function formatTimelineEvent(event) {
  if (typeof event === 'string') {
    return oneLine(event);
  }
  if (!event || typeof event !== 'object') {
    return '';
  }
  const at = oneLine(event.at || event.date || '');
  const label = EVENT_LABELS[event.type] || oneLine(event.label || event.type || 'Update');
  const note = oneLine(event.note || '');
  const head = [at, label].filter(Boolean).join(' - ');
  return note ? `${head}: ${note}` : head;
}

export function formatTimeline(timeline = []) {
  if (!Array.isArray(timeline)) {
    throw new TemplateError('INVALID_TIMELINE', 'timeline must be an array');
  }
  return timeline.map(formatTimelineEvent).filter(Boolean);
}

/**
 * Draft complaint to the regulator. This is a draft for the user to review
 * and submit; it is never sent by the engine.
 * @returns {{subject: string, body: string}}
 */
export function renderComplaintDraft({
  jurisdiction,
  right,
  company,
  profile,
  fields,
  sentDate,
  dueDate,
  timeline = [],
  allowUnverified = false
}) {
  const record = requireJurisdiction(jurisdiction, allowUnverified);
  requireRight(record, right);
  const recipient = requireText(company, 'company');
  const sent = requireText(sentDate, 'sentDate');
  const due = requireText(dueDate, 'dueDate');
  const lines = [
    `To: ${record.regulator.name}`,
    `Complaint portal: ${record.regulator.complaintUrl}`,
    '',
    `Re: unanswered data rights request to ${recipient}`,
    '',
    `On ${sent} I sent a request to ${recipient} under ${record.law}.`,
    `The response date recorded for that request was ${due}. I have not received a response.`,
    '',
    'Timeline:',
    ...formatTimeline(timeline).map((line) => `- ${line}`),
    '',
    ...identityBlock(profile, fields),
    'This is a draft. I have not submitted it. I will review it and add any information the regulator requires before sending.',
    '',
    'This draft was generated locally by SecureInChat Opt-Out. No copy was sent to any server.'
  ];
  return {
    subject: `Complaint draft: unanswered data rights request - ${recipient}`,
    body: lines.join('\n')
  };
}

/**
 * Build a mailto: URL, or fall back to "copy the body" when the URL would be
 * too long for mail clients. Recipient is validated against header injection.
 * @returns {{mode:'mailto'|'copy', url:string|null, subject:string, body:string, reason?:string}}
 */
export function buildMailto({ to, subject, body, maxLength = MAILTO_MAX_LENGTH }) {
  const address = String(to === undefined || to === null ? '' : to).trim();
  if (!address || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
    throw new TemplateError('INVALID_RECIPIENT', 'A valid recipient email is required');
  }
  const safeSubject = String(subject === undefined || subject === null ? '' : subject);
  const safeBody = String(body === undefined || body === null ? '' : body);
  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    throw new TemplateError('INVALID_MAX_LENGTH', 'maxLength must be a positive integer');
  }

  const url = `mailto:${address}?subject=${encodeURIComponent(
    safeSubject
  )}&body=${encodeURIComponent(safeBody)}`;

  if (url.length > maxLength) {
    return {
      mode: 'copy',
      url: null,
      subject: safeSubject,
      body: safeBody,
      reason: 'TOO_LONG'
    };
  }
  return { mode: 'mailto', url, subject: safeSubject, body: safeBody };
}
