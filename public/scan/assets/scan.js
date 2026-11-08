/* /scan/ controller. Local only: no fetch, XHR, WebSocket, EventSource, beacon or storage.
   Results and the optional first-scan snapshot live in this script's memory. */
(function () {
  'use strict';
  var M = window.ScanModel;
  var D = window.ScanDiff;
  var R = window.ScanReport;
  var P = window.ScanProbes;

  var startBtn = document.getElementById('scan-start');
  var stopBtn = document.getElementById('scan-stop');
  var statusEl = document.getElementById('scan-status');
  var liveEl = document.getElementById('scan-live');
  var resultsSection = document.getElementById('scan-results');
  var groupsEl = document.getElementById('scan-groups');
  var summaryEl = document.getElementById('results-summary');
  var saveBtn = document.getElementById('save-snapshot');
  var clearBtn = document.getElementById('clear-results');
  var saveStatus = document.getElementById('save-status');
  var compareSection = document.getElementById('compare');
  var compareBody = document.getElementById('compare-body');
  var compareStatus = document.getElementById('compare-status');
  var clearSnapshotBtn = document.getElementById('clear-snapshot');
  var proofCount = document.getElementById('proof-count');
  var proofNew = document.getElementById('proof-new');
  var proofList = document.getElementById('proof-list');
  var reportChanges = document.getElementById('report-changes');
  var reportChangesList = document.getElementById('report-changes-list');
  var downloadTextBtn = document.getElementById('download-text');
  var downloadJsonBtn = document.getElementById('download-json');
  var includeRawEl = document.getElementById('include-raw');
  var rawWarning = document.getElementById('raw-warning');
  var exportStatus = document.getElementById('export-status');

  var latest = null;
  var snapshot = null;
  var running = false;
  var cancelRequested = false;
  var resourceBaseline = 0;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* ---------- network proof ---------- */
  function resourceUrls() {
    if (!window.performance || !performance.getEntriesByType) return [];
    return performance.getEntriesByType('resource').map(function (e) { return e.name; });
  }

  function displayUrl(url) {
    try {
      var u = new URL(url);
      return u.origin === location.origin ? u.pathname + u.search : u.href;
    } catch (e) { return url; }
  }

  function refreshProof(scanned) {
    var urls = resourceUrls();
    var added = urls.length - resourceBaseline;
    if (added < 0) added = 0;
    proofCount.textContent = String(urls.length);
    if (!scanned) {
      proofNew.textContent = 'No scan has run yet. Scanning adds 0 requests.';
    } else if (added === 0) {
      proofNew.textContent = 'After the local scan: 0 new requests (' + urls.length + ' page resources in total).';
    } else {
      proofNew.textContent = 'After the local scan: ' + added + ' new request' + (added === 1 ? '' : 's') + ' observed.';
    }
    proofList.textContent = '';
    urls.forEach(function (url) {
      proofList.appendChild(el('li', null, displayUrl(url)));
    });
  }

  function setBaseline() {
    resourceBaseline = resourceUrls().length;
    refreshProof(false);
  }

  /* ---------- results ---------- */
  function renderResults(results) {
    groupsEl.textContent = '';
    var groups = M.groupByRisk(results);
    groups.forEach(function (group) {
      var section = el('section', 'risk-group');
      var head = el('h3', 'risk-group__head');
      var badge = el('span', 'risk-badge', group.symbol + ' ' + group.label);
      badge.setAttribute('data-risk', group.risk);
      head.appendChild(badge);
      head.appendChild(el('span', 'risk-group__count', group.items.length + ' item' + (group.items.length === 1 ? '' : 's')));
      section.appendChild(head);

      var list = el('div', 'results');
      group.items.forEach(function (item) {
        var card = el('article', 'result-card');
        card.setAttribute('data-id', item.id);
        card.setAttribute('data-risk', item.risk);
        card.appendChild(el('h3', null, item.title));
        card.appendChild(el('p', 'result-value', item.value));
        var who = el('p', 'result-who');
        who.appendChild(el('strong', null, 'Who can read it: '));
        who.appendChild(document.createTextNode(item.whoCanRead));
        card.appendChild(who);
        var details = el('details');
        details.appendChild(el('summary', null, 'How to reduce'));
        details.appendChild(el('p', null, item.howToReduce));
        card.appendChild(details);
        card.appendChild(el('p', 'result-source', 'Source: ' + item.source));
        list.appendChild(card);
      });
      section.appendChild(list);
      groupsEl.appendChild(section);
    });

    summaryEl.textContent = R.summaryLine(results) + ' No network request was made.';
    resultsSection.hidden = false;
  }

  function renderReportChanges(diff) {
    reportChanges.hidden = false;
    reportChangesList.textContent = '';
    if (!diff.changed.length) {
      var empty = el('li', 'report-changes__empty', 'No changed value was observed since the saved scan.');
      reportChangesList.appendChild(empty);
      return;
    }
    diff.changed.forEach(function (item) {
      var li = el('li');
      li.appendChild(el('strong', null, item.title));
      li.appendChild(document.createTextNode(' value changed since the saved scan.'));
      reportChangesList.appendChild(li);
    });
  }

  function renderCompare() {
    if (!snapshot || !latest) {
      compareSection.hidden = true;
      reportChanges.hidden = true;
      return;
    }
    var diff = D.diff(snapshot.results, latest);
    renderReportChanges(diff);
    compareBody.textContent = '';

    function column(title, items, emptyText, showValues) {
      var col = el('div', 'compare__col');
      col.appendChild(el('h3', null, title));
      if (!items.length) {
        col.appendChild(el('p', 'compare__empty', emptyText));
      } else {
        var ul = el('ul');
        items.forEach(function (item) {
          var li = el('li');
          li.appendChild(el('strong', null, item.title));
          if (showValues && item.before !== undefined) {
            li.appendChild(document.createTextNode('Was: ' + item.before));
            li.appendChild(document.createElement('br'));
            li.appendChild(document.createTextNode('Now: ' + item.value));
          } else {
            li.appendChild(document.createTextNode(item.value));
          }
          if (item.reason) {
            li.appendChild(document.createElement('br'));
            li.appendChild(document.createTextNode(item.reason));
          }
          ul.appendChild(li);
        });
        col.appendChild(ul);
      }
      compareBody.appendChild(col);
    }

    column('Changed', diff.changed, 'No changed value was observed.', true);
    column('Unchanged', diff.unchanged, 'No value was observed twice.', false);
    column('Could not compare', diff.incomparable, 'Nothing was missing or unavailable.', false);

    compareStatus.textContent = diff.changed.length + ' changed, ' + diff.unchanged.length +
      ' unchanged, ' + diff.incomparable.length + ' could not be compared. Saved results stay in this tab only.';
    if (diff.changed.length) compareStatus.removeAttribute('data-tone');
    else compareStatus.setAttribute('data-tone', 'ok');
    compareSection.hidden = false;
  }

  function resetView() {
    latest = null;
    snapshot = null;
    groupsEl.textContent = '';
    compareBody.textContent = '';
    liveEl.textContent = '';
    resultsSection.hidden = true;
    compareSection.hidden = true;
    reportChanges.hidden = true;
    reportChangesList.textContent = '';
    saveStatus.textContent = '';
    compareStatus.textContent = '';
    exportStatus.textContent = '';
    includeRawEl.checked = false;
    rawWarning.hidden = true;
    saveBtn.disabled = true;
    statusEl.textContent = 'No scan has run yet.';
    statusEl.removeAttribute('data-tone');
    refreshProof(false);
    startBtn.textContent = 'Start local scan';
    startBtn.disabled = false;
    stopBtn.hidden = true;
  }

  /* ---------- scan ---------- */
  function addLiveRow(spec) {
    var row = el('li', 'live__row');
    row.setAttribute('data-id', spec.id);
    row.setAttribute('data-state', 'running');
    var main = el('div');
    main.appendChild(el('strong', null, spec.title));
    var value = el('p', 'live__value', 'Reading\u2026');
    main.appendChild(value);
    row.appendChild(main);
    row.appendChild(el('span', 'live__state', 'Reading'));
    liveEl.appendChild(row);
    return { row: row, value: value, state: row.querySelector('.live__state') };
  }

  function finishLiveRow(handle, ok) {
    handle.row.setAttribute('data-state', ok ? 'done' : 'cancelled');
    handle.state.textContent = ok ? 'Done' : 'Cancelled';
  }

  function scan() {
    if (running) return;
    running = true;
    cancelRequested = false;
    latest = null;
    startBtn.disabled = true;
    startBtn.textContent = 'Scanning\u2026';
    stopBtn.hidden = false;
    liveEl.textContent = '';
    resultsSection.hidden = true;
    compareSection.hidden = true;
    reportChanges.hidden = true;
    reportChangesList.textContent = '';
    saveBtn.disabled = true;
    saveStatus.textContent = '';
    exportStatus.textContent = '';
    statusEl.removeAttribute('data-tone');

    var specs = M.LOCAL_SPECS;
    var collected = [];
    var index = 0;

    function next() {
      if (cancelRequested) {
        for (; index < specs.length; index++) {
          var cancelled = addLiveRow(specs[index]);
          cancelled.value.textContent = 'Not run: the scan was stopped.';
          finishLiveRow(cancelled, false);
        }
        var partial = M.summarize(collected);
        statusEl.textContent = 'Scan stopped after ' + partial.total + ' of ' + specs.length + ' local items. Completed items stay on this page until you clear them.';
        statusEl.setAttribute('data-tone', 'fail');
        if (collected.length) renderResults(collected);
        done();
        return;
      }
      if (index >= specs.length) {
        statusEl.textContent = 'Local scan complete: ' + collected.length + ' items read. No network request was made.';
        statusEl.setAttribute('data-tone', 'ok');
        renderResults(collected);
        latest = collected.slice();
        saveBtn.disabled = false;
        refreshProof(true);
        if (snapshot) renderCompare();
        done();
        return;
      }

      var spec = specs[index];
      var handle = addLiveRow(spec);
      statusEl.textContent = 'Reading ' + (index + 1) + ' of ' + specs.length + ': ' + spec.title + '\u2026';
      P.valueFor(spec.id).then(function (value) {
        index++;
        if (cancelRequested) {
          finishLiveRow(handle, false);
          handle.value.textContent = 'Not counted: the scan was stopped.';
          next();
          return;
        }
        var result = M.makeResult({
          id: spec.id,
          group: 'local',
          title: spec.title,
          value: value,
          whoCanRead: spec.whoCanRead,
          risk: spec.risk,
          howToReduce: spec.howToReduce,
          source: spec.source
        });
        collected.push(result);
        handle.value.textContent = value;
        finishLiveRow(handle, true);
        wait(45).then(next);
      }, function () {
        index++;
        var failed = M.makeResult({
          id: spec.id,
          group: 'local',
          title: spec.title,
          value: M.unavailable('the browser blocked this read'),
          whoCanRead: spec.whoCanRead,
          risk: spec.risk,
          howToReduce: spec.howToReduce,
          source: spec.source
        });
        collected.push(failed);
        handle.value.textContent = failed.value;
        finishLiveRow(handle, true);
        wait(45).then(next);
      });
    }

    function done() {
      running = false;
      startBtn.disabled = false;
      startBtn.textContent = latest ? 'Scan again' : 'Start local scan';
      stopBtn.hidden = true;
      refreshProof(true);
    }

    next();
  }

  startBtn.addEventListener('click', scan);
  stopBtn.addEventListener('click', function () {
    if (!running) return;
    cancelRequested = true;
    stopBtn.disabled = true;
    statusEl.textContent = 'Stopping after the current item\u2026';
    setTimeout(function () { stopBtn.disabled = false; }, 200);
  });

  saveBtn.addEventListener('click', function () {
    if (!latest) return;
    snapshot = { results: latest.slice(), savedAt: new Date() };
    saveBtn.disabled = true;
    saveStatus.textContent = 'Saved in this page\u2019s memory. Change a browser setting, then scan again to compare. Reloading the page clears it.';
    compareStatus.textContent = '';
    renderCompare();
  });

  clearSnapshotBtn.addEventListener('click', function () {
    snapshot = null;
    compareSection.hidden = true;
    reportChanges.hidden = true;
    reportChangesList.textContent = '';
    saveBtn.disabled = !latest;
    saveStatus.textContent = latest ? 'Saved comparison cleared. The current report is still in memory.' : '';
  });

  function download(kind) {
    if (!latest) return;
    var includeRaw = includeRawEl.checked;
    var changes = snapshot ? D.diff(snapshot.results, latest).changed : null;
    var options = { includeRaw: includeRaw, changes: changes, generatedAt: new Date() };
    var content = kind === 'json' ? R.buildJson(latest, options) : R.buildText(latest, options);
    var name = kind === 'json' ? 'exposure-report.json' : 'exposure-report.txt';
    var blob = new Blob([content], { type: kind === 'json' ? 'application/json' : 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // The file has already been handed to the browser; release the object URL afterwards.
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    exportStatus.textContent = 'Created ' + name + ' in this tab' +
      (includeRaw ? ' with raw values.' : ' with raw values hidden.');
  }

  downloadTextBtn.addEventListener('click', function () { download('text'); });
  downloadJsonBtn.addEventListener('click', function () { download('json'); });
  includeRawEl.addEventListener('change', function () {
    rawWarning.hidden = !includeRawEl.checked;
  });

  // A printed report should include the reduction advice even when it is collapsed on screen.
  var openedForPrint = [];
  window.addEventListener('beforeprint', function () {
    openedForPrint = [];
    groupsEl.querySelectorAll('details').forEach(function (details) {
      if (!details.open) {
        details.open = true;
        openedForPrint.push(details);
      }
    });
  });
  window.addEventListener('afterprint', function () {
    openedForPrint.forEach(function (details) { details.open = false; });
    openedForPrint = [];
  });

  clearBtn.addEventListener('click', resetView);

  // Keep the proof accurate if late page resources (for example a font) finish after first paint.
  setBaseline();
  window.addEventListener('load', setBaseline);
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
    document.fonts.ready.then(function () { if (!running) setBaseline(); });
  }
})();
