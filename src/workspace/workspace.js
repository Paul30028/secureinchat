/* Private workspace UI. Everything stays in this tab: no storage, no cookies, no network calls. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var imageToken = 0;
  var fileToken = 0;
  var receiptUrl = '';
  var receiptTimer = 0;
  function emptyImage() {
    return {
      name: '', format: '', beforeSize: 0, beforeWidth: 0, beforeHeight: 0,
      afterSize: 0, width: 0, height: 0, outputUrl: '', outputName: '', busy: false
    };
  }
  function emptyFile() {
    return {
      name: '', ext: '', mime: '', size: 0, bytes: null, analysis: null,
      outputUrl: '', outputName: '', remaining: [], busy: false
    };
  }
  function emptyAi() {
    return { token: 0, entities: [], selected: new Set(), done: false };
  }
  var state = {
    mode: 'text',
    text: { source: '', analysis: null, selected: new Set(), preview: '', undo: [], spans: [] },
    ai: emptyAi(),
    link: { raw: '', analysis: null },
    image: emptyImage(),
    file: emptyFile(),
    receipt: null
  };

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clearNode(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function setHidden(node, hidden) {
    if (node) node.hidden = !!hidden;
  }

  function setStatus(message, tone) {
    var node = $('status');
    if (!node) return;
    node.textContent = message;
    node.setAttribute('data-tone', tone || 'info');
  }

  function plural(n, one, many) { return n === 1 ? one : many; }

  function hasContent() {
    return !!($('draft').value.trim() || $('link-url').value.trim() || state.image.name || state.image.busy || state.file.name || state.file.busy);
  }

  function selectedRecipient() {
    var input = document.querySelector('input[name="recipient"]:checked');
    return input ? input.value : '';
  }

  // The recipient only changes this local reminder. It does not change the check, score the
  // content or produce a safe/unsafe verdict.
  function updateRecipientNote() {
    var note = $('recipient-note');
    if (!note) return;
    clearNode(note);
    var info = window.WSReceipt ? window.WSReceipt.recipientById(selectedRecipient()) : null;
    if (!info) {
      note.appendChild(make('p', null, 'No recipient selected. The local check works the same way. Choose one to see what to review for that situation.'));
      return;
    }
    note.appendChild(make('p', null, 'For ' + info.label + ', review these points. They are reminders, not a safety score.'));
    var list = make('ul', 'recipient-points');
    info.tips.forEach(function (tip) { list.appendChild(make('li', null, tip)); });
    note.appendChild(list);
  }

  function revokeReceiptUrl() {
    if (receiptTimer) {
      window.clearTimeout(receiptTimer);
      receiptTimer = 0;
    }
    if (receiptUrl) {
      try { URL.revokeObjectURL(receiptUrl); } catch (e) { /* nothing to release */ }
      receiptUrl = '';
    }
  }

  function clearReceipt() {
    state.receipt = null;
    revokeReceiptUrl();
    var panel = $('receipt-panel');
    if (panel) panel.hidden = true;
    var receiptStatus = $('receipt-status');
    if (receiptStatus) receiptStatus.textContent = '';
  }

  // Builds a receipt from aggregate counts. Source text, URL values and file names are never
  // passed in, and the receipt builder ignores any extra fields.
  function offerReceipt(checkType, summary) {
    if (!window.WSReceipt) return;
    var receipt = window.WSReceipt.build({
      checkType: checkType,
      recipient: selectedRecipient(),
      summary: summary,
      now: new Date()
    });
    if (!receipt) {
      clearReceipt();
      return;
    }
    state.receipt = receipt;
    var panel = $('receipt-panel');
    if (panel) panel.hidden = false;
    var receiptStatus = $('receipt-status');
    if (receiptStatus) receiptStatus.textContent = 'Receipt ready. It is unsigned and not proof. Nothing is downloaded until you press the button.';
  }

  function downloadReceipt() {
    if (!state.receipt || !window.WSReceipt) return;
    var text = window.WSReceipt.toJSON(state.receipt);
    if (!text) return;
    try {
      var blob = new Blob([text], { type: 'application/json' });
      revokeReceiptUrl();
      receiptUrl = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = receiptUrl;
      link.download = 'secureinchat-local-receipt.json';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      receiptTimer = window.setTimeout(revokeReceiptUrl, 1000);
      setStatus('Receipt download requested. It contains counts and method only, not your input.', 'info');
    } catch (e) {
      revokeReceiptUrl();
      setStatus('The browser blocked the receipt download. Nothing was uploaded. Try again or use another browser.', 'alert');
    }
  }

  function updateUndoBar() {
    var bar = $('undo-bar');
    if (!bar) return;
    setHidden(bar, state.text.undo.length === 0);
  }

  function emptyText() {
    return { source: '', analysis: null, selected: new Set(), preview: '', undo: [], spans: [] };
  }

  function hideTextResult() {
    var host = $('text-result');
    if (!host) return;
    host.hidden = true;
    clearNode(host);
  }

  function hideAiResult() {
    var host = $('ai-result');
    if (!host) return;
    host.hidden = true;
    clearNode(host);
  }

  // Clears suggestions and the pending request, but leaves the loaded model in place.
  function resetAiResults() {
    state.ai.token++;
    state.ai = emptyAi();
    hideAiResult();
    if (window.WSAI && window.WSAI.isReady()) {
      var note = $('ai-status');
      if (note) note.textContent = '';
    }
  }

  function hideLinkResult() {
    var host = $('link-result');
    if (!host) return;
    host.hidden = true;
    clearNode(host);
  }

  function hideImageResult() {
    var host = $('image-result');
    if (!host) return;
    host.hidden = true;
    clearNode(host);
  }

  function hideFileResult() {
    var host = $('file-result');
    if (!host) return;
    host.hidden = true;
    clearNode(host);
  }

  function releaseImageOutput() {
    if (state.image.outputUrl) {
      try { URL.revokeObjectURL(state.image.outputUrl); } catch (e) { /* nothing to release */ }
    }
    state.image.outputUrl = '';
    state.image.outputName = '';
    state.image.afterSize = 0;
  }

  function resetImage() {
    imageToken++;
    releaseImageOutput();
    state.image = emptyImage();
    var input = $('image-file');
    if (input) input.value = '';
    var zone = $('image-drop');
    if (zone) zone.classList.remove('is-dragover');
    hideImageResult();
  }

  function releaseFileOutput() {
    if (state.file.outputUrl) {
      try { URL.revokeObjectURL(state.file.outputUrl); } catch (e) { /* nothing to release */ }
    }
    state.file.outputUrl = '';
    state.file.outputName = '';
  }

  function resetFile() {
    fileToken++;
    releaseFileOutput();
    state.file = emptyFile();
    var input = $('file-input');
    if (input) input.value = '';
    var zone = $('file-drop');
    if (zone) zone.classList.remove('is-dragover');
    hideFileResult();
  }

  function clearContent() {
    var draft = $('draft'), link = $('link-url');
    if (draft) draft.value = '';
    if (link) link.value = '';
    state.text = emptyText();
    resetAiResults();
    state.link = { raw: '', analysis: null };
    resetImage();
    resetFile();
    hideTextResult();
    hideLinkResult();
    clearReceipt();
    updateUndoBar();
  }

  function clearSession() {
    clearContent();
    setStatus('Session cleared. Nothing was kept.', 'info');
    if (state.mode === 'text' && $('draft')) $('draft').focus();
    else if (state.mode === 'link' && $('link-url')) $('link-url').focus();
    else if (state.mode === 'image' && $('image-file')) $('image-file').focus();
    else if (state.mode === 'file' && $('file-input')) $('file-input').focus();
  }

  function clearForExit() {
    try {
      var draft = $('draft'), link = $('link-url');
      if (draft) draft.value = '';
      if (link) link.value = '';
      state.text = emptyText();
      resetAiResults();
      state.link = { raw: '', analysis: null };
      resetImage();
      resetFile();
      hideTextResult();
      hideLinkResult();
      clearReceipt();
      if (window.WSAI) window.WSAI.terminate();
    } catch (e) { /* the page is leaving */ }
  }

  function activateMode(next, initial) {
    if (next !== 'text' && next !== 'link' && next !== 'image' && next !== 'file') return false;
    if (!initial && next !== state.mode) {
      if (hasContent() && !window.confirm('Switching modes clears the current text, link, image or file. Continue?')) return false;
      clearContent();
      if (next === 'text') setStatus('Text mode. The previous input was cleared. Nothing is uploaded.', 'info');
      else if (next === 'link') setStatus('Link mode. The previous input was cleared. Nothing is opened or contacted.', 'info');
      else if (next === 'image') setStatus('Image mode. The previous input was cleared. Nothing is uploaded or downloaded.', 'info');
      else setStatus('File mode. The previous input was cleared. Nothing is uploaded or downloaded.', 'info');
    }
    state.mode = next;
    var tabs = [$('tab-text'), $('tab-link'), $('tab-image'), $('tab-file')];
    for (var i = 0; i < tabs.length; i++) {
      var tab = tabs[i];
      if (!tab) continue;
      var active = tab.getAttribute('data-mode') === state.mode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    }
    setHidden($('panel-text'), state.mode !== 'text');
    setHidden($('panel-link'), state.mode !== 'link');
    setHidden($('panel-image'), state.mode !== 'image');
    setHidden($('panel-file'), state.mode !== 'file');
    return true;
  }

  function bindTabs() {
    var tabs = [$('tab-text'), $('tab-link'), $('tab-image'), $('tab-file')];
    for (var i = 0; i < tabs.length; i++) {
      if (!tabs[i]) continue;
      tabs[i].addEventListener('click', function () { activateMode(this.getAttribute('data-mode')); });
    }
    var list = document.querySelector('.tabs');
    if (!list) return;
    list.addEventListener('keydown', function (event) {
      var current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      var next = -1;
      if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      if (next < 0) return;
      event.preventDefault();
      if (activateMode(tabs[next].getAttribute('data-mode'))) tabs[next].focus();
    });
  }

  function textCategoryLabel(count) {
    return count + ' ' + plural(count, 'match', 'matches');
  }

  function selectedAiEntities() {
    return state.ai.entities.filter(function (entity) {
      return state.ai.selected.has(entity.start + ':' + entity.end);
    });
  }

  function updateTextPreview() {
    var source = state.text.source;
    var preview = $('clean-preview');
    var note = $('preview-note');
    var empty = $('preview-empty');
    var actions = $('preview-actions');
    if (!source || !preview) return;

    if (state.text.selected.size === 0 && state.ai.selected.size === 0) {
      state.text.preview = '';
      preview.value = '';
      setHidden(preview, true);
      setHidden(actions, true);
      setHidden(empty, false);
      if (empty) empty.textContent = 'No categories selected. Nothing will be replaced in the preview.';
      if (note) note.textContent = 'Choose at least one category or AI suggestion to build a preview.';
      return;
    }

    var result = window.WSText.redact(source, state.text.selected, selectedAiEntities());
    state.text.preview = result.ok ? result.text : '';
    preview.value = state.text.preview;
    setHidden(preview, false);
    setHidden(actions, false);
    setHidden(empty, true);
    var ruleCount = result.categories.reduce(function (n, c) { return n + (state.text.selected.has(c.id) ? c.replaced : 0); }, 0);
    var aiCount = result.aiReplaced || 0;
    var selectedCount = ruleCount + aiCount;
    if (note) {
      note.textContent = selectedCount + ' ' + plural(selectedCount, 'match', 'matches') +
        (aiCount ? ' (including ' + aiCount + ' confirmed AI ' + plural(aiCount, 'suggestion', 'suggestions') + ')' : '') +
        ' will be replaced in this preview. Your draft has not changed.';
    }
    var changed = state.text.preview !== source;
    if ($('copy-preview')) $('copy-preview').disabled = !changed;
    if ($('use-preview')) $('use-preview').disabled = !changed;
  }

  function onCategoryChange() {
    if (this.checked) state.text.selected.add(this.value);
    else state.text.selected.delete(this.value);
    updateTextPreview();
  }

  function renderTextResult() {
    var host = $('text-result');
    if (!host) return;
    clearNode(host);
    host.hidden = false;
    var analysis = state.text.analysis;
    var title = make('h3', 'result-title', analysis.total
      ? analysis.total + ' ' + plural(analysis.total, 'pattern match', 'pattern matches')
      : 'No matching patterns found');
    title.id = 'text-result-title';
    host.appendChild(title);
    host.appendChild(make('p', 'result-note', analysis.total
      ? 'These are common formats, not a complete review. Names, addresses, context and unusual formats can be missed.'
      : 'That does not mean the text is free of personal information. The rules only cover a few common formats.'));

    if (analysis.total) {
      var group = make('fieldset', 'category-group');
      group.appendChild(make('legend', null, 'Choose which categories to replace'));
      var hint = make('p', 'hint', 'Suggested categories are checked. Nothing is replaced until you copy the preview or choose to use it in the draft.');
      hint.id = 'category-hint';
      group.appendChild(hint);

      analysis.categories.filter(function (c) { return c.count > 0; }).forEach(function (category) {
        var label = make('label', 'rule-row');
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'cat-' + category.id;
        input.value = category.id;
        input.checked = state.text.selected.has(category.id);
        input.addEventListener('change', onCategoryChange);
        label.appendChild(input);
        var text = make('span', 'rule-label');
        text.appendChild(make('strong', null, category.label));
        text.appendChild(make('small', null, textCategoryLabel(category.count)));
        label.appendChild(text);
        label.appendChild(make('span', 'rule-count', String(category.count)));
        group.appendChild(label);
      });
      host.appendChild(group);
    }

    var previewBlock = make('div', 'preview-block');
    previewBlock.appendChild(make('h4', null, 'Cleaned preview'));
    var note = make('p', 'preview-note');
    note.id = 'preview-note';
    previewBlock.appendChild(note);
    var empty = make('p', 'preview-empty');
    empty.id = 'preview-empty';
    setHidden(empty, true);
    previewBlock.appendChild(empty);

    var area = document.createElement('textarea');
    area.id = 'clean-preview';
    area.className = 'preview-area';
    area.readOnly = true;
    area.spellcheck = false;
    area.setAttribute('aria-label', 'Cleaned preview');
    area.setAttribute('aria-describedby', 'preview-note');
    previewBlock.appendChild(area);

    var actions = make('div', 'actions actions--tight');
    actions.id = 'preview-actions';
    var copy = make('button', 'btn btn--small btn--primary', 'Copy preview');
    copy.type = 'button';
    copy.id = 'copy-preview';
    copy.addEventListener('click', function () { copyText(state.text.preview, $('clean-preview'), copy, 'Preview copied. Nothing was uploaded.'); });
    var use = make('button', 'btn btn--small', 'Use cleaned text in draft');
    use.type = 'button';
    use.id = 'use-preview';
    use.addEventListener('click', usePreviewInDraft);
    actions.appendChild(copy);
    actions.appendChild(use);
    previewBlock.appendChild(actions);
    host.appendChild(previewBlock);

    updateTextPreview();
  }

  function updateAiReceipt() {
    if (!state.receipt || !state.receipt.summary || !state.ai.done) return;
    state.receipt.summary.ai = {
      suggested: state.ai.entities.length,
      accepted: state.ai.selected.size,
      modelVersion: window.WSAI ? window.WSAI.version() : ''
    };
  }

  function onAiSuggestionChange() {
    if (this.checked) state.ai.selected.add(this.value);
    else state.ai.selected.delete(this.value);
    updateTextPreview();
    updateAiReceipt();
  }

  function aiLabel(label) {
    var allowed = window.WSAI ? window.WSAI.LABELS : [];
    return allowed.indexOf(label) >= 0 ? label : '';
  }

  function renderAiResult() {
    var host = $('ai-result');
    if (!host) return;
    clearNode(host);
    if (!state.ai.done) { host.hidden = true; return; }
    host.hidden = false;

    var title = make('h3', 'result-title', 'AI suggestions (please confirm)');
    title.id = 'ai-result-title';
    host.appendChild(title);
    host.appendChild(make('p', 'result-note', 'These are model guesses, not confirmed facts. Every item starts unchecked; tick it to add that text to the replacement preview. Suggestions that overlap a rule match are not shown again.'));

    if (!state.ai.entities.length) {
      host.appendChild(make('p', 'result-note', 'The model suggested nothing beyond the rule matches. It can still miss names, addresses and other details, and this is not a clean bill of health.'));
      return;
    }

    var group = make('fieldset', 'ai-group');
    group.appendChild(make('legend', null, 'AI suggestions (please confirm)'));
    host.appendChild(group);
    state.ai.entities.forEach(function (entity, index) {
      var key = entity.start + ':' + entity.end;
      var label = make('label', 'ai-row');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'ai-sug-' + index;
      input.value = key;
      input.checked = state.ai.selected.has(key);
      input.addEventListener('change', onAiSuggestionChange);
      label.appendChild(input);
      var body = make('span', 'ai-row__body');
      body.appendChild(make('span', 'ai-row__text', entity.text));
      body.appendChild(make('span', 'ai-row__meta', entity.label));
      label.appendChild(body);
      label.appendChild(make('span', 'ai-row__score', Math.round(entity.score * 100) + '%'));
      group.appendChild(label);
    });
  }

  function runAi(source) {
    if (!window.WSAI || !window.WSAI.isReady()) return;
    var token = ++state.ai.token;
    state.ai.entities = [];
    state.ai.selected = new Set();
    state.ai.done = false;
    hideAiResult();
    var note = $('ai-status');
    if (note) note.textContent = 'The local model is checking this text in your browser…';
    var rules = state.text.spans || [];
    window.WSAI.detect(source, function (entities) {
      if (token !== state.ai.token || state.text.source !== source) return;
      var clean = [];
      (entities || []).forEach(function (entity) {
        if (!entity || typeof entity.start !== 'number' || typeof entity.end !== 'number') return;
        if (entity.start < 0 || entity.end <= entity.start || entity.end > source.length) return;
        if (!(entity.score >= 0.4) || !aiLabel(entity.label)) return;
        if (source.slice(entity.start, entity.end) !== entity.text) return;
        for (var r = 0; r < rules.length; r++) {
          if (entity.start < rules[r].end && entity.end > rules[r].start) return;
        }
        for (var c = 0; c < clean.length; c++) {
          if (entity.start < clean[c].end && entity.end > clean[c].start) return;
        }
        clean.push({ start: entity.start, end: entity.end, text: entity.text, label: entity.label, score: entity.score });
      });
      clean.sort(function (a, b) { return a.start - b.start; });
      state.ai.entities = clean;
      state.ai.done = true;
      renderAiResult();
      updateAiReceipt();
      if (note) {
        note.textContent = clean.length
          ? 'The local AI suggested ' + clean.length + ' ' + plural(clean.length, 'item', 'items') + '. None is selected until you tick it.'
          : 'The local AI suggested nothing beyond the rule matches. It can still miss things.';
      }
    }, function (message) {
      if (token !== state.ai.token) return;
      state.ai.done = false;
      if (note) note.textContent = message || 'The local model could not check this text. The rule results above still stand.';
    });
  }

  function inspectText() {
    clearReceipt();
    var source = $('draft').value;
    if (!source.trim()) {
      setStatus('Paste some text first. Nothing was inspected.', 'warn');
      hideTextResult();
      resetAiResults();
      return;
    }
    var analysis = window.WSText.analyze(source);
    if (!analysis.ok) {
      hideTextResult();
      setStatus('That text is ' + analysis.length.toLocaleString('en-US') + ' characters. The local limit is ' + analysis.limit.toLocaleString('en-US') + '. Split it into smaller parts.', 'alert');
      return;
    }
    resetAiResults();
    state.text.source = source;
    state.text.analysis = analysis;
    state.text.selected = new Set(analysis.categories.filter(function (c) { return c.count > 0; }).map(function (c) { return c.id; }));
    state.text.spans = typeof window.WSText.locate === 'function' ? window.WSText.locate(source) : [];
    state.text.preview = '';
    renderTextResult();
    var types = analysis.categories.filter(function (c) { return c.count > 0; }).length;
    setStatus(analysis.total
      ? 'Inspected locally: ' + analysis.total + ' ' + plural(analysis.total, 'match', 'matches') + ' in ' + types + ' ' + plural(types, 'category', 'categories') + '. Nothing was uploaded. Choose categories, then preview.'
      : 'No matching formats found. This is not a clean bill of health: names, addresses, context and unusual formats can be missed.', analysis.total ? 'info' : 'warn');
    var counts = {};
    analysis.categories.forEach(function (category) { counts[category.id] = category.count; });
    offerReceipt('text', { counts: counts });
    runAi(source);
  }

  function usePreviewInDraft() {
    if (!state.text.preview || state.text.preview === $('draft').value) return;
    state.text.undo.push({ value: $('draft').value });
    $('draft').value = state.text.preview;
    var replacement = state.text.preview;
    resetAiResults();
    state.text.analysis = null;
    state.text.source = replacement;
    state.text.preview = '';
    state.text.spans = [];
    hideTextResult();
    clearReceipt();
    updateUndoBar();
    setStatus('Draft replaced with the cleaned preview. Review it before you copy or send. Undo is available.', 'info');
    $('draft').focus();
  }

  function undoDraft() {
    if (!state.text.undo.length) return;
    var previous = state.text.undo.pop();
    $('draft').value = previous.value;
    resetAiResults();
    state.text.analysis = null;
    state.text.source = previous.value;
    state.text.preview = '';
    state.text.spans = [];
    hideTextResult();
    clearReceipt();
    updateUndoBar();
    setStatus('Previous draft restored. Nothing from the replacement was kept.', 'info');
    $('draft').focus();
  }

  function copyText(value, fallbackNode, button, successMessage) {
    if (!value) return;
    function done() {
      setStatus(successMessage || 'Copied. Nothing was uploaded.', 'info');
      if (button) {
        var old = button.textContent;
        button.textContent = 'Copied';
        window.setTimeout(function () { button.textContent = old; }, 2000);
      }
    }
    function fallback() {
      if (fallbackNode) {
        fallbackNode.focus();
        if (fallbackNode.select) fallbackNode.select();
      }
      setStatus('The browser blocked clipboard access. The text is selected so you can copy it yourself.', 'warn');
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        var task = navigator.clipboard.writeText(value);
        if (task && typeof task.then === 'function') task.then(done, fallback);
        else done();
      } else {
        fallback();
      }
    } catch (e) {
      fallback();
    }
  }

  function structureRow(label, value, extra) {
    var row = make('div', 'structure-row');
    row.appendChild(make('dt', null, label));
    var dd = make('dd');
    dd.appendChild(make('span', 'structure-value', value));
    if (extra) dd.appendChild(make('span', 'chip chip--info', extra));
    row.appendChild(dd);
    return row;
  }

  function renderLinkResult(analysis) {
    var host = $('link-result');
    if (!host) return;
    clearNode(host);
    host.hidden = false;

    if (!analysis.ok) {
      var badTitle = make('h3', 'result-title', 'Not a web link');
      badTitle.id = 'link-result-title';
      host.appendChild(badTitle);
      host.appendChild(make('p', 'result-note', analysis.message + ' Nothing was sent or opened.'));
      return;
    }

    var title = make('h3', 'result-title', 'Link structure');
    title.id = 'link-result-title';
    host.appendChild(title);
    host.appendChild(make('p', 'result-note', 'Parsed from the text only. This page did not contact the host, follow the link, or check whether the site is safe.'));

    var list = make('dl', 'structure-list');
    list.appendChild(structureRow('Scheme', analysis.scheme, analysis.addedScheme ? 'https added for parsing' : ''));
    list.appendChild(structureRow('Host', analysis.host));
    if (analysis.port) list.appendChild(structureRow('Port', analysis.port));
    list.appendChild(structureRow('Path', analysis.path || '/'));
    list.appendChild(structureRow('Query', analysis.queryCount ? analysis.queryCount + ' ' + plural(analysis.queryCount, 'parameter', 'parameters') : 'none'));
    list.appendChild(structureRow('Fragment', analysis.fragment ? 'present (not shown here)' : 'none'));
    host.appendChild(list);

    if (analysis.query.length) {
      host.appendChild(make('h4', null, 'Query parameters'));
      var ul = make('ul', 'query-list');
      analysis.query.forEach(function (item) {
        var li = make('li', 'query-row');
        li.appendChild(make('code', 'query-key', item.key));
        li.appendChild(make('span', 'query-value', item.sensitive ? '[value hidden here]' : (item.value || '(empty)')));
        if (item.tracking) li.appendChild(make('span', 'chip chip--tracking', 'Tracking'));
        if (item.sensitive) li.appendChild(make('span', 'chip chip--review', 'Review'));
        ul.appendChild(li);
      });
      host.appendChild(ul);
    }

    if (analysis.flags.length) {
      host.appendChild(make('h4', null, 'What the structure shows'));
      var flags = make('ul', 'flag-list');
      analysis.flags.forEach(function (flag) {
        var li = make('li', 'flag-item flag-item--' + flag.level);
        var head = make('strong', null, flag.label);
        li.appendChild(head);
        li.appendChild(make('span', null, flag.detail));
        flags.appendChild(li);
      });
      host.appendChild(flags);
    } else {
      host.appendChild(make('p', 'result-note', 'No common tracking keys or session-like key names matched. That is not a safety verdict; a clean-looking link can still lead anywhere.'));
    }

    if (analysis.sensitiveKeys.length || analysis.fragmentSensitive) {
      var warning = make('div', 'callout callout--alert');
      warning.appendChild(make('strong', null, 'Review before sharing'));
      if (analysis.sensitiveKeys.length) {
        warning.appendChild(make('p', null, 'The query has key names often used for session or identity data: ' + analysis.sensitiveKeys.join(', ') + '. This page does not know what those values contain. It will not open the link.'));
      }
      if (analysis.fragmentSensitive) {
        warning.appendChild(make('p', null, 'The part after # also has a session-like name. It is not shown here. This page will not open the link.'));
      }
      host.appendChild(warning);
    }

    if (analysis.trackingKeys.length) {
      host.appendChild(make('h4', null, 'Tracking-removed preview'));
      host.appendChild(make('p', 'result-note', 'Removing these keys usually does not change where the link points, but it can change how the site behaves. The destination was not contacted.'));
      var area = document.createElement('textarea');
      area.id = 'clean-link';
      area.className = 'preview-area preview-area--link';
      area.readOnly = true;
      area.spellcheck = false;
      area.value = analysis.cleanUrl;
      area.setAttribute('aria-label', 'Preview with common tracking parameters removed');
      host.appendChild(area);

      if (analysis.copyAllowed) {
        var copy = make('button', 'btn btn--small btn--primary', 'Copy tracking-clean link');
        copy.type = 'button';
        copy.id = 'copy-clean';
        copy.addEventListener('click', function () { copyText(analysis.cleanUrl, $('clean-link'), copy, 'Tracking-clean link copied. The destination was never contacted.'); });
        var actions = make('div', 'actions actions--tight');
        actions.appendChild(copy);
        host.appendChild(actions);
      } else {
        var reason = make('p', 'copy-blocked');
        reason.id = 'copy-blocked-reason';
        reason.textContent = (analysis.sensitiveKeys.length || analysis.fragmentSensitive)
          ? 'Quick copy is blocked because the query or fragment contains session or identity-like key names. The preview still contains those values. Review the original link before sharing it.'
          : 'Quick copy is blocked because the link still contains data this page cannot judge. Review the original link before sharing it.';
        host.appendChild(reason);
        var blocked = make('button', 'btn btn--small', 'Copy blocked');
        blocked.type = 'button';
        blocked.id = 'copy-clean';
        blocked.disabled = true;
        blocked.setAttribute('aria-describedby', 'copy-blocked-reason');
        host.appendChild(blocked);
      }
    } else {
      host.appendChild(make('p', 'result-note', 'No common tracking parameters were found, so there is nothing to remove. This is not a safety verdict.'));
    }
  }

  function inspectLink() {
    clearReceipt();
    var raw = $('link-url').value;
    if (!raw.trim()) {
      setStatus('Paste a link first. Nothing was contacted.', 'warn');
      hideLinkResult();
      return;
    }
    var analysis = window.WSLink.analyze(raw);
    state.link = { raw: raw, analysis: analysis };
    renderLinkResult(analysis);
    if (!analysis.ok) {
      setStatus(analysis.message + ' Nothing was sent or opened.', 'alert');
      return;
    }
    var parts = [];
    if (analysis.trackingKeys.length) parts.push(analysis.trackingKeys.length + ' common tracking ' + plural(analysis.trackingKeys.length, 'key', 'keys'));
    if (analysis.sensitiveKeys.length) parts.push(analysis.sensitiveKeys.length + ' ' + plural(analysis.sensitiveKeys.length, 'key', 'keys') + ' to review');
    if (analysis.fragmentSensitive) parts.push('a fragment that needs review');
    setStatus('Parsed locally: ' + analysis.host + '. ' + (parts.length ? parts.join('; ') + '. ' : '') + 'Nothing was contacted.', (analysis.sensitiveKeys.length || analysis.fragmentSensitive) ? 'warn' : 'info');
    offerReceipt('link', {
      queryParameters: analysis.queryCount,
      trackingParameters: analysis.trackingKeys.length,
      reviewParameters: analysis.sensitiveKeys.length,
      fragmentReview: analysis.fragmentSensitive ? 1 : 0
    });
  }

  function imageStale(token) {
    return token !== imageToken;
  }

  function readBlob(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error('read failed')); };
      reader.readAsArrayBuffer(blob);
    });
  }

  function imageFailure(message) {
    clearReceipt();
    imageToken++;
    releaseImageOutput();
    state.image = emptyImage();
    var input = $('image-file');
    if (input) input.value = '';
    hideImageResult();
    var host = $('image-result');
    if (host) {
      var title = make('h3', 'result-title', 'Image not processed');
      title.id = 'image-result-title';
      host.appendChild(title);
      host.appendChild(make('p', 'result-note', message));
      host.appendChild(make('p', 'result-note', 'Nothing was uploaded or downloaded. Choose one JPEG, PNG or WebP file and try again.'));
      host.hidden = false;
    }
    setStatus(message, 'alert');
  }

  function imageFact(label, value) {
    var row = make('div', 'image-fact');
    row.appendChild(make('dt', null, label));
    row.appendChild(make('dd', null, value));
    return row;
  }

  function imageCard(title, info) {
    var card = make('section', 'image-card');
    card.appendChild(make('h4', null, title));
    var facts = make('dl', 'image-facts');
    facts.appendChild(imageFact('Dimensions', info.width.toLocaleString('en-US') + ' × ' + info.height.toLocaleString('en-US') + ' px'));
    facts.appendChild(imageFact('File size', info.size));
    facts.appendChild(imageFact('Format', info.format));
    card.appendChild(facts);
    return card;
  }

  function downloadImage() {
    if (!state.image.outputUrl) return;
    var name = state.image.outputName || 'image-cleaned';
    var link = document.createElement('a');
    link.href = state.image.outputUrl;
    link.download = name;
    link.rel = 'noopener';
    try {
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus('Download requested: ' + name + '. The copy stays in this tab until you clear the session or leave.', 'info');
    } catch (e) {
      link.remove();
      setStatus('The browser blocked the download. Nothing was uploaded. Try again or use another browser.', 'alert');
    }
  }

  function renderImageResult() {
    var host = $('image-result');
    if (!host) return;
    clearNode(host);
    host.hidden = false;
    var image = state.image;
    var formats = window.WSImage.FORMATS;
    var label = (formats[image.format] && formats[image.format].label) || image.format.toUpperCase();

    var title = make('h3', 'result-title', 'Re-encoded copy ready');
    title.id = 'image-result-title';
    host.appendChild(title);
    host.appendChild(make('p', 'result-note', 'Downloading creates a new copy with a new name. The original file on your device is not changed.'));

    var grid = make('div', 'image-grid');
    grid.appendChild(imageCard('Before', {
      width: image.beforeWidth, height: image.beforeHeight,
      size: window.WSImage.formatBytes(image.beforeSize), format: label
    }));
    grid.appendChild(imageCard('After', {
      width: image.width, height: image.height,
      size: window.WSImage.formatBytes(image.afterSize), format: label
    }));
    host.appendChild(grid);

    var caveat = make('div', 'callout');
    caveat.appendChild(make('strong', null, 'Check the picture before you share it'));
    caveat.appendChild(make('p', null, 'Re-encoding drops most metadata chunks, but it does not prove every block is gone. Quality, colour and transparency can change, and an animated file becomes one still frame. It does not inspect faces, house numbers, screens or anything else visible in the picture.'));
    host.appendChild(caveat);

    var actions = make('div', 'actions actions--tight');
    var button = make('button', 'btn btn--primary', 'Download ' + image.outputName);
    button.type = 'button';
    button.id = 'download-image';
    button.setAttribute('aria-describedby', 'image-result-title');
    button.addEventListener('click', downloadImage);
    actions.appendChild(button);
    host.appendChild(actions);
  }

  async function processImage(file, intro) {
    var I = window.WSImage;
    if (!I) {
      imageFailure('The image checks did not load, so this file was not processed. Reload the page and try again.');
      return;
    }
    var token = ++imageToken;
    clearReceipt();
    releaseImageOutput();
    state.image = emptyImage();
    state.image.name = file.name || 'image';
    state.image.busy = true;
    hideImageResult();
    setStatus((intro ? intro + ' ' : '') + 'Checking the file type, size and pixel limit locally…', 'info');

    // Refuse unsupported or oversized files before reading all their bytes.
    var pre = I.inspect({ type: file.type, size: file.size, bytes: new Uint8Array(0) });
    if (!pre.ok && pre.error !== 'empty') {
      imageFailure(pre.message);
      return;
    }

    var bytes;
    try {
      var buffer = await readBlob(file);
      if (imageStale(token)) return;
      bytes = new Uint8Array(buffer);
    } catch (e) {
      if (!imageStale(token)) imageFailure('The browser could not read this file locally. Nothing was uploaded. Try choosing it again.');
      return;
    }

    if (imageStale(token)) return;
    var info = I.inspect({ type: file.type, size: file.size, bytes: bytes });
    if (!info.ok) {
      imageFailure(info.message);
      return;
    }
    // The input no longer needs to hold the original file; the bytes are read.
    var input = $('image-file');
    if (input) input.value = '';

    if (typeof window.createImageBitmap !== 'function') {
      imageFailure('This browser cannot decode images locally (createImageBitmap is unavailable). Nothing was uploaded. Use a current browser or the file-metadata tool.');
      return;
    }

    setStatus('Decoding the image in this tab…', 'info');
    var bitmap;
    try {
      bitmap = await window.createImageBitmap(new Blob([bytes], { type: info.mime }));
    } catch (e) {
      if (!imageStale(token)) imageFailure('The browser could not decode this ' + info.label + ' file. It may be damaged or use a variant this browser does not support. Nothing was uploaded.');
      return;
    }
    if (imageStale(token)) {
      if (bitmap && bitmap.close) bitmap.close();
      return;
    }

    try {
      var width = Number(bitmap.width) || 0;
      var height = Number(bitmap.height) || 0;
      if (!width || !height || I.tooManyPixels(width, height)) {
        imageFailure('The decoded image is ' + width.toLocaleString('en-US') + ' × ' + height.toLocaleString('en-US') + ' pixels (' + (width * height).toLocaleString('en-US') + ' total). The limit is 40,000,000 pixels. It was not processed.');
        return;
      }
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var context = canvas.getContext('2d');
      if (!context) throw new Error('canvas');
      context.drawImage(bitmap, 0, 0);

      var options = I.encodeOptions(info.format);
      var blob = await new Promise(function (resolve) {
        try { canvas.toBlob(resolve, options.type, options.quality === null ? undefined : options.quality); }
        catch (e) { resolve(null); }
      });
      if (imageStale(token)) return;
      if (!blob || !blob.size) {
        imageFailure('The browser could not encode the new ' + info.label + ' copy. Nothing was uploaded or downloaded. The file may be too large for this device.');
        return;
      }

      var head = new Uint8Array(await readBlob(blob.slice(0, 16)));
      if (imageStale(token)) return;
      var outMagic = I.sniff(head);
      if (!outMagic.ok || outMagic.format !== info.format) {
        imageFailure('This browser did not produce a real ' + info.label + ' file, so the copy was discarded. Nothing was uploaded or downloaded. Try another browser.');
        return;
      }

      var outputUrl;
      try {
        outputUrl = URL.createObjectURL(blob);
      } catch (e) {
        imageFailure('The browser could not prepare the new copy in memory. Nothing was uploaded. Try again.');
        return;
      }

      state.image = {
        name: file.name || 'image',
        format: info.format,
        beforeSize: info.size,
        beforeWidth: width,
        beforeHeight: height,
        afterSize: blob.size,
        width: width,
        height: height,
        outputUrl: outputUrl,
        outputName: I.outputName(info.format),
        busy: false
      };
      renderImageResult();
      setStatus('Re-encoded locally: ' + width + ' × ' + height + ', ' + I.formatBytes(info.size) + ' → ' + I.formatBytes(blob.size) + '. Nothing was uploaded. The copy is downloaded only when you press the button.', 'info');
      offerReceipt('image', {
        before: { width: width, height: height, bytes: info.size },
        after: { width: width, height: height, bytes: blob.size }
      });
    } catch (e) {
      if (!imageStale(token)) imageFailure('The browser could not finish the local re-encode. Nothing was uploaded or downloaded. Try a smaller image or another browser.');
    } finally {
      if (bitmap && bitmap.close) bitmap.close();
    }
  }

  function onImageChange(event) {
    var files = event.target.files;
    if (!files || !files.length) return;
    if (files.length > 1) {
      imageFailure('Choose one image at a time. Nothing was processed.');
      return;
    }
    processImage(files[0]);
  }

  function bindImage() {
    if ($('image-file')) $('image-file').addEventListener('change', onImageChange);
    if ($('clear-session-image')) $('clear-session-image').addEventListener('click', clearSession);
    var zone = $('image-drop');
    if (!zone) return;
    ['dragenter', 'dragover'].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        zone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'dragend', 'drop'].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        zone.classList.remove('is-dragover');
      });
    });
    zone.addEventListener('drop', function (event) {
      var files = event.dataTransfer && event.dataTransfer.files;
      if (!files || !files.length) {
        setStatus('The drop did not contain a file. Use the file field to choose a JPEG, PNG or WebP image.', 'warn');
        return;
      }
      if (files.length > 1) {
        imageFailure('Choose one image at a time. Nothing was processed.');
        return;
      }
      processImage(files[0]);
    });
  }

  function fileFailure(message) {
    clearReceipt();
    fileToken++;
    releaseFileOutput();
    state.file = emptyFile();
    var input = $('file-input');
    if (input) input.value = '';
    hideFileResult();
    var host = $('file-result');
    if (host) {
      var title = make('h3', 'result-title', 'File not processed');
      title.id = 'file-result-title';
      host.appendChild(title);
      host.appendChild(make('p', 'result-note', message));
      host.appendChild(make('p', 'result-note', 'Nothing was uploaded or downloaded. Choose one PDF, DOCX, XLSX or PPTX file and try again.'));
      host.hidden = false;
    }
    setStatus(message, 'alert');
  }

  function fileValue(value) {
    var text = value === undefined || value === null ? '' : String(value);
    return text.length > 200 ? text.slice(0, 200) + '…' : text;
  }

  function fileMetadataGroups(groups, host) {
    groups.forEach(function (group) {
      var card = make('section', 'image-card file-group');
      card.appendChild(make('h4', null, group.name));
      var facts = make('dl', 'image-facts');
      group.items.forEach(function (item) {
        var row = make('div', 'image-fact');
        row.appendChild(make('dt', null, item && item.name ? String(item.name) : 'Value'));
        row.appendChild(make('dd', null, fileValue(item && item.value)));
        facts.appendChild(row);
      });
      card.appendChild(facts);
      host.appendChild(card);
    });
  }

  function fileRemaining(groups) {
    var names = [];
    groups.forEach(function (group) {
      group.items.forEach(function (item) {
        names.push((group.name ? group.name + ' / ' : '') + (item && item.name ? String(item.name) : 'value'));
      });
    });
    return names.join(', ');
  }

  function downloadFile() {
    if (!state.file.outputUrl) return;
    var name = state.file.outputName || ('file-cleaned.' + (state.file.ext || 'bin'));
    var link = document.createElement('a');
    link.href = state.file.outputUrl;
    link.download = name;
    link.rel = 'noopener';
    try {
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus('Download requested: ' + name + '. The copy stays in this tab until you clear the session or leave the page.', 'info');
    } catch (e) {
      link.remove();
      setStatus('The browser blocked the download. Nothing was uploaded. Try again or use another browser.', 'alert');
    }
  }

  function updateFileGenerate() {
    var button = $('file-generate');
    var confirm = $('file-confirm');
    if (button) button.disabled = !(confirm && confirm.checked) || state.file.busy || !state.file.bytes;
  }

  function renderFileResult() {
    var host = $('file-result');
    if (!host) return;
    clearNode(host);
    host.hidden = false;
    var file = state.file;
    var analysis = file.analysis;
    var label = (analysis && analysis.label) || file.ext.toUpperCase();

    var total = analysis ? analysis.total : 0;
    var title = make('h3', 'result-title', total
      ? total + ' ' + plural(total, 'metadata item', 'metadata items') + ' found'
      : 'No readable metadata found');
    title.id = 'file-result-title';
    host.appendChild(title);
    host.appendChild(make('p', 'result-note', 'File: ' + (file.name || 'file') + ' (' + label + ', ' + window.WSFile.formatBytes(file.size) + '). Read in this tab; nothing was uploaded.'));

    if (analysis && analysis.groups && analysis.groups.length) {
      fileMetadataGroups(analysis.groups, host);
    } else {
      host.appendChild(make('p', 'result-note', 'The engine found no metadata it can list. You can still generate a cleaned copy.'));
    }

    host.appendChild(make('p', 'result-note', 'Only the metadata fields listed above are cleared. The content of the file is not checked: names, phone numbers and other details written inside the document stay there. To check text inside the file, copy it into Text mode. After processing, open the cleaned copy yourself and confirm it.'));

    if (file.outputUrl) {
      if (file.remaining && file.remaining.length) {
        var left = make('div', 'callout callout--alert');
        left.appendChild(make('strong', null, 'A second scan still found ' + file.remaining.length + ' ' + plural(file.remaining.length, 'item', 'items')));
        left.appendChild(make('p', null, fileRemaining(file.remainingGroups || []) + '. These are part of the file structure. If that matters to you, do not share the copy.'));
        host.appendChild(left);
      } else {
        var ready = make('div', 'callout');
        ready.appendChild(make('strong', null, 'Cleaned copy ready in memory'));
        ready.appendChild(make('p', null, 'A second scan found no readable metadata left. Open the copy yourself before you share it.'));
        host.appendChild(ready);
      }

      var actions = make('div', 'actions actions--tight');
      var download = make('button', 'btn btn--primary', 'Download ' + file.outputName);
      download.type = 'button';
      download.id = 'download-file';
      download.setAttribute('aria-describedby', 'file-result-title');
      download.addEventListener('click', downloadFile);
      actions.appendChild(download);
      host.appendChild(actions);
      return;
    }

    var confirmRow = make('label', 'rule-row file-confirm');
    var box = document.createElement('input');
    box.type = 'checkbox';
    box.id = 'file-confirm';
    box.addEventListener('change', updateFileGenerate);
    confirmRow.appendChild(box);
    var text = make('span', 'rule-label');
    text.appendChild(make('strong', null, 'I want to clear the metadata fields listed above in a new copy'));
    text.appendChild(make('small', null, 'The original file on your device is not changed.'));
    confirmRow.appendChild(text);
    host.appendChild(confirmRow);

    var actions2 = make('div', 'actions actions--tight');
    var generate = make('button', 'btn btn--primary', 'Generate clean copy');
    generate.type = 'button';
    generate.id = 'file-generate';
    generate.disabled = true;
    generate.addEventListener('click', processFileClean);
    actions2.appendChild(generate);
    host.appendChild(actions2);
  }

  function fileStale(token) {
    return token !== fileToken;
  }

  async function processFileIntake(file, intro) {
    var F = window.WSFile;
    if (!F) {
      fileFailure('The file checks did not load, so this file was not processed. Reload the page and try again.');
      return;
    }
    var token = ++fileToken;
    clearReceipt();
    releaseFileOutput();
    state.file = emptyFile();
    state.file.name = file.name || 'file';
    state.file.busy = true;
    hideFileResult();
    setStatus((intro ? intro + ' ' : '') + 'Reading the file in this tab…', 'info');

    var pre = F.inspect(file);
    if (!pre.ok) {
      fileFailure(pre.message);
      return;
    }

    var bytes;
    try {
      var buffer = await readBlob(file);
      if (fileStale(token)) return;
      bytes = new Uint8Array(buffer);
    } catch (e) {
      if (!fileStale(token)) fileFailure('The browser could not read this file locally. Nothing was uploaded. Try choosing it again.');
      return;
    }
    if (fileStale(token)) return;

    var info = F.inspect(file);
    if (!info.ok) {
      fileFailure(info.message);
      return;
    }
    var input = $('file-input');
    if (input) input.value = '';

    setStatus('Reading the file metadata with the local engine…', 'info');
    var analysis;
    try {
      analysis = await F.analyze(file, bytes);
    } catch (e) {
      if (!fileStale(token)) fileFailure('The local file engine could not finish. Nothing was uploaded. Try another file or reload the page.');
      return;
    }
    if (fileStale(token)) return;
    if (!analysis.ok) {
      fileFailure(analysis.message);
      return;
    }

    state.file = {
      name: file.name || 'file',
      ext: analysis.ext,
      mime: analysis.label,
      size: analysis.size,
      bytes: bytes,
      analysis: analysis,
      outputUrl: '',
      outputName: '',
      remaining: [],
      busy: false
    };
    renderFileResult();
    setStatus(analysis.total
      ? analysis.total + ' ' + plural(analysis.total, 'metadata item', 'metadata items') + ' found in this ' + analysis.label + ' file. Nothing was uploaded. Check the list, tick the box, then generate a clean copy.'
      : 'No readable metadata found in this ' + analysis.label + ' file. You can still generate a clean copy. Nothing was uploaded.', analysis.total ? 'warn' : 'info');
  }

  async function processFileClean() {
    if (!state.file.bytes || !state.file.ext) return;
    var F = window.WSFile;
    if (!F) return;
    var token = fileToken;
    var button = $('file-generate');
    if (button) {
      button.disabled = true;
      button.textContent = 'Cleaning…';
    }
    setStatus('Building the cleaned copy in this tab…', 'info');
    var result;
    try {
      result = await F.clean(state.file.bytes, state.file.ext);
    } catch (e) {
      result = { ok: false, message: 'The local engine could not clean this file. Nothing was uploaded or downloaded.' };
    }
    if (fileStale(token)) return;
    if (!result.ok) {
      if (button) {
        button.disabled = false;
        button.textContent = 'Generate clean copy';
      }
      setStatus(result.message, 'alert');
      return;
    }

    var outputUrl;
    try {
      outputUrl = URL.createObjectURL(new Blob([result.bytes], { type: result.mime || 'application/octet-stream' }));
    } catch (e) {
      setStatus('The browser could not prepare the cleaned copy in memory. Nothing was uploaded or downloaded. Try again.', 'alert');
      return;
    }
    releaseFileOutput();
    state.file.outputUrl = outputUrl;
    state.file.outputName = result.outputName;
    state.file.remaining = result.remaining || [];
    state.file.remainingGroups = result.remainingGroups || [];
    renderFileResult();
    setStatus('Cleaned copy ready: ' + result.outputName + '. Nothing was uploaded. The download starts only when you press its button.', state.file.remaining.length ? 'warn' : 'info');
  }

  function bindFile() {
    if ($('file-input')) $('file-input').addEventListener('change', function () {
      var files = this.files;
      if (!files || !files.length) return;
      if (files.length > 1) {
        fileFailure('Choose one file at a time. Nothing was processed.');
        return;
      }
      processFileIntake(files[0]);
    });
    if ($('clear-session-file')) $('clear-session-file').addEventListener('click', clearSession);
    var zone = $('file-drop');
    if (!zone) return;
    ['dragenter', 'dragover'].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        zone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'dragend', 'drop'].forEach(function (name) {
      zone.addEventListener(name, function (event) {
        event.preventDefault();
        zone.classList.remove('is-dragover');
      });
    });
    zone.addEventListener('drop', function (event) {
      var files = event.dataTransfer && event.dataTransfer.files;
      if (!files || !files.length) {
        setStatus('The drop did not contain a file. Use the file field to choose a PDF, DOCX, XLSX or PPTX file.', 'warn');
        return;
      }
      if (files.length > 1) {
        fileFailure('Choose one file at a time. Nothing was processed.');
        return;
      }
      processFileIntake(files[0]);
    });
  }

  function intakeFailure(message) {
    setStatus(message, 'warn');
  }

  function handleIntake(result) {
    if (!result || result.kind === 'empty') {
      intakeFailure('Nothing to identify. Drop a file, paste text or paste a link.');
      return;
    }
    if (!result.mode) {
      if (result.kind === 'multiple') intakeFailure('One file at a time. Nothing was processed.');
      else if (result.reason === 'legacy-office') intakeFailure('Old Office files (.doc, .xls, .ppt) are not supported. Save the file as .docx, .xlsx or .pptx, then try again.');
      else if (result.reason === 'unsupported-image') intakeFailure('Image mode handles JPEG, PNG and WebP only. This file was not processed.');
      else intakeFailure('That file type is not recognised. Use PDF, DOCX, XLSX or PPTX; JPEG, PNG or WebP; text; or one link.');
      return;
    }

    var target = result.mode;
    if (target === state.mode) {
      if (hasContent() && !window.confirm('Replace the current content with the new ' + target + ' input? Continue?')) return;
      clearContent();
    } else if (!activateMode(target)) {
      return;
    }

    if (result.kind === 'text') {
      $('draft').value = result.text;
      setStatus('Recognised as text. Switched to Text mode. Nothing was uploaded. Press Inspect locally to check it.', 'info');
      $('draft').focus();
    } else if (result.kind === 'url') {
      $('link-url').value = result.url;
      setStatus('Recognised as a link. Switched to Link mode. Nothing was opened or contacted.', 'info');
      $('link-url').focus();
    } else if (result.kind === 'image') {
      processImage(result.file, 'Recognised as an image. Switched to Image mode. Nothing was uploaded.');
    } else if (result.kind === 'file') {
      processFileIntake(result.file, 'Recognised as a ' + result.ext.toUpperCase() + ' file. Switched to File mode. Nothing was uploaded.');
    }
  }

  function intakeFiles(list) {
    var files = [];
    if (list) for (var i = 0; i < list.length; i++) if (list[i]) files.push(list[i]);
    if (!files.length) {
      intakeFailure('The drop did not contain a file or text.');
      return;
    }
    if (!window.WSIntake) {
      intakeFailure('The intake checks did not load. Reload the page and try again.');
      return;
    }
    handleIntake(window.WSIntake.classify({ files: files }));
  }

  function bindIntake() {
    var input = $('intake-file');
    if (input) input.addEventListener('change', function () {
      var files = this.files;
      if (files && files.length) intakeFiles(files);
      this.value = '';
    });
    var zone = $('intake-drop');
    if (zone) {
      ['dragenter', 'dragover'].forEach(function (name) {
        zone.addEventListener(name, function (event) {
          event.preventDefault();
          zone.classList.add('is-dragover');
        });
      });
      ['dragleave', 'dragend'].forEach(function (name) {
        zone.addEventListener(name, function () { zone.classList.remove('is-dragover'); });
      });
      zone.addEventListener('drop', function (event) {
        event.preventDefault();
        zone.classList.remove('is-dragover');
      });
    }

    document.addEventListener('paste', function (event) {
      var target = event.target;
      var tag = target && target.tagName ? target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || (target && target.isContentEditable)) return;
      var data = event.clipboardData;
      if (!data) return;
      if (data.files && data.files.length) {
        event.preventDefault();
        intakeFiles(data.files);
        return;
      }
      var text = data.getData('text/plain');
      if (text) {
        event.preventDefault();
        handleIntake(window.WSIntake ? window.WSIntake.classify(text) : null);
      }
    });

    document.addEventListener('dragover', function (event) {
      if (event.dataTransfer && Array.prototype.indexOf.call(event.dataTransfer.types || [], 'Files') >= 0) event.preventDefault();
    });
    document.addEventListener('drop', function (event) {
      var target = event.target;
      if (target && target.closest && target.closest('#image-drop, #file-drop')) return;
      var data = event.dataTransfer;
      if (!data) return;
      if (data.files && data.files.length) {
        event.preventDefault();
        intakeFiles(data.files);
        return;
      }
      var text = data.getData('text/plain');
      if (text) {
        event.preventDefault();
        handleIntake(window.WSIntake ? window.WSIntake.classify(text) : null);
      }
    });
  }

  function bindText() {
    if ($('inspect-text')) $('inspect-text').addEventListener('click', inspectText);
    if ($('draft')) {
      $('draft').addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          inspectText();
        }
      });
    }
    if ($('clear-session')) $('clear-session').addEventListener('click', clearSession);
    if ($('undo-draft')) $('undo-draft').addEventListener('click', undoDraft);
    if ($('download-receipt')) $('download-receipt').addEventListener('click', downloadReceipt);
  }

  function bindLink() {
    if ($('inspect-link')) $('inspect-link').addEventListener('click', inspectLink);
    if ($('link-url')) {
      $('link-url').addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          inspectLink();
        }
      });
    }
    if ($('clear-session-link')) $('clear-session-link').addEventListener('click', clearSession);
  }

  function init() {
    var app = $('workspace-app');
    if (app) app.hidden = false;
    bindTabs();
    bindIntake();
    bindText();
    bindLink();
    bindImage();
    bindFile();
    if (window.WSAI) {
      window.WSAI.init({
        onReady: function () {
          if (state.mode === 'text') setStatus('Local AI is ready. It runs in this tab and uses the cached model. Press Inspect locally to use it.', 'info');
        },
        onDeleted: function () {
          resetAiResults();
          setStatus('Model deleted from this browser. The cached model files and the worker were removed. The rule checks still work.', 'info');
        },
        onFailed: function (message) {
          if (state.mode === 'text') setStatus(message, 'alert');
        }
      });
    }
    if ($('recipient')) {
      $('recipient').addEventListener('change', updateRecipientNote);
    }
    updateRecipientNote();
    var mode = 'text';
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'link') mode = 'link';
      else if (params.get('mode') === 'image') mode = 'image';
      else if (params.get('mode') === 'file') mode = 'file';
    } catch (e) { /* keep text */ }
    activateMode(mode, true);
    window.addEventListener('pagehide', clearForExit);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
