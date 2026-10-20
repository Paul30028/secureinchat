# Outreach playbook (agencies and small IT services)

Source: Claude and ChatGPT discussion on 2026-10-20. Scores, thresholds and volumes are internal experiment rules, not industry standards. Laws differ by country: check the recipient's regulator (US CAN-SPAM covers B2B email too; UK ICO treats some business contact data as personal data). If compliance is unclear, do not send.

## Who sends
Paul, from his own mailbox, after checking each target. AI prepares the list, evidence and drafts. Start with one target market and 5-10 hand-verified companies, not bulk sending.

## Where to find real small companies
1. Official partner directories of site platforms (for example the Webflow certified partner directory), filtered to Agency/Freelancer and maintenance, migration or support services. Then open the company's own site.
2. Public portfolios and case pages showing live client sites and ongoing maintenance.
3. Providers listed for open-source projects that sell hosting, implementation or support, small independent teams rather than the software vendor.
4. Local web design or digital agency association member pages (membership is only a first signal).
5. Public professional marketplaces and expert directories, using the platform's own contact feature only.
6. Public technical communities where someone says they maintain client sites; interact within community rules first.
7. Company blogs, service and careers pages as business-direction clues only.
Identify "small" with two independent signals: business (maintenance, hosting, migration, support), size (studio or small team), clients (real cases), recurring service (monthly care plans), credibility (site, links and identity agree). Expect a low qualifying rate; record the real rate in week 1.

## Do not
Scrape personal emails or extract emails in bulk; buy lists of unknown origin; bypass logins, paywalls, captchas, rate limits or anti-automation; infer private addresses from social profiles; present ordinary configuration gaps as vulnerabilities; contact a person again by another channel after a refusal.

## Scoring (100 points)
Business fit 20, small-team fit 15, recurring maintenance business 15, verifiable public observation 15, English market 10, suitable contact route 10, compliance risk 10, credibility and activity 5.
75-100: review by hand. 60-74: hold, fill gaps. Below 60: do not contact. Compliance 0 means never send. No verifiable observation: do not invent one; use the question email instead.

## One-page report
Title with company, date and "Checked with SecureInChat". Scope (home page only: HTTPS, HTTP redirect, public security headers, title, description, basics). 1-3 observations, each re-verified by hand. Evidence (time, status code, redirect target, header present or missing). One practical next step each. Limits: not a security audit, one location, home page only.
Banned wording: anything that creates fear, calls a missing header a vulnerability or breach, or claims an audit.

## Email A (finding first, under 100 words)
Subject: A small website check for [Company]

Hi [Name],

I was looking at [Company's website] and noticed that [specific, verifiable observation].

I ran a limited homepage check with SecureInChat and wrote up the evidence and a practical next step. It is not a security audit, and I have not tested the whole site. Happy to send it if useful.

Best,
[Name]
SecureInChat
[business contact and any opt-out details required for that market]

## Email B (question first)
Hi [Name],

I am researching how small web agencies keep track of basic website health across client sites. I am building SecureInChat, a free tool that produces a limited website health report. If this is relevant to your work, I would appreciate your feedback.

Best,
[Name]
SecureInChat
[business contact and any opt-out details]

Compare A on whether people accept the report and continue; B on whether people describe their workflow and gaps. Do not use open rate. One follow-up at most; no chasing.

## Replies
Interested: send the report, ask how they check client sites today, offer a short call. Price question: say it is free now, and ask what they would need from a recurring version before discussing any pricing. Declined: thank them, stop, log it. Stop contacting: confirm once, add to the suppression list, never contact again. Who are you: say who you are, what SecureInChat is, how you found their public contact, and offer to delete their details.
Stop and log immediately if the check ran beyond the stated scope, a finding turns out wrong, a community or platform bans promotion, or a recipient complains.

## Tracking fields
Company and public site; contact source and date verified; market, contact basis, compliance status; contact date, template, actual text sent; reply class; suppression list entry and date. Keep nothing else about people.
