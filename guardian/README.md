# Guardian (Android) — work in progress

Guardian will block tracker domains on the phone itself, using Android's VpnService as a local DNS filter. No remote server is involved, and none is planned. It is a separate app from Permission Checkup (`android/permcheck`), which keeps its promise of no INTERNET permission.

Licensed GPL-3.0-or-later.

## Status (2026-10-27)

| Part | State |
|---|---|
| `core/` DNS query parser, blocked-response builder (NXDOMAIN or 0.0.0.0 / ::), IPv4/UDP checksums, blocklist parser (hosts, plain domains, `||domain^`, `@@` allowlist) with label-suffix matching | DeepSeek wrote it to Claude's spec (G1). Claude compiled it and reviewed it. Two test sets pass: `DnsFilterTest` (10 groups, including 40,000 fuzzed inputs that must not throw) and `tests/dns_oracle.py`, which checks 21 responses and 5 rejections against dnspython and its own checksum code. |
| Android VpnService shell (G2) | not started |
| Blocklist source and per-app view (G3) | not started |
| Real-device test | none |

## Run the checks

    kotlinc core/src/main/kotlin core/src/test/kotlin -include-runtime -d /tmp/g.jar
    java -cp /tmp/g.jar org.secureinchat.guardian.dns.DnsFilterTestKt
    kotlinc core/src/main/kotlin tests/oracle/Cli.kt -include-runtime -d /tmp/cli.jar
    pip install dnspython && python3 tests/dns_oracle.py /tmp/cli.jar
