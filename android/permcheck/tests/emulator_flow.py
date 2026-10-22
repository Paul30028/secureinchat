#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""T11 emulator flow test: drives the whole normal-mode change-record loop on an emulator with adb.

  1. A test-only app (tests/testtarget, no code) is granted CAMERA and READ_CALL_LOG.
  2. Permission Checkup scans; the test taps "Open settings" on the target's row.
  3. While Settings is open, `pm revoke` switches CAMERA off (standing in for the user's tap).
  4. Back in the app: the automatic recheck must show "Change record (1)" with "PermFlowTarget · CAMERA",
     and the record file (noBackupFilesDir/change-record.txt) must hold exactly that pending change.
  5. Force-stop and relaunch: the record must still be shown (it survives the app being closed).
  6. `pm grant` turns CAMERA back on (what the copied adb command does); "Scan again" must reconcile:
     the record section disappears and the file marks the entry restored.
  7. "Clear record" path: revoke again via Settings, then "Clear record" must delete the file.

Usage: emulator_flow.py <permcheck.apk> <target.apk>. Screens and UI dumps go to /tmp/permcheck-flow.
"""
import pathlib, re, subprocess, sys, time
import xml.etree.ElementTree as ET

PKG = "org.secureinchat.permcheck"
TARGET = "org.secureinchat.permchecktarget"
LABEL = "PermFlowTarget"
CAM = "android.permission.CAMERA"
CALLLOG = "android.permission.READ_CALL_LOG"
OUT = pathlib.Path("/tmp/permcheck-flow")
OUT.mkdir(parents=True, exist_ok=True)
step_no = 0


def adb(*args, check=True):
    r = subprocess.run(["adb", *args], capture_output=True, text=True, timeout=120)
    if check and r.returncode != 0:
        raise SystemExit(f"adb {' '.join(args)} failed: {r.stdout}{r.stderr}")
    return r.stdout.replace("\r", "")


def sh(cmd, check=True):
    return adb("shell", cmd, check=check)


def snap(name):
    global step_no
    step_no += 1
    tag = f"{step_no:02d}-{name}"
    sh("screencap -p /sdcard/flow.png", check=False)
    adb("pull", "/sdcard/flow.png", str(OUT / f"{tag}.png"), check=False)


def dump():
    """Returns the visible UI nodes in document order as (text, bounds) pairs."""
    for _ in range(3):
        sh("rm -f /sdcard/ui.xml", check=False)
        sh("uiautomator dump /sdcard/ui.xml", check=False)
        xml = sh("cat /sdcard/ui.xml", check=False)
        if xml.strip().startswith("<?xml"):
            root = ET.fromstring(xml[xml.index("<"):])
            return [(n.get("text") or "", n.get("bounds") or "", n.get("class") or "") for n in root.iter("node")]
        time.sleep(1)
    raise SystemExit("uiautomator dump failed")


def texts(nodes):
    return [t for t, _, _ in nodes]


def center(bounds):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", bounds))
    return (x1 + x2) // 2, (y1 + y2) // 2


def tap(bounds):
    x, y = center(bounds)
    sh(f"input tap {x} {y}")


def fail(msg, nodes=None):
    snap("FAIL")
    if nodes is not None:
        (OUT / "fail-ui.txt").write_text("\n".join(texts(nodes)))
    (OUT / "logcat.txt").write_text(adb("logcat", "-d", check=False))
    raise SystemExit("FAIL: " + msg)


def size():
    m = re.search(r"(\d+)x(\d+)", sh("wm size"))
    return int(m.group(1)), int(m.group(2))


def swipe(up=True):
    w, h = size()
    a, b = int(h * 0.75), int(h * 0.30)
    if up:
        sh(f"input swipe {w // 2} {a} {w // 2} {b} 400")
    else:
        sh(f"input swipe {w // 2} {b} {w // 2} {a} 400")
    time.sleep(1)


def to_top():
    w, h = size()
    for _ in range(6):
        sh(f"input swipe {w // 2} {int(h * 0.3)} {w // 2} {int(h * 0.85)} 120")
    time.sleep(1)


def wait_scan_done(timeout=60):
    """Waits until the status line no longer says "Checking…"; returns the nodes."""
    end = time.time() + timeout
    while time.time() < end:
        to_top()
        nodes = dump()
        joined = "\n".join(texts(nodes))
        if "Permission Checkup" in joined and "Checking" not in joined and re.search(r"High \d+", joined):
            return nodes
        time.sleep(2)
    fail("scan did not finish", dump())


def find_after(nodes, start_text, button_text):
    """First Button with [button_text] after the node whose text is exactly [start_text]."""
    seen = False
    for t, b, cls in nodes:
        if t == start_text:
            seen = True
        elif seen and cls.endswith("Button") and t == button_text and b:
            return b
    return None


def scroll_find(predicate, max_swipes=25):
    to_top()
    for _ in range(max_swipes):
        nodes = dump()
        hit = predicate(nodes)
        if hit:
            return hit
        swipe(up=True)
    return None


def record_lines():
    out = sh(f"run-as {PKG} cat no_backup/change-record.txt", check=False)
    if "No such file" in out:
        return None
    return [l.split("\t") for l in out.splitlines() if "\t" in l]


def entries_for(lines, perm):
    """Runtime-revoke lines are R<TAB>atMillis<TAB>restored(0/1)<TAB>package<TAB>permission."""
    return [f for f in (lines or []) if len(f) == 5 and f[0] == "R" and f[3] == TARGET and f[4] == perm]


def launch():
    sh(f"am start -W -n {PKG}/.MainActivity")


def open_target_settings():
    def pred(nodes):
        return find_after(nodes, TARGET, "Open settings")
    b = scroll_find(pred)
    if not b:
        fail("no 'Open settings' button for the target app", dump())
    tap(b)
    time.sleep(4)
    focus = sh("dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'", check=False)
    (OUT / f"focus-{step_no}.txt").write_text(focus)
    if PKG + "/" in focus and "settings" not in focus.lower():
        fail("Settings did not open: " + focus)
    snap("settings-open")


def main():
    app_apk, target_apk = sys.argv[1], sys.argv[2]
    adb("install", "-r", app_apk)
    adb("install", "-r", target_apk)
    sh(f"pm clear {PKG}", check=False)
    for p in (CAM, CALLLOG):
        sh(f"pm grant {TARGET} {p}")
    adb("logcat", "-c", check=False)

    # 1-2: scan, the target is listed
    launch()
    nodes = wait_scan_done()
    snap("first-scan")
    if record_lines() is not None:
        fail("record file exists before anything was switched off")
    if not scroll_find(lambda n: TARGET in texts(n) or None):
        fail("target app not listed after scan", dump())

    # 3-4: open settings, switch CAMERA off, come back
    open_target_settings()
    sh(f"pm revoke {TARGET} {CAM}")
    sh("input keyevent KEYCODE_BACK")
    time.sleep(3)
    nodes = wait_scan_done()
    snap("after-return")
    joined = texts(nodes)
    if "Change record (1)" not in joined:
        fail("change record section missing or wrong count after return", nodes)
    if f"{LABEL} · CAMERA" not in joined:
        fail("record row for the target CAMERA missing", nodes)
    lines = record_lines()
    cam = entries_for(lines, CAM)
    if len(cam) != 1 or cam[0][2] != "0":
        fail(f"record file should hold one pending CAMERA entry, got {lines}")
    if entries_for(lines, CALLLOG):
        fail(f"READ_CALL_LOG was not switched off but is in the record: {lines}")
    files = sh(f"run-as {PKG} find . -type f", check=False)
    (OUT / "app-files.txt").write_text(files)
    written = [f for f in files.split() if not f.startswith(("./code_cache", "./cache"))]
    if written != ["./no_backup/change-record.txt"]:
        fail(f"app wrote files other than the change record: {written}")

    # 5: survives a restart
    sh(f"am force-stop {PKG}")
    launch()
    nodes = wait_scan_done()
    snap("after-restart")
    if "Change record (1)" not in texts(nodes):
        fail("change record not shown after restart", nodes)

    # 6: turned back on (what the copied adb command does) -> reconcile on "Scan again"
    sh(f"pm grant {TARGET} {CAM}")
    b = next((b for t, b, c in nodes if t == "Scan again"), None)
    if not b:
        fail("no 'Scan again' button", nodes)
    tap(b)
    time.sleep(3)
    nodes = wait_scan_done()
    snap("after-restore")
    if any(t.startswith("Change record") for t in texts(nodes)):
        fail("record section still shown after the permission was granted again", nodes)
    cam = entries_for(record_lines(), CAM)
    if len(cam) != 1 or cam[0][2] != "1":
        fail(f"record entry should be marked restored, got {cam}")

    # 7: Clear record
    open_target_settings()
    sh(f"pm revoke {TARGET} {CAM}")
    sh("input keyevent KEYCODE_BACK")
    time.sleep(3)
    nodes = wait_scan_done()
    if "Change record (1)" not in texts(nodes):
        fail("second revoke not recorded", nodes)
    b = scroll_find(lambda n: next((b for t, b, c in n if t == "Clear record"), None))
    if not b:
        fail("no 'Clear record' button", dump())
    tap(b)
    time.sleep(2)
    nodes = wait_scan_done()
    snap("after-clear")
    if any(t.startswith("Change record") for t in texts(nodes)):
        fail("record section still shown after Clear record", nodes)
    if record_lines() is not None:
        fail("record file still exists after Clear record")

    log = adb("logcat", "-d", check=False)
    (OUT / "logcat.txt").write_text(log)
    if "FATAL EXCEPTION" in log and PKG in log:
        fail("app crashed during the flow")
    sh(f"pm grant {TARGET} {CAM}", check=False)
    print("emulator flow test passed: record, restart, reconcile, clear")


if __name__ == "__main__":
    main()
