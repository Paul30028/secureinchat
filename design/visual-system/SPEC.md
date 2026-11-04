# SecureInChat visual asset specification (W20, 2026-11-04)

Status: **proposal with assets and preview. Nothing is implemented in `src/` or `public/`; nothing merged.**
Preview: `preview.png` (full page). Brief: ChatGPT's "Homepage Visual Refinement" (relayed by Paul).

## 0. Decisions (Claude + ChatGPT, 2026-11-04, for Paul's approval)

1. Main mark: shield + speech bubble (Secure + Chat, three typing dots = In chat). Strata bands are the second brand element (illustrations, section breaks, splash). The layered arch is dropped as the main mark (kept in `explorations/layered-arch/` for reference only).
2. Tagline: **Privacy, layer by layer.** Never "the deeper, the safer": the layers are six areas to check, not security levels.
3. Colours: the values already live on the site and in the app (section 2). No second palette.
4. Icons: 24 grid, 1.75 stroke, round ends; 16/20 px versions of the most used icons get their own optical adjustment.
5. Signed announcements show four states (section 7).
6. "What this page sends" is written per tool from the code audit (section 5) and guarded by tests that tie each request target to its sentence.
7. Six-layer illustration: no text in the SVG; labels in an HTML legend; one icon badge per layer; the six names are the site's real six.
8. Order: site mark + claim fixes, then icons and illustration, then Checkup, tool pages, guides, Messaging. Branches only; Paul approves each merge.

Brief corrections that still apply: the live homepage had no illustration (the landscape is new work), and the mood board's "Physical Surroundings" / "The Wider World" are not the site's layers.

## 1. Brand mark (shield bubble + Strata)

Files in `brand/`:

| File | Use | Size rule |
|---|---|---|
| `mark-compact.svg` | Shield bubble on the forest tile, mark scaled 0.86 into the 66 dp safe zone | 48–95 px, app icon, header |
| `mark-full.svg` | Same core outline plus two translucent Strata layers around it | 96 px and up: homepage hero, splash, print, social avatar |
| `favicon.svg` | Compact mark on rounded tile, view box 16–92 | browser fallback |
| `favicon-32.svg` | Pixel-aligned 32 px drawing | 32 px tabs, bookmarks |
| `favicon-16.svg` | Pixel-aligned 16 px drawing; two dots instead of three so they stay separate | 16 px tabs |
| `app-foreground.svg`, `app-background.svg`, `app-monochrome.svg` | Android adaptive layers, 108 × 108; whole mark incl. tail inside x 31.6–79.6, y 24.3–83.6; monochrome = one opaque shape with the dots cut out | — |

The full and compact versions share one core outline, so they read as the same mark. Clear space ≥ ¼ of the mark's width. No outlines, shadows, gradients or recolouring. App resources from these files are already on branch `feature/C11-icon` (APK build green); the site version is on `feature/W19-brand` and needs `favicon-16/32` added.

## 2. Colour (unchanged palette, named tokens)

| Token | Hex | Use |
|---|---|---|
| forest | #123B3A | primary, mark tile, bottom band |
| forest-600 | #2D6B60 | links, band 2 |
| sage | #8DB5AA | outer arch, band 4 |
| sage-100 | #D7E6E1 | icon tiles, top band |
| ivory | #F4EFE4 | badges, middle arch |
| paper | #FAF8F3 | page |
| wheat gold | #E3A23B | sun, door, accents. Fill only: 2.08:1 on paper, never text on light backgrounds |
| gold-700 | #8A5A12 | gold-toned text on light (5.57:1) |
| ink / ink-2 | #14201F / #4D5A57 | text (15.75:1 / 6.79:1 on paper) |

Strata bands top → bottom: #D7E6E1, #B7D3CA, #8DB5AA, #4E8A7E, #2D6B60, #123B3A.

## 3. Icon system (`icons/`, 22 icons)

- 24 × 24 grid, stroke 1.75, round caps and joins, `fill="none"`, `stroke="currentColor"`. Same weight as the live homepage icons; six of them are reused unchanged.
- `icons/sprite.svg` holds all 22 as `<symbol id="i-<name>">`. Pages use `<svg class="ico" aria-hidden="true"><use href="/assets/icons/sprite.svg#i-<name>"/></svg>`: same-origin, colour from CSS, no inline styles. Single files in `icons/categories/` and `icons/tools/` for other uses.
- Decorative next to a visible label (`aria-hidden="true"`); an icon-only control gets an `aria-label` on the control.
- Rule: an icon shows what the tool does. The shield-and-check motif is not used for tools.
- Categories (6): physical, devices-network, accounts-email, communication, offline-emergency, ai-privacy.
- Tools and sections (16): photo-metadata-remover, file-metadata-remover, text-redactor, link-checker, browser-fingerprint-test, account-checkup, password-checker, ip-leak-test, ipv6-leak-test, webrtc-leak-test, site-health-check, privacy-report, phone-checkup, privacy-checkup, guides, messaging.

## 4. Illustration system (`illustrations/`)

All decorative (`alt=""` on `<img>`), no text inside any SVG; labels and captions are HTML so they translate (en, zh, es) and pass contrast.

| File | Where | Contents |
|---|---|---|
| `layers-hero.svg` (640 × 620) | Homepage band below the hero; /protect/ | Six wave bands, gold sun, one ivory icon badge per layer. Paired with an HTML legend (`<ol>`) whose icons match the badges. This fixes the bottom-layer label contrast: no text on bands. |
| `spot-<tool>.svg` (360 × 140, 16 files) | Top of each tool page, guides, messaging | Three bands, sun, the tool's icon badge |
| `checkup-path.svg` (720 × 200) | Privacy checkup | Six layer badges as steps along one path |
| `messaging-architecture.svg` (720 × 220) | Messaging page | Your phone → relay → their phone; HTML labels underneath: the relay sees online devices, size and time of encrypted data, and cannot read it. Replaces the mood board's "You → Your devices → SecureInChat → Internet", which implied traffic passes through us. |

## 5. Privacy claims (accuracy)

Source: each tool's script on main 3925729 (`grep fetch/RTCPeerConnection/https://`); pages load no analytics.

| Tool | Network | What leaves the device |
|---|---|---|
| Photo, file, text redactor, link checker, fingerprint test | none | Nothing. File cleaner downloads its WASM engine from this site. |
| Account, phone, privacy checkup | none | Nothing; answers stay in the browser |
| Password checker | on request | First 5 hex characters of the SHA-1 hash to api.pwnedpasswords.com, only when the breach check is pressed |
| IP leak, IPv6, WebRTC | yes | api4/api6.ipify.org, ipwho.is, dnsapi.secureinchat.com, stun.cloudflare.com (they see your IP; that is the test). Not on Chinese pages. |
| Privacy report | yes | Same as IP leak test plus on-device fingerprint checks |
| Website health check | yes | The address you enter goes to our server, which fetches that site's headers |

Wording rule: keep three things apart. (a) Your content is not uploaded. (b) The page makes network requests (it always loads from this site; the file cleaner downloads its WASM engine). (c) Requests go to SecureInChat or to a third party. "Works on your device" never means "no network requests".

Copy changes:
- Hero lead: "…check what you expose. ~~Everything runs in your browser.~~ **Most checks run on your device. Each tool explains what, if anything, it sends.**（中文：大多数检查在你的设备上完成。每个工具都会说明它是否发送数据，以及发送什么。）"
- Local tools intro (en): "**These six tools work on your device. Your photos, files and text are not uploaded. Each page lists what it loads and sends.**" (zh: 「这六个工具在你的设备上运行，照片、文件和文字不会上传。每个页面都写明它加载和发送了什么。」; es to follow with the i18n work.)
- The request-log panel (`net-log.js`) is on 4 of the 6 local tools; add it to link checker, fingerprint test and account checkup so the claim can be checked on every page.
- Each tool page gets one "What this page sends" line taken from the table above.

## 6. Implementation constraints (for the build step)

- Strict CSP unchanged: SVGs served from `/assets/brand/`, `/assets/icons/`, `/assets/illustrations/` (same origin, `img-src 'self'`). No `style=` attributes in any SVG (checked: 0), no `<style>`, no scripts, no external references.
- Inline icon markup uses presentation attributes only; layout via existing CSS files.
- Existing IDs and `data-*` attributes untouched; only the brand mark, icons and new figure/legend markup change.
- Tests to add: every page references only existing sprite ids; no SVG contains `style=`/`<script`/`http`; homepage legend has six items; for each tool, the hosts found in its scripts (`fetch`, `RTCPeerConnection`, URLs) must equal the hosts named in its "What this page sends" line, so a code change without a copy change fails the build.

## 7. Signed announcements (app)

| State | Shown when | Badge |
|---|---|---|
| Verified | The client verified the ECDSA P-256 signature against the admin key from the invite; the signature covers group, column, title, body, time and audio id | gold check, "Signed by the organiser" |
| Verification failed | A signature is present and does not verify | red, "Signature does not match. Do not trust this notice." Never falls back to a plain notice |
| Cannot verify | No admin key for this group (old invite format) or an older notice without a signature field | grey, "Cannot check who posted this" |
| Unsigned | No signature | no badge, plain notice styling |

"Has a signature" is never shown as "verified". Key rotation and the multi-admin design (C-ADM) must keep these states correct.

## 8. Concept screens

Board 04 (App) is a concept for the redesign. Already true in the app today: no account or phone number, invite-only joining, end-to-end encrypted content, signed announcements verified on the device. Not built yet: group templates (hiking club, book club), English/Spanish interface, the redesigned Today cards. Marketing must not present those as current features.
