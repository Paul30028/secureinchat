"""Apply a DeepSeek answer written in the agreed file-block format.

Format (required in every spec):
    === FILE: relative/path.ext ===
    <full file content>
    === END FILE ===

Usage: python3 scripts/deepseek_apply.py drop/deepseek/<task>/roundN.txt
Only paths under apps/, packages/, server/, scripts/, docs/ or src/ are accepted; nothing outside the repo.
Prints the list of files written. Standard library only.
"""
import pathlib
import re
import sys

ALLOWED = ("apps/", "packages/", "server/", "scripts/", "docs/", "src/", "build/", "tests/")
BLOCK = re.compile(r"^=== FILE: (?P<path>[^\n]+?) ===\n(?P<body>.*?)\n=== END FILE ===$", re.M | re.S)


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
    if not written:
        sys.exit("No file blocks found")
    print("\n".join(written))


if __name__ == "__main__":
    main(sys.argv[1])
