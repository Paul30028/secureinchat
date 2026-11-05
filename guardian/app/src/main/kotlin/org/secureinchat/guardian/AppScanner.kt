// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.Manifest
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.AppOpsManager
import android.app.KeyguardManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import java.util.Calendar
import org.secureinchat.guardian.dns.AppCheckup

/**
 * G19: reads what the app checkup needs. Read-only: it changes no setting. The result lives in memory
 * only (never written to storage, never sent anywhere; policy_check.py keeps network code out of here).
 * Reading follows android/permcheck's SystemReader: one package at a time, so each binder reply stays small
 * on phones with many apps.
 */
class AppScanner(private val ctx: Context) {
    private val pm: PackageManager = ctx.packageManager

    data class Result(
        val apps: List<AppCheckup.AppFacts>,
        val findings: List<AppCheckup.Finding>,
        val phone: List<AppCheckup.PhoneIssue>,
        val counts: Map<AppCheckup.Kind, Int>,
        /** Notification access could not be read on this phone (the check is then left out, not guessed). */
        val notificationAccessUnknown: Boolean,
    )

    fun scan(list: Map<String, AppCheckup.ListedApp>): Result {
        val a11y = accessibilityPackages()
        val admins = deviceAdminPackages()
        val notifRaw = secure("enabled_notification_listeners")
        val notif = AppCheckup.packagesOfComponents(notifRaw)
        val apps = installedPackageNames().mapNotNull { name -> facts(name, a11y, admins, notif) }
        val self = ctx.packageName
        return Result(
            apps = apps,
            findings = AppCheckup.evaluate(apps, list, self),
            phone = AppCheckup.phoneIssues(phoneFacts()),
            counts = AppCheckup.counts(apps, self),
            notificationAccessUnknown = notifRaw == null,
        )
    }

    private fun facts(name: String, a11y: Set<String>, admins: Set<String>, notif: Set<String>): AppCheckup.AppFacts? {
        val pi = packageInfo(name) ?: return null
        val ai: ApplicationInfo = pi.applicationInfo ?: return null
        val names = pi.requestedPermissions ?: emptyArray()
        val flags = pi.requestedPermissionsFlags ?: IntArray(0)
        val granted = names.indices
            .filter { i -> i < flags.size && (flags[i] and PackageInfo.REQUESTED_PERMISSION_GRANTED) != 0 }
            .map { names[it] }
            .toSet()
        val isGame = ai.category == ApplicationInfo.CATEGORY_GAME
        val overlay = Manifest.permission.SYSTEM_ALERT_WINDOW in names &&
            opAllowed(AppOpsManager.OPSTR_SYSTEM_ALERT_WINDOW, ai.uid, name)
        return AppCheckup.AppFacts(
            packageName = name,
            label = ai.loadLabel(pm).toString(),
            isSystem = (ai.flags and ApplicationInfo.FLAG_SYSTEM) != 0,
            hasLauncher = pm.getLaunchIntentForPackage(name) != null,
            isGame = isGame,
            granted = granted,
            accessibility = name in a11y,
            deviceAdmin = name in admins,
            notificationListener = name in notif,
            overlay = overlay,
        )
    }

    private fun phoneFacts(): AppCheckup.PhoneFacts {
        val screenLock = try {
            ctx.getSystemService(KeyguardManager::class.java)?.isDeviceSecure
        } catch (_: Throwable) { null }
        val adb = try {
            Settings.Global.getInt(ctx.contentResolver, Settings.Global.ADB_ENABLED, 0) == 1
        } catch (_: Throwable) { null }
        val now = Calendar.getInstance()
        return AppCheckup.PhoneFacts(
            screenLock = screenLock,
            usbDebugging = adb,
            securityPatch = Build.VERSION.SECURITY_PATCH,
            todayYear = now.get(Calendar.YEAR),
            todayMonth = now.get(Calendar.MONTH) + 1,
        )
    }

    private fun installedPackageNames(): List<String> =
        if (Build.VERSION.SDK_INT >= 33) pm.getInstalledPackages(PackageManager.PackageInfoFlags.of(0L)).map { it.packageName }
        else @Suppress("DEPRECATION") pm.getInstalledPackages(0).map { it.packageName }

    private fun packageInfo(name: String): PackageInfo? = try {
        if (Build.VERSION.SDK_INT >= 33) pm.getPackageInfo(name, PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong()))
        else @Suppress("DEPRECATION") pm.getPackageInfo(name, PackageManager.GET_PERMISSIONS)
    } catch (_: PackageManager.NameNotFoundException) {
        null // uninstalled while scanning
    }

    private fun accessibilityPackages(): Set<String> = try {
        val am = ctx.getSystemService(AccessibilityManager::class.java)
        am?.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            ?.mapNotNull { it.resolveInfo?.serviceInfo?.packageName }?.toSet() ?: emptySet()
    } catch (_: Throwable) { emptySet() }

    private fun deviceAdminPackages(): Set<String> = try {
        ctx.getSystemService(DevicePolicyManager::class.java)?.activeAdmins.orEmpty().map { it.packageName }.toSet()
    } catch (_: Throwable) { emptySet() }

    private fun secure(key: String): String? = try {
        Settings.Secure.getString(ctx.contentResolver, key)
    } catch (_: SecurityException) { null }

    private fun opAllowed(op: String, uid: Int, pkg: String): Boolean = try {
        val ops = ctx.getSystemService(AppOpsManager::class.java)
        val mode = if (Build.VERSION.SDK_INT >= 29) ops?.unsafeCheckOpNoThrow(op, uid, pkg)
        else @Suppress("DEPRECATION") ops?.checkOpNoThrow(op, uid, pkg)
        mode == AppOpsManager.MODE_ALLOWED
    } catch (_: Throwable) { false }

    companion object {
        /** Parsed once per process; small (about 650 lines). */
        @Volatile private var listCache: Map<String, AppCheckup.ListedApp>? = null

        fun stalkerwarePackages(ctx: Context): Map<String, AppCheckup.ListedApp> = listCache ?: try {
            ctx.assets.open("stalkerware-packages-echap.tsv").use { AppCheckup.parseList(it.bufferedReader().readText()) }
        } catch (_: Throwable) { emptyMap() }.also { listCache = it }
    }
}
