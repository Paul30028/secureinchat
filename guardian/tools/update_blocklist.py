#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Refresh the three bundled HaGeZi Multi snapshots (GPL-3.0, same licence as Guardian).

Usage: python3 guardian/tools/update_blocklist.py

Each tier uses its own full list. The three lists are NOT supersets of each other (light has
domains multi does not, and vice versa), so no diffing is done - each one is bundled as shipped.
The snapshots are committed, so builds are reproducible and the app never downloads lists.
"""
import pathlib, re, sys, urllib.request

BASE = "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard"
LICENCE_URL = "https://github.com/hagezi/dns-blocklists/blob/main/LICENSE"
ASSETS = pathlib.Path(__file__).resolve().parent.parent / "app/src/main/assets"

# (asset file, source URL, minimum entry count). The minimums are well below the current sizes
# (~78k / ~175k / ~211k) so a normal upstream shrink does not break the build, but a truncated
# or error-page download does.
TIERS = [
    ("blocklist-hagezi-light.txt", f"{BASE}/light-onlydomains.txt", 20_000),
    ("blocklist-hagezi-normal.txt", f"{BASE}/multi-onlydomains.txt", 80_000),
    ("blocklist-hagezi-pro.txt", f"{BASE}/pro-onlydomains.txt", 100_000),
]

for out_name, url, min_entries in TIERS:
    text = urllib.request.urlopen(url, timeout=60).read().decode("utf-8")
    head = "\n".join(l for l in text.splitlines()[:20] if l.startswith("#"))
    if "hagezi/dns-blocklists/blob/main/LICENSE" not in head:
        sys.exit(f"{out_name}: licence line missing from header; check the source before bundling")
    entries = [l for l in text.splitlines() if l and not l.startswith("#")]
    if len(entries) < min_entries:
        sys.exit(f"{out_name}: only {len(entries)} entries; refusing to bundle a truncated list")
    bad = [l for l in entries if not re.fullmatch(r"[a-z0-9_.-]+", l)]
    if bad:
        sys.exit(f"{out_name}: unexpected lines, first: {bad[:3]}")
    if "bat.bing.com" not in entries:
        sys.exit(f"{out_name}: bat.bing.com missing; update BLOCKED_HAGEZI in tests/emulator_flow.py")
    out = ASSETS / out_name
    out.write_text(
        f"# Licence: GPL-3.0, {LICENCE_URL}\n# Source: {url}\n" + text,
        encoding="utf-8",
    )
    ver = re.search(r"# Version: (\S+)", head)
    print(f"{out.name}: {len(entries)} domains, version {ver.group(1) if ver else '?'}")
