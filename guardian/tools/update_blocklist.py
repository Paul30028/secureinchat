#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Refresh the bundled HaGeZi Multi LIGHT snapshot (GPL-3.0, same licence as Guardian).

Usage: python3 guardian/tools/update_blocklist.py
Writes guardian/app/src/main/assets/blocklist-hagezi-light.txt and prints its version line.
The snapshot is committed, so builds are reproducible and the app never downloads lists.
"""
import pathlib, re, sys, urllib.request

URL = "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/light-onlydomains.txt"
OUT = pathlib.Path(__file__).resolve().parent.parent / "app/src/main/assets/blocklist-hagezi-light.txt"

text = urllib.request.urlopen(URL, timeout=60).read().decode("utf-8")
head = "\n".join(l for l in text.splitlines()[:20] if l.startswith("#"))
if "hagezi/dns-blocklists/blob/main/LICENSE" not in head:
    sys.exit("licence line missing from list header; check the source before bundling")
entries = [l for l in text.splitlines() if l and not l.startswith("#")]
if len(entries) < 20000:
    sys.exit(f"only {len(entries)} entries; refusing to bundle a truncated list")
bad = [l for l in entries if not re.fullmatch(r"[a-z0-9_.-]+", l)]
if bad:
    sys.exit(f"unexpected lines, first: {bad[:3]}")
if "bat.bing.com" not in entries:
    sys.exit("bat.bing.com is gone from the list; update BLOCKED_HAGEZI in tests/emulator_flow.py")
OUT.write_text("# Licence: GPL-3.0, https://github.com/hagezi/dns-blocklists/blob/main/LICENSE\n# Source: " + URL + "\n" + text, encoding="utf-8")
ver = re.search(r"# Version: (\S+)", head)
print(f"{OUT.name}: {len(entries)} domains, version {ver.group(1) if ver else '?'}")
