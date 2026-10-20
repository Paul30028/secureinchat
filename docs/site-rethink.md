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
