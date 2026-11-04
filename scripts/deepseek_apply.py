"""Apply a DeepSeek answer written in the agreed file-block format.

Format (required in every spec):
    === FILE: relative/path.ext ===
    <full file content>
    === END FILE ===

Edits to a long existing file (instead of the full file):
    === EDIT: relative/path.ext ===
    <<<<<<< OLD
    exact existing text (must occur exactly once)
    =======
    replacement text
    >>>>>>> NEW
    (more OLD/NEW pairs allowed)
    === END EDIT ===

Usage: python3 scripts/deepseek_apply.py drop/deepseek/<task>/roundN.txt
Only paths under apps/, packages/, server/, scripts/, docs/ or src/ are accepted; nothing outside the repo.
Prints the list of files written. Standard library only.
"""
import pathlib
import re
import sys

ALLOWED = ("apps/", "packages/", "server/", "scripts/", "docs/", "src/", "build/", "tests/")
BLOCK = re.compile(r"^=== FILE: (?P<path>[^\n]+?) ===\n(?P<body>.*?)\n=== END FILE(?: ===)?[ \t]*$", re.M | re.S)

EDIT = re.compile(r"^=== EDIT: (?P<path>[^\n]+?) ===\n(?P<body>.*?)\n=== END EDIT(?: ===)?[ \t]*$", re.M | re.S)
PAIR = re.compile(r"^<<<<<<< OLD\n(?P<old>.*?)\n=======\n(?P<new>.*?)\n?>>>>>>> NEW[ \t]*$", re.M | re.S)


def safe_target(root: pathlib.Path, rel: str):
    target = (root / rel).resolve()
    if not rel.startswith(ALLOWED) or root not in target.parents:
        print(f"REFUSED (outside allowed folders): {rel}")
        return None
    return target


def apply_edits(root: pathlib.Path, text: str) -> tuple[list, list]:
    """Apply every OLD/NEW pair in order; a pair whose OLD is missing or not unique is reported, not applied."""
    written, failed = [], []
    for m in EDIT.finditer(text):
        rel = m.group("path").strip().strip("`")
        target = safe_target(root, rel)
        if target is None or not target.exists():
            failed.append(f"{rel}: file missing or refused")
            continue
        src = target.read_text(encoding="utf-8")
        for i, pair in enumerate(PAIR.finditer(m.group("body")), 1):
            old, new = pair.group("old"), pair.group("new")
            n = src.count(old)
            if n != 1:
                failed.append(f"{rel} edit {i}: OLD found {n} times: {old[:80]!r}")
                continue
            src = src.replace(old, new, 1)
        target.write_text(src, encoding="utf-8")
        written.append(rel)
    return written, failed


def main(answer_path: str) -> None:
    text = pathlib.Path(answer_path).read_text(encoding="utf-8")
    root = pathlib.Path.cwd().resolve()
    written = []
    for m in BLOCK.finditer(text):
        rel = m.group("path").strip().strip("`")
        target = (root / rel).resolve()
        if not rel.startswith(ALLOWED) or root not in target.parents:
            print(f"REFUSED (outside allowed folders): {rel}")
            continue
        body = m.group("body")
        # DeepSeek sometimes wraps the body in a Markdown fence; strip one outer fence.
        fence = re.match(r"^```[\w-]*\n(.*)\n```\s*$", body, re.S)
        if fence:
            body = fence.group(1)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(body.rstrip("\n") + "\n", encoding="utf-8")
        written.append(rel)
    edited, failed = apply_edits(root, text)
    written += edited
    if not written:
        sys.exit("No file blocks found")
    print("\n".join(written))
    if failed:
        print("FAILED EDITS:\n" + "\n".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1])
