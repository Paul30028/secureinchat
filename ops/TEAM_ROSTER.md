# Team roster and specialist roles

A role is a responsibility with a deliverable and a boundary, not a different person. Every role is played by one of the three AIs, so independence comes from the rule: the author of a piece of work is never its only reviewer. Real legal, tax and financial advice needs a qualified professional.

## Members
- Paul: owner and final approver (money, accounts, logins, sending, posting, go-live). 15-20 minutes a day.
- Claude: execution and evidence. Tools: code, tests, repo (local branch), browser, files, web search.
- ChatGPT: strategy and red team. Counters conclusions, checks official sources, drafts policy text.
- Grok: market scout and independent second opinion (added 2026-10-20). Real-time web and X, competitor revenue disclosures, platform policy changes. Model family differs, which helps against agreement by habit. Its numbers still need sources.

## Specialist roles
| Role | Lead | Reviewer | Deliverable | Must not |
|---|---|---|---|---|
| Software engineer (web, extension, client) | Claude | ChatGPT (spec, edge cases) | Tested changes on a branch with change notes | Ship payment or privacy logic unreviewed; push to main |
| Security engineer | Claude | ChatGPT threat model; Grok public advisories and competitors | Threat model, dependency audit, check that "not stored" claims match the code | Claim "audited" or "certified" without a third party |
| Growth and SEO engineer | Claude | Grok (queries, results pages) | Index and crawl review, titles, internal links, weekly Search Console summary | Buy links; promise ranking dates |
| Content and video producer | ChatGPT outline and counter-view; Claude drafts and builds | Grok fact and trend check | Publishable pages and FAQs; video scripts and shot lists from real demos | Mass thin content; template video batches |
| Data analyst | Claude | ChatGPT checks metric definitions | One-page view: impressions, clicks, completed use, revenue, source | Vanity metrics; counting bots or own tests |
| Compliance and risk (light) | ChatGPT drafts | Paul confirms; Grok watches policy changes; professionals for law and tax | Policy diffs, pre-launch checklist | Present drafts as legal advice |
| Payments and business architecture (software side) | ChatGPT compares options | Paul registers and decides; Grok checks platform policies | Channel comparison, pricing hypotheses | Anything that evades sanctions or platform rules |
| Financial software and data engineer (on demand) | Claude | ChatGPT | Software, data and educational tools only | Trading, bots that trade, investment recommendations, anything for mainland virtual-currency services |
| Market scout | Grok | Claude spot-checks sources | Briefs with evidence grade and links | Final business decisions |

## Mature, publicly documented models (Grok's list, 2026-10-20)
Sources are Grok's and have not been checked by Claude; figures marked as estimates stay estimates. All public examples are survivor-biased.
1. Browser extension, freemium or subscription. Reported: many paid extensions earn $0; disclosed examples about $300-$15k a month. Claimed tracking of about 57% at $0 and about 6% above $1k a month: unverified. First revenue often 1-6 months. Fits: our leak, fingerprint and redaction logic.
2. English tool site with ads or affiliate. Reported RPM $5-20, so about $400 a month needs tens of thousands of English page views. First revenue often 3-9 months. Fits: the existing 7 tools.
3. Micro-SaaS. Reported median of about 5-9 months to $1k MRR in small samples; most never reach $10k.
4. WordPress plugin, freemium. Freemius case studies; about 1-3% conversion; needs thousands of active installs.
5. Digital products (checklists, templates). Median creator income very low; needs an audience first.
6. Newsletter sponsorship. Needs thousands of subscribers; vertical audiences pay more.
7. Content site plus sponsors and affiliates. Years; weak fit for a new domain.
8. Browser mini-game with ads or purchases. Very high variance.
Common to successes: one problem solved well, a free tier that is really useful, one acquisition channel pursued deeply, charging early.

## Where earlier judgements may be wrong (Grok and ChatGPT agree)
Over-estimating how fast a new-domain site gets search traffic; confusing automated production with automated acquisition; assuming privacy-niche ad rates before there is sellable inventory (VPN and proxy advertising rules are strict); having no single funnel from tools to the client apps; treating payout eligibility for a mainland-China owner as a later detail. That last point is Paul's to verify: AdSense, YouTube Partner Programme, Paddle, Lemon Squeezy and Stripe eligibility are all unconfirmed.
