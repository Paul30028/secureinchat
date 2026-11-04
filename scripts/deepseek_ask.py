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


MAX_CONTINUATIONS = 6


def call(messages: list) -> dict:
    body = json.dumps({
        "model": os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"),
        "messages": messages,
        "max_tokens": int(os.environ.get("DEEPSEEK_MAX_TOKENS", "8192")),
        "stream": False,
    }).encode()
    req = urllib.request.Request(API, data=body, headers={
        "Authorization": f"Bearer {os.environ['DEEPSEEK_API_KEY']}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=1500) as resp:
        return json.load(resp)


def ask(spec_text: str) -> tuple[str, dict]:
    """Ask once; if the reply is cut off by the output limit, ask it to continue and join the parts."""
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": spec_text}]
    parts: list[str] = []
    usage: dict = {"prompt_tokens": 0, "completion_tokens": 0, "calls": 0}
    for _ in range(1 + MAX_CONTINUATIONS):
        result = call(messages)
        choice = result["choices"][0]
        parts.append(choice["message"]["content"])
        u = result.get("usage", {})
        usage["prompt_tokens"] += u.get("prompt_tokens", 0)
        usage["completion_tokens"] += u.get("completion_tokens", 0)
        usage["calls"] += 1
        if choice.get("finish_reason") != "length":
            break
        messages += [
            {"role": "assistant", "content": choice["message"]["content"]},
            {"role": "user", "content": "Continue exactly where you stopped. Do not repeat anything; start with the next character."},
        ]
    else:
        usage["truncated"] = True
    return "".join(parts), usage


def main(paths: list[str]) -> None:
    for p in paths:
        spec = pathlib.Path(p)
        task = spec.stem
        out_dir = pathlib.Path("drop/deepseek") / task
        out_dir.mkdir(parents=True, exist_ok=True)
        n = 1
        while (out_dir / f"round{n}.txt").exists():
            n += 1
        try:
            answer, usage = ask(spec.read_text(encoding="utf-8"))
        except Exception as err:  # one failed task must not lose the answers of the others
            print(f"FAILED {p}: {err}")
            continue
        (out_dir / f"round{n}.txt").write_text(answer, encoding="utf-8")
        (out_dir / f"round{n}.usage.json").write_text(json.dumps(usage, indent=2), encoding="utf-8")
        print(f"{p} -> {out_dir}/round{n}.txt ({len(answer)} chars)")


if __name__ == "__main__":
    main(sys.argv[1:])
