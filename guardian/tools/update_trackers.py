#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Refresh Guardian's bundled tracker names (G15).

Source: the Exodus Privacy tracker database (ETIP), published under the Open Database License
(ODbL v1.0); individual contents under the Database Contents License (DbCL v1.0). We read the copy
that TrackerControl keeps in its repository (same data, refreshed from Exodus), because the Exodus
API does not allow automated fetching.

Writes guardian/app/src/main/assets/trackers-exodus.tsv: one tracker per line,
  id <TAB> name <TAB> categories (comma-separated) <TAB> website <TAB> network regex <TAB> code signatures ('|'-separated)
Lines starting with '#' are comments. Tabs and newlines inside fields are replaced by spaces.
The app never downloads this file; it is committed so builds are reproducible.
"""
import json, pathlib, re, sys, urllib.request

URL = "https://raw.githubusercontent.com/TrackerControl/tracker-control-android/master/app/src/main/assets/trackers.json"
OUT = pathlib.Path(__file__).resolve().parent.parent / "app/src/main/assets/trackers-exodus.tsv"

data = json.loads(urllib.request.urlopen(URL, timeout=60).read().decode("utf-8"))
trackers = list(data["trackers"].values())
if len(trackers) < 300:
    sys.exit(f"only {len(trackers)} trackers; refusing to bundle a truncated file")

def clean(s):
    return re.sub(r"[\t\r\n]+", " ", (s or "").strip())

lines = [
    "# Tracker data: Exodus Privacy (https://exodus-privacy.eu.org), ODbL v1.0 / DbCL v1.0.",
    "# Copy via TrackerControl: " + URL,
    "# id\tname\tcategories\twebsite\tnetwork_regex\tcode_signatures",
]
bad = 0
for t in sorted(trackers, key=lambda t: t["id"]):
    net = clean(t.get("network_signature"))
    if net:
        try:
            re.compile(net)
        except re.error:
            bad += 1
            net = ""
    code = clean(t.get("code_signature"))
    lines.append("\t".join([str(t["id"]), clean(t["name"]), ",".join(t.get("categories") or []),
                            clean(t.get("website")), net, code]))
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
with_net = sum(1 for l in lines[3:] if l.split("\t")[4])
print(f"{OUT.name}: {len(lines) - 3} trackers, {with_net} with network signatures, {bad} invalid regexes dropped")
