# Demand probe 1 (2026-10-20, branch `next`): "AI-era privacy" search questions
Method: Google autocomplete (hl=en) expanded a-z for 10 seed patterns; then top-10 organic domains for 8 sample queries. Limits: autocomplete shows breadth of phrasing, NOT search volume; one location/profile; one day; domains only (no authority/traffic data); no revenue evidence.

## Autocomplete breadth (unique suggestions, a-z expansion)
free alternative to 260; how to check if my 260; open source alternative to 245; is it safe to upload 217; how to remove metadata from 227; best free tool to 208; cheapest software for 155; self hosted alternative to 137; free online calculator for 62; privacy friendly alternative to 3.

## Finding
"is it safe to upload ..." is dominated by AI-chatbot questions: bank statements, credit-card statements, ID, CV/resume, contracts, confidential documents, blood-test results, photos/selfies -> to ChatGPT / Claude / Gemini / Copilot. Real, specific, fear-driven phrasing across many document types.

## Who ranks (top organic domains, mixed results)
- "is it safe to upload bank statements to chatgpt": reddit, linkedin, investopedia, treasury.sh, spendsum.com, welleness.ai, wjla.com, afr.com.
- "redact personal information before chatgpt": redact-pdf.ai, fastcompany.com, vidizmo.ai, memx.app, caviard.ai, reddit, privacyscrubber.com, Chrome Web Store.
- "remove personal info from screenshot before sharing": reddit, tools.faxianai.com, macomptroller.org, pics.io, redacted.app, verypdf.com, metaclean.app, cnet.
- "how to anonymize text before pasting into ai": layrin.com, camotext.ai, anonym.plus, haqq.ai, note.com, medium, redact-pdf.ai, codeless.co, dev.to.

## Reading
- Demand signal is plausible, not measured: many distinct phrasings, but no volume data.
- Competition: many small single-purpose sites (redact-pdf.ai, privacyscrubber.com, memx.app, caviard.ai, camotext.ai, anonym.plus, redacted.app, metaclean.app) already rank = the niche is forming and contested, and small domains can rank (reachable), but they sell the same thing we already built (secureinchat.com text redactor, photo metadata remover).
- Differentiators we could test: strictly in-browser (no upload) with verifiable proof, per-document-type guides (bank statement, ID, CV, medical result), "what ChatGPT/Claude/Gemini do with uploads" explainers that link to the tool.
- Monetisation: unproven; only ads/affiliate-level traffic value assumed, nothing measured.

## 7-day zero-cost experiment (AI side only; publishing is the owner's decision)
D1-2 collect the full query list by document type, pick 10 with weakest top-10 pages. D3-5 draft 5 pages (guide + in-browser tool link, original content, no bulk generation). D6 ChatGPT/Grok review. D7 owner decides whether to publish; if published, track impressions/clicks in Search Console for 4-8 weeks (SEO cannot be judged in 7 days). Stop: no impressions after 8 weeks, or all targeted queries dominated by large publishers.
