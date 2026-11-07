/* Home live text review and request counter.
   Everything here runs in this tab: no fetch, no XHR, no storage, no cookies.
   The text analysis is the same WSText module the workspace uses; this file only renders
   category names and counts, never the matched values. */
(function () {
  'use strict';

  document.documentElement.classList.add('home-js');

  var LANG = ((document.documentElement.lang || 'en').toLowerCase().indexOf('zh') === 0) ? 'zh'
    : ((document.documentElement.lang || '').toLowerCase().indexOf('ja') === 0) ? 'ja' : 'en';
  var T = {
    en: {
      start: 'Start typing to see what the rules can find.',
      total: function (n, c) { return n + (n === 1 ? ' match' : ' matches') + ' in ' + c + (c === 1 ? ' category.' : ' categories.'); },
      none: 'No supported patterns found by these rules. That does not mean the text is safe to share.',
      tooLong: 'This text is longer than 200,000 characters. Shorten it and try again.',
      unavailable: 'The local check could not load. The text was not sent anywhere; reload the page and try again.',
      requests: function (n) { return 'Requests since you started typing: ' + n; },
      unsupported: 'Requests since you started typing: unable to count in this browser.',
    },
    zh: {
      start: '开始输入，看看规则能发现什么。',
      total: function (n, c) { return '发现 ' + n + ' 处匹配，涉及 ' + c + ' 个类别。'; },
      none: '这些规则没有发现支持的格式。这不代表这段文字可以安全分享。',
      tooLong: '文字超过 20 万个字符，请缩短后再试。',
      unavailable: '本地检查未能加载。文字没有发送到任何地方；请刷新页面重试。',
      requests: function (n) { return '开始输入后本页发出的请求：' + n; },
      unsupported: '开始输入后本页发出的请求：无法统计。',
    },
    ja: {
      start: '入力を始めると、ルールで見つかる項目が表示されます。',
      total: function (n, c) { return n + ' 件の一致、' + c + ' 種類です。'; },
      none: 'このルールでは対応する形式が見つかりませんでした。共有しても安全という意味ではありません。',
      tooLong: '文字数が 20 万を超えています。短くしてからお試しください。',
      unavailable: 'ローカル確認を読み込めませんでした。文字はどこにも送信されていません。ページを再読み込みしてください。',
      requests: function (n) { return '入力を始めてからこのページが送信したリクエスト：' + n; },
      unsupported: '入力を始めてからこのページが送信したリクエスト：このブラウザでは取得できません。',
    },
  }[LANG];

  var root = document.getElementById('home-check');
  var field = document.getElementById('home-text');
  var status = document.getElementById('home-status');
  var list = document.getElementById('home-categories');
  var proof = document.getElementById('request-count');
  if (!root || !field || !status || !list || !proof) return;

  function setStatus(text) {
    status.textContent = text;
  }

  function clearList() {
    while (list.firstChild) list.removeChild(list.firstChild);
  }

  function render() {
    var value = field.value || '';
    if (value.length === 0) {
      clearList();
      setStatus(T.start);
      return;
    }
    if (!window.WSText || typeof window.WSText.analyze !== 'function') {
      clearList();
      setStatus(T.unavailable);
      return;
    }
    var result;
    try {
      result = window.WSText.analyze(value);
    } catch (e) {
      clearList();
      setStatus(T.unavailable);
      return;
    }
    if (!result || !result.ok) {
      clearList();
      setStatus(T.tooLong);
      return;
    }
    clearList();
    var found = [];
    for (var i = 0; i < result.categories.length; i++) {
      if (result.categories[i].count > 0) found.push(result.categories[i]);
    }
    if (!found.length) {
      setStatus(T.none);
      return;
    }
    for (var j = 0; j < found.length; j++) {
      var row = document.createElement('li');
      row.className = 'home-category';
      row.setAttribute('data-category', found[j].id);
      var label = document.createElement('span');
      label.textContent = found[j].label;
      var count = document.createElement('span');
      count.className = 'home-category__count';
      count.textContent = String(found[j].count);
      row.appendChild(label);
      row.appendChild(count);
      list.appendChild(row);
    }
    setStatus(T.total(result.total, found.length));
  }

  // ------------------------------------------------------------ request count
  var canTime = !!(window.performance &&
    typeof window.performance.now === 'function' &&
    typeof window.performance.getEntriesByType === 'function');
  var started = false;
  var mark = 0;
  var timer = 0;
  var observer = null;

  function showCount(n) {
    proof.textContent = T.requests(n);
    proof.setAttribute('data-count', String(n));
    proof.setAttribute('data-state', 'counting');
  }

  function refreshCount() {
    if (!started || !canTime) return;
    var entries;
    try {
      entries = window.performance.getEntriesByType('resource') || [];
    } catch (e) {
      return;
    }
    var n = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].startTime >= mark) n++;
    }
    showCount(n);
  }

  function startCounting() {
    if (started) return;
    started = true;
    if (!canTime) {
      proof.textContent = T.unsupported;
      proof.setAttribute('data-state', 'unsupported');
      proof.removeAttribute('data-count');
      return;
    }
    mark = window.performance.now();
    showCount(0);
    if (typeof window.PerformanceObserver === 'function') {
      try {
        observer = new window.PerformanceObserver(function (entryList) {
          var entries = entryList.getEntries();
          if (entries && entries.length) refreshCount();
        });
        try {
          observer.observe({ type: 'resource', buffered: true });
        } catch (e) {
          observer.observe({ entryTypes: ['resource'] });
        }
      } catch (e) {
        observer = null;
      }
    }
    if (!observer) timer = window.setInterval(refreshCount, 1000);
    refreshCount();
  }

  field.addEventListener('input', function () {
    if (!started && field.value.length > 0) startCounting();
    render();
  });
  field.addEventListener('paste', function () {
    if (!started) startCounting();
  });

  if (!canTime) {
    proof.textContent = T.unsupported;
    proof.setAttribute('data-state', 'unsupported');
    proof.removeAttribute('data-count');
  }
  window.addEventListener('pagehide', function () {
    if (timer) window.clearInterval(timer);
    if (observer) {
      try { observer.disconnect(); } catch (e) { /* already gone */ }
    }
  });
})();
