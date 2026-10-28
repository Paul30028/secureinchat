/* Network request log. Reads browser Resource Timing data and lists it. No network, no storage. */
(function () {
  'use strict';

  var root = document.getElementById('netlog');
  if (!root) return;

  var details = root.querySelector('.netlog-details');
  var countEl = root.querySelector('.netlog-count');
  var tbody = root.querySelector('.netlog-rows');
  var fallback = root.querySelector('.netlog-fallback');
  if (!details || !countEl || !tbody) return;

  // Cell labels, sizes and the fallback line follow the document language. The English page is the
  // default, so its output is unchanged; the Chinese photo page sets lang="zh-CN" and gets Chinese.
  var ZH = /^zh/i.test(document.documentElement.lang || '');
  var T = ZH ? {
    notAvailable: '不可用',
    time: '时间', type: '类型', address: '地址', size: '大小',
    timeTitle: '自本页开始加载以来的时间',
    other: '其他',
    cached: '缓存',
    cachedWhy: '传输 0 字节：浏览器报告该资源来自缓存。',
    notReported: '大小未报告。浏览器没有返回该资源的传输大小：可能是缓存命中，或者服务器没有发送 Timing-Allow-Origin。',
    external: '外部',
  } : {
    notAvailable: 'not available',
    time: 'Time', type: 'Type', address: 'Address', size: 'Size',
    timeTitle: 'Time since this page started loading',
    other: 'other',
    cached: 'cached',
    cachedWhy: '0 bytes transferred: the browser reports this resource came from cache.',
    notReported: 'Size not reported. The browser did not return a transfer size for this resource: it may have been cached, or the server did not send Timing-Allow-Origin.',
    external: 'external',
  };

  // If the browser does not expose resource timing to pages, show the fallback and stop.
  if (typeof PerformanceObserver !== 'function' ||
      typeof window.performance === 'undefined' ||
      typeof window.performance.getEntriesByType !== 'function') {
    // The fallback line sits inside <details>, so keep the panel and hide only the table and count.
    if (fallback) fallback.hidden = false;
    var scroll = root.querySelector('.netlog-scroll');
    if (scroll) scroll.hidden = true;
    countEl.textContent = T.notAvailable;
    return;
  }

  var seen = {};
  var count = 0;
  var firstMarkTime = null;
  var addedMarkers = {};

  function fmtBytes(n) {
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return n + ' B';
  }

  function isSameOrigin(url) {
    try { return new URL(url, location.href).origin === location.origin; }
    catch (e) { return false; }
  }

  function displayUrl(url) {
    try {
      var u = new URL(url, location.href);
      if (u.origin === location.origin) return u.pathname + u.search;
      return u.origin + u.pathname + (u.search || '');
    } catch (e) { return url; }
  }

  function insertByTime(tr, time) {
    var children = tbody.children;
    for (var i = 0; i < children.length; i++) {
      var rt = parseFloat(children[i].getAttribute('data-time'));
      if (!isNaN(rt) && rt > time) {
        tbody.insertBefore(tr, children[i]);
        return;
      }
    }
    tbody.appendChild(tr);
  }

  function buildSize(entry) {
    var td = document.createElement('td');
    td.setAttribute('data-label', T.size);
    if (entry.transferSize > 0) {
      td.textContent = fmtBytes(entry.transferSize);
    } else if (isSameOrigin(entry.name)) {
      td.textContent = T.cached;
      td.title = T.cachedWhy;
    } else {
      td.textContent = '\u2014';
      td.title = T.notReported;
    }
    return td;
  }

  function addEntry(entry) {
    if (!entry || !entry.name) return;
    var key = entry.name + '|' + entry.startTime + '|' + (entry.initiatorType || '');
    if (seen[key]) return;
    seen[key] = true;
    count += 1;

    var tr = document.createElement('tr');
    tr.className = 'netlog-row';
    tr.setAttribute('data-time', String(entry.startTime));
    if (firstMarkTime !== null && entry.startTime > firstMarkTime) {
      tr.classList.add('netlog-after');
    }

    var tdTime = document.createElement('td');
    tdTime.setAttribute('data-label', T.time);
    tdTime.textContent = (entry.startTime / 1000).toFixed(1) + 's';
    tdTime.title = T.timeTitle;

    var tdType = document.createElement('td');
    tdType.setAttribute('data-label', T.type);
    tdType.textContent = entry.initiatorType || T.other;

    var tdUrl = document.createElement('td');
    tdUrl.setAttribute('data-label', T.address);
    tdUrl.className = 'netlog-url';
    var code = document.createElement('code');
    code.textContent = displayUrl(entry.name);
    tdUrl.appendChild(code);
    if (!isSameOrigin(entry.name)) {
      tdUrl.appendChild(document.createTextNode(' '));
      var tag = document.createElement('span');
      tag.className = 'netlog-tag';
      tag.textContent = T.external;
      tdUrl.appendChild(tag);
    }

    tr.appendChild(tdTime);
    tr.appendChild(tdType);
    tr.appendChild(tdUrl);
    tr.appendChild(buildSize(entry));
    insertByTime(tr, entry.startTime);
    countEl.textContent = String(count);
  }

  function addMarker(label) {
    if (addedMarkers[label]) return;
    addedMarkers[label] = true;

    var time = (typeof performance.now === 'function') ? performance.now() : 0;
    if (firstMarkTime === null) firstMarkTime = time;

    var tr = document.createElement('tr');
    tr.className = 'netlog-marker';
    tr.setAttribute('data-time', String(time));
    var th = document.createElement('th');
    th.scope = 'row';
    th.colSpan = 4;
    th.textContent = label;
    tr.appendChild(th);
    insertByTime(tr, time);
  }

  try {
    var initial = window.performance.getEntriesByType('resource');
    for (var i = 0; i < initial.length; i++) addEntry(initial[i]);
  } catch (e) {}

  try {
    var observer = new PerformanceObserver(function (list) {
      var entries = list.getEntries();
      for (var j = 0; j < entries.length; j++) addEntry(entries[j]);
    });
    observer.observe({ type: 'resource', buffered: true });
  } catch (e) {
    // Live updates unavailable; whatever the initial read produced stays shown.
  }

  document.addEventListener('netlog:mark', function (e) {
    var label = e && e.detail && e.detail.label;
    if (typeof label !== 'string' || !label) return;
    addMarker(label);
  });

  countEl.textContent = String(count);
})();
