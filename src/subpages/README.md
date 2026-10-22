# SecureInChat — Secondary & Tertiary Page Design Kit v2

This is a reusable redesign kit for the pages below the approved homepage. It includes page templates, a shared subpage stylesheet, original local SVG illustrations, route mapping, and preview files.

## What's included

- `assets/css/subpages.css` — page hierarchy, section layouts, tool workspaces, checkup/checklist styling, guide feeds, article typography, side navigation, responsive layouts, and footer contrast fixes.
- `assets/illustrations/*.svg` — nine redrawn diagram assets plus a local favicon. The illustrations use a single line-art language and avoid tiny in-image legends.
- `templates/` — 15 English/Chinese templates covering tools, privacy checkup, guide library, principles, information pages, messaging, link checker detail and phone-privacy article detail.
- `ROUTE-MAP.md` — suggested route-to-template mapping and the important integration cautions.
- `DESIGN-SYSTEM.md` — details for each page tier, illustration rules, responsive layouts, color and typography, and trust requirements.
- `previews/illustration-montage-v2.jpg` — a contact sheet of the redesigned illustrations.
- `previews/illustrations.html` and `previews/illustrations.css` — a responsive gallery for viewing the SVG library.
- `previews/render/` — English page-preview HTML files and local copies of the shared styles/assets, intended to be viewed from a local static server rooted at that directory.

## Integration

1. Keep the approved homepage `/assets/css/home.css` intact.
2. Copy `assets/css/subpages.css` to `/assets/css/subpages.css` and load it **after** `/assets/css/home.css` on pages using these templates.
3. Copy `assets/illustrations/` to `/assets/illustrations/`.
4. Use the correct localized template and route from `ROUTE-MAP.md`. Do not invent localized slugs for articles that do not exist.
5. Preserve existing production copy and working tool markup. The templates are design shells and examples, not permission to rewrite tool behaviour or verified claims.
6. For the link checker and relay diagnostic, move the current live interface into the marked integration slot, preserving every existing `id`, `data-*` hook, event handler and script dependency. Remove the explanatory integration note before deployment.
7. For the six-item phone checklist, preserve the real source links already verified by the project team and keep state in page memory only. Do not overwrite production source URLs with the illustrative source placeholders from older drafts.
8. Retain the existing privacy labels only when they match the implementation and tests. The page style must never upgrade a claim from `Documented` to `Tested` or `Local processing` without evidence.

## CSP / privacy

The HTML templates contain no inline style attributes, no `<style>` blocks, and no inline scripts. SVGs do not use inline styles, embedded CSS, remote references or external fonts. The page shell only requests same-origin CSS, images, fonts and scripts; preserve the deployed CSP and verify the final Network panel after integration.

## Checks completed for this package

- 15 template files parsed successfully.
- No duplicate element IDs detected in the templates.
- No inline style attributes, inline script bodies or `<style>` blocks detected in the templates.
- All referenced local SVG illustration assets exist.
- `subpages.css` parsed with no CSS syntax errors.
- The Chinese tool/checkup/guide/principles templates contain no VPN, WebRTC, IPv6 or IP-leak-test category copy.

These are static checks, not a claim that the templates have been fully integrated into production or browser-tested in every target environment. The live tool DOM and client scripts still need project-side regression testing.
