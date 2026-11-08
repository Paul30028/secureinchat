#!/usr/bin/env python3
"""End-to-end test for the SecureInChat Opt-Out extension.

Loads the unpacked extension in Chromium, serves the two local fixtures over
self-signed HTTPS, runs the real content runner, and verifies that:

  * fields are filled on both mock sites;
  * the runner stops at pause / fake CAPTCHA / final submit;
  * the on-page banner appears;
  * the fake CAPTCHA and submit button are never touched;
  * no request leaves 127.0.0.1:8765 (all others are blocked and recorded).

Run:  python tests/optout/e2e.py
If Chromium/Playwright cannot start in a sandbox, run it on a normal desktop.
"""

from __future__ import annotations

import datetime
import ipaddress
import json
import os
import shutil
import ssl
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
EXTENSION = ROOT / "extension" / "optout"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
RUNNER = EXTENSION / "content" / "runner.js"

HOST = "127.0.0.1"
PORT = 8765
BASE_URL = f"https://{HOST}:{PORT}"
BANNER_TEXT = "请你核对信息并亲自提交/完成验证"

PROFILE = {
    "fullName": "张三",
    "previousNames": ["张叁"],
    "city": "Austin",
    "state": "TX",
    "ageRange": "30-39",
    "phone": "+1 512 555 0100",
    "email": "zhangsan@example.test",
}


def make_cert(directory: Path) -> tuple[Path, Path]:
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "SecureInChat Opt-Out Test")])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=2))
        .add_extension(
            x509.SubjectAlternativeName([x509.IPAddress(ipaddress.ip_address(HOST))]),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )
    cert_path = directory / "cert.pem"
    key_path = directory / "key.pem"
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        )
    )
    return cert_path, key_path


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *args) -> None:
        return


def start_server(tmp: Path) -> ThreadingHTTPServer:
    cert_path, key_path = make_cert(tmp)
    handler = lambda *args, **kwargs: QuietHandler(  # noqa: E731
        *args, directory=str(FIXTURES), **kwargs
    )
    httpd = ThreadingHTTPServer((HOST, PORT), handler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return httpd


def local_url(url: str) -> bool:
    if url.startswith(("chrome-extension://", "chrome://", "about:", "data:", "blob:")):
        return True
    parsed = urlparse(url)
    return parsed.scheme == "https" and parsed.hostname == HOST and parsed.port == PORT


def wait_for_worker(context, timeout: float = 20.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if context.service_workers:
            return context.service_workers[0]
        time.sleep(0.1)
    try:
        return context.wait_for_event("serviceworker", timeout=5000)
    except Exception as exc:  # pragma: no cover - depends on host Chromium
        raise RuntimeError(
            "扩展 service worker 未启动。请确认使用带扩展支持的 Chromium，"
            "并尝试 OPTOUT_HEADLESS=0（有桌面会话时）。"
        ) from exc


def run_rule(page, url: str, rule: dict) -> dict:
    page.goto(url, wait_until="domcontentloaded")
    page.evaluate(
        "cfg => { window.__OPTOUT_CONFIG__ = cfg; }",
        {"rule": rule, "profile": PROFILE},
    )
    page.add_script_tag(path=str(RUNNER))
    page.wait_for_function(
        "window.__OPTOUT_RESULT__ && window.__OPTOUT_RESULT__.finishedAt",
        timeout=20000,
    )
    return page.evaluate("window.__OPTOUT_RESULT__")


def assert_banner(page) -> None:
    banner = page.locator('[data-sichat-optout="banner"]')
    assert banner.count() == 1, "提示条没有出现"
    assert BANNER_TEXT in banner.inner_text(), banner.inner_text()


def main() -> int:
    try:
        import playwright  # noqa: F401
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit("需要 Python Playwright：pip install playwright && playwright install chromium") from exc

    manifest = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["manifest_version"] == 3
    assert manifest["permissions"] == ["storage", "activeTab", "scripting"]
    assert manifest["optional_host_permissions"] == []
    assert "host_permissions" not in manifest, "本阶段不应有常驻站点权限"
    assert "content_security_policy" not in manifest, "使用 MV3 默认 CSP"
    assert "content_scripts" not in manifest, "按用户操作注入，不做常驻内容脚本"

    rules = json.loads((EXTENSION / "rules" / "demo.json").read_text(encoding="utf-8"))["rules"]
    rule_a, rule_b = rules[0], rules[1]
    url_a = f"{BASE_URL}/site-a.html"
    url_b = f"{BASE_URL}/site-b.html"

    external: list[str] = []
    run_root = Path(__file__).resolve().parent / ".run"
    run_root.mkdir(exist_ok=True)
    tmp = run_root / f"e2e-{os.getpid()}-{int(time.time())}"
    tmp.mkdir()

    def guard(route):
        if local_url(route.request.url):
            route.continue_()
        else:
            external.append(route.request.url)
            route.abort()

    httpd = None
    context = None
    try:
        httpd = start_server(tmp)
        with sync_playwright() as playwright:
            headless = os.environ.get("OPTOUT_HEADLESS", "0") == "1"
            options = {
                "headless": headless,
                "ignore_https_errors": True,
                "args": [
                    f"--disable-extensions-except={EXTENSION}",
                    f"--load-extension={EXTENSION}",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            }
            if headless:
                options["channel"] = "chromium"
            context = playwright.chromium.launch_persistent_context(
                str(tmp / "profile"), **options
            )

            context.route("http://**/*", guard)
            context.route("https://**/*", guard)

            worker = wait_for_worker(context)
            extension_id = worker.url.split("/")[2]
            print(f"extension loaded: {extension_id}")

            popup = context.new_page()
            popup.goto(f"chrome-extension://{extension_id}/popup.html")
            popup.wait_for_selector("#gate-title")
            assert popup.text_content("#gate-title").strip() in ("设置口令", "解锁资料库")
            popup.close()

            page_a = context.new_page()
            page_a.on(
                "request",
                lambda request: (
                    external.append(request.url) if not local_url(request.url) else None
                ),
            )
            result_a = run_rule(page_a, url_a, rule_a)
            assert result_a["status"] == "filled-awaiting-user", result_a
            assert result_a["reason"] == "pause", result_a
            assert result_a["filled"] == ["fullName", "city", "state", "email"], result_a
            assert page_a.input_value("#search-name") == PROFILE["fullName"]
            assert page_a.input_value("#city") == PROFILE["city"]
            assert page_a.input_value("#state") == PROFILE["state"]
            assert page_a.input_value("#email") == PROFILE["email"]
            assert page_a.evaluate("window.__submitted") is False
            assert_banner(page_a)
            print("site-a: filled, stopped before submit, banner present")

            page_b = context.new_page()
            page_b.on(
                "request",
                lambda request: (
                    external.append(request.url) if not local_url(request.url) else None
                ),
            )
            result_b = run_rule(page_b, url_b, rule_b)
            assert result_b["status"] == "filled-awaiting-user", result_b
            assert result_b["reason"] == "captcha", result_b
            assert page_b.input_value("#full-name") == PROFILE["fullName"]
            assert page_b.input_value("#email") == PROFILE["email"]
            assert page_b.locator("#captcha-checkbox").is_checked() is False
            assert page_b.evaluate("window.__captchaTouched") is False
            assert page_b.evaluate("window.__submitted") is False
            assert_banner(page_b)
            print("site-b: captcha untouched, submit untouched, banner present")

            # Defence in depth: even a bad rule that clicks the final submit
            # must be stopped by the runner, not obeyed.
            submit_rule = json.loads(json.dumps(rule_b))
            submit_rule["needs"] = []
            submit_rule["steps"] = [
                {"action": "fill", "selector": "#full-name", "field": "fullName"},
                {"action": "fill", "selector": "#email", "field": "email"},
                {"action": "click", "selector": "#final-submit", "note": "最终提交"},
            ]
            result_submit = run_rule(page_b, url_b, submit_rule)
            assert result_submit["status"] == "filled-awaiting-user", result_submit
            assert result_submit["reason"] == "final-submit", result_submit
            assert page_b.evaluate("window.__submitted") is False
            assert_banner(page_b)
            print("site-b: final submit click refused by runner")

            captcha_rule = json.loads(json.dumps(rule_b))
            captcha_rule["needs"] = []
            captcha_rule["steps"] = [
                {"action": "fill", "selector": "#full-name", "field": "fullName"},
                {"action": "click", "selector": "#captcha-checkbox", "note": "CAPTCHA"},
            ]
            result_captcha = run_rule(page_b, url_b, captcha_rule)
            assert result_captcha["reason"] == "captcha", result_captcha
            assert page_b.evaluate("window.__captchaTouched") is False
            assert page_b.evaluate("window.__submitted") is False
            assert_banner(page_b)
            print("site-b: captcha click refused by runner")

            assert external == [], f"发现对外请求：{external[:5]}"
            print("network: no external requests")

        print("E2E OK")
        return 0
    finally:
        if context is not None:
            try:
                context.close()
            except Exception:
                pass
        if httpd is not None:
            httpd.shutdown()
            httpd.server_close()
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
