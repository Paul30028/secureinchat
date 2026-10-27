# Guardian (Android) — work in progress

Guardian will block tracker domains on the phone itself, using Android's VpnService as a local DNS filter. No remote server is involved, and none is planned. It is a separate app from Permission Checkup (`android/permcheck`), which keeps its promise of no INTERNET permission.

Licensed GPL-3.0-or-later.

## Status (2026-10-27)

| Part | State |
|---|---|
| `core/` DNS query parser, blocked-response builder (NXDOMAIN or 0.0.0.0 / ::), IPv4/UDP checksums, blocklist parser (hosts, plain domains, `||domain^`, `@@` allowlist) with label-suffix matching | DeepSeek wrote it to Claude's spec (G1). Claude compiled it and reviewed it. Two test sets pass: `DnsFilterTest` (10 groups, including 40,000 fuzzed inputs that must not throw) and `tests/dns_oracle.py`, which checks 21 blocked responses, 5 rejected queries and 12 upstream answers against dnspython and its own checksum code. |
| `core/` upstream answers (G2a): wrap the real resolver's answer for the TUN device, only if ID, question name, type and class match the query; blocklist hardening (G1.1: at least one dot, label rules) | DeepSeek wrote, Claude reviewed. `DnsUpstreamTest` (5 groups) passes; the oracle also checks 12 upstream cases (3 valid answers, 9 that must be refused: wrong ID, wrong name, a query instead of an answer). |
| `core/` QueryHandler (G2b part 1): block / forward / drop decision, counters, last 200 queries in memory only | DeepSeek wrote, Claude reviewed. `QueryHandlerTest` (10 groups, including 4 threads x 5,000 queries) passes. |
| Android VpnService shell and screen (G2b part 2) | being written |
| Blocklist source (G3a) | Bundled snapshot of [HaGeZi Multi LIGHT](https://github.com/hagezi/dns-blocklists) (GPL-3.0, about 72,000 domains, chosen for few false positives) plus Guardian's short `blocklist-extra.txt`. Refresh with `python3 tools/update_blocklist.py`; the app never downloads lists. Parse on a desktop JVM: about 0.4 s, 8 MB heap. |
| Per-app view, user allowlist (G3b) | being written |
| Real-device test | none |

## Run the checks

    kotlinc core/src/main/kotlin core/src/test/kotlin -include-runtime -d /tmp/g.jar
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.DnsFilterTestKt
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.DnsUpstreamTestKt
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.QueryHandlerTestKt
    kotlinc core/src/main/kotlin tests/oracle/Cli.kt -include-runtime -d /tmp/cli.jar
    pip install dnspython && python3 tests/dns_oracle.py /tmp/cli.jar

## Blocklist credit

The bundled list is HaGeZi's Multi LIGHT, © HaGeZi, licensed GPL-3.0 (https://github.com/hagezi/dns-blocklists/blob/main/LICENSE). Its version line is kept in the asset header.
