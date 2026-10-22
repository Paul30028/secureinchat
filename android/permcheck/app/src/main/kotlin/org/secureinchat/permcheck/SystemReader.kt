// SPDX-License-Identifier: GPL-3.0-or-later
// T7-b: reads permission and special-access state from the system. Read-only; changes nothing.
// Status: not yet compiled against the Android SDK or run on a device (see README).
package org.secureinchat.permcheck

import android.Manifest
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import org.secureinchat.permcheck.core.Components
import org.secureinchat.permcheck.core.RawApp
import org.secureinchat.permcheck.core.SpecialSnapshot

class SystemReader(private val ctx: Context) {
    private val pm: PackageManager = ctx.packageManager

    data class Scan(val apps: List<RawApp>, val special: SpecialSnapshot)

    fun scan(): Scan {
        val overlay = mutableSetOf<String>()
        val usage = mutableSetOf<String>()
        val vpn = vpnPackages()
        val apps = installedPackageNames().mapNotNull { name ->
            val pi = packageInfo(name) ?: return@mapNotNull null
            val ai: ApplicationInfo? = pi.applicationInfo
            val names = pi.requestedPermissions ?: emptyArray()
            val flags = pi.requestedPermissionsFlags ?: IntArray(0)
            val granted = names.indices
                .filter { i -> i < flags.size && (flags[i] and PackageInfo.REQUESTED_PERMISSION_GRANTED) != 0 }
                .map { names[it] }
                .toSet()
            if (ai != null) {
                if (Manifest.permission.SYSTEM_ALERT_WINDOW in names && opAllowed(AppOpsManager.OPSTR_SYSTEM_ALERT_WINDOW, ai.uid, name)) overlay += name
                if (Manifest.permission.PACKAGE_USAGE_STATS in names && opAllowed(AppOpsManager.OPSTR_GET_USAGE_STATS, ai.uid, name)) usage += name
            }
            RawApp(
                packageName = name,
                label = ai?.loadLabel(pm)?.toString() ?: name,
                isSystem = ai != null && (ai.flags and ApplicationInfo.FLAG_SYSTEM) != 0,
                granted = granted,
                declaresVpnService = name in vpn,
            )
        }
        val special = SpecialSnapshot(
            accessibility = accessibilityPackages(),
            notificationListeners = Components.packagesOf(secure("enabled_notification_listeners")),
            deviceAdmins = deviceAdminPackages(),
            defaultKeyboard = Components.packageOf(secure(Settings.Secure.DEFAULT_INPUT_METHOD)),
            overlay = overlay,
            usageStats = usage,
        )
        return Scan(apps, special)
    }

    // One package at a time keeps each binder reply small (a single big query can fail on phones with many apps).
    private fun installedPackageNames(): List<String> =
        if (Build.VERSION.SDK_INT >= 33) pm.getInstalledPackages(PackageManager.PackageInfoFlags.of(0L)).map { it.packageName }
        else @Suppress("DEPRECATION") pm.getInstalledPackages(0).map { it.packageName }

    private fun packageInfo(name: String): PackageInfo? = try {
        if (Build.VERSION.SDK_INT >= 33) pm.getPackageInfo(name, PackageManager.PackageInfoFlags.of(PackageManager.GET_PERMISSIONS.toLong()))
        else @Suppress("DEPRECATION") pm.getPackageInfo(name, PackageManager.GET_PERMISSIONS)
    } catch (e: PackageManager.NameNotFoundException) {
        null // uninstalled while scanning
    }

    /** Apps that declare a VpnService (intent action android.net.VpnService). */
    private fun vpnPackages(): Set<String> {
        val intent = Intent("android.net.VpnService")
        val list = if (Build.VERSION.SDK_INT >= 33) pm.queryIntentServices(intent, PackageManager.ResolveInfoFlags.of(0L))
        else @Suppress("DEPRECATION") pm.queryIntentServices(intent, 0)
        return list.mapNotNull { it.serviceInfo?.packageName }.toSet()
    }

    private fun accessibilityPackages(): Set<String> {
        val am = ctx.getSystemService(AccessibilityManager::class.java) ?: return emptySet()
        return am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            .mapNotNull { it.resolveInfo?.serviceInfo?.packageName }
            .toSet()
    }

    private fun deviceAdminPackages(): Set<String> {
        val dpm = ctx.getSystemService(DevicePolicyManager::class.java) ?: return emptySet()
        return dpm.activeAdmins.orEmpty().map { it.packageName }.toSet()
    }

    private fun secure(key: String): String? = try {
        Settings.Secure.getString(ctx.contentResolver, key)
    } catch (e: SecurityException) {
        null
    }

    private fun opAllowed(op: String, uid: Int, pkg: String): Boolean = try {
        val ops = ctx.getSystemService(AppOpsManager::class.java) ?: return false
        val mode = if (Build.VERSION.SDK_INT >= 29) ops.unsafeCheckOpNoThrow(op, uid, pkg)
        else @Suppress("DEPRECATION") ops.checkOpNoThrow(op, uid, pkg)
        mode == AppOpsManager.MODE_ALLOWED
    } catch (e: SecurityException) {
        false
    }
}
