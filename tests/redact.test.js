const assert = require('assert');
const { redact, restore, parseTerms, luhn } = require('../public/tools/assets/redact.js');
let n = 0; const t = (name, fn) => { fn(); n++; };
t('email', () => { const r = redact('mail bob@example.com and BOB@example.com and ann@x.org'); assert.strictEqual(r.text, 'mail [EMAIL_1] and [EMAIL_1] and [EMAIL_2]'); assert.strictEqual(r.counts.email, 3); });
t('ipv4', () => { assert.strictEqual(redact('from 192.168.1.10 to 8.8.8.8').text, 'from [IPV4_1] to [IPV4_2]'); });
t('ipv4 invalid not matched', () => { assert.strictEqual(redact('v 1.2.3.999 and 256.1.1.1').total, 0); });
t('version numbers not ip', () => { assert.strictEqual(redact('version 1.2.3').total, 0); });
t('ipv6', () => { assert.strictEqual(redact('addr 2001:db8::1 up').text, 'addr [IPV6_1] up'); assert.strictEqual(redact('2001:0db8:85a3:0000:0000:8a2e:0370:7334').text, '[IPV6_1]'); });
t('time not ipv6', () => { assert.strictEqual(redact('at 12:30:45 today').total, 0); });
t('card luhn', () => { assert.ok(luhn('4111111111111111')); assert.strictEqual(redact('card 4111 1111 1111 1111 ok').text, 'card [CARD_1] ok'); assert.strictEqual(redact('order 1234567890123456').total, 0); });
t('phone', () => { assert.strictEqual(redact('call +1 415-555-0132 now').text, 'call [PHONE_1] now'); assert.strictEqual(redact('call +8613812345678').text, 'call [PHONE_1]'); });
t('date not phone', () => { assert.strictEqual(redact('on 2026-10-20 it ran').total, 0); });
t('api keys', () => { const r = redact('k AKIAIOSFODNN7EXAMPLE and ghp_' + 'a'.repeat(36)); assert.strictEqual(r.counts.apikey, 2); });
t('jwt', () => { assert.strictEqual(redact('t eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk end').text, 't [JWT_1] end'); });
t('private key', () => { assert.strictEqual(redact('a\n-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----\nb').text, 'a\n[PRIVATE_KEY_1]\nb'); });
t('url credentials keep host', () => { assert.strictEqual(redact('postgres://user:hunter2@db.local/x').text, 'postgres://[URL_CREDENTIALS_1]@db.local/x'); });
t('mac', () => { assert.strictEqual(redact('aa:bb:cc:dd:ee:ff').text, '[MAC_1]'); });
t('disable a rule', () => { assert.strictEqual(redact('a@b.co 1.1.1.1', { email: false }).text, 'a@b.co [IPV4_1]'); });
t('empty and plain', () => { assert.strictEqual(redact('').text, ''); assert.strictEqual(redact('nothing here').total, 0); });
t('iban valid', () => { assert.ok(require('../public/tools/assets/redact.js').ibanOk('GB29NWBK60161331926819')); assert.strictEqual(redact('pay GB29 NWBK 6016 1331 9268 19 now').text, 'pay [IBAN_1] now'); assert.strictEqual(redact('DE89370400440532013000').text, '[IBAN_1]'); });
t('iban bad checksum not matched', () => { assert.strictEqual(redact('GB29NWBK60161331926818').counts.iban, undefined); assert.strictEqual(redact('order AB12CD34EF56GH78').counts.iban, undefined); });
// Custom terms: rules and round-trip tests.
t('terms basic and same word same number', () => {
  const r = redact('Ann Lee met ann lee and ANN LEE', true, { terms: ['Ann Lee'] });
  assert.strictEqual(r.text, '[NAME_1] met [NAME_1] and [NAME_1]');
  assert.strictEqual(r.counts.term, 3);
  assert.strictEqual(r.total, 3);
});
t('terms longest match first', () => {
  const r = redact('Ann Lee and Ann', true, { terms: ['Ann', 'Ann Lee'] });
  assert.strictEqual(r.text, '[NAME_1] and [NAME_2]');
  assert.strictEqual(r.counts.term, 2);
});
t('term latin word boundary', () => {
  assert.strictEqual(redact('Annual report for Ann', true, { terms: ['Ann'] }).text, 'Annual report for [NAME_1]');
});
t('term cjk no boundary needed', () => {
  assert.strictEqual(redact('我是张伟。', true, { terms: ['张伟'] }).text, '我是[NAME_1]。');
});
// A term replaces a rule match only when the term fully covers it. A term that is only part
// of an email address or a URL credential is ignored, so the rule still hides the whole value.
// A term that covers a whole rule match (for example a full phone number) wins over the rule.
t('term inside email does not break the email', () => {
  const r = redact('write to bob@example.com', true, { terms: ['bob'] });
  assert.strictEqual(r.text, 'write to [EMAIL_1]');
  assert.strictEqual(r.counts.term, undefined);
});
t('term covering a whole match wins', () => {
  const r = redact('call 415-555-0132', true, { terms: ['415-555-0132'] });
  assert.strictEqual(r.text, 'call [NAME_1]');
  assert.strictEqual(r.counts.term, 1);
});
t('term rule disabled', () => {
  const r = redact('Ann Lee', { term: false }, { terms: ['Ann Lee'] });
  assert.strictEqual(r.text, 'Ann Lee');
  assert.strictEqual(r.total, 0);
});
t('mapping keeps original case and url credentials', () => {
  const r = redact('Bob@Example.com and postgres://user:hunter2@db.local/x', true, { terms: ['Bob'] });
  assert.strictEqual(r.text, '[EMAIL_1] and postgres://[URL_CREDENTIALS_1]@db.local/x');
  assert.strictEqual(r.mapping['[EMAIL_1]'], 'Bob@Example.com');
  assert.strictEqual(r.mapping['[URL_CREDENTIALS_1]'], 'user:hunter2');
  const r2 = redact('ann lee and Ann Lee', true, { terms: ['Ann Lee'] });
  assert.strictEqual(r2.text, '[NAME_1] and [NAME_1]');
  assert.strictEqual(r2.mapping['[NAME_1]'], 'ann lee');
});
t('restore five forms and unknown', () => {
  const mapping = { '[EMAIL_1]': 'bob@example.com', '[NAME_1]': 'Ann Lee', '[PHONE_1]': '+1 415-555-0132' };
  const r = restore('[EMAIL_1] [ EMAIL_1 ] [email_1] \\[EMAIL\\_1\\] 【EMAIL_1】 [PHONE_9] [NAME_1] [IPV4_7]', mapping);
  assert.strictEqual(r.text, 'bob@example.com bob@example.com bob@example.com bob@example.com bob@example.com [PHONE_9] Ann Lee [IPV4_7]');
  assert.strictEqual(r.restored, 6);
  assert.deepStrictEqual(r.unknown, ['[PHONE_9]', '[IPV4_7]']);
});
t('restore ignores placeholders without brackets', () => {
  const mapping = { '[EMAIL_1]': 'bob@example.com' };
  const r = restore('EMAIL_1 and [EMAIL_1]', mapping);
  assert.strictEqual(r.text, 'EMAIL_1 and bob@example.com');
  assert.strictEqual(r.restored, 1);
});
t('restore empty mapping returns text', () => {
  const r = restore('[EMAIL_1]', null);
  assert.strictEqual(r.text, '[EMAIL_1]');
  assert.strictEqual(r.restored, 0);
  assert.deepStrictEqual(r.unknown, []);
  const r2 = restore('[EMAIL_1]', {});
  assert.strictEqual(r2.text, '[EMAIL_1]');
  assert.strictEqual(r2.restored, 0);
  assert.deepStrictEqual(r2.unknown, []);
});
t('restore keeps $ sequences', () => {
  const mapping = { '[NAME_1]': 'Cost $& and $1 here', '[NAME_2]': '$`' };
  const r = restore('[NAME_1] then [NAME_2]', mapping);
  assert.strictEqual(r.text, 'Cost $& and $1 here then $`');
  assert.strictEqual(r.restored, 2);
});
t('round trip redact then restore', () => {
  const text = 'Bob Lee (bob@example.com) at 10.0.0.5 used card 4111 1111 1111 1111 and postgres://user:hunter2@db.local/x. 张伟 wrote.';
  const r = redact(text, true, { terms: ['Bob Lee', '张伟'] });
  assert.strictEqual(r.text, '[NAME_1] ([EMAIL_1]) at [IPV4_1] used card [CARD_1] and postgres://[URL_CREDENTIALS_1]@db.local/x. [NAME_2] wrote.');
  const back = restore(r.text, r.mapping);
  assert.strictEqual(back.text, text);
  assert.strictEqual(back.restored, 6);
  assert.deepStrictEqual(back.unknown, []);
});
t('parseTerms splits on lines and separators', () => {
  assert.deepStrictEqual(parseTerms('Ann Lee\nBob, Carol，Dan;Eve；\n\n Frank '), ['Ann Lee', 'Bob', 'Carol', 'Dan', 'Eve', 'Frank']);
  assert.deepStrictEqual(parseTerms(''), []);
  assert.deepStrictEqual(parseTerms('  ,  ; '), []);
});
t('terms still hidden when lowercasing changes length earlier in the text', () => {
  const text = 'İstanbul: İİ Alice Smith met Bob';
  const r = redact(text, true, { terms: ['Alice Smith'] });
  assert.strictEqual(r.text, 'İstanbul: İİ [NAME_1] met Bob');
  assert.strictEqual(restore(r.text, r.mapping).text, text);
});
t('terms containing regex characters match literally', () => {
  const r = redact('Project (X.1) and Project X11', true, { terms: ['Project (X.1)'] });
  assert.strictEqual(r.text, '[NAME_1] and Project X11');
});
// W8: Chinese mainland mobile numbers and resident ID numbers. The rules are strict on purpose: a miss
// is better than a false hit. 11010519491231002X is the example number printed in GB 11643-1999.
t('cn mobile plain, prefixed and separated', () => {
  const r = redact('手机13812345678，备用 +86 139-1234-5678，0086 150 1234 5678，86-18612345678');
  assert.strictEqual(r.text, '手机[PHONE_1]，备用 [PHONE_2]，[PHONE_3]，[PHONE_4]');
  assert.strictEqual(r.counts.cn_mobile, 4);
  assert.strictEqual(r.mapping['[PHONE_2]'], '+86 139-1234-5678');
});
t('cn mobile negatives', () => {
  assert.strictEqual(redact('座机 010-12345678').total, 0);
  assert.strictEqual(redact('订单 12345678901').total, 0);
  assert.strictEqual(redact('编号 213812345678 和 138123456789').total, 0);
  assert.strictEqual(redact('号码 12812345678').total, 0);
  assert.strictEqual(redact('id A13812345678B').total, 0);
});
t('cn mobile and generic phone never share a placeholder', () => {
  const r = redact('13812345678 and +1 415-555-0132 and 13812345678');
  assert.strictEqual(r.text, '[PHONE_1] and [PHONE_2] and [PHONE_1]');
  assert.strictEqual(r.counts.cn_mobile, 2); assert.strictEqual(r.counts.phone, 1);
  assert.strictEqual(restore('[PHONE_2] / [PHONE_1]', r.mapping).text, '+1 415-555-0132 / 13812345678');
});
t('cn mobile wins over phone on the same text', () => {
  const r = redact('call +86 138 1234 5678');
  assert.strictEqual(r.text, 'call [PHONE_1]');
  assert.strictEqual(r.counts.cn_mobile, 1); assert.strictEqual(r.counts.phone, undefined);
});
t('cn id valid, lower-case x and spaced', () => {
  const { cnIdOk } = require('../public/tools/assets/redact.js');
  assert.ok(cnIdOk('11010519491231002X'));
  assert.strictEqual(redact('身份证 11010519491231002X 号').text, '身份证 [ID_NUMBER_1] 号');
  assert.strictEqual(redact('11010519491231002x').text, '[ID_NUMBER_1]');
  assert.strictEqual(redact('110105 19491231 002X').text, '[ID_NUMBER_1]');
});
t('cn id bad check digit, bad date, wrong length', () => {
  assert.strictEqual(redact('110105194912310021').counts.cn_id, undefined);
  assert.strictEqual(redact('110105194902300028').counts.cn_id, undefined); // 30 February
  assert.strictEqual(redact('110105194913010028').counts.cn_id, undefined); // month 13
  assert.strictEqual(redact('11010519491231002').counts.cn_id, undefined);  // 17 digits
  assert.strictEqual(redact('11010519491231002X1').total, 0);               // a digit right after
});
t('cn id wins over card when both checksums pass', () => {
  // 330106199001010069 passes both the GB 11643 check and the Luhn check.
  const r = redact('x 330106199001010069 y');
  assert.strictEqual(r.text, 'x [ID_NUMBER_1] y');
  assert.strictEqual(r.counts.card, undefined);
});
t('cn rules together with existing rules', () => {
  const r = redact('张三 13812345678 zhang@example.com 11010519491231002X 卡 4111 1111 1111 1111 IP 1.2.3.4', true, { terms: ['张三'] });
  assert.strictEqual(r.text, '[NAME_1] [PHONE_1] [EMAIL_1] [ID_NUMBER_1] 卡 [CARD_1] IP [IPV4_1]');
  assert.strictEqual(restore(r.text, r.mapping).text, '张三 13812345678 zhang@example.com 11010519491231002X 卡 4111 1111 1111 1111 IP 1.2.3.4');
});
t('cn rules can be switched off', () => {
  assert.strictEqual(redact('13812345678 11010519491231002X', { cn_mobile: false, cn_id: false }).total, 0);
});
console.log(n + ' tests passed');
