/* Local processing receipt for the private workspace.
   Pure functions: no DOM, no network, no storage. Loaded by the page and by the Node tests.
   A receipt is an unsigned personal record of one completed local check. It contains aggregate
   counts, dimensions and bytes only. It never contains source text, URL values or file names,
   and it is not evidence that anyone else can verify. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.WSReceipt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA_VERSION = 1;

  var NOTICE = 'Unsigned and not proof: this is only your own record of a local check. It cannot be verified by anyone else, and it does not show what the input contained.';

  var RECIPIENTS = [
    {
      id: 'ai',
      label: 'AI assistant',
      tips: [
        'Do not paste customer data, private messages, credentials or API keys.',
        'The platform may keep the conversation, use it for training and set its own retention; this page cannot check those settings.',
        'Remove other people\'s names and identifiers unless the task really needs them.'
      ]
    },
    {
      id: 'work',
      label: 'Work / email',
      tips: [
        'Check every recipient and whether the thread reaches people who should not see it.',
        'Remove other people\'s personal details unless the work needs them.',
        'Work mail systems and colleagues may keep copies you cannot delete.'
      ]
    },
    {
      id: 'public',
      label: 'Public post',
      tips: [
        'Look at the picture for house numbers, licence plates and screens in the background.',
        'Remove names, locations and contact details that identify you or someone else.',
        'Assume copies and search indexes can outlast a deleted post.'
      ]
    },
    {
      id: 'known',
      label: 'Someone I know',
      tips: [
        'Include only what this person needs for this conversation.',
        'Check whether forwarding or a screenshot would expose someone else.',
        'The other person gets their own copy; deleting yours does not delete theirs.'
      ]
    }
  ];

  var METHODS = {
    text: 'Local pattern matching for a limited set of common formats. It is not semantic review; names, addresses, context and unusual formats can be missed.',
    link: 'Local parsing of the URL structure. The page did not open, contact or follow the link, and it cannot tell whether the destination is safe.',
    image: 'Local in-browser re-encode of one JPEG, PNG or WebP image. It drops most metadata chunks but does not prove every block is gone, and it does not inspect faces, house numbers, screens or anything else visible in the picture.'
  };

  var TEXT_CATEGORIES = ['key', 'email', 'id', 'card', 'phone', 'ipv4'];
  var LINK_COUNTS = ['queryParameters', 'trackingParameters', 'reviewParameters', 'fragmentReview'];

  function cloneRecipient(item) {
    return { id: item.id, label: item.label, tips: item.tips.slice() };
  }

  function recipientById(id) {
    var key = String(id === undefined || id === null ? '' : id);
    for (var i = 0; i < RECIPIENTS.length; i++) {
      if (RECIPIENTS[i].id === key) return cloneRecipient(RECIPIENTS[i]);
    }
    return null;
  }

  // Counts are whole, non-negative numbers. Anything else becomes 0 rather than being copied.
  function count(value) {
    if (typeof value !== 'number' && typeof value !== 'string') return 0;
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
  }

  function normalizeSummary(checkType, summary) {
    var s = summary && typeof summary === 'object' ? summary : {};
    var out, i;

    if (checkType === 'text') {
      var source = s.counts && typeof s.counts === 'object' ? s.counts : s;
      out = { counts: {} };
      for (i = 0; i < TEXT_CATEGORIES.length; i++) {
        out.counts[TEXT_CATEGORIES[i]] = count(source[TEXT_CATEGORIES[i]]);
      }
      return out;
    }

    if (checkType === 'link') {
      out = {};
      for (i = 0; i < LINK_COUNTS.length; i++) out[LINK_COUNTS[i]] = count(s[LINK_COUNTS[i]]);
      return out;
    }

    out = {
      before: { width: 0, height: 0, bytes: 0 },
      after: { width: 0, height: 0, bytes: 0 }
    };
    var sides = ['before', 'after'];
    for (i = 0; i < sides.length; i++) {
      var side = s[sides[i]] && typeof s[sides[i]] === 'object' ? s[sides[i]] : {};
      out[sides[i]].width = count(side.width);
      out[sides[i]].height = count(side.height);
      out[sides[i]].bytes = count(side.bytes);
    }
    return out;
  }

  function isoTime(value) {
    var date = value instanceof Date ? value : new Date();
    try {
      return date.toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  }

  // Builds a new receipt from a deliberately small set of fields. Any other property in `input`
  // (text, URL, file name, matches and so on) is ignored and cannot reach the JSON.
  function build(input) {
    input = input && typeof input === 'object' ? input : {};
    var checkType = String(input.checkType === undefined || input.checkType === null ? '' : input.checkType);
    if (checkType !== 'text' && checkType !== 'link' && checkType !== 'image') return null;

    var receipt = {
      schemaVersion: SCHEMA_VERSION,
      createdAt: isoTime(input.now),
      checkType: checkType
    };
    var chosen = recipientById(input.recipient);
    if (chosen) receipt.recipient = { id: chosen.id, label: chosen.label };
    receipt.summary = normalizeSummary(checkType, input.summary);
    receipt.method = METHODS[checkType];
    receipt.unsigned = true;
    receipt.notice = NOTICE;
    return receipt;
  }

  function toJSON(receipt) {
    if (!receipt || typeof receipt !== 'object') return '';
    return JSON.stringify(receipt, null, 2) + '\n';
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    NOTICE: NOTICE,
    RECIPIENTS: RECIPIENTS.map(cloneRecipient),
    METHODS: METHODS,
    recipientById: recipientById,
    build: build,
    toJSON: toJSON
  };
});
