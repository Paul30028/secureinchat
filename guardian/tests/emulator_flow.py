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
BLOCKED = "doubleclick.net"   # from app/src/main/assets/blocklist-extra.txt
BLOCKED_HAGEZI = "bat.bing.com"   # from the bundled HaGeZi LIGHT snapshot, not in the extra list
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
    # The app refreshes its screen every second, so uiautomator can miss its idle window; retry generously.
    msg = ""
    for _ in range(12):
        sh("rm -f /sdcard/ui.xml", check=False)
        msg = sh("uiautomator dump /sdcard/ui.xml", check=False, timeout=60)
        xml = sh("cat /sdcard/ui.xml", check=False)
        if "<?xml" in xml:
            root = ET.fromstring(xml[xml.index("<?xml"):].strip())
            return [(n.get("text") or "", n.get("content-desc") or "", n.get("bounds") or "", n.get("class") or "")
                    for n in root.iter("node")]
        time.sleep(2)
    snap("dump-failed")
    (OUT / "logcat.txt").write_text(adb("logcat", "-d", check=False))
    raise SystemExit("uiautomator dump failed: " + msg.strip()[-300:])


def joined(nodes):
    return "\n".join(t for t, _, _, _ in nodes)


def fail(msg, nodes=None):
    snap("FAIL")
    if nodes is not None:
        # Also print the visible text, so a failure can be read from the job log without the artifact.
        print("---- screen text at failure ----\n" + joined(nodes)[:4000] + "\n---- end ----")
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


_screen = None


def screen_size():
    """(width, height) from `wm size`; swipes must start inside the screen or they do nothing."""
    global _screen
    if _screen is None:
        out = sh("wm size", check=False)
        m = re.findall(r"(\d+)x(\d+)", out)
        _screen = tuple(map(int, m[-1])) if m else (720, 1280)
    return _screen


def swipe_up(fraction=0.4):
    """Scrolls the content down by about [fraction] of the screen height."""
    w, h = screen_size()
    x, y1, y2 = w // 2, int(h * 0.75), int(h * (0.75 - fraction))
    sh(f"input swipe {x} {y1} {x} {y2} 400", check=False)


def scroll_find(pred, what, tries=6):
    """Dumps the screen, scrolling down between attempts, until pred(joined text) holds.
    The per-app list sits below the log, so it can be off-screen on small emulator displays."""
    for i in range(tries):
        nodes = dump()
        if pred(joined(nodes)):
            return nodes
        swipe_up()
        time.sleep(1)
    fail(what, nodes)


def scroll_top():
    w, h = screen_size()
    for _ in range(5):
        sh(f"input swipe {w // 2} {int(h * 0.3)} {w // 2} {int(h * 0.8)} 300", check=False)
    time.sleep(1)


def button_on_row(nodes, label, row_text_prefix):
    """The button labelled [label] whose vertical centre lies inside the text node starting with
    row_text_prefix (each domain row is a horizontal layout: text, then its button)."""
    for rt, _, row, _ in nodes:
        if not (rt.startswith(row_text_prefix) and row):
            continue
        _, ry1, _, ry2 = map(int, re.findall(r"\d+", row))
        for t, _, b, c in nodes:
            if c.endswith("Button") and t.strip().lower() == label.lower() and b:
                _, y1, _, y2 = map(int, re.findall(r"\d+", b))
                if y1 <= (ry1 + ry2) // 2 <= y2:
                    return b
    return None


def hide_keyboard():
    """Closes the soft keyboard if it is up. Swipes that start on the keyboard do not scroll the app,
    so lists below the input field stay out of reach while it is shown. Back with no keyboard would
    leave the app, so check first."""
    for _ in range(2):
        if not re.search(r"mInputShown=true", sh("dumpsys input_method", check=False)):
            return
        sh("input keyevent 4", check=False)
        time.sleep(1)


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
    addr, out = resolve(BLOCKED_HAGEZI)
    print(f"guardian: {BLOCKED_HAGEZI} -> {addr}")
    if addr not in ("0.0.0.0", "127.0.0.1"):
        fail(f"{BLOCKED_HAGEZI} (HaGeZi snapshot) should be blocked, got {addr}: {out}")
    wait_ui(lambda s: f"BLOCK {BLOCKED_HAGEZI}" in s, f"log does not show BLOCK {BLOCKED_HAGEZI}")
    print(f"ok: {BLOCKED_HAGEZI} blocked from the bundled snapshot")

    # 4. Allowed domain is forwarded to the network's resolver
    addr, out = resolve(ALLOWED)
    print(f"guardian: {ALLOWED} -> {addr}")
    if addr is None or addr in ("0.0.0.0", "127.0.0.1", "::"):
        fail(f"{ALLOWED} should resolve to a real address through Guardian, got {addr}: {out}")
    nodes = wait_ui(lambda s: f"ALLOW {ALLOWED}" in s and re.search(r"Answered: [1-9]", s),
                    f"log does not show ALLOW {ALLOWED} with an answered query")
    snap("block-and-allow")
    print(f"ok: {ALLOWED} forwarded and answered")

    # 4b. "Blocked most often" list and the user's allowlist (G3b): allow doubleclick.net from its row,
    #     check a not-yet-cached subdomain now resolves for real, then remove the rule again.
    # Match the list row itself ("doubleclick.net (2)"), not the log line "doubleclick.net (type 1)".
    dom_row = re.compile(rf"^{re.escape(BLOCKED)} \(\d+\)$", re.M)
    nodes = scroll_find(lambda s: dom_row.search(s), f"'Blocked most often' does not list {BLOCKED}")
    b = button_on_row(nodes, "Allow", f"{BLOCKED} (")
    if not b:
        # The row may sit at the bottom edge with its button cut off; scroll a little and look again.
        swipe_up(0.15)
        time.sleep(1)
        nodes = dump()
        b = button_on_row(nodes, "Allow", f"{BLOCKED} (")
    if not b:
        fail(f"no Allow button on the {BLOCKED} row", nodes)
    tap(b)
    allowed_row = re.compile(rf"^{re.escape(BLOCKED)}$", re.M)
    nodes = scroll_find(lambda s: allowed_row.search(s), f"'Allowed by you' does not list {BLOCKED}")
    snap("allowed-by-user")
    probe = "www." + BLOCKED
    addr, out = resolve(probe)
    print(f"guardian after Allow: {probe} -> {addr}")
    if addr is None or addr in ("0.0.0.0", "127.0.0.1", "::"):
        fail(f"{probe} should resolve for real after allowing {BLOCKED}, got {addr}: {out}")
    nodes = scroll_find(lambda s: allowed_row.search(s), f"'Allowed by you' does not list {BLOCKED}")
    b = button_on_row(nodes, "Remove", BLOCKED)
    if not b:
        fail(f"no Remove button on the {BLOCKED} allowlist row", nodes)
    tap(b)
    scroll_top()
    wait_ui(lambda s: "0 allowed by you" in s, "rules line does not return to 0 allowed by you")
    probe2 = "googleads.g." + BLOCKED
    addr, out = resolve(probe2)
    print(f"guardian after Remove: {probe2} -> {addr}")
    if addr not in ("0.0.0.0", "127.0.0.1"):
        fail(f"{probe2} should be blocked again after removing the rule, got {addr}: {out}")
    scroll_top()
    nodes = dump()
    print("ok: 'Blocked most often', Allow and Remove work")

    # 4c. Pause 5 minutes (G6): a blocked name resolves for real while paused, and is blocked again after Resume.
    nodes = dump()
    b = button(nodes, "Pause 5 min")
    if not b:
        fail("no 'Pause 5 min' button while running", nodes)
    tap(b)
    nodes = wait_ui(lambda s: "Status: Paused until" in s, "status did not change to 'Paused until'")
    probe3 = "stats.g." + BLOCKED
    addr, out = resolve(probe3)
    print(f"guardian paused: {probe3} -> {addr}")
    if addr is None or addr in ("0.0.0.0", "127.0.0.1", "::"):
        fail(f"{probe3} should resolve for real while paused, got {addr}: {out}")
    wait_ui(lambda s: f"PAUSE {probe3}" in s, f"log does not show PAUSE {probe3}")
    nodes = dump()
    b = button(nodes, "Resume")
    if not b:
        fail("no Resume button while paused", nodes)
    tap(b)
    nodes = wait_ui(lambda s: "Status: Running" in s, "status did not return to Running after Resume")
    probe4 = "ad." + BLOCKED
    addr, out = resolve(probe4)
    print(f"guardian resumed: {probe4} -> {addr}")
    if addr not in ("0.0.0.0", "127.0.0.1"):
        fail(f"{probe4} should be blocked again after Resume, got {addr}: {out}")
    print("ok: pause and resume work")

    # 4d. The user's own block list (G8): type a domain, Block, it resolves to the block address;
    #     Remove, and a not-yet-cached subdomain resolves for real again; then an invalid entry shows
    #     an error. The valid entry goes first, into the empty field: clearing a field over adb is
    #     unreliable (backspaces landed as stray text on API 29).
    user_dom = "example.org"

    def find_field():
        nodes = []
        for _ in range(6):
            nodes = dump()
            f = next((b for t, d, b, c in nodes if d == "Domain to block" and b), None)
            if f and button(nodes, "Block"):
                return f, nodes
            swipe_up()
            time.sleep(1)
        fail("no 'Domain to block' field with a Block button", nodes)

    field, nodes = find_field()
    tap(field)
    time.sleep(1)
    sh(f"input text {user_dom}")
    time.sleep(1)
    b = button(dump(), "Block")
    if not b:
        fail("Block button hidden after typing", dump())
    tap(b)
    time.sleep(1)
    hide_keyboard()
    blocked_row = re.compile(rf"^{re.escape(user_dom)}$", re.M)
    nodes = scroll_find(lambda s: blocked_row.search(s), f"'Blocked by you' does not list {user_dom}")
    snap("blocked-by-user")
    addr, out = resolve(user_dom)
    print(f"guardian after Block: {user_dom} -> {addr}")
    if addr not in ("0.0.0.0", "127.0.0.1"):
        fail(f"{user_dom} should be blocked after the user blocked it, got {addr}: {out}")
    nodes = scroll_find(lambda s: blocked_row.search(s), f"'Blocked by you' does not list {user_dom}")
    b = button_on_row(nodes, "Remove", user_dom)
    if not b:
        fail(f"no Remove button on the {user_dom} row", nodes)
    tap(b)
    scroll_top()
    wait_ui(lambda s: "0 blocked by you" in s, "rules line does not return to 0 blocked by you")
    probe5 = "www." + user_dom
    addr, out = resolve(probe5)
    print(f"guardian after Remove: {probe5} -> {addr}")
    if addr is None or addr in ("0.0.0.0", "127.0.0.1", "::"):
        fail(f"{probe5} should resolve for real after removing the user block, got {addr}: {out}")

    field, nodes = find_field()
    tap(field)
    time.sleep(1)
    sh("input text not_a_domain")
    time.sleep(1)
    tap(button(dump(), "Block"))
    # The error line sits just below the input row, often under the bottom edge: scroll to it.
    time.sleep(1)
    hide_keyboard()
    scroll_find(lambda s: "Not a valid domain" in s, "invalid domain did not show 'Not a valid domain'")
    hide_keyboard()
    scroll_top()
    nodes = dump()
    print("ok: user block list works")

    # 4e. Always-on VPN (G9): the status area reports "Always-on: Off" (API 29+), and the button opens
    #     the system VPN settings; Back returns to Guardian, still running.
    wait_ui(lambda s: "Always-on: Off" in s, "status area does not show 'Always-on: Off'")
    nodes = scroll_find(lambda s: "Always-on VPN settings" in s, "no 'Always-on VPN settings' button", tries=10)
    b = button(nodes, "Always-on VPN settings")
    if not b:
        swipe_up(0.15)
        time.sleep(1)
        nodes = dump()
        b = button(nodes, "Always-on VPN settings")
    if not b:
        fail("'Always-on VPN settings' button not tappable", nodes)
    tap(b)
    top = ""
    for _ in range(10):
        time.sleep(1)
        out = sh("dumpsys activity activities", check=False)
        m = re.search(r"(?:mResumedActivity|topResumedActivity|ResumedActivity)[^\n]*?\{[^}]*?\s(\S+/\S+)", out)
        top = m.group(1) if m else ""
        if top.startswith("com.android.settings"):
            break
    print(f"guardian: resumed after Always-on button -> {top}")
    if not top.startswith("com.android.settings"):
        fail(f"Always-on button did not open system settings (resumed: {top!r})")
    snap("vpn-settings")
    sh("input keyevent 4")  # Back
    time.sleep(2)
    scroll_top()
    nodes = wait_ui(lambda s: "Status: Running" in s, "Guardian not running after returning from VPN settings")
    print("ok: Always-on row and VPN settings button work")

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

    # 6b. Quick Settings tile (G5): start and stop without opening the app. The VPN is already authorised.
    tile = f"{PKG}/.GuardianTileService"
    sh(f"cmd statusbar add-tile {tile}", check=False)
    time.sleep(1)
    sh(f"cmd statusbar click-tile {tile}", check=False)
    end = time.time() + 30
    while time.time() < end and not (service_running() and vpn_up()):
        time.sleep(1)
    if not (service_running() and vpn_up()):
        fail("tile click did not start the VPN")
    print("ok: started from the Quick Settings tile")
    time.sleep(2)
    sh(f"cmd statusbar click-tile {tile}", check=False)
    wait_stopped("stop from tile")
    sh("cmd statusbar collapse", check=False)
    print("ok: stopped from the Quick Settings tile")

    # 7. No crash
    c = crashes()
    if c:
        (OUT / "crash.txt").write_text(adb("logcat", "-d", "-b", "crash", check=False))
        fail("crash log has entries for the app: " + c[0])
    (OUT / "logcat.txt").write_text(adb("logcat", "-d", check=False))
    print("guardian flow: PASS")


if __name__ == "__main__":
    main()
