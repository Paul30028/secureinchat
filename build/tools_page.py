"""Helper that writes a tools page in the shared layout. Run from public/tools: python3 ../../build/tools_page.py (see make_*.py calls)."""
import json, html, os
esc = lambda x: html.escape(x, quote=False)

def page(slug, title, desc, h1, lede, hint, controls, tbody, prose, faq, scripts, sdesc, cap, extra=''):
    url = f'https://secureinchat.com/tools/{slug}/'
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebApplication", "name": h1, "url": url, "applicationCategory": "SecurityApplication", "operatingSystem": "Any",
         "browserRequirements": "Requires JavaScript.", "description": desc, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}, "dateModified": "2026-10-20"},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}]}
    faqhtml = "\n".join(f"    <h3>{esc(q)}</h3>\n    <p>{esc(a)}</p>" for q, a in faq)
    sc = "\n".join(f'<script src="/tools/assets/{s}" defer></script>' for s in scripts)
    out = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{url}">
<meta name="theme-color" content="#070A11">
<link rel="preload" href="/tools/fonts/atkinson-hyperlegible-next-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/tools/assets/style.css">
<script type="application/ld+json">
{json.dumps(ld, indent=2)}
</script>
</head>
<body>
<a class="skip" href="#results">Skip to results</a>
<header class="top">
  <div class="wrap top__in">
    <a class="brand" href="/">SecureInChat</a>
    <nav aria-label="Main"><a href="/#architecture">Architecture</a><a href="/#security">Security</a><a href="/#diagnostics">Diagnostics</a><a href="/tools/" aria-current="page">Tools</a><a href="/blog/">Blog</a></nav>
  </div>
</header>
<main>
  <section class="hero wrap" aria-labelledby="h1">
    <h1 id="h1">{esc(h1)}</h1>
    <p class="lede">{lede}</p>
    {controls}
    <p class="hint">{hint}</p>
  </section>
  <section class="wrap" id="results" aria-labelledby="results-h">
    <div class="results-head">
      <h2 id="results-h">Result</h2>
      <p id="summary" class="summary" role="status" aria-live="polite" data-tone="idle">{esc(sdesc)}</p>
    </div>
    <table class="results">
      <caption class="sr">{esc(cap)}</caption>
      <thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">Status</th></tr></thead>
      <tbody id="rows">
{tbody}
      </tbody>
    </table>
  </section>
{extra}
  <section class="wrap prose" aria-labelledby="what-h">
{prose}
  </section>
  <section class="wrap prose" aria-labelledby="faq-h">
    <h2 id="faq-h">Frequently asked questions</h2>
{faqhtml}
  </section>
</main>
<footer class="foot">
  <div class="wrap foot__in">
    <p>SecureInChat</p>
    <nav aria-label="Footer"><a href="/tools/">Tools</a><a href="/about/">About</a><a href="/privacy/">Privacy policy</a><a href="/blog/">Blog</a></nav>
  </div>
</footer>
{sc}
</body>
</html>
'''
    os.makedirs(slug, exist_ok=True)
    open(f'{slug}/index.html', 'w').write(out)

def idle(a, b):
    return f'''        <tr data-status="idle">
          <th scope="row" data-label="Check"><span class="c-name">{a}</span><span class="c-desc">{b}</span></th>
          <td data-label="Result"><div class="vals"><div class="val mono">Not run yet</div></div></td>
          <td data-label="Status"><span class="pill">Not run</span></td>
        </tr>'''
