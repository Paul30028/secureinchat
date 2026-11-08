/* Compare two scans in page memory.
   Pure functions: no DOM, no network, no storage. Matching is by stable result id, never by title text. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScanDiff = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function comparable(value) {
    return typeof value === 'string' && value.length > 0 && !/^unavailable(?::|\s*$)/i.test(value);
  }

  function entry(result, value, extra) {
    var out = { id: result.id, title: result.title, value: value };
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
      }
    }
    return out;
  }

  /* diff(first, second) accepts arrays of result objects.
     Returns { changed, unchanged, incomparable, hasChanges } where each list holds
     { id, title, before, after } (before/after omitted where a scan had no value).
     "unchanged" means the same value was observable twice in this browser context; it is
     not evidence that no other site has already linked the two visits. */
  function diff(first, second) {
    var a = Array.isArray(first) ? first : [];
    var b = Array.isArray(second) ? second : [];
    var byId = {};
    var order = [];
    var i;

    for (i = 0; i < a.length; i++) {
      if (!a[i] || typeof a[i].id !== 'string') continue;
      if (!byId[a[i].id]) order.push(a[i].id);
      byId[a[i].id] = byId[a[i].id] || { first: null, second: null };
      byId[a[i].id].first = a[i];
    }
    for (i = 0; i < b.length; i++) {
      if (!b[i] || typeof b[i].id !== 'string') continue;
      if (!byId[b[i].id]) order.push(b[i].id);
      byId[b[i].id] = byId[b[i].id] || { first: null, second: null };
      byId[b[i].id].second = b[i];
    }

    var out = { changed: [], unchanged: [], incomparable: [], hasChanges: false };
    order.forEach(function (id) {
      var pair = byId[id];
      var before = pair.first;
      var after = pair.second;
      var any = after || before;
      if (!before || !after) {
        out.incomparable.push(entry(any, any.value, {
          reason: !before ? 'Not present in the first scan' : 'Not present in the second scan'
        }));
        return;
      }
      if (!comparable(before.value) || !comparable(after.value)) {
        out.incomparable.push(entry(after, after.value, {
          reason: 'A value was unavailable in one of the scans'
        }));
        return;
      }
      if (before.value === after.value) {
        out.unchanged.push(entry(after, after.value));
      } else {
        out.changed.push(entry(after, after.value, { before: before.value }));
        out.hasChanges = true;
      }
    });
    return out;
  }

  return { diff: diff, comparable: comparable };
});
