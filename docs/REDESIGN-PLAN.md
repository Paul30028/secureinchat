# SecureInChat redesign implementation plan

Status: implementation specification for the “local privacy workspace before send” direction. Design source: `盈利计划/docs/redesign-2026-11/files/secureinchat-reimagined/`. This plan does not authorize deployment or change existing product rules. Estimates are engineer-days: S = 0.5–1, M = 2–3, L = 4–6.

## 1. Current state

### Stack and delivery

- Website on this `next` line is a generated static site. Node ESM generator `build/build.mjs` reads `src/` and writes `public/`; generated output is committed. `worker/index.js` backs only `GET /tools/api/whoami`; Cloudflare Worker static assets serve other paths. `wrangler.jsonc` defines deployment. Pushing to `main` deploys; this document is not authorization to push or deploy.
- Build: `cd build && npm install && node build.mjs`. CLAUDE.md also lists `cd build && npm install && cd .. && node build/build.mjs`, an equivalent invocation from repo root. `build/package.json` has only a placeholder npm test script.
- Website checks per CLAUDE.md: `python3 tests/site.py /tmp/shots`, `node tests/logic.test.js`, `python3 tests/e2e.py /tmp/shots`; also `node --test tests/*.test.js tests/*.test.mjs` and Python test loop excluding `tests/shots.py`. Each new feature requires tests; core logic changes require mutation check. These were not run for this planning document.
- Route/content generation lives in `build/build.mjs`, `build/posts.mjs`, `build/protect.mjs`, `build/tools_page.py`, `build/subshell.mjs`, `build/toolshell.mjs`; authored pages/tools and shared assets are under `src/`; sitemap, robots and CSP headers are generated into `public/`.
- Rules: no tracking, analytics, telemetry, third-party dependencies, fake functionality, fabricated measurements or unsupported security claims. Browser-local by default; disclose each external data flow at the action. New pages enter site tests, sitemap and `_headers`. Tool pages require `script-src 'self'`, no inline styles or external requests from the local core workspace. Preserve AI-use disclosure in README. Chinese pages must not add IP/WebRTC/IPv6 tests or VPN links. Existing approved Nord affiliate links on Chinese checkup/phone-checkup remain labelled “联盟链接” and retain “适合在海外使用”; never use Nord offer 153.

### Existing pages and tools

Exact deployed routes must be confirmed against generated `public/sitemap.xml` and the selected branch's route registry before migration. Do not invent localized slugs.

- Entry pages: `/`, `/zh/`, `/ja/`; home, language navigation, browser readout, privacy layers and tool entry points.
- Tool indexes: `/tools/`, `/zh/tools/`.
- English tool routes: `/tools/privacy-report/`, `/tools/ip-leak-test/`, `/tools/webrtc-leak-test/`, `/tools/ipv6-leak-test/`, `/tools/browser-fingerprint-test/`, `/tools/text-redactor/`, `/tools/link-checker/`, `/tools/photo-metadata-remover/`, `/tools/file-metadata-remover/`, `/tools/password-checker/`, `/tools/site-health-check/`, `/tools/account-checkup/`. The Chinese `src/tools/zh/` source includes account, browser fingerprint, file/photo metadata, link, password, site health and text tools; no Chinese IP/WebRTC/IPv6 tools.
- Checkups: `/checkup/`, `/zh/checkup/`; phone self-review checklist route(s), verify exact generated path. These are self-review, not device scans; preserve page-memory-only state, reset and verified sources.
- Editorial and reference pages: `/blog/`, `/zh/blog/`, published articles from `build/posts.mjs`; protect/layer and situation routes from `build/protect.mjs`; `/principles/`; `/messaging/` with live relay WebSocket diagnostic; mission, privacy, about, contact, sponsor/funding, shop/product, legal and policy pages registered by generator.
- Standalone/API: `/tools/ip-leak-test/` includes hand-authored tool; `/tools/api/whoami` is a Worker endpoint and must not be redirected to HTML. Relay diagnostic markup and scripts are live functionality; preserve IDs, `data-*` hooks and WebSocket behavior.
- Tools include local pattern redaction, local URL parsing, photo/file metadata handling, password estimate and breach check, account checklist, browser fingerprint report, network diagnostics, combined privacy report and server-side site health request. Verify each actual implementation and request destination rather than relying on marketing labels.

## 2. Old-to-new mapping

“Retain” preserves the canonical URL/content with a new shell. “Modify” keeps useful route equity while changing the experience. “Advanced diagnostics” means a separate section with request/data recipient preflight. “Retire” requires a direct, relevant 301/308 and sitemap/internal-link cleanup; never blanket-redirect unrelated routes to home. Do not redirect API endpoints.

| Existing page/tool | Decision | Target and migration |
|---|---|---|
| `/`, `/zh/`, `/ja/` | Modify | Workspace-led home per language; keep all existing language availability and locale-specific restrictions. |
| `/tools/`, `/zh/tools/` | Modify | Retain routes as orientation pages; feature Workspace and a separate Diagnostics directory, not an undifferentiated grid. |
| `/tools/text-redactor/`, `/zh/tools/text-redactor/` | Modify | Text mode in workspace. Keep old URL as a detail/deep-link until SEO choice; retain category-level opt-in replacement and state that pattern matching is not semantic review. |
| `/tools/link-checker/`, `/zh/tools/link-checker/` | Modify | Link mode. Preserve parsing/cleaning; never open or submit URL; block quick-copy when keys resemble session/identity data and ask user to review. |
| `/tools/photo-metadata-remover/`, `/zh/tools/photo-metadata-remover/` | Modify | Image mode with supported formats and output caveats visible before processing. Keep original route until canonical decision. |
| `/tools/file-metadata-remover/` and published localized route | Modify / verify | Preserve only verified supported formats. Do not imply universal file support; route unsupported formats to an honest guide or detail page. |
| `/tools/privacy-report/` | Advanced diagnostics | Keep functioning report and explain network requests and recipients. |
| `/tools/ip-leak-test/`, `/tools/webrtc-leak-test/`, `/tools/ipv6-leak-test/` | Advanced diagnostics | Keep English pages, clearly disclose external requests and limits. Do not introduce Chinese routes. If historical localized URLs exist, map individually to a relevant Chinese diagnostics explanation without showing prohibited tests. |
| `/tools/browser-fingerprint-test/`, `/zh/tools/browser-fingerprint-test/` | Advanced diagnostics | Keep; describe observed browser properties and limits, no unsupported uniqueness/safety verdict. |
| `/tools/password-checker/`, `/zh/tools/password-checker/` | Advanced diagnostics | Separate local strength estimate from breach lookup. Before any hash-prefix request, disclose recipient and prefix; never send full password. |
| `/tools/site-health-check/`, `/zh/tools/site-health-check/` | Advanced diagnostics | Disclose URL submission to SecureInChat server and server fetch of target before action; do not label local-only. |
| `/tools/account-checkup/`, `/zh/tools/account-checkup/` | Retain / consolidate | Place checklist in Learn/account recovery; preserve checklist route and behavior. If duplicate route retired, direct 301 to same-language checklist. |
| Phone checklist route(s), English and published Chinese version | Retain | Guided self-review, not scan. Preserve six items, page-memory state, sources and approved labelled Chinese affiliate links. |
| `/checkup/`, `/zh/checkup/` | Modify | Reframe as guided review index; preserve localized differences and exclude IP tests in Chinese. |
| `/blog/`, `/zh/blog/`, `/blog/<published-slug>/` | Retain | Learn section; preserve articles, citations, dates, language routes, canonicals and disclosures. |
| Protect/layer and situation journeys | Retain / demote | Put under Learn / Explore the system; keep evidence labels, status definitions and routes. |
| `/principles/` (localized only if present) | Modify | Display as Protocol; preserve route/canonical if possible and explain local vs external processing per tool. |
| `/messaging/` | Retain | Keep separate from share-preflight workspace; preserve live diagnostic markup, IDs, hooks, scripts and accurate limits. |
| Mission, privacy, about, contact, sponsor/funding, legal/policy, shop/product | Retain | New shared shell only; preserve exact legal copy, disclosures and working destinations. No invented forms or commerce. |
| Content with no equivalent | Retire only after audit | Direct 301/308 to closest same-language equivalent. If none exists, 410 and remove internal links/sitemap. Never send all removed URLs to home. |

SEO rollout: initially keep legacy paths and canonicals. Decide whether workspace modes become canonical URLs only after a route/backlink review. Update redirects, sitemap, canonical, hreflang, internal links, titles/descriptions and structured data together. SEO results cannot be guaranteed. Use only Paul/CEO's existing Search Console context; do not add analytics.

## 3. Information architecture and routing

Primary navigation: **Workspace · Advanced diagnostics · Learn · About**. Persistent locale switch; no account/sign-in flow.

- `/`, `/zh/`, `/ja/`: landing pages; main action opens the workspace.
- `/workspace/`: text, link and image modes. Optional `?mode=text|link|image` selects a mode only; never stores content. Recipient context (AI, work/email, public, personal) changes local reminder copy. Keep content in memory only; clear on reset, mode change, navigation or refresh. No local/session storage, cookies, account or network calls.
- `/protocol/` or retained `/principles/` canonical: methods, data-flow boundary, supported formats, blind spots and receipt limitations. Avoid duplicate indexable pages until canonical is decided.
- `/diagnostics/`: advanced network/browser, credential, website and account self-review categories. Every item shows local/network status, exact request recipient, data sent, trigger and limitation before use.
- `/learn/` or retained `/blog/`: existing guides/articles. Create new localized slugs only after confirming translation and availability.
- Existing `/about/`, `/privacy/`, `/contact/`, `/sponsor/`, `/messaging/`, `/checkup/` routes stay stable pending audit.

Use the existing static generator, not prototype hash routing. Preserve API paths. Locale links must point only to existing translated counterparts.

## 4. Design system

Prototype CSS tokens, subject to contrast and type validation:

| Token | Value | Use |
|---|---|---|
| Dark base | `#11130E` | hero, navigation, dark surfaces |
| Raised dark | `#1B1E18` | workspace header |
| Ink | `#171912` | light-surface text |
| Acid | `#D8F361` | primary action/accent; never sole status cue |
| Cream | `#F0EFE7` | canvas |
| Off-white | `#FAF9F2` | inputs and results |
| Muted | `#A2A69A` | secondary text; verify contrast |
| Rules | `#35392F` / `#D5D6C9` | dark/light dividers |
| Alert | `#FF674D` | pair with icon and text |
| Prototype type | DM Sans / DM Mono | interface / data labels, self-host only if approved |

Spacing: prototype's compact rhythm should become 4, 8, 12, 16, 24, 32, 48, 64px tokens. Content max 1200px; gutter `clamp(20px, 5vw, 72px)`; minimum control height 44px. Body copy 16px; metadata at least 12px. Responsive type scales with `clamp()`.

**Repository conflict:** `src/subpages/DESIGN-SYSTEM.md` requires Atkinson Hyperlegible Next and Noto Serif, existing palette, and says not to add another type system. Prototype proposes DM Sans/DM Mono and a new palette. Until CEO/brand owner decides, preserve repository fonts and use prototype layout/palette only after contrast review; do not add remote fonts or dependencies.

Components: site header and locale switch; privacy boundary strip; workspace shell/status; mode tab group; recipient selector/reminder; labelled textarea, URL input, file picker/drop zone; inspect action; result summary; opt-in category redaction controls; cleaned preview; local copy/download/reset actions; receipt disclosure/download; method-and-limits panel; diagnostic request ledger/preflight; tool and guide rows; unsupported/error states. Render controls only when functional.

Dark/light themes should use semantic tokens and respect `prefers-color-scheme`; any explicit toggle is session-only unless approved. Validate contrast in every state. At 930px simplify grids; 700px stack; 430px reflow controls; test 320px with no horizontal overflow. Full-width primary action on small screens. Use semantic landmarks/headings, labelled controls, keyboard-operable tabs, visible focus, live status, error summary, reduced motion, meaningful alt text and WCAG 2.2 AA contrast. Never rely on color alone or drag-only file input.

## 5. Phased implementation tasks

Estimates are engineer-days: S 0.5–1, M 2–3, L 4–6. Phase 1 is independently releasable: additive route, old pages/tools stay available, no redirect or service migration.

### Phase 0 — inventory and decisions

1. **Route/claim audit (S).** Goal: exact generated route, locale, canonical, page owner, tool behavior and network request inventory. Files read: `build/build.mjs`, `build/posts.mjs`, `build/protect.mjs`, `build/tools_page.py`, `src/subpages/ROUTE-MAP.md`, `public/sitemap.xml`, tests. Acceptance: every page/API mapped; no guessed routes. Do not create extra committed artifact without approval.
2. **Record CEO decisions (S).** Goal: settle §6 decisions needed for canonical, typography and scope. Files: none. Acceptance: decisions recorded before Phase 2 migrations.

### Phase 1 — standalone workspace (independent release)

1. **Workspace route and shell (M).** Goal: add `/workspace/` through current static generator and site shell. Files: `build/build.mjs`, likely `build/tools_page.py` or a generator module following current patterns, new `src/workspace/*`, generated `public/workspace/*`, `public/sitemap.xml`, `public/_headers`. Acceptance: metadata/canonical, sitemap, same-origin CSP, navigation/back behavior, no inline scripts/styles or external requests; old tools untouched.
2. **Text review (M).** Goal: local category-level pattern review and opt-in replacements. Files: workspace JS/CSS/markup and `tests/`. Acceptance: common formats only; explicit not semantic analysis; no persistence/network; reversible preview; keyboard/no-JS fallback; unit tests and mutation check.
3. **Link review (M).** Goal: local URL structure/tracking review. Same workspace assets and tests. Acceptance: malformed input safe; accurate scheme/host/query display; no request/open; block quick-copy for session-like keys; no claim destination is safe; regression tests.
4. **Image re-encode (M/L).** Goal: local JPEG/PNG/WebP processing and download. Files: workspace assets and tests. Acceptance: verify MIME/decode; handle unsupported/corrupt/large inputs; user-triggered download; disclose possible quality/color/transparency changes; do not promise metadata removal until verified per format; no upload.
5. **Shared UX, receipt and accessibility (M).** Goal: recipient context, method/limits, reset lifecycle and optional JSON receipt. Acceptance: memory clears on mode/navigation; no storage; receipt excludes source text, URL values and filename, is unsigned/not proof; every copy/download/reset user-triggered. Keyboard, screen reader, contrast, reduced-motion and mobile 320px reviewed.
6. **Build and release evidence (M).** Goal: integrate generated output and policy checks. Files: `tests/site.py`, Node tests, `build/build.mjs`, generated `public/`. Acceptance: mandated site/Python/Node suites pass; no-JS route and no-network behavior tested; CSP/sitemap asserted; only approved sources/build outputs changed.

Release gate: feature branch/staging only; CI green and Paul approves release per CLAUDE.md. Additive design can ship independently but does not grant deployment authority.

### Phase 2 — navigation and dual-running migration

1. **Global navigation (M).** Goal: Workspace, Diagnostics, Learn, About with locale support. Files: `build/build.mjs`, shared source CSS/JS, generated shells, site tests. Acceptance: legacy routes remain; locale switch only links to real counterpart; no dead links.
2. **Diagnostics directory (M).** Goal: group external-request checks with disclosure ledger. Files: `src/diagnostics/*`, `build/tools_page.py`, `build/build.mjs`, tests and public output. Acceptance: every check states recipient/data/trigger/limits; no full password sent; site-health URL submission disclosed; Chinese exclusions and affiliate labels preserved.
3. **Legacy bridges (M).** Goal: point text/link/photo legacy routes to workspace modes while preserving useful content and format limits. Acceptance: direct links work, no duplicate behavior drifts. Redirect only after approved SEO decision.
4. **Content shell migration (L).** Goal: update guides, protocol, checkups and information shell without rewriting facts. Files: `build/posts.mjs`, `build/protect.mjs`, `build/subshell.mjs`, templates and tests. Acceptance: sources, status labels, locale content, checklists and relay behavior unchanged.
5. **SEO redirects (M).** Goal: approved per-route 301/308, metadata and sitemap updates. Files: `wrangler.jsonc` or Cloudflare redirect config, generator, tests, sitemap. Acceptance: relevant same-language target, no chains/loops, API exceptions, links validated, explicit 404/410 policy.

### Phase 3 — evidence-based consolidation

1. **Retire duplicates (S/M).** Goal: consolidate only after existing search/backlink evidence and content-owner approval. Files: route registry, redirect config, sitemap/tests. Acceptance: direct redirect, no loss of unique content or behavior; no tracking added.
2. **Independent security/accessibility review (M).** Goal: inspect processing boundaries and format claims. Files: tests and docs only as authorized. Acceptance: findings fixed or claims narrowed; no universal safe verdict.
3. **Future orchestration/extension research (S).** Goal: user research and threat model before automation or browser permissions. Files: none until approved. Acceptance: no implementation commitment without evidence.

## 6. Risks and CEO decisions

### Rule conflicts and risks

1. **Fonts:** prototype DM Sans/DM Mono conflicts with repository-mandated Atkinson Hyperlegible Next/Noto Serif and no separate type system. Default to existing fonts until CEO/brand owner decides.
2. **“Nothing leaves” scope:** the prototype is standalone, but existing report, network tests, breach lookup and site-health checker make external requests. Only verified workspace modes may be described as local; never extend that claim site-wide.
3. **Image claims:** Canvas behavior depends on browser and format and can alter quality, color or alpha. Verify output by format before saying which fields are removed; retain caveat.
4. **SEO:** changing canonical paths can cost established visibility/links. Audit deployed routes and existing Search Console/backlink evidence; use relevant same-language direct redirects and preserve unique content. No guarantee of SEO results.
5. **Chinese localization:** current restrictions exclude IP leak testing and extra VPN promotion. Do not route Chinese users into prohibited content; retain explicitly approved affiliate disclosures only.
6. **Branch/output drift:** docs may describe proposed templates and unreleased `next` work. Verify generated `public/` and sitemap on selected branch before migration.
7. **Architecture/CSP:** prototype has inline HTML/CSS/JS; production uses static generator and strict tool CSP. Reimplement in repo structure, no prototype copy-paste or new dependency.
8. **Receipt:** JSON receipt is unsigned and not cryptographic proof or independent verification. Avoid compliance/evidence badge wording.
9. **Scope:** broad file support, share orchestration and extension are future ideas, not shipped prototype functionality.

### CEO decisions to record

- Approve product naming/tagline and whether Workspace replaces Tools in primary navigation while preserving old URLs.
- Choose typography: repository fonts or prototype DM fonts; approve any new self-hosted font assets under dependency policy.
- Choose canonical policy for text/link/photo routes: remain canonical legacy pages with workspace deep-links, or migrate after search/backlink review; approve each redirect set/timing.
- Confirm M1 scope: recommend text/link/image only once actual support and tests are verified; file metadata, orchestration, receipt and recipient context can be deferred.
- Choose dark-mode behavior (system preference only or explicit session-only toggle) and approve acid accent after contrast review.
- Provide existing Search Console/backlink context and confirm which unpublished `next` work is in release scope. No new analytics.
- Approve public wording/governance for unsigned processing receipt and its explicit non-proof limitation.

Until those decisions are recorded, use additive routes, existing fonts and shell, make no redirects/removals, and limit claims to tested behavior.
