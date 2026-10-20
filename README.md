# secureinchat.com (rebuilt)

public/index.html   main page, identical to the live page (byte-for-byte) plus one "Tools" nav link and footer link
public/tools/       IP leak test (dark theme), served at /tools/ and /tools/ip-leak-test/
worker/index.js     serves GET /tools/api/whoami; every other request goes to static assets
wrangler.jsonc      Worker "secureinchat" with static assets; only /tools/api/* runs the script
public/_headers     strict CSP for /tools/* only (main page keeps its CDN scripts and wss relay)

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
