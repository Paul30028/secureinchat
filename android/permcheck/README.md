# Permission Checkup (Android) — work in progress

Shows which apps hold sensitive permissions and special access (accessibility, notification access, device admin, keyboard with internet, VPN, overlay, usage access), ranks them by risk, and opens each app's system settings so you can switch things off. When you come back, it checks again and tells you what changed, and keeps a **change record** of the permissions you switched off so you can turn them back on later: a "Turn back on" button per item (opens that app's settings), or a copyable list of `adb shell pm grant …` commands to run from a computer. Items you re-enable drop off the record automatically on the next check. The report is made on the phone and can be copied (Android 13+ marks the copy as sensitive so the clipboard preview is hidden).

The app requests **no INTERNET permission** and has no library dependencies. Its only permission is `QUERY_ALL_PACKAGES` (needed to see all installed apps on Android 11+). It never changes any setting itself. The only file it writes is the change record (`change-record.txt` in `noBackupFilesDir`, which Android leaves out of cloud backup and device-to-device transfer); "Clear record" deletes it.

Licensed GPL-3.0-or-later (see LICENSE), separate from the MIT-licensed website tools.

## Status (2026-10-22, T11-c + emulator flow test)

| Part | State |
|---|---|
| `core/` risk rules, reasons (EN/ZH), settings targets, recheck diff, text report | 35 tests pass (`kotlinc` + `java`) |
| `core/` advanced-mode change ledger and executor (T11-a/b; `Runner` port not yet backed by Shizuku) | 73 + 27 tests pass |
| `core/` change record for normal mode: detect what was switched off, reconcile, adb restore commands (T11-c, `Restore.kt`) | 20 tests pass |
| `app/` Android screen (`MainActivity`), system reader (`SystemReader`), record file (`LedgerStore`) | Type-checks against compile-only stubs. GitHub Actions (`.github/workflows/permcheck.yml`) builds the debug APK, runs Android lint, checks the APK has no INTERNET permission, and launches it on API 29 and 34 emulators (smoke test: starts, no crash). `tests/emulator_flow.py` then drives the change-record loop on both emulators with adb: a test-only app (`tests/testtarget`, no code, never shipped) holds CAMERA and READ_CALL_LOG; the test taps "Open settings", revokes CAMERA with `pm revoke` (standing in for the user's tap), goes back, and checks the record row, the record file, that it survives a restart, that `pm grant` + "Scan again" marks it restored, that "Clear record" deletes the file, and that the app writes no other file. **Not run on a real phone.** |
| Policy checks (manifest has only `QUERY_ALL_PACKAGES`, no network code, no settings-changing APIs, file writes only in `LedgerStore.kt` under `noBackupFilesDir`, no dependencies, GPL headers) | pass |
| Release | none; publishing is Paul's decision |

### Android APIs used and what still needs checking on a real device

| What | API | To verify on device |
|---|---|---|
| Installed apps, granted permissions | `PackageManager.getInstalledPackages`, `getPackageInfo(GET_PERMISSIONS)`, `PackageInfo.requestedPermissionsFlags` & `REQUESTED_PERMISSION_GRANTED` | 未测 |
| Accessibility services | `AccessibilityManager.getEnabledAccessibilityServiceList` | 未测 |
| Notification access | secure setting `enabled_notification_listeners` (not a documented public constant; may return null on some versions → treated as none) | 未测 |
| Device admin | `DevicePolicyManager.getActiveAdmins` | 未测 |
| Default keyboard | `Settings.Secure.DEFAULT_INPUT_METHOD` | 未测 |
| VPN apps | services answering intent `android.net.VpnService` (means "can act as VPN", not "VPN is on") | 未测 |
| Overlay, usage access | `AppOpsManager.unsafeCheckOpNoThrow` for other apps' uid (counts only `MODE_ALLOWED`) | 未测 — may need adjusting if the system refuses or reports `MODE_DEFAULT` |
| Open settings | `Settings.ACTION_*` with fallback to the app details page, then main Settings | 未测 per vendor |
| Restore with adb | `adb shell pm grant <pkg> <permission>` works only for runtime (dangerous) permissions; the record is limited to those | Emulator flow test (API 29/34, see CI); 未测 on a real device; some vendors may also need the app reopened |
| Change record file | `Context.getNoBackupFilesDir()` | Emulator flow test (API 29/34); 未测 on a real device |

## Run the checks (no Android SDK needed)

    kotlinc core/src/main/kotlin core/src/test/kotlin -include-runtime -d /tmp/pc.jar
    java -cp /tmp/pc.jar org.secureinchat.permcheck.core.RiskRulesTestKt
    java -cp /tmp/pc.jar org.secureinchat.permcheck.core.CollectTestKt
    java -cp /tmp/pc.jar org.secureinchat.permcheck.core.LedgerTestKt
    java -cp /tmp/pc.jar org.secureinchat.permcheck.core.ExecutorTestKt
    java -cp /tmp/pc.jar org.secureinchat.permcheck.core.RestoreTestKt
    KOTLINC=kotlinc sh tests/compile_app.sh
    python3 tests/policy_check.py

## Build the APK (needs Android SDK 35)

    gradle :app:assembleDebug

Plan and sources: see the project document "app-permission-checkup-proposal".
