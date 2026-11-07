# SecureInChat — Shared Design System v3

This document replaces the v2 palette and the old "home.css first" rule. The canonical source is
`src/tokens/tokens.css`, built to `/assets/css/tokens.css`. The workspace and the global header and
footer consume those tokens today; page batches move over one class of pages at a time.

## Scope and migration status

- **Shared now:** design tokens, the base layer (`/assets/css/base.css`, used by the workspace), and
  the global header/footer (`/assets/css/shell.css`).
- **Still on the old stylesheets:** home, tools, guides, blog, checkup and information-page content.
  Their body markup and content styles are intentionally unchanged until their own migration step.
- Do not add a second palette or a page-specific font stack. New or migrated components use the
  semantic tokens below.
- The old light-only brand colours (`#F7F5EF`, `#173D32`, `#C6A15B`, etc.) are no longer the target
  system. They remain only inside old page styles during migration.

## Product and privacy boundaries

- No tracking, analytics, telemetry, third-party fonts, CDNs or remote images.
- Every font, stylesheet, script and SVG is served from `/assets/` on this origin.
- Status labels and copy describe verified implementation, not design intent.
- No account, automatic upload, automatic send or automatic open is implied by the shell.
- URLs, APIs, tool behaviour, legal text and language limits stay unchanged during visual migration.

## Tokens

Colour is semantic, never named after a hue. Dark is the default mapping; light is available through
`<html data-theme="light">` or, while there is no theme switch, the OS `prefers-color-scheme`.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--sc-canvas` | `#11130E` | `#F0EFE7` | Page background |
| `--sc-surface` | `#1B1E18` | `#FAF9F2` | Cards, forms, surfaces |
| `--sc-surface-raised` | `#242820` | `#E7E7DC` | Floating menus, emphasis |
| `--sc-surface-subtle` | `#23261F` | `#F4F2E9` | Quiet panels and secondary blocks |
| `--sc-ink` | `#F0EFE7` | `#171912` | Primary text |
| `--sc-ink-muted` | `#C3C7BA` | `#45483F` | Secondary text |
| `--sc-ink-subtle` | `#A2A69A` | `#55594F` | Metadata and notes |
| `--sc-accent` | `#D8F361` | `#52651A` | Primary action, emphasis |
| `--sc-accent-ink` | `#171912` | `#FFFFFF` | Text on the accent |
| `--sc-link` | `#D8F361` | `#3F5311` | Body links (always underlined) |
| `--sc-rule` | `#35392F` | `#C6C7B9` | Dividers and borders |
| `--sc-focus` | `#D8F361` | `#34470A` | Focus ring |
| `--sc-danger` | `#FF806B` | `#A93222` | Error text and icons |
| `--sc-danger-surface` | `#321D19` | `#FCE9E4` | Error background |
| `--sc-success` | `#B8DB73` | `#355719` | Success text and icons |
| `--sc-success-surface` | `#20291B` | `#EAF2DC` | Success background |

The global shell is always deep. It uses fixed shell tokens (`--sc-shell-*`) derived from the dark
mapping, so the header and footer do not turn pale when a content page is in light mode.

Contrast targets: 4.5:1 for normal text and controls, 3:1 for large text and non-text UI boundaries.
Do not use the bright accent as small text on a light background, or white text on the bright accent.
Status is never conveyed by colour alone: include an icon or a word.

## Typography

- Sans: `--sc-font-sans`, `"DM Sans", "Atkinson Hyperlegible Next", system-ui, sans-serif`.
- Mono: `--sc-font-mono`, `"DM Mono", "Cascadia Code", ui-monospace, monospace`.
- Editorial: `--sc-font-editorial`.
- All DM Sans and DM Mono weights are self-hosted WOFF2 files under `/assets/fonts/`, with their
  licences. No remote font request.
- Sizes are `rem`-based and respond to the user's font size: `--sc-text-xs` (12px) through
  `--sc-text-4xl` and `--sc-text-display` (clamped). Body leading is 1.6; headings 1.08–1.2.
- English UI copy uses Sans. Paths, request fields and status labels may use Mono. Long guides never
  set the whole body in Mono or all caps.
- CJK: the stack falls back to system Noto Sans SC/JP or the operating system's CJK font. Chinese
  body text is at least 16px with 1.75 leading; Japanese 16px with 1.8. CJK headings use
  `letter-spacing: 0` (never English-style negative tracking), natural wrapping and full-width
  punctuation. Use `lang="zh-Hans"` (or the site's `zh-CN`) and `lang="ja"`; mark inline English
  phrases with `lang="en"`.

## Spacing, layout and motion

- Spacing: `--sc-space-1` 4px, 2 8px, 3 12px, 4 16px, 5 24px, 6 32px, 7 48px, 8 64px, 9 96px.
- Content maximum: `1200px`. Reading maximum: `68ch` (about `36em` for CJK, verified against the
  real font). Gutter: `clamp(20px, 5vw, 72px)`. Touch targets: at least 44×44px.
- Radius: `4px` small controls, `8px` medium, `12px` large, `18px` extra large, pill for tags only.
  The visual direction is geometric; large decorative pills are not the default.
- Shadows follow the theme: dark relies on borders and surface contrast; light cards use a soft
  `0 2px 8px`, floating panels `0 12px 32px`. Never use shadow as the only control boundary.
- Motion: 120ms fast, 180ms normal, 260ms slow. Animate colour, border and small displacement only.
  No parallax, autoplay or flashing. `prefers-reduced-motion: reduce` stops non-essential motion and
  smooth scrolling.

## Global shell

The header and footer are generated once by `build/nav.mjs` and applied to every page by
`build/build.mjs`; `build/subshell.mjs` uses the same renderers.

- Deep header, 72px desktop. Brand mark plus SecureInChat on the left.
- Four primary items: Workspace / Tools / Learn / About (localized). Workspace appears once in the
  navigation. The right-hand action says **Open workspace** (localized) and is not another
  title-style "Workspace" button.
- Current section uses `aria-current="page"` on the exact page and `aria-current="true"` on a parent
  section. A language menu lists only languages that have a real destination: the page's own
  `hreflang` alternates when they exist, otherwise the real locale home page. No slug is guessed.
- The language control and the mobile menu are native `<details>` elements, so they work without
  JavaScript. `assets/js/shell.js` adds Escape and outside-click closing, and keeps one menu open.
- At 320–900px the main navigation moves into the menu; brand, language and menu stay visible.
  Desktop navigation must not wrap because of the language control.
- Footer: brand and "Practical privacy tools. Clear about limits."; Explore (Workspace, Tools &
  diagnostics, Privacy checkup, Guides, Messaging); About & policy (Mission, Principles, Status
  labels, Privacy & legal, Contact, Sponsorship & affiliate disclosure). It stacks vertically on
  narrow screens and keeps 44px targets. No old footer entry is silently dropped.

## Page patterns

- **Level 2 landing pages** orient: small breadcrumbs, one clear title, a short lead and one primary
  action. Organize by intent, not by forcing every item into an identical card grid.
- **Tool detail pages** let people act. Preserve form IDs, `data-*` hooks and scripts. Put the data
  flow and limitations next to the tool, not in the footer. Results use a polite live region.
- **Article pages** keep a readable measure, real metadata, sources and a table of contents on long
  pieces. The article body stays on its existing editorial surface inside the new shell.
- **About and policy pages** use a deep title area, a readable body and a deep principles band. Keep
  legal, privacy and sponsorship text unchanged unless a separate content task changes it.
- Images are local; non-decorative images need meaningful alternative text. Decorative SVGs are
  hidden from assistive technology.

## Accessibility

- WCAG 2.2 AA: contrast, visible focus, keyboard operation, no keyboard traps, reduced motion.
- Support 320px without horizontal scrolling; test desktop and narrow widths.
- Headings stay in order; controls have labels; errors are not colour-only.
- Language switch, menus, tabs, forms and result panels must be usable with a screen reader and
  without JavaScript where the underlying control supports it.
- Test the actual generated page, not only the source template.
