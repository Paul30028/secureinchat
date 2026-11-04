#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""U1 checks for Guardian's string resources (runs in CI, no Android SDK needed):
  1. res/values*/strings.xml are exactly what tools/gen_strings.py produces (no hand edits, no stale files);
  2. every language has the same keys, the same plural keys, and an "other" form for each plural;
  3. placeholders (%1$s, %2$d, ...) are the same set in every language for each key;
  4. no empty text;
  5. every R.string / R.plurals used in the app's Kotlin exists, and no defined key is unused;
  6. no hard-coded txt(...) / tr(...) helpers are left in the app code."""
import pathlib, re, sys
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import gen_strings  # noqa: E402

errors = []
for path, text in gen_strings.outputs().items():
    if not path.exists() or path.read_text(encoding="utf-8") != text:
        errors.append(f"{path.relative_to(ROOT)} is out of date: run tools/gen_strings.py")

PH = re.compile(r"%(\d+)\$[sd]")


def load(path):
    root = ET.parse(path).getroot()
    strings = {e.get("name"): (e.text or "") for e in root.findall("string")}
    plurals = {e.get("name"): {i.get("quantity"): (i.text or "") for i in e.findall("item")} for e in root.findall("plurals")}
    return strings, plurals


res = ROOT / "app/src/main/res"
langs = {d.name: load(d / "strings.xml") for d in sorted(res.glob("values*")) if (d / "strings.xml").exists()}
base_s, base_p = langs["values"]
untranslatable = {k for k in base_s if k == "app_name"}
for name, (s, pl) in langs.items():
    if name == "values":
        continue
    missing = set(base_s) - untranslatable - set(s)
    extra = set(s) - set(base_s)
    if missing: errors.append(f"{name}: missing {sorted(missing)}")
    if extra: errors.append(f"{name}: unknown keys {sorted(extra)}")
    if set(pl) != set(base_p): errors.append(f"{name}: plural keys differ")
    for k, v in s.items():
        if k in base_s and set(PH.findall(v)) != set(PH.findall(base_s[k])):
            errors.append(f"{name}/{k}: placeholders {PH.findall(v)} vs {PH.findall(base_s[k])}")
for name, (s, pl) in langs.items():
    for k, v in s.items():
        if not v.strip('" '): errors.append(f"{name}/{k}: empty")
    for k, forms in pl.items():
        if "other" not in forms: errors.append(f"{name}/{k}: no 'other' plural form")
        for q, v in forms.items():
            if set(PH.findall(v)) != set(PH.findall(base_p[k]["other"])):
                errors.append(f"{name}/{k}[{q}]: placeholders differ")

code = "\n".join(p.read_text() for p in (ROOT / "app/src/main/kotlin").rglob("*.kt"))
used_s = set(re.findall(r"R\.string\.(\w+)", code))
used_p = set(re.findall(r"R\.plurals\.(\w+)", code))
manifest = (ROOT / "app/src/main/AndroidManifest.xml").read_text()
used_s |= set(re.findall(r"@string/(\w+)", manifest))
for k in sorted(used_s - set(base_s)): errors.append(f"code uses R.string.{k}, which is not defined")
for k in sorted(used_p - set(base_p)): errors.append(f"code uses R.plurals.{k}, which is not defined")
for k in sorted(set(base_s) - used_s): errors.append(f"string {k} is defined but never used")
for k in sorted(set(base_p) - used_p): errors.append(f"plural {k} is defined but never used")
if re.search(r"\b(txt|tr)\(\s*\"", code): errors.append("hard-coded txt(\"...\")/tr(\"...\") left in app code")

if errors:
    print("strings: FAIL\n  " + "\n  ".join(errors))
    sys.exit(1)
print(f"strings: ok ({len(base_s)} strings, {len(base_p)} plurals, {len(langs)} languages)")
