# SecureInChat: site and privacy tools

Source of [secureinchat.com](https://secureinchat.com/), including a free, open-source **IP leak test** (public IP, WebRTC, IPv6, time zone, request headers). It runs in the browser, stores nothing and sets no cookies. DNS is deliberately reported as "not tested": a browser cannot see which resolver answers, and the test says so.

- Live tool: https://secureinchat.com/tools/ip-leak-test/
- How it works and what it cannot see: https://secureinchat.com/blog/how-the-ip-leak-test-works/
- License: MIT for `public/tools/`, `worker/`, `build/`, `tests/` (see LICENSE). The SecureInChat name, logo and main-site text are not covered.

## Layout

    public/             generated static site (committed; this is what gets deployed)
    public/tools/       IP leak test (hand-written HTML/CSS/JS, not touched by the build)
    worker/index.js     Cloudflare Worker: GET /tools/api/whoami; everything else goes to static assets
    wrangler.jsonc      Worker with static assets; only /tools/api/* runs the script
    src/, build/        sources and generator for the main pages and blog
    tests/              unit tests (logic) and Playwright tests (pages, CSP, IP test with mocked network)

## Self-host the IP leak test

The only server-side piece is `/tools/api/whoami`, which returns what Cloudflare saw for the request (`cf-connecting-ip`, `request.cf` network and location, a few headers) and writes nothing. Deploy `public/` and `worker/index.js` as a Cloudflare Worker with static assets (see `wrangler.jsonc`), keep the CSP from `public/_headers`, and the tool works on your own domain. Change the canonical and Open Graph URLs in `public/tools/ip-leak-test/index.html`.

## Build

    cd build && npm install && node build.mjs

Regenerates the HTML for en, zh, ja, privacy, about, contact and blog, the self-hosted fonts, the compiled Tailwind CSS, `sitemap.xml`, `robots.txt` and `_headers`.

## Tests

    python3 tests/site.py /tmp/shots                               # every page: CSP, overflow, relay mock, no-JS, language switch
    node tests/logic.test.js && python3 tests/e2e.py /tmp/shots    # IP leak test logic and UI

## Deploy

Pushing to `main` deploys through Cloudflare (`npx wrangler deploy`). Direct deploy: `npx wrangler deploy` from the repository root. Roll back from the Deployments tab in the Cloudflare dashboard.
