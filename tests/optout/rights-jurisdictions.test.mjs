import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TEST_JURISDICTIONS,
  JURISDICTION_FIELDS,
  RIGHTS,
  getJurisdiction,
  validateJurisdiction,
  isUsable,
  assertUsable
} from '../../extension/optout/src/rights/jurisdictions.schema.js';

test('test fixtures are exactly TEST-A and TEST-B and never claim to be law', () => {
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

test('isUsable rejects unverified fixtures and accepts only verified data', () => {
  for (const fixture of TEST_JURISDICTIONS) {
    assert.equal(isUsable(fixture), false);
    assert.throws(
      () => assertUsable(fixture),
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

test('getJurisdiction looks up only known ids', () => {
  assert.equal(getJurisdiction('TEST-A').id, 'TEST-A');
  assert.equal(getJurisdiction('REAL-NOT-RESEARCHED'), null);
});
