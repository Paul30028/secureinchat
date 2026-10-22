# Permission Checkup (Android) — work in progress

Shows which apps hold sensitive permissions and special access (accessibility, notification access, device admin, keyboard with internet, VPN, overlay, usage access), ranks them by risk, and opens each app's system settings so you can switch things off. When you come back, it checks again and tells you what changed. The report is made on the phone and can be copied (Android 13+ marks the copy as sensitive so the clipboard preview is hidden).

The app requests **no INTERNET permission** and has no library dependencies. Its only permission is `QUERY_ALL_PACKAGES` (needed to see all installed apps on Android 11+). It never changes any setting itself.

Licensed GPL-3.0-or-later (see LICENSE), separate from the MIT-licensed website tools.

## Status (2026-10-22, T7-b)

| Part | State |
|---|---|
| `core/` risk rules, reasons (EN/ZH), settings targets, recheck diff, text report | 35 tests pass (`kotlinc` + `java`) |
| `app/` Android screen (`MainActivity`) and system reader (`SystemReader`) | Type-checks against compile-only stubs. **Not yet built with the Android SDK, not run on an emulator or phone** (the build session could not download the SDK). |
| Policy checks (manifest has only `QUERY_ALL_PACKAGES`, no network code, no write APIs, no dependencies, GPL headers) | pass |
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

## Run the checks (no Android SDK needed)

    kotlinc core/src/main/kotlin core/src/test/kotlin -include-runtime -d /tmp/pc.jar
    java -cp /tmp/pc.jar org.secureinchat.permcheck.core.RiskRulesTestKt
    java -cp /tmp/pc.jar org.secureinchat.permcheck.core.CollectTestKt
    KOTLINC=kotlinc sh tests/compile_app.sh
    python3 tests/policy_check.py

## Build the APK (needs Android SDK 35)

    gradle :app:assembleDebug

Plan and sources: see the project document "app-permission-checkup-proposal".
