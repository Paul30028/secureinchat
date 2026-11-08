import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMailto,
  renderComplaintDraft,
  renderReminderLetter,
  renderRequestLetter
} from '../../extension/optout/src/rights/templates.js';
import { TEST_JURISDICTIONS } from '../../extension/optout/src/rights/jurisdictions.schema.js';

const TEST_A = TEST_JURISDICTIONS[0];
const PROFILE = {
  fullName: 'Alex Fixture',
  previousNames: ['Alex Oldname', 'A. Fixture'],
  city: 'Austin',
  state: 'TX',
  ageRange: '30-39',
  phone: '+1 512 555 0199',
  email: 'alex@example.test'
};

function request(overrides = {}) {
  return renderRequestLetter({
    jurisdiction: TEST_A,
    right: 'erasure',
    company: 'Acme Test Co',
    profile: PROFILE,
    fields: ['fullName', 'email'],
    allowUnverified: true,
    ...overrides
  });
}

test('request letter includes only selected identity fields and the jurisdiction law', () => {
  const { subject, body } = request();
  assert.match(subject, /Acme Test Co/);
  assert.match(subject, /TEST-A Data Protection Act/);
  assert.match(body, /Alex Fixture/);
  assert.match(body, /alex@example\.test/);
  assert.match(body, /TEST-A Data Protection Act \(fictional test data\)/);

  assert.equal(body.includes('+1 512 555 0199'), false);
  assert.equal(body.includes('Alex Oldname'), false);
  assert.equal(body.includes('Austin'), false);
  assert.equal(body.includes('30-39'), false);
});

test('request letter rejects unverified law by default and unknown fields/rights', () => {
  assert.throws(
    () => request({ allowUnverified: false }),
    (error) => error.code === 'UNVERIFIED_JURISDICTION'
  );
  assert.throws(
    () => request({ fields: ['fullName', 'passportNumber'] }),
    (error) => error.code === 'INVALID_FIELD'
  );
  assert.throws(
    () => request({ right: 'optout-sale' }),
    (error) => error.code === 'RIGHT_NOT_AVAILABLE'
  );
});

test('mailto encodes subject and body and round-trips exactly', () => {
  const { subject, body } = request();
  const result = buildMailto({
    to: 'privacy@acme.example',
    subject,
    body
  });
  assert.equal(result.mode, 'mailto');
  assert.ok(result.url.startsWith('mailto:privacy@acme.example?'));
  assert.equal(result.url.includes('\n'), false);
  assert.equal(result.url.includes('%0A'), true);
  assert.equal(result.url.includes(' '), false);

  const query = result.url.slice(result.url.indexOf('?') + 1);
  const params = new URLSearchParams(query);
  assert.equal(params.get('subject'), subject);
  assert.equal(params.get('body'), body);
});

test('over-long mailto falls back to copy mode and keeps the plain text', () => {
  const body = 'A'.repeat(2500);
  const result = buildMailto({
    to: 'privacy@acme.example',
    subject: 'Long request',
    body
  });
  assert.equal(result.mode, 'copy');
  assert.equal(result.url, null);
  assert.equal(result.reason, 'TOO_LONG');
  assert.equal(result.body, body);
  assert.equal(result.subject, 'Long request');
});

test('mailto length limit is inclusive and recipient injection is rejected', () => {
  const base = buildMailto({
    to: 'privacy@acme.example',
    subject: 's',
    body: 'b'
  });
  const exact = buildMailto({
    to: 'privacy@acme.example',
    subject: 's',
    body: 'b',
    maxLength: base.url.length
  });
  assert.equal(exact.mode, 'mailto');
  assert.throws(
    () => buildMailto({ to: 'privacy@acme.example\r\nBcc: x@example.test', subject: 's', body: 'b' }),
    (error) => error.code === 'INVALID_RECIPIENT'
  );
});

test('reminder letter keeps data minimization and states the recorded dates', () => {
  const { subject, body } = renderReminderLetter({
    jurisdiction: TEST_A,
    right: 'access',
    company: 'Acme Test Co',
    profile: PROFILE,
    fields: ['fullName'],
    sentDate: '2028-01-01',
    dueDate: '2028-01-31',
    allowUnverified: true
  });
  assert.match(subject, /Follow-up/);
  assert.match(body, /2028-01-01/);
  assert.match(body, /2028-01-31/);
  assert.match(body, /Alex Fixture/);
  assert.equal(body.includes('alex@example.test'), false);
  assert.equal(body.includes('+1 512 555 0199'), false);
  assert.equal(body.includes('Austin'), false);
});

test('complaint draft addresses the regulator and renders the timeline', () => {
  const { subject, body } = renderComplaintDraft({
    jurisdiction: TEST_A,
    right: 'erasure',
    company: 'Acme Test Co',
    profile: PROFILE,
    fields: ['fullName', 'email'],
    sentDate: '2028-01-01',
    dueDate: '2028-01-31',
    timeline: [
      { type: 'sent', at: '2028-01-01' },
      { type: 'overdue', at: '2028-02-01', note: 'No reply' }
    ],
    allowUnverified: true
  });
  assert.match(subject, /Complaint draft/);
  assert.match(body, /Testland A Privacy Authority \(fictional\)/);
  assert.match(body, /https:\/\/example\.test\/test-a\/complaint/);
  assert.match(body, /Timeline:/);
  assert.match(body, /2028-01-01 - Request sent/);
  assert.match(body, /No reply/);
  assert.match(body, /This is a draft/);
  assert.equal(body.includes('+1 512 555 0199'), false);
});
