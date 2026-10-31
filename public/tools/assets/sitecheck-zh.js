/* Chinese wording for the site health check (loaded only on /zh/tools/site-health-check/).
   The site-check endpoint answers in English; this file turns each row and error into Chinese in the browser.
   It only rewrites text the endpoint is known to send. Anything it does not recognise is shown unchanged,
   so a new English message can never be hidden or mistranslated. Header names and header values stay as sent. */
(function (root) {
  'use strict';
  var LABEL = {
    reach: '网站能否访问', https: 'HTTPS', 'http-redirect': 'HTTP 是否跳转到 HTTPS', status: '首页状态码', speed: '响应时间',
    'hdr-frame': '防点击劫持', noindex: '允许搜索引擎收录', title: '页面标题', description: '元描述（meta description）',
    canonical: '规范链接（canonical）', viewport: '移动端视口（viewport）', lang: '语言属性（lang）', h1: '主标题（h1）',
    html: '页面内容', robots: 'robots.txt', sitemap: '站点地图（sitemap）'
  };
  var EXACT = {
    // values
    'No response': '无响应', 'Timed out': '超时', 'Could not connect': '无法连接',
    'Redirected to an address that cannot be checked': '跳转到了无法检查的地址', 'Too many redirects': '跳转次数过多', 'Invalid redirect': '无效的跳转',
    'Served over HTTPS': '通过 HTTPS 提供', 'Final page is plain HTTP': '最终页面是未加密的 HTTP', 'Port 80 did not answer': '80 端口没有响应',
    'Missing': '缺失', 'noindex found': '发现 noindex', 'No noindex': '没有 noindex', 'Not set': '未设置', 'Set': '已设置',
    'Unknown type': '类型未知', 'Not checked': '未检查', 'Disallow: / for all crawlers': '对所有爬虫 Disallow: /', 'Found': '已找到',
    'Found, but no URLs': '已找到，但没有列出网址',
    // details
    'The site did not answer over HTTPS within 6 seconds, so the other checks could not run.': '网站在 6 秒内没有通过 HTTPS 响应，其他检查无法进行。',
    'The page loads over an encrypted connection.': '页面通过加密连接加载。',
    'The page ends on http://. Redirect all traffic to HTTPS.': '页面最终停在 http:// 上。请把所有访问跳转到 HTTPS。',
    'Visitors who type the address without https may not reach the site. This can be fine if the site is HTTPS-only by design.': '输入地址时不带 https 的访客可能打不开网站。如果网站有意只提供 HTTPS，这可以接受。',
    'Plain http:// requests are sent to the secure address.': '普通 http:// 请求会被转到加密地址。',
    'http:// requests are not redirected to https://. Add a permanent redirect.': 'http:// 请求没有跳转到 https://。请加一个永久跳转。',
    'The page answers normally.': '页面正常响应。',
    'Time until the server began to answer, measured from one Cloudflare location. Your visitors in other regions will see different numbers.': '从发出请求到服务器开始响应的时间，在 Cloudflare 的一个节点上测量。其他地区的访客看到的数字会不同。',
    'Present.': '已设置。',
    'Tells browsers to use HTTPS only. Add Strict-Transport-Security with a max-age of at least 6 months.': '告诉浏览器只用 HTTPS 访问。请添加 Strict-Transport-Security，max-age 至少 6 个月。',
    'Limits where scripts and other resources can load from. It reduces the damage of injected scripts.': '限制脚本和其他资源可以从哪里加载，能减少被注入脚本造成的损害。',
    'Set it to nosniff so browsers do not guess file types.': '设为 nosniff，浏览器就不会猜测文件类型。',
    'Controls how much of the page address is sent to other sites. strict-origin-when-cross-origin is a common choice.': '控制页面地址有多少会发给其他网站。常用值是 strict-origin-when-cross-origin。',
    'Turns off browser features the site does not use, such as camera or location.': '关闭网站用不到的浏览器功能，比如摄像头或位置。',
    'Other sites cannot embed this page in a frame.': '其他网站不能把本页嵌入框架。',
    'Set X-Frame-Options or a CSP frame-ancestors rule so other sites cannot embed the page.': '请设置 X-Frame-Options 或 CSP 的 frame-ancestors 规则，防止其他网站嵌入本页。',
    'The page tells search engines not to index it. Remove noindex unless that is intended.': '页面告诉搜索引擎不要收录它。除非是有意为之，请去掉 noindex。',
    'Nothing blocks search engines from indexing the home page.': '没有任何设置阻止搜索引擎收录首页。',
    'Add a title element. It is the headline in search results.': '请添加 title 元素，它是搜索结果里的标题。',
    'Aim for roughly 10 to 70 characters so it is not cut off.': '建议约 10 到 70 个字符，避免被截断。',
    'Length is fine.': '长度合适。',
    'Add a short description. Search engines often show it under the title.': '请添加一段简短描述，搜索引擎常把它显示在标题下面。',
    'Aim for about 50 to 170 characters.': '建议约 50 到 170 个字符。',
    'A canonical link tells search engines which address is the main one. It matters most when the same page loads at several addresses.': '规范链接告诉搜索引擎哪个地址是主地址。同一页面能从多个地址打开时最重要。',
    'The page declares a mobile viewport.': '页面声明了移动端视口。',
    'Without a viewport meta tag, phones show a zoomed-out desktop layout.': '没有 viewport 标签，手机会显示缩小的桌面版面。',
    'Add lang to the html element for screen readers and search engines.': '请在 html 元素上加 lang 属性，方便读屏软件和搜索引擎。',
    'One main heading.': '只有一个主标题。',
    'Add one h1 that says what the page is about.': '请加一个说明页面内容的 h1。',
    'Several h1 elements. One is the usual choice.': '有多个 h1 元素。通常只用一个。',
    'The home page did not return HTML, so page-level checks were skipped.': '首页返回的不是 HTML，所以跳过了页面层面的检查。',
    'No robots.txt found. It is optional, but it is the standard place to point to your sitemap.': '没有找到 robots.txt。它不是必需的，但通常用它指向站点地图。',
    'The file blocks every crawler from the whole site.': '该文件禁止所有爬虫访问整个网站。',
    'The file is readable and does not block the whole site.': '文件可以读取，没有禁止访问整个网站。',
    'The file loaded but it lists no addresses. If it is a sitemap index, open it to check the child sitemaps.': '文件能加载，但没有列出任何地址。如果它是站点地图索引，请打开检查下级站点地图。',
    'The sitemap loads and lists addresses.': '站点地图能加载，并列出了地址。',
    // errors from the endpoint
    'Enter a website address.': '请输入网站地址。',
    'That address is too long.': '地址太长。',
    'That does not look like a web address.': '这看起来不是网址。',
    'Only http and https addresses can be checked.': '只能检查 http 和 https 地址。',
    'Addresses with a username or password are not accepted.': '不接受带用户名或密码的地址。',
    'Only the standard web ports (80 and 443) can be checked.': '只能检查标准网页端口（80 和 443）。',
    'Enter a full domain name such as example.com.': '请输入完整域名，例如 example.com。',
    'Enter a domain name, not an IP address.': '请输入域名，不要输入 IP 地址。',
    'That domain name has characters that are not allowed.': '域名里有不允许的字符。',
    'That is not a valid domain name.': '这不是有效的域名。',
    'Only public websites can be checked.': '只能检查公开网站。',
    'This tool cannot check the site that hosts it. Enter another address.': '本工具不能检查托管它的网站。请输入其他地址。',
    'Too many checks from your network. Wait a minute and try again.': '你所在网络的检查次数过多。请等一分钟再试。'
  };
  var PATTERNS = [
    [/^(\d+) to HTTPS$/, function (m) { return m[1] + '，跳转到 HTTPS'; }],
    [/^Status (\d+), to ([\s\S]+)$/, function (m) { return '状态码 ' + m[1] + '，跳转到 ' + m[2]; }],
    [/^Status (\d+)$/, function (m) { return '状态码 ' + m[1]; }],
    [/^(\d+), (\d+) redirects?$/, function (m) { return m[1] + '，经过 ' + m[2] + ' 次跳转'; }],
    [/^([\s\S]*) \((\d+) characters\)$/, function (m) { return m[1] + '（' + m[2] + ' 个字符）'; }],
    [/^(\d+) characters$/, function (m) { return m[1] + ' 个字符'; }],
    [/^(\d+) h1 elements?$/, function (m) { return m[1] + ' 个 h1 元素'; }],
    [/^Found, lists (\d+) sitemaps?$/, function (m) { return '已找到，列出 ' + m[1] + ' 个站点地图'; }],
    [/^(\d+) address(?:es)?( or more)?$/, function (m) { return m[1] + ' 个地址' + (m[2] ? '或更多' : ''); }],
    [/^The page answers, but visitors pass through (\d+) redirects first\. Each one adds delay\.$/, function (m) { return '页面能响应，但访客要先经过 ' + m[1] + ' 次跳转，每一次都会增加延迟。'; }],
    [/^The home page returned (\d+)\. Search engines and visitors see an error\.$/, function (m) { return '首页返回 ' + m[1] + '，搜索引擎和访客看到的是错误。'; }],
    [/^No sitemap found at ([\s\S]+)\. A sitemap helps search engines find every page\.$/, function (m) { return '在 ' + m[1] + ' 没有找到站点地图。站点地图帮助搜索引擎找到每一个页面。'; }]
  ];
  function text(s) {
    if (typeof s !== 'string' || !s) return s;
    if (Object.prototype.hasOwnProperty.call(EXACT, s)) return EXACT[s];
    for (var i = 0; i < PATTERNS.length; i++) { var m = PATTERNS[i][0].exec(s); if (m) return PATTERNS[i][1](m); }
    return s;
  }
  // Values that are raw data from the checked site (header values, title text, canonical URL, lang, content type)
  // must not be rewritten even if they happen to look like one of the English phrases.
  var RAW_VALUE = { canonical: 1, lang: 1, html: 1 };
  function row(c) {
    var out = {}; for (var k in c) if (Object.prototype.hasOwnProperty.call(c, k)) out[k] = c[k];
    if (Object.prototype.hasOwnProperty.call(LABEL, c.id)) out.label = LABEL[c.id];
    var raw = RAW_VALUE[c.id] || (/^hdr-/.test(c.id) && c.value !== 'Missing');
    if (raw) { if (c.value === 'Missing' || c.value === 'Not set' || c.value === 'Unknown type') out.value = text(c.value); }
    else if (c.id === 'title' && c.value !== 'Missing') { var t = /^([\s\S]*) \((\d+) characters\)$/.exec(c.value); if (t) out.value = t[1] + '（' + t[2] + ' 个字符）'; }
    else out.value = text(c.value);
    out.detail = text(c.detail);
    return out;
  }
  var api = { row: row, text: text, error: text, LABEL: LABEL, EXACT: EXACT };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SCZH = api;
})(this);
