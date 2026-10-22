#!/bin/sh
# Emulator smoke test: install, launch, check the activity stays up without a crash, capture a screenshot.
set -e
APK="$1"; OUT=/tmp/permcheck-smoke; PKG=org.secureinchat.permcheck
mkdir -p "$OUT"
adb install -r "$APK"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity"
sleep 12
adb shell screencap -p /sdcard/smoke.png && adb pull /sdcard/smoke.png "$OUT/screen.png"
adb logcat -d > "$OUT/logcat.txt"
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb pull /sdcard/ui.xml "$OUT/ui.xml" || true
if grep -q "FATAL EXCEPTION" "$OUT/logcat.txt"; then grep -A30 "FATAL EXCEPTION" "$OUT/logcat.txt"; echo "app crashed"; exit 1; fi
PID=$(adb shell pidof "$PKG" | tr -d '\r')
[ -n "$PID" ] || { echo "app is not running"; exit 1; }
adb shell dumpsys package "$PKG" | grep -i "android.permission.INTERNET" && { echo "INTERNET permission present"; exit 1; } || true
echo "smoke test passed (pid $PID)"
