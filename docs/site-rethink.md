# secureinchat.com rethink (draft, branch `next`, nothing live) - 2026-10-20
Decision from Paul: use secureinchat.com for now (no new domain); re-conceive the site.

## Diagnosis of today's site
- Home leads with an encrypted-chat narrative, but the page itself says clients are "in development". The only live, useful things are the diagnostics, 7 free tools and the blog.
- Search visitors arrive for tools/blog, then land on a chat story. Message mismatch; no revenue path; no conversion goal.

## Concept
One promise: **"Nothing here is a guess."** Tools run in your browser; guides are run and tested before we publish; we say what was and was not verified.
Three pillars:
1. Privacy tools (live, free, in-browser): the search/trust engine. Includes AI-era privacy pages (redact before pasting into ChatGPT, etc.; see demand-probe-1).
2. Tested guides (new, /guides/): AI build guides. Free preview + playable result; paid pack (prompts, working result, automated test, real test log). Price under evaluation (0.99 test value).
3. Private chat (relay, in development): demoted to a section/page, not the hero.

## Home layout (EN first)
Hero: two paths - "Check what your connection gives away" (tools) and "Build with AI, with every step tested" (guides). Then: latest tested guide card (with playable demo), tools grid, blog, "also building: private chat" strip, honest status line. zh/ja pages unchanged in phase 1.

## Structure
/ (home), /tools/..., /guides/ (index), /guides/<slug>/ (preview + buy), /guides/<slug>/play/, /blog/..., /chat/ (move relay story; keep old URLs redirecting or intact), /about, /refund, /terms, /privacy (add checkout-provider disclosure: our site sets no cookies; payment is handled by a third party).

## Risks
- Topical dilution/brand mismatch (privacy brand vs AI game guides). Mitigation: own section and nav; shared trust promise; measure; if guides win, split to a separate domain later.
- "No trackers" claim must stay true; checkout is third-party and must be disclosed.
- Moving the chat story could hurt existing rankings: keep URLs, only change home emphasis.
- Quality: every guide needs a test log; unverified guides do not ship.
- Original content only; no resale/copying of others' courses.

## Phases (all on `next`; Paul decides go-live)
P1 /guides/ section + Breakout guide + new home + nav + sitemap + tests. P2 five AI-privacy explainers linking tools. P3 second guide after independent re-run of the first. P4 review data (search impressions, tool use, guide interest) before more.

## ChatGPT review applied (2026-10-20)
- Keep the domain; do a reversible home change; guides in their own /guides/ section; no existing tool/blog URL changed.
- Slogan is a method, not a guarantee: each guide states environment, scope, known limits, last verified date.
- Do not claim the whole site is "no tracker": home/blog use Cloudflare Web Analytics (cookie-less), tools and /guides/ load none, checkout is third-party and is disclosed in the privacy policy.
- Home order: two entries, tools, tested guide (playable demo), blog, chat as "also building".
- Refund must be shown before purchase and not default to "no refunds".
- 14-day metrics: Search Console impressions/clicks/queries, home path clicks, guide visits / checkout clicks / purchases, tool completions, checkout exit. Save the current home, key URLs and 28-day baseline first (owner has Search Console). Roll back the home if tool completions or related search clicks fall clearly and persistently; if guide visits but no checkout clicks, fix presentation; if clicks but no purchases, check payment trust and price before adding guides.

## Phase 1 status (on `next`, tests pass, not live)
New EN home, /guides/, /guides/breakout-game-with-ai/ (+ /play/), /refund/, /terms/ (both drafts), nav + footer links, sitemap, per-path CSP headers, privacy policy section on checkout, tests extended. zh/ja homes unchanged.
