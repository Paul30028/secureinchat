/* Optional local AI (English) for the private workspace.
   Creates a same-origin Worker only after the user asks for it, forwards download progress,
   and runs detect requests. No network request happens here: the worker fetches model files
   from this site, caches them in this browser and keeps the text inside its own thread.
   No text, match or model input is stored or sent anywhere. */
(function () {
  'use strict';

  var AI_ROOT = '/workspace/ai/';
  var WORKER_URL = AI_ROOT + 'ai-worker.js';
  var LABELS = [
    'person', 'street address', 'city', 'organization',
    'date of birth', 'bank account number', 'passport number', 'username'
  ];
  var THRESHOLD = 0.4;

  var worker = null;
  var supported = false;
  var loading = false;
  var ready = false;
  var totalBytes = 0;
  var version = '';
  var sequence = 0;
  var pending = {};
  var callbacks = { ready: null, deleted: null, failed: null };

  function el(id) { return document.getElementById(id); }
  function setText(id, text) {
    var node = el(id);
    if (node) node.textContent = text;
  }
  function show(id, visible) {
    var node = el(id);
    if (node) node.hidden = !visible;
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    var mb = bytes / 1000000;
    var rounded = mb >= 100 ? Math.round(mb) : Math.round(mb * 10) / 10;
    return rounded + ' MB';
  }

  function setProgress(loaded, total) {
    var percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
    var bar = el('ai-progress');
    if (bar) bar.setAttribute('aria-valuenow', String(percent));
    var fill = el('ai-progress-bar');
    if (fill) fill.style.width = percent + '%';
    setText('ai-progress-label', percent + '%' + (total > 0 ? ' (' + formatSize(loaded) + ' of ' + formatSize(total) + ')' : ''));
  }

  function stopWorker() {
    if (!worker) return;
    try { worker.terminate(); } catch (e) { /* already gone */ }
    worker = null;
  }

  function fail(message) {
    loading = false;
    ready = false;
    pending = {};
    stopWorker();
    show('ai-progress-wrap', false);
    show('ai-ready', false);
    show('ai-actions', false);
    show('ai-enable', true);
    var button = el('ai-enable');
    if (button) button.disabled = false;
    setText('ai-status', message || 'The local AI model could not start. Nothing was uploaded. You can try again or keep using the rule checks.');
    if (callbacks.failed) callbacks.failed(message);
  }

  function onReady(ms) {
    loading = false;
    ready = true;
    var seconds = (Math.round((Number(ms) || 0) / 100) / 10);
    setProgress(totalBytes, totalBytes);
    setText('ai-ready', 'Ready. Loaded in ' + seconds + ' seconds. The model is cached in this browser, so it can run offline.');
    show('ai-ready', true);
    show('ai-actions', true);
    show('ai-progress-wrap', false);
    setText('ai-status', 'The local model runs in this tab. Your text is not sent, logged or stored.');
    if (callbacks.ready) callbacks.ready();
  }

  function handleMessage(event) {
    var message = event && event.data;
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'progress') {
      setProgress(Number(message.loaded) || 0, Number(message.total) || totalBytes);
      return;
    }
    if (message.type === 'ready') {
      onReady(message.ms);
      return;
    }
    if (message.type === 'result' || message.type === 'error') {
      var entry = pending[message.id];
      if (!entry) {
        if (message.type === 'error' && loading) {
          fail('The local AI model could not load: ' + (message.message || 'unknown error') + '. Nothing was uploaded.');
        }
        return;
      }
      delete pending[message.id];
      if (message.type === 'result') {
        if (entry.ok) entry.ok(message.entities);
      } else if (entry.fail) {
        entry.fail(message.message || 'The local model could not check this text.');
      }
      return;
    }
  }

  function enable() {
    if (!supported || loading || ready) return;
    loading = true;
    sequence += 1;
    pending = {};
    setProgress(0, totalBytes);
    show('ai-enable', false);
    show('ai-progress-wrap', true);
    show('ai-ready', false);
    show('ai-actions', false);
    setText('ai-status', 'Downloading the model from this site. It is checked file by file. Nothing about your text is sent.');
    try {
      worker = new Worker(WORKER_URL, { type: 'module' });
    } catch (e) {
      fail('This browser could not start the local AI worker. Nothing was uploaded.');
      return;
    }
    worker.onmessage = handleMessage;
    worker.onerror = function () {
      fail('The local AI worker stopped before it was ready. Nothing was uploaded. Check that the browser allows workers and WebAssembly.');
    };
    try {
      worker.postMessage({ type: 'load' });
    } catch (e) {
      fail('The local AI worker could not start. Nothing was uploaded.');
    }
  }

  function detect(text, ok, fail_) {
    if (!ready || !worker) return false;
    sequence += 1;
    var id = 'ai-' + sequence;
    pending[id] = { ok: ok, fail: fail_ };
    try {
      worker.postMessage({ type: 'detect', id: id, text: text, labels: LABELS, threshold: THRESHOLD });
    } catch (e) {
      delete pending[id];
      if (fail_) fail_('The local model could not be asked to check this text.');
      return false;
    }
    return true;
  }

  function deleteModel() {
    var finished = false;
    function finish(success) {
      if (finished) return;
      finished = true;
      stopWorker();
      ready = false;
      loading = false;
      pending = {};
      show('ai-progress-wrap', false);
      show('ai-ready', false);
      show('ai-actions', false);
      show('ai-enable', true);
      var button = el('ai-enable');
      if (button) button.disabled = false;
      setProgress(0, totalBytes);
      setText('ai-status', success
        ? 'Model deleted from this browser: the cached model files were removed and the worker was stopped. Nothing was kept. You can download it again.'
        : 'The worker was stopped, but the browser did not confirm that the cached model files were removed. Clear this site\'s data in your browser to remove them.');
      if (callbacks.deleted) callbacks.deleted(success);
    }
    if (!worker) {
      finish(true);
      return;
    }
    worker.onmessage = function (event) {
      if (event && event.data && event.data.type === 'cache-cleared') finish(true);
    };
    worker.onerror = function () { finish(true); };
    try {
      worker.postMessage({ type: 'clear-cache' });
    } catch (e) {
      finish(true);
      return;
    }
    window.setTimeout(function () { finish(false); }, 3000);
  }

  function terminate() {
    stopWorker();
    ready = false;
    loading = false;
    pending = {};
  }

  function init(options) {
    callbacks.ready = options && options.onReady ? options.onReady : null;
    callbacks.deleted = options && options.onDeleted ? options.onDeleted : null;
    callbacks.failed = options && options.onFailed ? options.onFailed : null;

    var block = el('ai-block');
    if (block) {
      totalBytes = parseInt(block.getAttribute('data-ai-bytes'), 10) || 0;
      version = block.getAttribute('data-ai-version') || '';
    }
    var size = formatSize(totalBytes);
    if (size) {
      setText('ai-size', size);
      setText('ai-enable', 'Download and enable (about ' + size + ')');
    }

    supported = typeof Worker === 'function' &&
      typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    if (!supported) {
      setText('ai-unsupported', 'Your browser does not support local AI, so the model cannot run here. The rule checks still work.');
      show('ai-unsupported', true);
      show('ai-enable', false);
      show('ai-progress-wrap', false);
      show('ai-ready', false);
      show('ai-actions', false);
      return;
    }

    if (el('ai-enable')) el('ai-enable').addEventListener('click', enable);
    if (el('ai-delete')) el('ai-delete').addEventListener('click', deleteModel);
    show('ai-enable', true);
  }

  window.WSAI = {
    LABELS: LABELS.slice(),
    THRESHOLD: THRESHOLD,
    init: init,
    enable: enable,
    detect: detect,
    isReady: function () { return ready; },
    isLoading: function () { return loading; },
    isSupported: function () { return supported; },
    version: function () { return version; },
    totalBytes: function () { return totalBytes; },
    deleteModel: deleteModel,
    terminate: terminate
  };
})();
