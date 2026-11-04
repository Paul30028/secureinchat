"""Send each spec file to the DeepSeek chat API and save the answer.

Usage: python3 scripts/deepseek_ask.py drop/claude/<task>.txt [...]
Writes drop/deepseek/<task>/roundN.txt (N = next free number) plus a .usage.json with token counts.
Standard library only (no third-party dependencies).
"""
import json
import os
import pathlib
import sys
import urllib.request

API = "https://api.deepseek.com/chat/completions"
SYSTEM = (
    "You are a software engineer on the SecureInChat project. Follow the spec exactly. "
    "Output every file: new files in full; changes to existing files as 'anchor (verbatim, unique) -> replacement' snippets. "
    "Include tests. Keep the code comments. Do not add third-party dependencies."
)


def ask(spec_text: str) -> dict:
    body = json.dumps({
        "model": os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"),
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": spec_text}],
        "stream": False,
    }).encode()
    req = urllib.request.Request(API, data=body, headers={
        "Authorization": f"Bearer {os.environ['DEEPSEEK_API_KEY']}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=1500) as resp:
        return json.load(resp)


def main(paths: list[str]) -> None:
    for p in paths:
        spec = pathlib.Path(p)
        task = spec.stem
        out_dir = pathlib.Path("drop/deepseek") / task
        out_dir.mkdir(parents=True, exist_ok=True)
        n = 1
        while (out_dir / f"round{n}.txt").exists():
            n += 1
        result = ask(spec.read_text(encoding="utf-8"))
        answer = result["choices"][0]["message"]["content"]
        (out_dir / f"round{n}.txt").write_text(answer, encoding="utf-8")
        (out_dir / f"round{n}.usage.json").write_text(json.dumps(result.get("usage", {}), indent=2), encoding="utf-8")
        print(f"{p} -> {out_dir}/round{n}.txt ({len(answer)} chars)")


if __name__ == "__main__":
    main(sys.argv[1:])
