# Guardian (Android) — work in progress

Guardian will block tracker domains on the phone itself, using Android's VpnService as a local DNS filter. No remote server is involved, and none is planned. It is a separate app from Permission Checkup (`android/permcheck`), which keeps its promise of no INTERNET permission.

Licensed GPL-3.0-or-later.

## Status (2026-10-28)

| Part | State |
|---|---|
| `core/` DNS query parser, blocked-response builder (NXDOMAIN or 0.0.0.0 / ::), IPv4/UDP checksums, blocklist parser (hosts, plain domains, `||domain^`, `@@` allowlist) with label-suffix matching | DeepSeek wrote it to Claude's spec (G1). Claude compiled it and reviewed it. Two test sets pass: `DnsFilterTest` (10 groups, including 40,000 fuzzed inputs that must not throw) and `tests/dns_oracle.py`, which checks 21 blocked responses, 5 rejected queries and 12 upstream answers against dnspython and its own checksum code. |
| `core/` upstream answers (G2a): wrap the real resolver's answer for the TUN device, only if ID, question name, type and class match the query; blocklist hardening (G1.1: at least one dot, label rules) | DeepSeek wrote, Claude reviewed. `DnsUpstreamTest` (5 groups) passes; the oracle also checks 12 upstream cases (3 valid answers, 9 that must be refused: wrong ID, wrong name, a query instead of an answer). |
| `core/` QueryHandler (G2b part 1): block / forward / drop decision, counters, last 200 queries in memory only | DeepSeek wrote, Claude reviewed. `QueryHandlerTest` (10 groups, including 4 threads x 5,000 queries) passes. |
| Android VpnService shell and screen (G2b part 2) | Done; emulator flow on API 29 and 34 passes in CI (start, block, forward, stop from app and notification). |
| Blocklist source (G3a) | Bundled snapshot of [HaGeZi Multi LIGHT](https://github.com/hagezi/dns-blocklists) (GPL-3.0, about 72,000 domains, chosen for few false positives) plus Guardian's short `blocklist-extra.txt`. Refresh with `python3 tools/update_blocklist.py`; the app never downloads lists. Parse on a desktop JVM: about 0.4 s, 8 MB heap. |
| "Blocked most often" list, user allowlist (G3b) | DeepSeek wrote to Claude's spec; Claude reviewed and fixed a start/stop race (Stop pressed while the list loads) and throttled list rebuilds. The spec asked for counts per app, but the emulator flow showed every query arriving from the system DNS service (uid 1051): on Android 10+ apps resolve through that service, so a DNS-only VPN cannot tell which app asked. The screen therefore lists blocked domains, each with Allow; per-app attribution would need routing all traffic through the VPN, which is not planned. Counts live in memory only; the user's allowlist is the one thing saved (`UserRulesStore`). `AppTallyTest` (9 groups) passes; the emulator flow taps Allow and Remove and checks that resolution changes. |
| DNS over IPv6 (G4) | DeepSeek wrote to Claude's spec: IPv6/UDP queries (no extension headers), blocked and upstream answers with the IPv6 pseudo-header checksum, and an IPv6 DNS server address (fd00:6a72:6764::2) on the VPN, falling back to IPv4 only if the platform refuses it. `DnsIpv6Test` (14 groups) and `tests/dns_oracle6.py` (8 answers, 6 rejects, 4 upstream cases checked with dnspython and a separate checksum) pass. |
| Quick Settings tile (G5) | DeepSeek wrote to Claude's spec: a tile that starts and stops Guardian; if VPN consent is missing it opens the app. The emulator flow adds the tile and clicks it to start and stop. |
| Pause 5 minutes, app icon, lint (G6) | DeepSeek wrote to Claude's spec: pause/resume in QueryHandler (PauseTest, 7 groups), a Pause/Resume button, a notification with Resume, and the tile showing Paused; an adaptive launcher icon (shield and check from the site favicon); data_extraction_rules.xml excluding every domain. The emulator flow pauses, checks a blocked name resolves, resumes, and checks it is blocked again. |
| Your own block list (G8) | DeepSeek wrote to Claude's spec: user-blocked domains in Blocklist with precedence user allow > user block > builtin allow > builtin block (UserRulesTest, 7 groups); a "Blocked by you" field with Block, an error for invalid names, and Remove. A domain sits in at most one of your two lists. The emulator flow blocks example.org, checks it resolves to the block address, removes it, and checks a subdomain resolves for real. |
| Always-on VPN (G9) | DeepSeek wrote to Claude's spec: the service checks VPN consent when the system starts it for Always-on (or after a sticky restart) and stops instead of looping; an "Always-on: On/Off" line (API 29+, hidden otherwise, refreshed when you return from settings) with ", blocks connections without VPN" in lockdown; a button to the system VPN settings with a one-line explanation. No boot receiver: Android restarts an Always-on VPN itself. The emulator flow checks the Off line, that the button opens system settings, and that Back returns with Guardian still running. Turning Always-on on is not automated: it has no supported adb command. |
| Real-device test | none |

## Run the checks

    kotlinc core/src/main/kotlin core/src/test/kotlin -include-runtime -d /tmp/g.jar
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.DnsFilterTestKt
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.DnsUpstreamTestKt
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.QueryHandlerTestKt
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.AppTallyTestKt
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.DnsIpv6TestKt
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.PauseTestKt
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.UserRulesTestKt
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.RulesTextTestKt
    kotlinc core/src/main/kotlin tests/oracle/Cli.kt -include-runtime -d /tmp/cli.jar
    pip install dnspython && python3 tests/dns_oracle.py /tmp/cli.jar && python3 tests/dns_oracle6.py /tmp/cli.jar

## Blocklist credit

The bundled list is HaGeZi's Multi LIGHT, © HaGeZi, licensed GPL-3.0 (https://github.com/hagezi/dns-blocklists/blob/main/LICENSE). Its version line is kept in the asset header.
