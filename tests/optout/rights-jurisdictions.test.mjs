import test from 'node:test';
import assert from 'node:assert/strict';

import {
  JURISDICTIONS,
  getJurisdiction,
  isUsable,
  assertUsable
} from '../../extension/optout/src/rights/jurisdictions.js';
import {
  JURISDICTION_FIELDS,
  RIGHTS,
  validateJurisdiction
} from '../../extension/optout/src/rights/jurisdictions.schema.js';
import { TEST_JURISDICTIONS } from './fixtures/jurisdictions.js';

test('test fixtures are local, fictional and never claim to be law', () => {
  assert.equal(TEST_JURISDICTIONS.length, 2);
  assert.deepEqual(
    TEST_JURISDICTIONS.map((item) => item.id),
    ['TEST-A', 'TEST-B']
  );
  for (const fixture of TEST_JURISDICTIONS) {
    assert.equal(fixture.verified, false);
    assert.equal(validateJurisdiction(fixture).ok, true);
    assert.match(fixture.verificationNote, /fictional/i);
    assert.match(fixture.appliesWhen, /fictional|test/i);
  }
});

test('schema exposes every required field', () => {
  assert.deepEqual(
    [...JURISDICTION_FIELDS].sort(),
    [
      'appliesWhen',
      'dayType',
      'deadlineNote',
      'extendableDays',
      'id',
      'law',
      'name',
      'regulator',
      'responseDays',
      'rights',
      'sources',
      'verificationNote',
      'verified'
    ]
  );
  assert.deepEqual(
    [...RIGHTS].sort(),
    ['access', 'erasure', 'object', 'optout-sale', 'rectification']
  );
});

test('GDPR record is verified, usable and complete', () => {
  const gdpr = getJurisdiction('eu-gdpr');
  assert.ok(gdpr);
  assert.equal(gdpr.verified, true);
  assert.equal(validateJurisdiction(gdpr).ok, true);
  assert.equal(isUsable(gdpr), true);
  assert.equal(assertUsable(gdpr), true);
  assert.deepEqual(gdpr.rights, ['access', 'rectification', 'erasure', 'object']);
  assert.deepEqual(gdpr.rightArticles, {
    access: 'Article 15',
    rectification: 'Article 16',
    erasure: 'Article 17',
    object: 'Article 21'
  });
  assert.equal(gdpr.deadlineArticle, 'Article 12(3)');
  assert.equal(gdpr.recipientsArticle, 'Article 19');
  assert.equal(gdpr.complaintArticle, 'Article 77');
  assert.equal(gdpr.responseDays, 30);
  assert.equal(gdpr.dayType, 'calendar');
  assert.equal(gdpr.extendableDays, 60);
  assert.match(gdpr.deadlineNote, /Art\. 12\(3\)/);
  assert.ok(
    gdpr.sources.some(
      (source) =>
        source.url ===
          'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679' &&
        source.quote.includes('Article 17 Right to erasure') &&
        source.quote.includes('Article 19 Notification obligation') &&
        source.quote.includes('Article 77 Right to lodge a complaint')
    )
  );
});

test('unverified jurisdictions carry no article numbers', () => {
  for (const record of JURISDICTIONS.filter((item) => !item.verified)) {
    assert.equal(record.rightArticles, undefined, record.id);
    assert.equal(record.deadlineArticle, undefined, record.id);
    assert.equal(record.recipientsArticle, undefined, record.id);
    assert.equal(record.complaintArticle, undefined, record.id);
  }
});

test('isUsable rejects unverified records and accepts only verified data', () => {
  for (const fixture of TEST_JURISDICTIONS) {
    assert.equal(isUsable(fixture), false);
    assert.throws(
      () => assertUsable(fixture),
      (error) => error.code === 'UNVERIFIED_JURISDICTION'
    );
  }
  for (const record of JURISDICTIONS.filter((item) => !item.verified)) {
    assert.equal(isUsable(record), false);
    assert.throws(
      () => assertUsable(record),
      (error) => error.code === 'UNVERIFIED_JURISDICTION'
    );
  }

  const verified = { ...TEST_JURISDICTIONS[0], verified: true };
  assert.equal(isUsable(verified), true);
  assert.equal(assertUsable(verified), true);

  const broken = { ...verified, sources: [] };
  assert.equal(isUsable(broken), false);
  assert.throws(
    () => assertUsable(broken),
    (error) => error.code === 'INVALID_JURISDICTION'
  );
});

test('every verified jurisdiction cites at least one source with a quote', () => {
  const verified = JURISDICTIONS.filter((item) => item.verified === true);
  assert.ok(verified.length >= 1);
  for (const record of verified) {
    assert.equal(validateJurisdiction(record).ok, true, record.id);
    assert.ok(Array.isArray(record.sources) && record.sources.length > 0, record.id);
    for (const source of record.sources) {
      assert.match(source.url, /^https?:\/\//, record.id);
      assert.ok(source.checked, record.id);
      assert.ok(typeof source.quote === 'string' && source.quote.trim(), record.id);
    }
  }
});

test('getJurisdiction looks up only known ids', () => {
  assert.equal(getJurisdiction('eu-gdpr').id, 'eu-gdpr');
  assert.equal(getJurisdiction('TEST-A'), null);
  assert.equal(getJurisdiction('REAL-NOT-RESEARCHED'), null);
});
