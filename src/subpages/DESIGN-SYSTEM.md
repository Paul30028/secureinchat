# SecureInChat — Secondary & Tertiary Page Design System v2

## Design intent

The homepage establishes the brand. Below it, pages should feel like the same publication, but their layouts should respond to the job of the page instead of repeating the homepage's cards.

- **Level 2 pages orient.** A visitor should understand the section, see the available paths, and choose one next step.
- **Level 3 tool pages let people act.** The working interface is the main content; data handling and limitations sit close to it, not buried in the footer.
- **Level 3 articles help people understand.** Reading width, hierarchy, contents, sources and related actions take precedence over promotional blocks.
- **Principles and architecture pages make the invisible legible.** Data paths and trust boundaries need diagrams and exact explanations, not broad security claims.

## Brand tokens

Use the existing production `/assets/css/home.css` first, then load `/assets/css/subpages.css`. Do not introduce a separate brand palette or a new typography system for the subpages.

- Warm ivory: `#F7F5EF`
- Card surface: `#FFFFFF` / editorial surface `#FBFAF6`
- Forest green: `#173D32`
- Body text: `#20312B`
- Muted text: `#4F5D56`
- Soft sage: `#E7E9E2`
- Decorative wheat gold: `#C6A15B` (not body text on light backgrounds)
- Readable deep gold: `#79551B`
- Dark footer: `#0B241F`
- Dark-surface text: `#F7F5EF` and secondary `#D1DDD6`

Atkinson Hyperlegible Next remains the body font. Noto Serif is reserved for editorial headlines and a few section titles. All font files remain self-hosted. Body copy should generally stay at 16px; status labels and metadata must not fall below 12px.

## Level 2 page patterns

### Section landing — tools, checkup and guide library

1. Breadcrumbs are small and quiet; they help orientation but are not the page's headline.
2. The hero uses one large serif title, a short plain-language lead, and one primary action (a secondary action is optional).
3. The illustration or side note should answer a real question. It is not a decorative photo slot.
4. Main content is organised by intent and priority. Use one featured tool or guide where it helps people begin; do not force every item into a same-size card grid.
5. Status labels use approved wording such as `Local processing`, `Network lookup`, `Tested`, `Documented`, `Untested` and `Limitations`. Never use labels as decoration.
6. Related guidance follows the primary choices instead of competing with them.

### Principles / architecture

- Keep a readable secondary navigation beside the main content on desktop; move it above the content on mobile.
- Draw messaging and tool lookups as separate paths. Do not imply every tool request uses the chat relay.
- Pair every diagram with a plain-language caption and a limit statement.
- Put the tool-by-tool data-flow inventory and status definitions in scannable rows, not a large wall of text.

### Informational pages

Mission, privacy, contact and sponsorship pages share an editorial shell: narrow readable content, meaningful section headings, simple action rows and source links where relevant. Do not inflate these pages with empty cards or hero imagery just to make them look full.

## Level 3 page patterns

### Tool detail

1. **Tool hero:** Breadcrumbs, clear verb-led title, one-sentence description and verified processing/status labels.
2. **Working task:** Preserve the existing production form, result panel, IDs, `data-*` hooks and JavaScript. The task must be the main visual anchor.
3. **How to read results:** Numbered next steps that explain what a result means, rather than repeating the interface labels.
4. **Handling and limits:** A nearby aside explains local processing or each network request, plus what the tool cannot determine.
5. **Related next step:** A real related guide or a different relevant tool.

Tool shells in this kit contain a marked integration slot. It is a handoff marker for developers and must never be published in place of a functioning tool.

### Article detail

- Keep body text around `46rem` maximum width and line-height around `1.8`.
- The title, deck, date/read time and article-specific diagram establish context before the article body begins.
- Table of contents is sticky on larger screens where it is useful; it becomes a normal block above the article on mobile.
- Use notes for safety-critical caveats, not for every paragraph.
- Clearly separate sources, last-updated details and related next steps.
- Keep source destinations real and specific. A generic vendor homepage should not be substituted for the exact source page when that page exists.

### Interactive checklist pages

The phone-number checkup is a self-review checklist, not a device scan. Keep the privacy note, progress count, checklist explanations, official-source slot, and reset behavior visible. Do not ask the visitor to enter a phone number. Preserve the existing page-memory-only state logic; never add storage or analytics to make the checklist look more sophisticated.

## Illustration system

The local SVG library has been redrawn as a consistent family of original line diagrams. The pictures deliberately contain no tiny in-image legend text: explanatory words remain in HTML so they can be translated and remain readable on mobile.

- `privacy-layers.svg`: six connected symbols for the six-layer privacy model.
- `data-flows.svg`: separate visual lanes for encrypted messaging and a tool lookup.
- `relay-architecture.svg`: endpoint → relay → endpoint, with encrypted payload motifs.
- `url-anatomy.svg`: the host, path and query parameter portions of an address bar.
- `photo-metadata.svg`: an image and examples of possible device/time/location fields.
- `text-redaction.svg`: sensitive spans before and after redaction.
- `account-recovery.svg`: one account connected to multiple sign-in and recovery routes.
- `data-broker.svg`: separate data sources linked to a profile and broker record.
- `sim-swap.svg`: device-level and carrier-level protection as separate control points.

SVG rules: only local files, no external references, no inline `<style>`, no `style` attributes, no gradients, consistent rounded line caps, forest-green strokes, sage fills and restrained deep-gold paths. Colour is never the only way information is distinguished. Each SVG has a `title`, `desc` and corresponding HTML `alt` text.

## Responsive behaviour

- Content shell: maximum `75rem` (1200px).
- Page gutter: `clamp(1.25rem, 3vw, 2rem)`.
- Tablet breakpoint: `64rem`; content grids simplify and sidebars may move below the main area.
- Mobile breakpoint: `48rem`; one-column tool interfaces, stacked heroes, non-sticky article contents and full-width primary actions.
- Small-phone breakpoint: `24rem`; remove two-column clusters that become cramped.
- Never let horizontal overflow be the mechanism for reading important content.
- Keep hover as enhancement only; all actions must remain visible and keyboard accessible.

## Trust and accessibility

- Status labels represent real implementation and test evidence.
- A local checklist is not presented as a technical scan of device settings.
- URL structure checks never claim that the destination is safe.
- Relay diagnostics do not constitute an independent cryptographic audit.
- Do not imply that unreleased client interfaces already exist.
- Body-text contrast should meet WCAG 2.2 AA (at least 4.5:1 for normal text). Gold is decorative on pale backgrounds; deep gold is the readable text shade.
- Preserve visible focus indicators, semantic headings, labelled controls, reduced-motion support and meaningful alt text.
