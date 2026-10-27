#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""G2 emulator acceptance test for Guardian: start -> block -> allow -> stop (app) -> start -> stop (notification).

  1. Install the APK, allow the VPN consent with `appops set ... ACTIVATE_VPN allow` (stands in for the
     user's tap on the system consent dialog), grant POST_NOTIFICATIONS on API 33+, turn Private DNS off
     (with it on, Android may send DNS over TLS and bypass a local DNS VPN; the app shows a hint for that).
  2. Tap "Start": the status must read "Status: Running" and the service must be a foreground service.
  3. `ping` from adb shell resolves a listed tracker domain: it must resolve to 0.0.0.0 (Guardian's
     NULL_IP answer) and the app's log must show "BLOCK <domain>".
  4. `ping` resolves example.com: it must get a real address (forwarded to the network's own resolver)
     and the app's log must show "ALLOW example.com".
  5. Tap "Stop" in the app: status "Stopped", service gone, no VPN network left.
  6. Start again, then press Home and use the notification's "Stop" action: the service must stop.
  7. No crash for the app in the crash log at any point.

Usage: emulator_flow.py <guardian.apk>. Screens, UI dumps and logcat go to /tmp/guardian-flow.
"""
import pathlib, re, subprocess, sys, time
import xml.etree.ElementTree as ET

PKG = "org.secureinchat.guardian"
BLOCKED = "doubleclick.net"   # first entry of app/src/main/assets/blocklist.txt
ALLOWED = "example.com"
OUT = pathlib.Path("/tmp/guardian-flow")
OUT.mkdir(parents=True, exist_ok=True)
step_no = 0


def adb(*args, check=True, timeout=120):
    r = subprocess.run(["adb", *args], capture_output=True, text=True, timeout=timeout)
    if check and r.returncode != 0:
        raise SystemExit(f"adb {' '.join(args)} failed: {r.stdout}{r.stderr}")
    return (r.stdout + r.stderr).replace("\r", "")


def sh(cmd, check=True, timeout=120):
    return adb("shell", cmd, check=check, timeout=timeout)


def snap(name):
    global step_no
    step_no += 1
    sh("screencap -p /sdcard/flow.png", check=False)
    adb("pull", "/sdcard/flow.png", str(OUT / f"{step_no:02d}-{name}.png"), check=False)


def dump():
    for _ in range(4):
        sh("rm -f /sdcard/ui.xml", check=False)
        sh("uiautomator dump /sdcard/ui.xml", check=False)
        xml = sh("cat /sdcard/ui.xml", check=False)
        if "<?xml" in xml:
            root = ET.fromstring(xml[xml.index("<?xml"):].strip())
            return [(n.get("text") or "", n.get("content-desc") or "", n.get("bounds") or "", n.get("class") or "")
                    for n in root.iter("node")]
        time.sleep(1)
    raise SystemExit("uiautomator dump failed")


def joined(nodes):
    return "\n".join(t for t, _, _, _ in nodes)


def fail(msg, nodes=None):
    snap("FAIL")
    if nodes is not None:
        (OUT / "fail-ui.txt").write_text("\n".join(f"{t!r} {d!r} {b} {c}" for t, d, b, c in nodes))
    (OUT / "logcat.txt").write_text(adb("logcat", "-d", check=False))
    raise SystemExit("FAIL: " + msg)


def tap(bounds):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", bounds))
    sh(f"input tap {(x1 + x2) // 2} {(y1 + y2) // 2}")


def button(nodes, label):
    for t, d, b, c in nodes:
        if c.endswith("Button") and t.strip().lower() == label.lower() and b:
            return b
    return None


def wait_ui(pred, what, timeout=30):
    end = time.time() + timeout
    nodes = []
    while time.time() < end:
        nodes = dump()
        if pred(joined(nodes)):
            return nodes
        time.sleep(1)
    fail(what, nodes)


def service_running():
    out = sh(f"dumpsys activity services {PKG}", check=False)
    return "GuardianVpnService" in out and "isForeground=true" in out


def vpn_up():
    # The VPN's TUN interface (tun0, tun1, ...) exists only while a VPN is established.
    out = sh("ls /sys/class/net", check=False)
    return any(re.fullmatch(r"tun\d+", n.strip()) for n in out.split())


def crashes():
    out = adb("logcat", "-d", "-b", "crash", check=False)
    return [l for l in out.splitlines() if PKG in l]


def resolve(name, tries=6):
    """Returns the address ping printed for [name], or None. Retries: the upstream resolver is
    discovered asynchronously after the VPN starts, and netd caches negative answers briefly."""
    last = ""
    for i in range(tries):
        last = sh(f"ping -c 1 -W 2 {name}", check=False, timeout=30)
        m = re.search(r"PING \S+ \(([0-9a-fA-F:.]+)\)", last)
        if m:
            return m.group(1), last
        time.sleep(2 + i)
    return None, last


def launch():
    sh(f"am start -W -n {PKG}/.MainActivity")
    time.sleep(2)


def start_from_app():
    nodes = wait_ui(lambda s: "Status: " in s, "main screen did not appear")
    b = button(nodes, "Start")
    if not b:
        fail("no Start button", nodes)
    tap(b)
    nodes = wait_ui(lambda s: "Status: Running" in s, "status did not change to Running")
    end = time.time() + 15
    while time.time() < end and not service_running():
        time.sleep(1)
    if not service_running():
        fail("service is not a running foreground service", nodes)
    return nodes


def wait_stopped(what):
    end = time.time() + 20
    while time.time() < end:
        if not service_running() and not vpn_up():
            return
        time.sleep(1)
    fail(f"{what}: service or VPN still up")


def main():
    apk = sys.argv[1]
    api = int(sh("getprop ro.build.version.sdk").strip())
    print(f"API {api}")
    adb("logcat", "-c", check=False)
    adb("logcat", "-b", "crash", "-c", check=False)
    adb("install", "-r", "-g", apk)
    sh(f"appops set {PKG} ACTIVATE_VPN allow")
    if api >= 33:
        sh(f"pm grant {PKG} android.permission.POST_NOTIFICATIONS", check=False)
    sh("settings put global private_dns_mode off", check=False)

    # Before Guardian runs: the tracker domain must not already resolve to 0.0.0.0 (otherwise step 3 proves nothing).
    pre, pre_out = resolve(BLOCKED, tries=2)
    print(f"before: {BLOCKED} -> {pre}")
    if pre in ("0.0.0.0", "127.0.0.1", "::"):
        fail(f"{BLOCKED} already resolves to {pre} without Guardian: {pre_out}")

    # 2. Start
    launch()
    snap("start-screen")
    start_from_app()
    if not vpn_up():
        time.sleep(3)
    if not vpn_up():
        fail("no VPN network after start")
    snap("running")
    print("ok: running, foreground service, VPN network up")

    # 3. Blocked domain
    addr, out = resolve(BLOCKED)
    print(f"guardian: {BLOCKED} -> {addr}")
    # iputils ping replaces a 0.0.0.0 destination with 127.0.0.1 before printing it, so both mean
    # Guardian's NULL_IP answer; the "before" check above showed a real address without Guardian.
    if addr not in ("0.0.0.0", "127.0.0.1"):
        fail(f"{BLOCKED} should resolve to 0.0.0.0 through Guardian, got {addr}: {out}")
    nodes = wait_ui(lambda s: f"BLOCK {BLOCKED}" in s, f"log does not show BLOCK {BLOCKED}")
    print(f"ok: {BLOCKED} blocked (0.0.0.0) and logged")

    # 4. Allowed domain is forwarded to the network's resolver
    addr, out = resolve(ALLOWED)
    print(f"guardian: {ALLOWED} -> {addr}")
    if addr is None or addr in ("0.0.0.0", "127.0.0.1", "::"):
        fail(f"{ALLOWED} should resolve to a real address through Guardian, got {addr}: {out}")
    nodes = wait_ui(lambda s: f"ALLOW {ALLOWED}" in s and re.search(r"Answered: [1-9]", s),
                    f"log does not show ALLOW {ALLOWED} with an answered query")
    snap("block-and-allow")
    print(f"ok: {ALLOWED} forwarded and answered")

    # 5. Stop from the app
    b = button(nodes, "Stop")
    if not b:
        fail("no Stop button", nodes)
    tap(b)
    wait_ui(lambda s: "Status: Stopped" in s, "status did not change to Stopped")
    wait_stopped("stop from app")
    snap("stopped-app")
    print("ok: stopped from the app")

    # 6. Start again, stop from the notification
    start_from_app()
    sh("input keyevent KEYCODE_HOME")
    time.sleep(1)
    sh("cmd statusbar expand-notifications", check=False)
    time.sleep(2)
    nodes = dump()
    b = button(nodes, "Stop")
    if not b:
        # Low-importance notifications can be collapsed; expand ours by swiping down on its title.
        for t, d, bounds, c in nodes:
            if t == "Guardian" and bounds:
                x1, y1, x2, y2 = map(int, re.findall(r"\d+", bounds))
                sh(f"input swipe {(x1 + x2) // 2} {y1} {(x1 + x2) // 2} {y1 + 400} 300")
                time.sleep(2)
                break
        nodes = dump()
        b = button(nodes, "Stop")
    if not b:
        fail("notification Stop action not found", nodes)
    snap("notification")
    tap(b)
    wait_stopped("stop from notification")
    sh("cmd statusbar collapse", check=False)
    print("ok: stopped from the notification")

    # 7. No crash
    c = crashes()
    if c:
        (OUT / "crash.txt").write_text(adb("logcat", "-d", "-b", "crash", check=False))
        fail("crash log has entries for the app: " + c[0])
    (OUT / "logcat.txt").write_text(adb("logcat", "-d", check=False))
    print("guardian flow: PASS")


if __name__ == "__main__":
    main()
