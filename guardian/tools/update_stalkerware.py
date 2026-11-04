#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Refresh Guardian's bundled stalkerware server list (G20).

Source: Echap's stalkerware indicators, https://github.com/AssoEchap/stalkerware-indicators
License: CC-BY 4.0 (attribution required; credited in the app and in the asset header).

Only the C2 (command-and-control) domains are used, not the vendors' marketing websites: a journalist
or a worried person reading about a stalkerware product must not be told their phone talks to its
servers. A C2 domain that Echap also lists as a website is kept but marked "web", and the app words that
alert more cautiously.

Writes guardian/app/src/main/assets/stalkerware-echap.tsv:
  domain <TAB> app name <TAB> kind (stalkerware|watchware) <TAB> also_website (0|1)
Lines starting with '#' are comments. The app never downloads this file; it is committed so builds are
reproducible, and the header records the exact source commit.

Needs PyYAML on the maintainer's machine (pip install pyyaml). This is a tool dependency only; the app
has none.
"""
import pathlib, re, subprocess, sys, urllib.request

try:
    import yaml
except ImportError:
    sys.exit("pip install pyyaml (maintainer tool only)")

REPO = "AssoEchap/stalkerware-indicators"
OUT = pathlib.Path(__file__).resolve().parent.parent / "app/src/main/assets/stalkerware-echap.tsv"
DOMAIN = re.compile(r"^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$")


def get(url):
    return urllib.request.urlopen(url, timeout=60).read().decode("utf-8")


# Pin the exact commit (git, not the GitHub API, so it works without an API token or rate limit).
sha = subprocess.run(["git", "ls-remote", f"https://github.com/{REPO}", "refs/heads/master"],
                     capture_output=True, text=True, check=True, timeout=60).stdout.split()[0]
rows = {}
skipped = 0
for name, kind in (("ioc.yaml", "stalkerware"), ("watchware.yaml", "watchware")):
    apps = yaml.safe_load(get(f"https://raw.githubusercontent.com/{REPO}/{sha}/{name}"))
    for app in apps:
        websites = {w.strip().lower() for w in (app.get("websites") or [])}
        for d in ((app.get("c2") or {}).get("domains") or []):
            d = d.strip().lower().rstrip(".")
            if not DOMAIN.match(d):
                skipped += 1
                continue
            # First listing wins; a domain in both files stays stalkerware (the stronger label).
            if d not in rows:
                rows[d] = (re.sub(r"[\t\r\n]+", " ", app["name"]).strip(), kind, "1" if d in websites else "0")

if len(rows) < 500:
    sys.exit(f"only {len(rows)} domains; refusing to bundle a truncated file")

lines = [
    "# Stalkerware C2 domains: Echap stalkerware-indicators, CC-BY 4.0, https://github.com/" + REPO,
    f"# Source commit: {sha}",
    "# domain\tapp\tkind\talso_website",
] + ["\t".join((d,) + rows[d]) for d in sorted(rows)]
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
kinds = {k: sum(1 for r in rows.values() if r[1] == k) for k in ("stalkerware", "watchware")}
print(f"{OUT.name}: {len(rows)} domains ({kinds}), {sum(r[2] == '1' for r in rows.values())} also websites, "
      f"{skipped} malformed skipped, commit {sha[:12]}")
