# SecureInChat secondary and tertiary page route map

Use the templates as design shells; copy the matching page-specific copy and real tool markup from production rather than replacing working functionality with example content.

## Level 2 — section pages

| Production route | Template | Notes |
|---|---|---|
| `/tools/` | `templates/tools-index.en.html` | Tool catalogue grouped by intent; primary browser report first. |
| `/zh/tools/` | `templates/tools-index.zh.html` | Localized categories; omits the VPN/IP leak category as requested. |
| `/checkup/` | `templates/checkup.en.html` | Four check types. |
| `/zh/checkup/` | `templates/checkup.zh.html` | Three check types; no IP test. |
| `/blog/` | `templates/guides-index.en.html` | Editorial featured guide and article feed. |
| `/zh/blog/` | `templates/guides-index.zh.html` | Uses “断网通信与中继 · 2 篇”; no VPN-related category. |
| `/principles/` | `templates/principles.en.html` | Data-flow paths, status-label definitions and tool-by-tool transparency. |
| `/zh/principles/` | `templates/principles.zh.html` | Localized principles layout. Verify localized route exists before using. |
| `/messaging/` | `templates/messaging.en.html` | Keep the live relay diagnostic interface and JavaScript intact. |
| Mission, Privacy, Contact, Sponsor/About | `templates/info-page.en.html` / `.zh.html` | Reuse the editorial shell, but retain each production page's exact copy and links. |

## Level 3 — detail pages

| Production route | Template | Notes |
|---|---|---|
| `/tools/link-checker/` | `templates/tool-detail-link-checker.en.html` | Example local-only tool detail; its integration slot must be replaced with the current working checker markup. |
| `/zh/tools/link-checker/` | `templates/tool-detail-link-checker.zh.html` | Same interaction-preservation rule. |
| `/blog/protect-your-phone-number-sim-swap/` | `templates/article-detail-phone-privacy.en.html` | Article layout example; keep the approved production article and verified source URLs. |
| localized phone-number article, if published | `templates/article-detail-phone-privacy.zh.html` | Only deploy if that localized article is actually present. Do not invent a translated URL. |

## Important integration rule

The link-checker and relay templates contain an explicit handoff block rather than a functional tool. This is deliberate: merge the existing working form/result subtree into the indicated location while preserving IDs, `data-*` hooks, and existing scripts. Do not publish the handoff block as if it were the tool itself. The phone-checkup checklist must likewise retain the live six-item DOM structure and `/assets/js/phone-checkup.js` behavior when its page is restyled.
