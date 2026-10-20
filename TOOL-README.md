# IP leak test (SecureInChat tools)

Static site plus one Cloudflare Pages Function. No build step, no dependencies at runtime.

```
public/                 Pages output directory
  index.html            tools hub (one link)
  ip-leak-test/index.html
  assets/logic.js       analysis logic (pure, unit tested)
  assets/app.js         browser side: lookups, WebRTC, rendering
  assets/style.css
  fonts/                Atkinson Hyperlegible Next and Mono, self-hosted, SIL OFL
  _headers              CSP and security headers
  robots.txt, sitemap.xml
worker/index.js Worker: GET /tools/api/whoami (see INTEGRATION.md)
tests/                  node + Playwright tests
```

## Deploy (Cloudflare Pages)

Git integration: new Pages project, framework preset none, build command empty, build output directory `public`. Keep `functions/` at the repo root next to `public/`.

Direct upload: from this folder run `npx wrangler pages deploy public --project-name <name>`.

Then add your domain under the project's Custom domains.

## Before you deploy: replace the placeholder domain

The files use `https://tools.secureinchat.com`. If you use another host:

```
grep -rl "tools.secureinchat.com" public | xargs sed -i 's#tools.secureinchat.com#YOUR.HOST#g'
```

It appears in the canonical tag, `og:url`, the JSON-LD, `robots.txt` and `sitemap.xml`.

## Verify after deploy (this was not possible from the build environment)

The build environment could not reach the live endpoints, so the logic is tested with mocked responses. Check these once on the real site:

1. Open `/api/whoami`. You should see your `ip`, `asn`, `asOrganization`, `city`, `country`, `timezone`.
2. With no VPN or proxy, check that `headers.via` is absent. If Cloudflare adds a `via` header itself, delete the `via` line in `checkHeaders` in `assets/logic.js`, or the Request headers row will warn for everyone.
3. Run the test with the box unticked: Public IP and the others should show Info or Pass, never Fail.
4. Run it with a VPN on and the box ticked. The Public IP row should pass if the VPN network name matches the hosting heuristic.
5. In the browser dev tools Network tab, confirm `api4.ipify.org`, `api6.ipify.org` and `ipwho.is` return successfully. If `ipwho.is` is blocked or rate limited, the IPv6 row falls back to a warning, it does not break.
6. Confirm WebRTC lines show a `srflx` public address (a line marked "matches your public IP"). If you only ever see `.local` lines, the STUN request is blocked on that network.

## Things to know

- DNS is not tested. A browser cannot observe the resolver. The row says so. A real DNS test needs an authoritative DNS server that logs which resolver asks for a random subdomain, for example a small server on your VPS plus a JSON endpoint. Until then do not label this row as passed.
- "Hosting or VPN network" versus "ISP" is a name-based guess (`HOSTING_RE` in `logic.js`). Residential VPN exits and corporate VPNs will be misjudged. The page says it is a heuristic.
- Pages Functions free plan: 100,000 requests per day shared with Workers. One test run is one function call.
- The page loads no analytics and sets no cookies, and says so. If you enable Cloudflare Web Analytics or add any script, update the privacy wording in the hero hint, the FAQ and the How the test works section.
- Use Search Console and Bing Webmaster Tools for search data. They need no script on the page.

## Turning on ads or affiliate links later

`#ad-slot-a` and `#partner-slot` are hidden empty containers. Do this only after AdSense approves the site:

1. Remove the `hidden` attribute from `#ad-slot-a`, give it a fixed `min-height` to avoid layout shift, and add the AdSense script and unit.
2. Add the AdSense domains to `script-src`, `frame-src`, `img-src` and `connect-src` in `public/_headers`. Test that the test itself still works.
3. Disclose affiliate links next to the link, and recommend only products you have used on this test. Some VPN programs require reviews to be based on real testing. If you live in mainland China, check the legal position of promoting commercial VPN services before adding any VPN affiliate link.
4. Update the privacy wording on the page and on the blog's privacy policy page to match.

## Tests

```
node tests/logic.test.js
python3 tests/e2e.py /some/output/dir    # needs playwright and Chromium
```

The end-to-end test serves `public/` with the same CSP as `_headers`, mocks the network and WebRTC, and checks statuses, layout overflow, fonts and CSP violations at 1280 px and 390 px.
