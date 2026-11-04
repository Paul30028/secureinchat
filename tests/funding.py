"""The funding page lists donation channels only when real URLs are configured, and states the relay-sponsor rules."""
import pathlib, re, sys

html = (pathlib.Path(__file__).resolve().parents[1] / "public/sponsor/index.html").read_text(encoding="utf-8")
build = (pathlib.Path(__file__).resolve().parents[1] / "build/build.mjs").read_text(encoding="utf-8")

errors = []
configured = re.findall(r"^\s*\['[^']+', '(https://[^']+)'\],", build.split("const FUNDING_CHANNELS = [", 1)[1].split("];", 1)[0], re.M)
for url in configured:
    if url not in html:
        errors.append(f"configured channel missing from page: {url}")
if not configured:
    if "Donation channels are being set up" not in html:
        errors.append("no channels configured, but the page does not say they are being set up")
    for host in ("opencollective.com", "github.com/sponsors", "liberapay.com", "ko-fi.com"):
        if host in html:
            errors.append(f"donation link to {host} shown before a channel is configured")
for phrase in ('id="sponsor-a-relay"', "keep no IP address logs", "Sponsors get their name in the server list, nothing else"):
    if phrase not in html:
        errors.append(f"missing: {phrase}")

if errors:
    print("FAIL funding:", *errors, sep="\n  ")
    sys.exit(1)
print("funding: ok")
