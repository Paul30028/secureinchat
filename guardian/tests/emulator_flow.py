#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""G2 emulator acceptance test for Guardian: start -> block -> allow -> stop (app) -> start -> stop (notification).

  1. Install the APK, allow the VPN consent with `appops set ... ACTIVATE_VPN allow` (stands in for the
     user's tap on the system consent dialog), grant POST_NOTIFICATIONS on API 33+, turn Private DNS off
     (with it on, Android may send DNS over TLS and bypass a local DNS VPN; the app shows a hint for that).
  2. Dismiss the first-run introduction, tap "Turn on" on the Protect tab: it must read "Protection is on" and the service must be a foreground service. (U2: four tabs; each step first taps the tab it needs.)
  3. `ping` from adb shell resolves a listed tracker domain: it must resolve to 0.0.0.0 (Guardian's
     NULL_IP answer) and the app's log must show "BLOCK <domain>".
  4. `ping` resolves example.com: it must get a real address (forwarded to the network's own resolver)
     and the app's log must show "ALLOW example.com".
  5. Tap "Stop" in the app: status "Stopped", service gone, no VPN network left.
  6. Start again, then press Home and use the notification's "Stop" action: the service must stop.
  7. No crash for the app in the crash log at any point.

Usage: emulator_flow.py <guardian.apk>. Screens, UI dumps and logcat go to /tmp/guardian-flow.
"""
import pathlib, re, socket, subprocess, sys, time
import xml.etree.ElementTree as ET

PKG = "org.secureinchat.guardian"
BLOCKED = "doubleclick.net"   # from app/src/main/assets/blocklist-extra.txt
BLOCKED_HAGEZI = "bat.bing.com"   # from the bundled HaGeZi LIGHT snapshot, not in the extra list
ALLOWED = "example.com"
ROOT = pathlib.Path(__file__).resolve().parent.parent   # guardian/
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


def ui_has(pred, timeout):
    """Like wait_ui, but returns None instead of failing."""
    end = time.time() + timeout
    while time.time() < end:
        nodes = dump()
        if pred(joined(nodes)):
            return nodes
        time.sleep(1)
    return None


def wait_block_logged(name):
    """The on-screen log keeps only the last 10 lines, and the emulator's own background queries can
    push a line out before we look (seen on API 34). Blocking itself is proven by the DNS answer;
    this checks that blocks are logged. If [name]'s line is gone, query a fresh subdomain (netd would
    answer a repeat of [name] from its cache, so it would never reach Guardian) and look for that."""
    show_live_log()
    nodes = find_quiet(lambda s: f"BLOCK {name}" in s, 15)
    if nodes:
        return nodes
    for i in range(3):
        probe = f"logcheck{i}-{int(time.time())}.{name}"
        addr, out = resolve(probe)
        if addr not in ("0.0.0.0", "127.0.0.1"):
            fail(f"{probe} should be blocked like {name}, got {addr}: {out}")
        nodes = find_quiet(lambda s: f"BLOCK {probe}" in s, 10)
        if nodes:
            print(f"note: {name} line had scrolled out of the log; {probe} was logged")
            return nodes
    fail(f"log does not show BLOCK {name} (nor a fresh subdomain of it)", dump())


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


def find_anywhere(pred, what, timeout=45, swipes=6):
    """Like scroll_find, but keeps going from the top until [timeout]: for text that appears only
    after a throttled rebuild (the 'Blocked most often' rows refresh at most every 5 s)."""
    end = time.time() + timeout
    nodes = []
    while time.time() < end:
        scroll_top()
        for _ in range(swipes):
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
    """The button labelled [label] on the row whose text starts with row_text_prefix. Each row is a
    horizontal layout (texts, then the button, centred vertically), so the button's vertical span
    overlaps the row's first text line; rows do not overlap each other."""
    for rt, _, row, _ in nodes:
        if not (rt.startswith(row_text_prefix) and row):
            continue
        _, ry1, _, ry2 = map(int, re.findall(r"\d+", row))
        for t, _, b, c in nodes:
            if c.endswith("Button") and t.strip().lower() == label.lower() and b:
                _, y1, _, y2 = map(int, re.findall(r"\d+", b))
                if y1 <= ry2 and y2 >= ry1:
                    return b
    return None


# U2: the app has four tabs (bottom bar). Each bar cell's content-desc starts with the tab name.
STATUS_ON = "Protection is on"
STATUS_OFF = "Protection is off"
STATUS_PAUSED = "Paused until"


def goto(tab):
    nodes = []
    for _ in range(5):
        nodes = dump()
        cell = next((b for t, d, b, c in nodes if d.startswith(tab) and b), None)
        if cell:
            tap(cell)
            time.sleep(1)
            scroll_top()
            return dump()
        time.sleep(1)
    fail(f"no '{tab}' tab in the bottom bar", nodes)


def find_quiet(pred, timeout=15, swipes=6):
    """Like find_anywhere, but returns None instead of failing."""
    end = time.time() + timeout
    while time.time() < end:
        scroll_top()
        for _ in range(swipes):
            nodes = dump()
            if pred(joined(nodes)):
                return nodes
            swipe_up()
            time.sleep(1)
    return None


def show_live_log():
    """The live log in Activity starts folded (U2); open it once, it stays open for the session."""
    goto("Activity")
    nodes = find_quiet(lambda s: "Show live log" in s or "Hide live log" in s, timeout=20)
    if nodes is None:
        fail("no live log toggle in Activity", dump())
    b = button(nodes, "Show live log")
    if b:
        tap(b)
        time.sleep(1)


def type_into_field(desc, text, tries=3):
    """Taps the EditText with content-desc [desc] and types [text]; retries until the field shows it.
    On API 29 the first tap sometimes only brings up the keyboard without focusing the field."""
    nodes = []
    for _ in range(tries):
        nodes = dump()
        f = next((b for t, d, b, c in nodes if d == desc and b), None)
        if not f:
            swipe_up()
            time.sleep(1)
            continue
        tap(f)
        time.sleep(1.5)
        sh(f"input text {text}")
        time.sleep(1)
        nodes = dump()
        if any(d == desc and t == text for t, d, b, c in nodes):
            return nodes
    fail(f"could not type {text!r} into {desc!r}", nodes)


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
        try:
            last = sh(f"ping -c 1 -W 2 {name}", check=False, timeout=30)
        except subprocess.TimeoutExpired:
            # The lookup itself hung (Guardian did not answer in time): a result, not a crash of the flow.
            last = f"ping {name}: no answer within 30 s"
            continue
        m = re.search(r"PING \S+ \(([0-9a-fA-F:.]+)\)", last)
        if m:
            return m.group(1), last
        time.sleep(2 + i)
    return None, last


def launch():
    sh(f"am start -W -n {PKG}/.MainActivity")
    time.sleep(2)
    # U3: the first launch shows a one-screen introduction.
    nodes = dump()
    b = button(nodes, "Get started")
    if b:
        if "Welcome to Guardian" not in joined(nodes) or "What it does not do" not in joined(nodes):
            fail("introduction screen incomplete", nodes)
        snap("intro")
        tap(b)
        time.sleep(1)
        print("ok: introduction shown on first launch")


def start_from_app():
    # The status line is at the top; earlier steps (G13 level switch) may have left the page scrolled down.
    goto("Protect")
    nodes = wait_ui(lambda s: "Protection is" in s, "main screen did not appear")
    b = button(nodes, "Turn on")
    if not b:
        fail("no Turn on button", nodes)
    tap(b)
    time.sleep(1)
    scroll_top()
    nodes = wait_ui(lambda s: STATUS_ON in s, "status did not change to on")
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
    nodes = wait_block_logged(BLOCKED)
    print(f"ok: {BLOCKED} blocked (0.0.0.0) and logged")
    addr, out = resolve(BLOCKED_HAGEZI)
    print(f"guardian: {BLOCKED_HAGEZI} -> {addr}")
    if addr not in ("0.0.0.0", "127.0.0.1"):
        fail(f"{BLOCKED_HAGEZI} (HaGeZi snapshot) should be blocked, got {addr}: {out}")
    wait_block_logged(BLOCKED_HAGEZI)
    print(f"ok: {BLOCKED_HAGEZI} blocked from the bundled snapshot")

    # 4. Allowed domain is forwarded to the network's resolver
    addr, out = resolve(ALLOWED)
    print(f"guardian: {ALLOWED} -> {addr}")
    if addr is None or addr in ("0.0.0.0", "127.0.0.1", "::"):
        fail(f"{ALLOWED} should resolve to a real address through Guardian, got {addr}: {out}")
    # The real address already proves Guardian forwarded the query (it is the only DNS path while the VPN is
    # up). The on-screen log keeps only the last 10 lines and the emulator's own Google traffic can push the
    # line out within seconds, so the log line is a soft check; the answered counter is the hard one.
    show_live_log()
    nodes = find_anywhere(lambda s: re.search(r"Answered: [1-9]", s), "no answered query counted")
    if f"ALLOW {ALLOWED}" not in joined(nodes):
        print(f"note: ALLOW {ALLOWED} already scrolled out of the 10-line log (background traffic)")
    snap("block-and-allow")
    print(f"ok: {ALLOWED} forwarded and answered")

    # 4a2. G20 stalkerware server alert. Look up a subdomain of a listed C2 domain (a fresh name, so netd
    #      cannot answer from cache). It does not need to resolve: the lookup reaching Guardian is enough.
    #      Expect: a notification on the safety-alert channel, and the alert in the app. Read the test
    #      domain from the bundled list, so the test follows data updates.
    spy_rows = [l.split("\t") for l in (ROOT / "app/src/main/assets/stalkerware-echap.tsv").read_text().splitlines()
                if l and not l.startswith("#")]
    spy_domain, spy_app = next((r[0], r[1]) for r in spy_rows if r[2] == "stalkerware" and r[3] == "0")
    spy_probe = f"g20check-{int(time.time())}.{spy_domain}"
    try:
        sh(f"ping -c 1 -W 2 {spy_probe}", check=False, timeout=30)
    except subprocess.TimeoutExpired:
        pass
    deadline = time.time() + 30
    notif = ""
    while time.time() < deadline:
        notif = sh("dumpsys notification --noredact", check=False, timeout=60)
        if "guardian_safety_alerts" in notif and spy_app in notif:
            break
        time.sleep(2)
    else:
        fail(f"no safety-alert notification for {spy_probe} ({spy_app})")
    print(f"ok: stalkerware alert notification for {spy_app}")
    alert_title = f"An app contacted the servers of the stalkerware {spy_app}"
    goto("Check")
    find_anywhere(lambda s: alert_title in s, f"app does not show '{alert_title}'")
    snap("stalkerware-alert")
    print("ok: stalkerware alert shown in the app")
    goto("Protect")
    wait_ui(lambda s: "1 safety alert" in s, "Protect tab does not show the safety alert card")
    print("ok: Protect tab shows the safety alert card")
    goto("Activity")

    # 4b. "Blocked most often" list and the user's allowlist (G3b): allow doubleclick.net from its row,
    #     check a not-yet-cached subdomain now resolves for real, then remove the rule again.
    # Match the list row itself ("doubleclick.net (2)"), not the log line "doubleclick.net (type 1)".
    dom_row = re.compile(rf"^{re.escape(BLOCKED)} \(\d+\)$", re.M)
    nodes = scroll_find(lambda s: dom_row.search(s), f"'Blocked most often' does not list {BLOCKED}")
    # G11: the row says which rule blocked it. The query was the bare name, so the rule is the name.
    rule_builtin = f"Rule: {BLOCKED} (built-in list)"
    nodes = find_anywhere(lambda s: dom_row.search(s) and rule_builtin in s,
                          f"'Blocked most often' row lacks '{rule_builtin}'")
    print(f"ok: row shows '{rule_builtin}'")
    # G15: the row also names the tracker from the Exodus data. doubleclick.net maps to
    # "Google DoubleClick", whose category column is empty, so the line is the name alone.
    tracker_line = "Tracker: Google DoubleClick"
    nodes = find_anywhere(lambda s: dom_row.search(s) and tracker_line in s,
                          f"'Blocked most often' row lacks '{tracker_line}'")
    print(f"ok: row shows '{tracker_line}'")
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
    goto("Settings")
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
    scroll_find(lambda s: "0 allowed by you" in s, "rules line does not return to 0 allowed by you")
    probe2 = "googleads.g." + BLOCKED
    addr, out = resolve(probe2)
    print(f"guardian after Remove: {probe2} -> {addr}")
    if addr not in ("0.0.0.0", "127.0.0.1"):
        fail(f"{probe2} should be blocked again after removing the rule, got {addr}: {out}")
    print("ok: 'Blocked most often', Allow and Remove work")

    # 4c. Pause 5 minutes (G6): a blocked name resolves for real while paused, and is blocked again after Resume.
    nodes = goto("Protect")
    b = button(nodes, "Pause 5 min")
    if not b:
        fail("no 'Pause 5 min' button while running", nodes)
    tap(b)
    nodes = wait_ui(lambda s: STATUS_PAUSED in s, "status did not change to 'Paused until'")
    probe3 = "stats.g." + BLOCKED
    addr, out = resolve(probe3)
    print(f"guardian paused: {probe3} -> {addr}")
    if addr is None or addr in ("0.0.0.0", "127.0.0.1", "::"):
        fail(f"{probe3} should resolve for real while paused, got {addr}: {out}")
    goto("Activity")
    find_anywhere(lambda s: f"PAUSE {probe3}" in s, f"log does not show PAUSE {probe3}", timeout=30)
    nodes = goto("Protect")
    b = button(nodes, "Resume")
    if not b:
        fail("no Resume button while paused", nodes)
    tap(b)
    nodes = wait_ui(lambda s: STATUS_ON in s, "status did not return to on after Resume")
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
    goto("Settings")

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

    find_field()
    nodes = type_into_field("Domain to block", user_dom)
    b = button(nodes, "Block")
    if not b:
        fail("Block button hidden after typing", dump())
    tap(b)
    time.sleep(1)
    hide_keyboard()
    blocked_row = re.compile(rf"^{re.escape(user_dom)}$", re.M)
    nodes = scroll_find(lambda s: blocked_row.search(s), f"'Blocked by you' does not list {user_dom}")
    snap("blocked-by-user")
    # The rule reloads asynchronously and netd may still hold an earlier answer, so allow ~30 s.
    end = time.time() + 30
    while True:
        addr, out = resolve(user_dom)
        if addr in ("0.0.0.0", "127.0.0.1") or time.time() > end:
            break
        time.sleep(3)
    print(f"guardian after Block: {user_dom} -> {addr}")
    if addr not in ("0.0.0.0", "127.0.0.1"):
        fail(f"{user_dom} should be blocked after the user blocked it, got {addr}: {out}")
    # G11: the new "Blocked most often" row for it names the user's own rule.
    rule_user = f"Rule: {user_dom} (blocked by you)"
    goto("Activity")
    find_anywhere(lambda s: rule_user in s, f"'Blocked most often' has no '{rule_user}' line")
    snap("rule-blocked-by-you")
    print(f"ok: row shows '{rule_user}'")
    goto("Settings")
    nodes = scroll_find(lambda s: blocked_row.search(s), f"'Blocked by you' does not list {user_dom}")
    b = button_on_row(nodes, "Remove", user_dom)
    if not b:
        fail(f"no Remove button on the {user_dom} row", nodes)
    tap(b)
    scroll_top()
    scroll_find(lambda s: "0 blocked by you" in s, "rules line does not return to 0 blocked by you")
    # The row itself must go too (it once stayed: an empty list's signature equalled the reset value).
    sect = re.compile(r"Blocked by you(?:(?!Allowed by you)[\s\S]){0,400}?\(none\)")
    scroll_find(lambda s: sect.search(s) and not blocked_row.search(s),
                f"'Blocked by you' does not show (none) after removing {user_dom}", tries=8)
    scroll_top()
    probe5 = "www." + user_dom
    addr, out = resolve(probe5)
    print(f"guardian after Remove: {probe5} -> {addr}")
    if addr is None or addr in ("0.0.0.0", "127.0.0.1", "::"):
        fail(f"{probe5} should resolve for real after removing the user block, got {addr}: {out}")

    find_field()
    nodes = type_into_field("Domain to block", "not_a_domain")
    tap(button(nodes, "Block"))
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
    goto("Settings")
    scroll_find(lambda s: "Always-on: Off" in s, "Settings does not show 'Always-on: Off'", tries=10)
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
    goto("Protect")
    nodes = wait_ui(lambda s: STATUS_ON in s, "Guardian not running after returning from VPN settings")
    print("ok: Always-on row and VPN settings button work")

    # 4f. Export / import of your rules (G10): Export opens the system document picker (DocumentsUI);
    #     Back returns to Guardian, still running. Picking a file is not automated (no reliable adb
    #     route); the format itself is covered by RulesTextTest.
    goto("Settings")
    nodes = scroll_find(lambda s: "Export rules" in s, "no 'Export rules' button", tries=10)
    b = button(nodes, "Export rules")
    if not b:
        swipe_up(0.15)
        time.sleep(1)
        nodes = dump()
        b = button(nodes, "Export rules")
    if not b:
        fail("'Export rules' button not tappable", nodes)
    tap(b)
    top = ""
    for _ in range(10):
        time.sleep(1)
        out = sh("dumpsys activity activities", check=False)
        m = re.search(r"(?:mResumedActivity|topResumedActivity|ResumedActivity)[^\n]*?\{[^}]*?\s(\S+/\S+)", out)
        top = m.group(1) if m else ""
        if "documentsui" in top:
            break
    print(f"guardian: resumed after Export -> {top}")
    if "documentsui" not in top:
        fail(f"Export did not open the document picker (resumed: {top!r})")
    snap("export-picker")
    sh("input keyevent 4")  # Back: cancel the picker
    time.sleep(2)
    hide_keyboard()
    scroll_top()
    goto("Protect")
    nodes = wait_ui(lambda s: STATUS_ON in s, "Guardian not running after cancelling the export picker")
    print("ok: Export opens the document picker")

    # 4f2. G13 blocking strength. sentry.io is in HaGeZi Pro only: not in Light, not in Multi, and not in
    # blocklist-extra.txt (which loads on every level; scorecardresearch.com is there, so it is no test).
    # Subdomains are blocked by label-suffix matching; each step uses a fresh subdomain because netd caches.
    STRICT_ONLY = "sentry.io"

    def pick_level(prefix):
        goto("Settings")
        nodes = scroll_find(lambda s: prefix in s, f"no '{prefix}' option")
        for t, d, b, c in nodes:
            if c.endswith("RadioButton") and t.startswith(prefix) and b:
                tap(b)
                break
        else:
            fail(f"no radio button starting with '{prefix}'", nodes)
        time.sleep(1)
        # While the new tier loads, Protect shows "Loading list…"; "Protection is on" means it is in place.
        goto("Protect")
        wait_ui(lambda s: STATUS_ON in s and "Loading list" not in s,
                f"still loading after choosing {prefix}", timeout=90)

    # Judge by the DNS answer, not the 10-line log (background traffic pushes lines out): a blocked
    # name always gets the block address; a forwarded one gets a real address or no answer (NXDOMAIN).
    BLOCK_ADDRS = ("0.0.0.0", "127.0.0.1", "::")
    addr, out = resolve("g13a." + STRICT_ONLY, tries=2)
    if addr in BLOCK_ADDRS:
        fail(f"Light blocked g13a.{STRICT_ONLY} ({addr}); it is in Pro only")
    print(f"ok: Light forwards {STRICT_ONLY} ({addr})")

    pick_level("Strict")
    addr, out = resolve("g13b." + STRICT_ONLY)
    if addr not in BLOCK_ADDRS:
        fail(f"Strict did not block g13b.{STRICT_ONLY}: {addr} {out[-200:]}")
    goto("Activity")
    find_anywhere(lambda s: f"Rule: {STRICT_ONLY} (built-in list)" in s,
                  f"no 'Blocked most often' row with Rule: {STRICT_ONLY}")
    snap("level-strict")
    print(f"ok: Strict blocks {STRICT_ONLY}")

    pick_level("Light")
    addr, out = resolve("g13c." + STRICT_ONLY, tries=2)
    if addr in BLOCK_ADDRS:
        fail(f"back on Light, g13c.{STRICT_ONLY} still blocked ({addr})")
    print("ok: back to Light")
    scroll_top()

    # 4g. Encrypted DNS (G18): choose Quad9, a name not looked up before resolves for real and the
    #     status says "connected" (set only after a DoT answer came back); then back to Off.
    def radio(label_prefix):
        nodes = scroll_find(lambda s: any(l.startswith(label_prefix) for l in s.split("\n")),
                            f"no '{label_prefix}' option on screen")
        for txt_, _, bnds, cls in nodes:
            if cls.endswith("RadioButton") and txt_.startswith(label_prefix) and bnds:
                return bnds
        fail(f"'{label_prefix}' is not a radio button", nodes)

    # The emulator's traffic leaves through this host, so if the host cannot open TCP to Quad9's DoT
    # port, the step cannot pass for reasons that have nothing to do with Guardian. Say so instead of
    # failing (and instead of pretending it passed). The address comes from DotProviders.kt.
    providers = (ROOT / "core/src/main/kotlin/org/secureinchat/guardian/dns/DotProviders.kt").read_text()
    quad9_ip = re.search(r'id = "quad9".*?addresses = listOf\("([0-9.]+)"', providers, re.S).group(1)
    try:
        socket.create_connection((quad9_ip, 853), timeout=5).close()
        dot_reachable = True
    except OSError as e:
        dot_reachable = False
        print(f"UNTESTED: encrypted DNS step skipped, this CI host cannot reach {quad9_ip}:853 ({e})")
    if dot_reachable:
        goto("Settings")
        tap(radio("Quad9:"))
        time.sleep(2)
        dot_probe = "www.wikipedia.org"
        addr, out = resolve(dot_probe, tries=4)
        print(f"guardian with Quad9 DoT: {dot_probe} -> {addr}")
        if addr is None or addr in ("0.0.0.0", "127.0.0.1", "::"):
            nodes = find_anywhere(lambda s: "Encrypted DNS:" in s, "no encrypted DNS status line", timeout=20)
            status = [l for l in joined(nodes).split("\n") if l.startswith(("Encrypted DNS:", "Reason:"))]
            fail(f"{dot_probe} should resolve over DoT to Quad9, got {addr} ({out.strip()[-200:]}); "
                 f"status: {status}", nodes)
        find_anywhere(lambda s: "Encrypted DNS: Quad9, connected" in s,
                      "encrypted DNS status does not say 'Quad9, connected'")
        snap("dot-quad9")
        print("ok: Quad9 DoT answers and the status says connected")
        tap(radio("Off (default)"))
        find_anywhere(lambda s: "Encrypted DNS: off" in s, "encrypted DNS status does not return to off")
        goto("Protect")
        nodes = wait_ui(lambda s: STATUS_ON in s, "Guardian not running after turning encrypted DNS off")
        print("ok: encrypted DNS back to off")
    nodes = goto("Protect")

    # 5. Stop from the app
    b = button(nodes, "Turn off")
    if not b:
        fail("no Turn off button", nodes)
    tap(b)
    wait_ui(lambda s: STATUS_OFF in s, "status did not change to off")
    wait_stopped("stop from app")
    snap("stopped-app")
    print("ok: stopped from the app")

    # 5b. G12: stopping flushes the last interval, so today's durable count is above 0 even though
    # the 60 s timer may not have fired; then "Clear block history" resets the row to 0.
    m_hist = re.compile(r"Blocked today: (\d+) · last 7 days: (\d+)")
    goto("Activity")
    nodes = find_anywhere(lambda s: (lambda m: bool(m) and int(m.group(1)) > 0)(m_hist.search(s)),
                          "Blocked today stayed 0 after blocking and stopping")
    print("ok: " + m_hist.search(joined(nodes)).group(0))
    nodes = scroll_find(lambda s: "Clear block history" in s, "no Clear block history button")
    b = button(nodes, "Clear block history")
    if not b:
        fail("no Clear block history button", nodes)
    tap(b)
    find_anywhere(lambda s: "Blocked today: 0 · last 7 days: 0" in s, "history not cleared")
    snap("history-cleared")
    print("ok: Clear block history resets the row")

    # 5c. G16: the privacy checkup shows three rows. Each row has either a working button or a
    # "Search Settings" hint, never both. A button must leave Guardian, and Back must return.
    goto("Check")
    nodes = find_anywhere(lambda s: all(x in s for x in (
        "Privacy checkup", "Delete your advertising ID", "Precise location", "Review app permissions")),
        "privacy checkup rows missing")
    s = joined(nodes)
    if ("Open ad settings" in s) == ('Search Settings for "Ads"' in s):
        fail("ad row must show exactly one of button / search hint", nodes)
    b = button(nodes, "Open app settings") or button(nodes, "Open ad settings")
    if b:
        tap(b)
        time.sleep(3)
        top = sh("dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity'", check=False)
        if PKG + "/" in top:
            fail("privacy button did not leave Guardian: " + top.strip()[:200], nodes)
        sh("input keyevent 4")
        time.sleep(2)
        top = sh("dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity'", check=False)
        if PKG + "/" not in top:
            fail("Back did not return to Guardian: " + top.strip()[:200])
        print("ok: privacy checkup button opens system settings and Back returns")
    else:
        print("ok: privacy checkup rows shown (no button resolvable on this image)")
    scroll_top()

    # 6. Start again, stop from the notification
    start_from_app()
    sh("input keyevent KEYCODE_HOME")
    time.sleep(1)
    sh("cmd statusbar expand-notifications", check=False)
    time.sleep(2)
    nodes = dump()
    b = button(nodes, "Stop")
    if not b:
        # Low-importance notifications can be collapsed; expand ours by swiping down on its text. Not on
        # the first "Guardian" title: since G20 a safety-alert notification from step 4a2 sits above it.
        for t, d, bounds, c in nodes:
            if t in ("DNS filtering active", "Blocking ads and trackers") and bounds:
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
