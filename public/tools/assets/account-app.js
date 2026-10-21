/* Account security checkup page. Answers live only in this page: nothing is sent or stored, and reloading clears them. */
(function () {
  'use strict';
  var A = window.ACCT;
  var form = document.getElementById('ac-form');
  var summary = document.getElementById('summary');
  var next = document.getElementById('ac-next');
  var list = document.getElementById('ac-next-list');
  var copyBtn = document.getElementById('ac-copy');
  var resetBtn = document.getElementById('ac-reset');
  var copied = document.getElementById('ac-copied');
  var last = null;

  function answers() {
    var o = {};
    A.ITEMS.forEach(function (it) {
      var c = form.querySelector('input[name="' + it.id + '"]:checked');
      if (c) o[it.id] = c.value;
    });
    return o;
  }

  function update() {
    var r = A.summarize(answers());
    last = r;
    summary.textContent = r.headline;
    summary.setAttribute('data-tone', r.tone);
    A.ITEMS.forEach(function (it) {
      var fs = document.getElementById('ac-' + it.id);
      var c = form.querySelector('input[name="' + it.id + '"]:checked');
      if (fs) fs.setAttribute('data-state', c ? c.value : 'open');
    });
    list.textContent = '';
    r.next.forEach(function (it) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#ac-' + it.id;
      a.textContent = it.todo;
      li.appendChild(a);
      if (r.unsure.indexOf(it) >= 0) li.appendChild(document.createTextNode(' (find out)'));
      list.appendChild(li);
    });
    next.hidden = !r.next.length;
    copyBtn.hidden = !r.answered;
    copied.textContent = '';
  }

  function reset() {
    form.querySelectorAll('input[type="radio"]').forEach(function (i) { i.checked = false; });
    update();
  }

  form.addEventListener('change', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  resetBtn.addEventListener('click', reset);
  copyBtn.addEventListener('click', function () {
    var t = A.text(last || A.summarize({}), new Date().toISOString().slice(0, 10));
    var done = function () { copied.textContent = 'Copied.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { copied.textContent = 'Copy failed. Select the list above instead.'; });
    else copied.textContent = 'Copy is not available in this browser.';
  });
  // Some browsers restore form fields after a reload or back navigation; clear them so nothing carries over.
  window.addEventListener('pageshow', reset);
  reset();
  window.ACCOUNT_CHECKUP = { answers: answers, update: update };
})();
