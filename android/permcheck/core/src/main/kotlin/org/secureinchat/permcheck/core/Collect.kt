// SPDX-License-Identifier: GPL-3.0-or-later
// T7-b: pure-Kotlin glue between what Android reports and the risk rules.
// Everything here is plain data so it can be tested without the Android SDK.
package org.secureinchat.permcheck.core

/** One installed package as read from PackageManager, before any risk logic. */
data class RawApp(
    val packageName: String,
    val label: String,
    val isSystem: Boolean,
    /** Permissions the app declares in its manifest that are currently granted. */
    val granted: Set<String>,
    /** True if the app declares a service protected by android.permission.BIND_VPN_SERVICE. */
    val declaresVpnService: Boolean = false,
)

/**
 * Device-wide special access, keyed by package name.
 * Each set holds the packages that currently have that access.
 */
data class SpecialSnapshot(
    val accessibility: Set<String> = emptySet(),
    val notificationListeners: Set<String> = emptySet(),
    val deviceAdmins: Set<String> = emptySet(),
    val defaultKeyboard: String? = null,
    val overlay: Set<String> = emptySet(),
    val usageStats: Set<String> = emptySet(),
) {
    fun specialFor(raw: RawApp): Set<Special> = buildSet {
        val p = raw.packageName
        if (p in accessibility) add(Special.ACCESSIBILITY)
        if (p in notificationListeners) add(Special.NOTIFICATION_LISTENER)
        if (p in deviceAdmins) add(Special.DEVICE_ADMIN)
        if (p == defaultKeyboard) add(Special.DEFAULT_KEYBOARD)
        if (raw.declaresVpnService) add(Special.VPN)
        if (p in overlay) add(Special.OVERLAY)
        if (p in usageStats) add(Special.USAGE_STATS)
    }
}

object Components {
    /** "com.foo/.Svc" or "com.foo/com.foo.Svc" -> "com.foo"; blank or malformed -> null. */
    fun packageOf(flat: String?): String? {
        val s = flat?.trim().orEmpty()
        if (s.isEmpty()) return null
        val pkg = s.substringBefore('/')
        return pkg.takeIf { it.isNotEmpty() && it.all { c -> c.isLetterOrDigit() || c == '.' || c == '_' } }
    }

    /** Colon-separated list as stored in secure settings -> set of package names. */
    fun packagesOf(list: String?): Set<String> =
        list.orEmpty().split(':').mapNotNull { packageOf(it) }.toSet()
}

/** Turns raw device data into the input of [audit]. Our own package is skipped. */
fun collect(raw: List<RawApp>, special: SpecialSnapshot, selfPackage: String): List<AppPerms> =
    raw.filter { it.packageName != selfPackage }
        .map { AppPerms(it.packageName, it.label, it.isSystem, it.granted, special.specialFor(it)) }
