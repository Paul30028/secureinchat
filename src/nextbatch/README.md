# SecureInChat next-batch visual delivery

## Contents
- `assets/css/tool-widgets.css`: redesigned styles scoped to `.legacy-tool`; intended to replace the widget styling portion of `src/tools/legacy-style.css`, not its `@font-face`, base reset, or page shell declarations.
- `messaging/relay-diagnostic.html`: replacement `.diag` fragment. Replace the existing `.diag` block only; preserve IDs, `data-state` behavior, `data-testing`, and `data-retest` values.
- `assets/css/relay-diagnostic.css`: load after `/assets/site.css`. All selectors are scoped under `#diagnostics`.
- `assets/illustrations/`: six privacy-layer and four situation SVG illustrations, matching the existing line-art palette. No inline `style`, embedded stylesheet, external resource, or script.
- `assets/css/min-type-size.css`: optional CSS patch. Link after `home.css` and `checkup.css` on the homepage and checkup pages to floor small text at 12 CSS px.

## Recommended integration
1. Copy `tool-widgets.css` to the static assets location and update the tool build shell to load it after the shared site styles. Avoid loading the old widget selectors afterwards.
2. Replace only the live `.diag` markup inside `#diagnostics` on `/messaging/`. Do not replace `/assets/main.js` or the relay websocket logic.
3. Copy the SVGs to `/assets/illustrations/`; add them where the content model says an illustration is useful. Use ordinary `<img src="/assets/illustrations/name.svg" width="760" height="360" alt="...">` or existing figure markup; keep explanatory text in HTML.
4. Add `<link rel="stylesheet" href="/assets/css/min-type-size.css">` after the current homepage styles and after checkup.css on checkup pages. If equivalent overrides are preferred inline in the source CSS, use these declarations as the source of truth instead.

## Safety notes
- Styles do not change IDs, `data-*` attributes, or JavaScript hooks.
- The relay fragment preserves `net-status`, `net-label`, `node-btn`, `node-btn-label`, `node-conn`, `node-latency`, `node-chal`, `node-chal-detail`, `node-log`.
- The relay test remains the existing real WebSocket check; this package does not simulate diagnostic values.
- SVG illustrations are explanatory drawings, not assertions that an unshipped product UI exists.
