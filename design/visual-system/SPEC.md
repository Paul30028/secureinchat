# SecureInChat visual asset specification (W20, 2026-11-04)

Status: **proposal with assets and preview. Nothing is implemented in `src/` or `public/`; nothing merged.**
Preview: `preview.png` (full page). Brief: ChatGPT's "Homepage Visual Refinement" (relayed by Paul).

## 0. Corrections to the brief

| Brief says | Fact | Handling |
|---|---|---|
| "Keep the current six-layer landscape illustration" | The live homepage (main 3925729) has no illustration; the landscape exists only in the ChatGPT mood board (raster). | New self-hosted SVG `illustrations/layers-hero.svg`, proposed for the homepage below the hero and for /protect/. |
| Six categories as in the mood board | The site's six layers are: Physical, Devices and network, Accounts and email, Communication, Offline and emergency, AI privacy (`/protect/`). The mood board's "Physical Surroundings" and "The Wider World" are wrong. | Icons and legend use the site's six. |
| "Replace the chat-bubble/shield logo" | The shield-bubble mark is only on branch `feature/W19-brand` (not live). Live main still has the older outline shield. | Arch mark redrawn as vector; Paul confirms the switch. W19 is not merged. |

## 1. Brand mark (layered arch)

Files in `brand/`:

| File | Use | Size rule |
|---|---|---|
| `mark-full.svg` | Sage outer arch, ivory middle arch, gold door with speech tail, on forest tile (rx 24/108) | 48 px and up |
| `mark-compact.svg` | Two shapes only (ivory arch + gold door) | below 48 px |
| `favicon.svg` | Compact mark on rounded tile, view box 16–92 | 16–32 px, header 36 px |
| `mark-on-light.svg` | No tile; forest middle arch for ivory backgrounds | print, footer |
| `app-foreground.svg`, `app-background.svg`, `app-monochrome.svg` | Android adaptive layers, 108 × 108; scaled 0.9 so everything, tail included, sits inside the 66 dp safe zone (x 25.6–82.4, y 23–86.9) | — |

Meaning: concentric arches = layers of protection; the gold doorway = the person; its speech tail = conversation.
Clear space ≥ ¼ of the mark's width. No outlines, shadows, gradients or recolouring.

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

Copy changes:
- Hero lead: "…check what you expose. ~~Everything runs in your browser.~~ **Most checks run on your device, and each tool says what, if anything, it sends.**"
- Local tools intro (en): "**These six tools work on your device. Your photos, files and text are not uploaded. The pages load from this site and make no other requests.**" (zh: 「这六个工具在你的设备上运行，照片、文件和文字不会上传。页面从本站加载，不发出其他请求。」; es to follow with the i18n work.)
- The request-log panel (`net-log.js`) is on 4 of the 6 local tools; add it to link checker, fingerprint test and account checkup so the claim can be checked on every page.
- Each tool page gets one "What this page sends" line taken from the table above.

## 6. Implementation constraints (for the build step)

- Strict CSP unchanged: SVGs served from `/assets/brand/`, `/assets/icons/`, `/assets/illustrations/` (same origin, `img-src 'self'`). No `style=` attributes in any SVG (checked: 0), no `<style>`, no scripts, no external references.
- Inline icon markup uses presentation attributes only; layout via existing CSS files.
- Existing IDs and `data-*` attributes untouched; only the brand mark, icons and new figure/legend markup change.
- Tests to add: every page references only existing sprite ids; no SVG contains `style=`/`<script`/`http`; homepage legend has six items; tool pages carry the "sends" line.
