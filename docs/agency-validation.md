# 14-day agency validation (no payment, no accounts)

Hypothesis: small web agencies will fold a recurring site-health report into their client maintenance routine, and will say what they would pay for it. Free single checks are not the success signal.

## Product stance
- Free tool: https://secureinchat.com/tools/site-health-check/ . Home page only; no certificate expiry; one check location; cannot check its own domain.
- Next features, by value to agencies (ChatGPT ranking, effort figures are estimates): 1) multi-site batch report (2-4 days), 2) shareable HTML report (2-4 days), 3) scheduled monitoring with change report and alerts (3-6 days; needs storage and email, so it waits for evidence).
- Differentiation is not more checks. It is "what changed since last time", which needs saved baselines. Do not build it before agencies ask for recurring use.

## Target list (30-50)
Include: small agencies and freelancers who publish a client portfolio and offer WordPress, Shopify or site maintenance; 2-15 people; English-language site; contact form or business email shown on their own site.
Exclude: large agencies, anyone whose site says no solicitation, private addresses, scraped mailing lists.
Sources: web search for "website maintenance agency", "WordPress care plan", "Shopify agency" and portfolio pages; manual LinkedIn reading; public communities where promotion is allowed.
Rules: contact only through channels the business publishes for enquiries, one follow-up at most, honour any opt-out, no bulk or scraped sending. Check the law for the recipient's country (CAN-SPAM in the US; corporate vs sole-trader rules in the UK).

## Per-target custom check (10 min)
1. Pick one client site from the agency's public portfolio.
2. Run the health check, re-verify the top 2-3 findings by hand, note time, status code, redirect or missing header.
3. Write one page: findings only, no scare language. A missing header is not a vulnerability and this is not a security audit.
4. Offer the page; ask how they check client sites today.

## Cold email (under 120 words)
Subject: A quick health check for [Client Website]

Hi [Name],

I noticed [Agency] maintains websites for clients, so I ran a quick public homepage check on [Client Website]. I found [verified finding] and [second finding, if useful].

I built a free tool that checks redirects, response status, security headers and basic page metadata in one report. It only checks publicly accessible pages and is not a full security audit. I would value your feedback on whether a consolidated report would save your team time.

Best,
[Name]
[Contact URL]

If you would rather not hear from me again, just say so.

Follow-up (once, 3-5 days later): one line, restate the finding, offer to send the one-page report, no further follow-up.

## Daily plan
Days 1-2: criteria and first 10 targets. Days 3-5: custom checks, reach 20. Days 6-8: send to suitable, contactable targets, reach 30. Days 9-11: continue, 40-50. Days 12-14: one follow-up each, collect feedback, decide.
The 30-50 figure is a goal, not a promise of 30-50 delivered contacts.

## Signals (suggested thresholds, not industry norms)
Demand: 5+ real replies; 3+ describe how they check sites today and how long it takes; 3+ discuss the custom report; 2+ will test multi-site or scheduled reports; 2+ discuss a trial after seeing a concrete price.
No demand: no relevant replies; praise with no concrete workflow; only occasional single-use.
Decisions: recurring-use interest -> build scheduled monitoring and change reports with those testers. Liked the report but no recurring use -> improve batch checks and report delivery. Requests all differ -> do not build custom work. Almost no replies -> check list and contact data first, then value, then price.
Success is an agency putting the report into a weekly or monthly client routine, not site visits.

## Security notes for the endpoint
Public domain names only, ports 80/443, no IPs, no internal suffixes, redirect hops re-validated, 6s timeout, response size caps, 20 checks per minute per IP, self-check refused. Workers cannot reach private ranges.
