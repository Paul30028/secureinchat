/* Browser fingerprint test: renders the checks from fpcore.js. Nothing is sent anywhere or stored. */
(function () {
  'use strict';
  var btn = document.getElementById('run');
  var tbody = document.getElementById('rows');
  var summary = document.getElementById('summary');

  function row(c) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-status', c.status);
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', 'Check');
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = c.name;
    var d = document.createElement('span'); d.className = 'c-desc'; d.textContent = c.desc;
    th.appendChild(n); th.appendChild(d);
    var td = document.createElement('td'); td.setAttribute('data-label', 'Result');
    var vals = document.createElement('div'); vals.className = 'vals';
    c.lines.forEach(function (l) { var v = document.createElement('div'); v.className = 'val mono'; v.textContent = l; vals.appendChild(v); });
    td.appendChild(vals);
    var p = document.createElement('p'); p.className = 'why'; p.textContent = c.why; td.appendChild(p);
    var ts = document.createElement('td'); ts.setAttribute('data-label', 'Status');
    var pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = c.label; ts.appendChild(pill);
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  function run() {
    btn.disabled = true; btn.textContent = 'Testing...';
    window.FPC.collect().then(function (checks) {
      tbody.textContent = '';
      var warn = 0;
      checks.forEach(function (c) { if (c.status === 'warn') warn++; tbody.appendChild(row(c)); });
      summary.textContent = warn ? warn + ' of ' + checks.length + ' checks give sites something to recognise you by.' : 'Nothing here makes you easier to recognise than usual.';
      summary.setAttribute('data-tone', warn ? 'warn' : 'ok');
    }).catch(function () {
      summary.textContent = 'The test could not finish.'; summary.setAttribute('data-tone', 'fail');
    }).then(function () { btn.disabled = false; btn.textContent = 'Run again'; });
  }
  btn.addEventListener('click', run);
})();
