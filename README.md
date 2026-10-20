# secureinchat.com (rebuilt)

public/             generated static site (committed; this is what gets deployed)
src/, build/        sources and generator: edit these, then run the build (below)
public/tools/       IP leak test (dark theme), served at /tools/ and /tools/ip-leak-test/
worker/index.js     serves GET /tools/api/whoami; every other request goes to static assets
wrangler.jsonc      Worker "secureinchat" with static assets; only /tools/api/* runs the script
public/_headers     strict CSP for /tools/* only (main page keeps its CDN scripts and wss relay)

## Build (after editing src/ or build/build.mjs)
    cd build && npm install && node build.mjs

This regenerates public/ (HTML for en, zh, ja, privacy, about, contact; self-hosted fonts; compiled Tailwind CSS; sitemap; robots; _headers). public/tools/ is hand-written and not touched by the build.

## Tests
    python3 tests/site.py /tmp/shots     # all pages, CSP, overflow, relay mock, no-JS, language switch
    node tests/logic.test.js && python3 tests/e2e.py /tmp/shots   # IP leak test

## Deploy
    npm i -D wrangler
    npx wrangler deploy

This replaces the current manual deployment of the existing "secureinchat" Worker. Its custom domains are kept.
You can roll back from the Deployments tab in the dashboard.

## After deploy (verify)
1. https://secureinchat.com/ looks and works as before (language switch, node diagnostics, QR download dialog).
2. https://secureinchat.com/tools/api/whoami returns JSON with your ip, asn, country.
3. https://secureinchat.com/tools/ip-leak-test/ runs; see TOOL-README.md for the full checklist.

## Put it in git (recommended; the old project folder was lost)
    git init && git add . && git commit -m "secureinchat site"
    then push to Paul30028/secureinchat
