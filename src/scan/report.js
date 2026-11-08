/* Local report generation for /scan/.
   Pure functions: no DOM, no network, no storage. The page turns these strings into a Blob,
   so the report exists only after the user presses a download button.
   Default policy: identifiable raw values are replaced by a category description. The user can
   opt in to raw values for this one download; the canvas hash is never exported. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScanReport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SCHEMA = 'secureinchat.exposure-report/1';
  var RISK_ORDER = ['high', 'medium', 'low'];
  var RISK_LABEL = {
    high: 'Higher exposure',
    medium: 'Worth a look',
    low: 'Lower exposure'
  };

  // The value shown instead of a raw value. Wording names the category, not the device.
  var CATEGORY_VALUE = {
    platform: 'A browser user-agent string and platform were read (raw values hidden)',
    webgl: 'A graphics card vendor and model were read (raw value hidden)',
    screen: 'A screen and window resolution and pixel ratio were read (raw values hidden)',
    timezone: 'A time zone identifier was read (raw value hidden)',
    languages: 'Browser language preferences were read (raw values hidden)',
    canvas: 'A stable canvas drawing was measured (drawing hash not exported)'
  };

  // A canvas hash is a stable high-entropy value. It is withheld even when the user asks for
  // raw values, matching the spec's rule against exporting fingerprint hashes.
  var NEVER_RAW = { canvas: true };

  function isUnavailable(value) {
    return typeof value !== 'string' || value.length === 0 ||
      /^(Unavailable|Hidden|Blocked|Varies)\b/i.test(value);
  }

  function valueFor(result, includeRaw) {
    var raw = result.value;
    var category = CATEGORY_VALUE[result.id];
    if (!category || isUnavailable(raw)) {
      return { value: raw, redacted: false, rawIncluded: false, withheld: false };
    }
    if (NEVER_RAW[result.id]) {
      return { value: category, redacted: true, rawIncluded: false, withheld: true };
    }
    if (includeRaw) {
      return { value: raw, redacted: false, rawIncluded: true, withheld: false };
    }
    return { value: category, redacted: true, rawIncluded: false, withheld: false };
  }

  function itemFor(result, includeRaw) {
    var shown = valueFor(result, includeRaw);
    return {
      id: result.id,
      group: result.group,
      title: result.title,
      risk: result.risk,
      riskLabel: RISK_LABEL[result.risk] || '',
      value: shown.value,
      whoCanRead: result.whoCanRead,
      howToReduce: result.howToReduce,
      source: result.source,
      redacted: shown.redacted,
      rawIncluded: shown.rawIncluded,
      withheld: shown.withheld
    };
  }

  function summarize(results) {
    var counts = { total: 0, high: 0, medium: 0, low: 0, local: 0, network: 0 };
    (results || []).forEach(function (r) {
      if (!r) return;
      counts.total++;
      if (RISK_ORDER.indexOf(r.risk) !== -1) counts[r.risk]++;
      if (r.group === 'local' || r.group === 'network') counts[r.group]++;
    });
    return counts;
  }

  // The one-sentence summary deliberately gives counts and risk, never a uniqueness or safety score.
  function summaryLine(results) {
    var c = summarize(results);
    return 'A normal website can read ' + c.total + ' items from you without your permission, ' +
      c.high + ' of them higher risk.';
  }

  function isoTime(value) {
    var d = value === undefined || value === null ? new Date() : value;
    if (typeof d === 'string') d = new Date(d);
    if (!(d instanceof Date) || isNaN(d.getTime())) d = new Date(0);
    return d.toISOString();
  }

  function buildReport(results, options) {
    var opts = options || {};
    var includeRaw = opts.includeRaw === true;
    var counts = summarize(results);
    var items = (results || []).filter(Boolean).map(function (result) {
      return itemFor(result, includeRaw);
    });
    items.sort(function (a, b) {
      return RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk);
    });
    var changes = (opts.changes || []).filter(Boolean).map(function (change) {
      return { id: change.id, title: change.title, changed: true };
    });
    var withheld = items.some(function (item) { return item.withheld; });
    return {
      schema: SCHEMA,
      generatedAt: isoTime(opts.generatedAt),
      scope: 'local-browser-reads-only',
      summary: {
        total: counts.total,
        high: counts.high,
        medium: counts.medium,
        low: counts.low,
        local: counts.local,
        network: counts.network,
        line: summaryLine(results)
      },
      redaction: {
        includeRaw: includeRaw,
        defaultPolicy: includeRaw ? 'raw-at-user-request' : 'category-descriptions',
        canvasHashExported: false,
        hasWithheldValues: withheld,
        note: includeRaw
          ? 'Raw values were included at your request. This file may identify your device.'
          : 'Identifiable raw values are hidden. They are not included in this file.'
      },
      items: items,
      changes: changes
    };
  }

  function buildJson(results, options) {
    return JSON.stringify(buildReport(results, options), null, 2) + '\n';
  }

  function lineFor(item) {
    return '  Value: ' + item.value + '\n' +
      '  Who can read it: ' + item.whoCanRead + '\n' +
      '  How to reduce: ' + item.howToReduce + '\n' +
      '  Source: ' + item.source + '\n';
  }

  function buildText(results, options) {
    var opts = options || {};
    var report = buildReport(results, opts);
    var out = [];
    out.push('EXPOSURE SCAN REPORT');
    out.push('Schema: ' + report.schema);
    out.push('Generated: ' + report.generatedAt);
    out.push('Scope: local browser reads only. The scan that produced this report made no network request.');
    out.push('');
    out.push(report.summary.line);
    out.push('');
    out.push('Redaction: ' + report.redaction.note);
    out.push('');

    RISK_ORDER.forEach(function (risk) {
      var items = report.items.filter(function (item) { return item.risk === risk; });
      if (!items.length) return;
      out.push((RISK_LABEL[risk] + ' (' + items.length + ')').toUpperCase());
      items.forEach(function (item) {
        out.push('- ' + item.title);
        out.push(lineFor(item).replace(/\n$/, ''));
        out.push('');
      });
    });

    // The change list is part of comparison mode only.
    if (Array.isArray(opts.changes)) {
      out.push('CHANGES SINCE THE LAST SAVED SCAN');
      if (report.changes.length) {
        report.changes.forEach(function (change) {
          out.push('- ' + change.title + ': value changed');
        });
      } else {
        out.push('No item changed between the two saved scans.');
      }
      out.push('');
    }

    out.push('No uniqueness or safety score is calculated. A common value is not proof of protection;');
    out.push('an unusual value is not proof that a site can identify you.');
    return out.join('\n') + '\n';
  }

  return {
    SCHEMA: SCHEMA,
    CATEGORY_VALUE: CATEGORY_VALUE,
    summarize: summarize,
    summaryLine: summaryLine,
    buildReport: buildReport,
    buildJson: buildJson,
    buildText: buildText
  };
});
