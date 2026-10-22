#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Static checks for the promises Permission Checkup makes:
no internet permission, no network code, no third-party libraries, read-only, GPL headers."""
import pathlib, re, sys, xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
A = "{http://schemas.android.com/apk/res/android}"
fails = []
def check(cond, msg):
    if not cond: fails.append(msg)

manifest = ET.parse(ROOT / "app/src/main/AndroidManifest.xml").getroot()
perms = {e.get(A + "name") for e in manifest.iter() if e.tag in ("uses-permission", "uses-permission-sdk-23")}
check(perms == {"android.permission.QUERY_ALL_PACKAGES"}, f"unexpected permissions: {sorted(perms)}")
check("INTERNET" not in (ROOT / "app/src/main/AndroidManifest.xml").read_text().replace("NO android.permission.INTERNET", ""),
      "INTERNET mentioned in manifest")
app = manifest.find("application")
check(app is not None and app.get(A + "allowBackup") == "false", "allowBackup must be false")
exported = [a for a in manifest.iter("activity") if a.get(A + "exported") == "true"]
check(len(exported) == 1, "only the launcher activity may be exported")
check(not list(manifest.iter("service")) and not list(manifest.iter("receiver")) and not list(manifest.iter("provider")),
      "no services, receivers or providers")

gradle = (ROOT / "app/build.gradle.kts").read_text()
check(re.search(r"^\s*dependencies\s*\{", gradle, re.M) is None, "app/build.gradle.kts must not add library dependencies")

banned = re.compile(r"\b(java\.net|javax\.net|okhttp|HttpURLConnection|Socket|URL\(|WebView|INTERNET|"
                    r"revokeRuntimePermission|grantRuntimePermission|setMode\(|AccessibilityService\b|SharedPreferences|openFileOutput)")
srcs = list((ROOT / "app/src/main/kotlin").rglob("*.kt")) + list((ROOT / "core/src/main/kotlin").rglob("*.kt"))
check(len(srcs) >= 6, f"expected app and core sources, found {len(srcs)}")
for p in srcs:
    text = p.read_text()
    check(text.startswith("// SPDX-License-Identifier: GPL-3.0-or-later"), f"missing SPDX header: {p.name}")
    code = "\n".join(l for l in text.splitlines() if not l.strip().startswith("//"))
    code = re.sub(r'"[^"\n]*"', '""', code)  # ignore string literals (user-facing text)
    m = banned.search(code)
    check(m is None, f"{p.name}: banned API {m.group(0) if m else ''}")

if fails:
    print("\n".join("FAIL " + f for f in fails)); sys.exit(1)
print(f"permcheck policy checks passed ({len(srcs)} sources, permissions={sorted(perms)})")
