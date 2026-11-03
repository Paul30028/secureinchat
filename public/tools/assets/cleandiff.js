/* Compares the metadata found before and after cleaning, item by item. Pure: no DOM, no network, no storage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CLEANDIFF = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function text(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    try { return String(v); } catch (e) { return ''; }
  }

  // Turns anything into a clean item list. Non-arrays become [], non-object entries become empty items.
  function items(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (it) {
      if (!it || typeof it !== 'object') return { category: '', name: '', value: '' };
      return { category: text(it.category), name: text(it.name), value: text(it.value) };
    });
  }

  function key(it) { return it.category.trim().toLowerCase() + '\u0000' + it.name.trim().toLowerCase(); }

  // Matches on category + name only (case and surrounding spaces ignored); values are not compared.
  // Duplicate keys are counted, so two "Author" before and one after is one removed and one left.
  function compare(before, after) {
    var b = items(before), a = items(after);
    var pool = {}, out = { removed: [], left: [], added: [] };
    a.forEach(function (it) {
      var k = key(it);
      (pool[k] = pool[k] || []).push(it);
    });
    b.forEach(function (it) {
      var k = key(it);
      if (pool[k] && pool[k].length) { pool[k].shift(); out.left.push(it); }
      else out.removed.push(it);
    });
    a.forEach(function (it) {
      var k = key(it);
      if (pool[k] && pool[k].length && pool[k][0] === it) { pool[k].shift(); out.added.push(it); }
    });
    return out;
  }

  // Converts an EXIFR.parse() result into the same item shape.
  function fromExif(parsed) {
    var out = [];
    if (!parsed || typeof parsed !== 'object') return out;
    if (parsed.hasGPS) {
      var g = parsed.gps;
      var v = g && typeof g.lat === 'number' && typeof g.lon === 'number' ? g.lat.toFixed(5) + ', ' + g.lon.toFixed(5) : 'present';
      out.push({ category: 'Location', name: 'GPS', value: v });
    }
    (Array.isArray(parsed.fields) ? parsed.fields : []).forEach(function (f) {
      var label = text(f && f[0]), value = text(f && f[1]);
      var cat = /camera|lens|software|owner/i.test(label) ? 'Device' : /date/i.test(label) ? 'Dates' : 'Other';
      out.push({ category: cat, name: label, value: value });
    });
    return out;
  }

  // Groups items by category, keeping first-seen order. Used by both tool pages to build their tables.
  function byCategory(list) {
    var groups = [], index = {};
    items(list).forEach(function (it) {
      var k = it.category.trim().toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(index, k)) { index[k] = groups.length; groups.push({ name: it.category.trim(), items: [] }); }
      groups[index[k]].items.push(it);
    });
    return groups;
  }

  return { compare: compare, fromExif: fromExif, byCategory: byCategory };
});
