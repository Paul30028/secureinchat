# Video topic research, round 1 (2026-10-20; branch `next`)

Method: fetched YouTube search results (en) for 10 task-style queries, parsed titles / view counts / age / length of the first ~13-20 results per query. Limits: results are YouTube's relevance ranking, not a random sample; views are not demand; titles only (no transcripts, no retention or CTR data); one run, one location/profile. Treat as a first signal.

| Query | Results | Top views | Median views |
|---|---|---|---|
| what metadata does a photo contain | 20 | 162,184 | 8,566 |
| remove exif data from photo | 20 | 113,719 | 2,678 |
| redact text from screenshot | 14 | 101,664 | 2,565 |
| dns leak test | 20 | 395,839 | 1,791 |
| is my vpn leaking | 19 | 80,295 | 1,597 |
| how to check website security headers | 18 | 157,081 | 764 |
| check if website is down or slow | 13 | 200,617 | 524 |
| webrtc leak test | 20 | 183,255 | 478 |
| blur sensitive info screenshot | 19 | 62,241 | 77 |
| website health check tool | 20 | 27,375 | 51 |

## Observations (from the data above only)
- Highest median: "what does a photo's metadata contain / how to view and remove it". Explain-then-act topics beat pure how-to.
- Top results are mostly old (3-8 years). Evergreen search videos keep collecting views; also means the front page is not fresh content.
- Top EXIF videos name a concrete tool and OS (Exiftool on Windows, macOS). The 2025-26 browser-based "no upload" videos in results have small views (22-307) = new, weak competitors, not proof of demand.
- "website health check tool": low demand on YouTube (median 51). Do not make video the channel for that tool; it fits SEO / outreach instead.
- Top DNS-leak result is Chinese-language; English-market demand for that exact query is not shown by it. Its 3rd (5 months old, 82k) is an English example of a recent hit.
- Security headers: top hits are bug-bounty/pentest audience, not site owners. Different audience from agencies.

## Candidate first topics (ranked by the data, to be tested not assumed)
1. "What is hidden in your photo? View and remove GPS/EXIF (in your browser, no upload)".
2. "Redact secrets/emails in a screenshot or text before sharing (browser-only)".
3. "DNS leak test: what it shows and what it cannot prove".
Hold: health check, security headers video.

## Not yet done (needs more than titles)
Transcripts/hooks of the top videos, comment mining for real questions, Google Trends / search-volume source, TikTok and Shorts equivalents (platform data harder to reach), repeat the run on another day.

---
# Round 2: broad sweep (not limited to tech)
Method: 30 broad queries (money, AI tools, productivity, life hacks, DIY, cleaning, fitness, meal prep, travel, study, language, gadgets, finance, editing, privacy...), YouTube English UI, filter "this month" sorted by view count, top ~20 per query; 531 unique videos. Limits: selection is already top-by-views (survivor bias), results include non-English/India/Indonesia channels, no subscriber counts, no retention/CTR, one run.

Median views of the top 20 per query (this month): home workout 2.87M; how to start a business 921k; life hacks 822k; cheap gadgets review 636k; video editing tutorial 611k; DIY home repair 443k; Android hidden features 423k; faceless youtube channel 394k; investing for beginners 372k; cleaning hacks 352k; meal prep 301k; free AI tools 288k; ChatGPT prompts 281k; make money online 268k; study tips 244k; budget travel 167k; learn english fast 143k.

Title/format features (median views with vs without) show no meaningful separation: digit 237k/209k, "free" 162k/241k, "AI" 199k/224k, "how to" 211k/221k, ALLCAPS 201k/235k, <=4 min 290k (n=30) vs 220k, >12 min 235k/213k. => On this sample, surface title tricks do not explain virality. Do not copy "formulas" from it.

Fastest per-day examples were established channels (family vlogs, gadget channels, DIY, a Google DeepMind video, Mark Tilbury's AI-money video), many non-English.

## Implications
- Virality here is driven by channel size, topic category and audience, not title wording. A new channel cannot assume it.
- Two different businesses are being mixed:
  A) Tool-funnel videos (niche, searchable, low views, qualified viewers) -> serves secureinchat.com.
  B) General-interest channel monetised by ads/affiliate (needs volume, eligibility for the partner programme is unverified for the owner; mass-produced AI content carries policy risk).
- Next evidence needed: transcripts/hooks of top videos, comment mining, Trends, same sweep on Shorts, and a check of which categories are dominated by big channels vs small channels winning (needs subscriber data).
