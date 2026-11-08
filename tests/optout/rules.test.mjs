import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  validateRule,
  validateRules,
  findRuleForUrl,
  hostMatchesPermission,
  RuleValidationError
} from '../../extension/optout/src/rules.js';

const demo = JSON.parse(
  readFileSync(new URL('../../extension/optout/rules/demo.json', import.meta.url), 'utf8')
);

function clone(rule) {
  return JSON.parse(JSON.stringify(rule));
}

test('the two shipped mock rules are valid', () => {
  assert.equal(demo.rules.length, 2);
  const result = validateRules(demo.rules);
  assert.equal(result.valid, true, JSON.stringify(result.results.map((r) => r.errors)));
  assert.deepEqual(result.rules.map((rule) => rule.id), ['mock-site-a', 'mock-site-b']);
});

test('non-https URLs and host permissions are rejected', () => {
  const rule = clone(demo.rules[0]);
  rule.optOutUrl = 'http://127.0.0.1:8765/site-a.html';
  const result = validateRule(rule);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('https://')));

  const badHost = clone(demo.rules[0]);
  badHost.hostPermission = 'http://127.0.0.1/*';
  assert.equal(validateRule(badHost).valid, false);

  const wrongHost = clone(demo.rules[0]);
  wrongHost.hostPermission = 'https://example.com/*';
  assert.equal(validateRule(wrongHost).valid, false);
});

test('remote scripts, eval and protocol-relative URLs are rejected anywhere in a rule', () => {
  const script = clone(demo.rules[0]);
  script.steps[0].note = '<script src="https://evil.example/x.js"></script>';
  assert.equal(validateRule(script).valid, false);

  const evalRule = clone(demo.rules[0]);
  evalRule.steps[1].selector = 'eval(document.cookie)';
  assert.equal(validateRule(evalRule).valid, false);

  const remote = clone(demo.rules[0]);
  remote.steps[0].note = '//evil.example/payload.js';
  assert.equal(validateRule(remote).valid, false);

  const fetchRule = clone(demo.rules[0]);
  fetchRule.name = 'fetch("https://evil.example")';
  assert.equal(validateRule(fetchRule).valid, false);
});

test('step schema, success and needs are checked', () => {
  const noPauseNote = clone(demo.rules[0]);
  noPauseNote.steps[6] = { action: 'pause' };
  assert.equal(validateRule(noPauseNote).valid, false);

  const badField = clone(demo.rules[0]);
  badField.steps[0].field = 'password';
  assert.equal(validateRule(badField).valid, false);

  const noSuccess = clone(demo.rules[0]);
  delete noSuccess.success;
  assert.equal(validateRule(noSuccess).valid, false);

  const bothSuccess = clone(demo.rules[0]);
  bothSuccess.success = { selector: '#optout-form', textIncludes: '成功' };
  assert.equal(validateRule(bothSuccess).valid, false);

  const badNeed = clone(demo.rules[0]);
  badNeed.needs.push('bypass-captcha');
  assert.equal(validateRule(badNeed).valid, false);

  const noDroppable = clone(demo.rules[0]);
  delete noDroppable.droppable;
  assert.equal(validateRule(noDroppable).valid, false);

  assert.throws(() => {
    const rule = clone(demo.rules[0]);
    rule.optOutUrl = 'http://example.com/';
    const checked = validateRule(rule);
    if (!checked.valid) {
      throw new RuleValidationError(checked.errors);
    }
  }, RuleValidationError);
});

test('duplicate ids are rejected and rules match only their https host', () => {
  const duplicate = validateRules([demo.rules[0], clone(demo.rules[0])]);
  assert.equal(duplicate.valid, false);

  assert.equal(hostMatchesPermission('127.0.0.1', 'https://127.0.0.1/*'), true);
  assert.equal(hostMatchesPermission('example.com', 'https://*.example.com/*'), true);
  assert.equal(hostMatchesPermission('a.example.com', 'https://*.example.com/*'), true);
  assert.equal(hostMatchesPermission('evil-example.com', 'https://*.example.com/*'), false);

  assert.equal(
    findRuleForUrl(demo.rules, 'https://127.0.0.1:8765/site-a.html').id,
    'mock-site-a'
  );
  assert.equal(findRuleForUrl(demo.rules, 'http://127.0.0.1:8765/site-a.html'), null);
  assert.equal(findRuleForUrl(demo.rules, 'https://example.com/'), null);
});
