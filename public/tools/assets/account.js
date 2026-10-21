/* Account security checkup: scoring and report text. Pure functions, no network, no storage.
   Loaded by the page and by the Node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ACCT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Order = the order we suggest fixing things in. Taking over the account comes first, then getting back in, then cleanup.
  var ITEMS = [
    { id: 'mfa', name: 'Two-step verification is on', todo: 'Turn on two-step verification' },
    { id: 'unique', name: 'The password is not used anywhere else', todo: 'Give this account a password it does not share' },
    { id: 'recovery', name: 'Recovery email and phone are current and yours', todo: 'Update the recovery email and phone' },
    { id: 'codes', name: 'Backup codes or a recovery key are kept offline', todo: 'Save backup codes somewhere offline' },
    { id: 'sessions', name: 'Signed-in devices reviewed', todo: 'Review the signed-in devices' },
    { id: 'strong', name: 'Second step is a passkey, security key or app prompt, not only SMS', todo: 'Add a passkey, security key or app prompt' },
    { id: 'apps', name: 'Third-party app access reviewed', todo: 'Review which other apps have access' },
    { id: 'breach', name: 'Email address checked against known breaches', todo: 'Check the email address on Have I Been Pwned' },
  ];
  var VALID = { yes: 1, no: 1, unsure: 1 };

  // answers: { id: 'yes' | 'no' | 'unsure' }; anything missing or unknown counts as unanswered.
  function summarize(answers) {
    answers = answers || {};
    var r = { total: ITEMS.length, done: 0, answered: 0, todo: [], unsure: [], open: [] };
    ITEMS.forEach(function (it) {
      var a = Object.prototype.hasOwnProperty.call(answers, it.id) && VALID[answers[it.id]] ? answers[it.id] : '';
      if (a) r.answered++;
      if (a === 'yes') r.done++;
      else if (a === 'no') r.todo.push(it);
      else if (a === 'unsure') r.unsure.push(it);
      else r.open.push(it);
    });
    if (!r.answered) { r.tone = 'idle'; r.headline = 'Answer the questions to see what to do first.'; }
    else if (r.done === r.total) { r.tone = 'ok'; r.headline = 'All ' + r.total + ' done for this account. Repeat the checkup for your next most important account.'; }
    else {
      var parts = [r.done + ' of ' + r.total + ' done'];
      if (r.todo.length) parts.push(r.todo.length + ' to do');
      if (r.unsure.length) parts.push(r.unsure.length + ' to find out');
      if (r.open.length) parts.push(r.open.length + ' not answered');
      r.tone = r.todo.length ? 'fail' : 'warn';
      r.headline = parts.join(', ') + '.';
    }
    // What to do first: "no" before "not sure", each in the fixed priority order.
    r.next = r.todo.concat(r.unsure);
    return r;
  }

  // Plain-text report for copying. Contains no account names, addresses or passwords: only the checklist state.
  function text(r, date) {
    var L = ['Account security checkup (secureinchat.com/tools/account-checkup/)' + (date ? ', ' + date : ''), r.done + ' of ' + r.total + ' done.'];
    if (r.next.length) {
      L.push('', 'Do next:');
      r.next.forEach(function (it, i) { L.push((i + 1) + '. ' + it.todo + (r.unsure.indexOf(it) >= 0 ? ' (find out)' : '')); });
    }
    if (r.open.length) { L.push('', 'Not answered:'); r.open.forEach(function (it) { L.push('- ' + it.name); }); }
    L.push('', 'Nothing was saved or sent. This list is only what you ticked.');
    return L.join('\n');
  }

  return { ITEMS: ITEMS, summarize: summarize, text: text };
});
