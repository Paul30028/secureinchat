// SPDX-License-Identifier: GPL-3.0-or-later
// T11-c: change record for the normal (non-privileged) mode, and ways to undo it.
// The user switches permissions off in Settings; when they come back we compare the two scans,
// record what went from granted to not granted, and keep that record so they can turn things back on
// (one Settings page per app, or copy adb commands to run from a computer). Nothing is run by this app.
package org.secureinchat.permcheck.core

/**
 * Runtime permissions that can be given back with `pm grant`. Only dangerous (runtime) permissions are
 * grantable that way, so the record is limited to the ones our rules know about.
 */
object Grantable {
    private const val P = "android.permission."
    val PERMISSIONS: Set<String> = setOf(
        "ACCESS_BACKGROUND_LOCATION", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION",
        "READ_SMS", "RECEIVE_SMS", "READ_CALL_LOG", "BODY_SENSORS_BACKGROUND",
        "RECORD_AUDIO", "CAMERA", "READ_CONTACTS", "READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO",
        "READ_EXTERNAL_STORAGE", "READ_PHONE_STATE", "BLUETOOTH_CONNECT", "NEARBY_WIFI_DEVICES",
        "POST_NOTIFICATIONS",
    ).map { P + it }.toSet()
}

/**
 * What the user switched off between two scans: permissions that were granted in [before] and are not
 * granted in [after], for apps still installed. Apps that disappeared (uninstalled) are ignored, and so
 * is anything [Commands] would refuse to undo (protected or system packages, malformed names).
 * Ordered by package, then permission, so the result is stable.
 */
fun revocationsBetween(before: List<AppPerms>, after: List<AppPerms>, atMillis: Long): List<Change.RuntimeRevoke> {
    val now = after.associateBy { it.packageName }
    val out = mutableListOf<Change.RuntimeRevoke>()
    for (b in before.sortedBy { it.packageName }) {
        val a = now[b.packageName] ?: continue
        for (perm in b.granted.sorted()) {
            if (perm !in Grantable.PERMISSIONS || perm in a.granted) continue
            val c = Change.RuntimeRevoke(b.packageName, perm, atMillis)
            val undoable = try { Commands.undo(c); true } catch (e: IllegalArgumentException) { false }
            if (undoable) out.add(c)
        }
    }
    return out
}

/** Records every change in [changes]; already-pending keys keep their first record. */
fun Ledger.recordAll(changes: List<Change>): Ledger = changes.fold(this) { l, c -> l.record(c) }

/**
 * Marks as restored every pending runtime revoke whose permission is granted again in [current]
 * (the user turned it back on in Settings, or ran the adb command). Apps not in [current] are left
 * pending: they may be uninstalled, or the scan may not have seen them.
 */
fun Ledger.reconcile(current: List<AppPerms>): Ledger {
    val byPkg = current.associateBy { it.packageName }
    var l = this
    for (c in pending()) {
        if (c is Change.RuntimeRevoke && byPkg[c.packageName]?.granted?.contains(c.permission) == true) {
            l = l.markRestored(c)
        }
    }
    return l
}

/** Text the user can copy and run on a computer with adb. */
object RestoreScript {
    private val SAFE = Regex("^[A-Za-z0-9_.]+$")

    /**
     * One `adb shell` line per pending change, newest first, with a short header. Every argument has
     * already passed [Validate] via [Commands]; as a second guard, a vector containing anything other than
     * letters, digits, `_` and `.` is dropped rather than printed, so the text can never smuggle in shell syntax.
     */
    fun adb(ledger: Ledger, lang: Lang): String {
        val zh = lang == Lang.ZH
        val lines = ledger.restorePlan().filter { argv -> argv.all { SAFE.matches(it) } }
        val sb = StringBuilder()
        sb.appendLine(
            if (zh) "# Permission Checkup 恢复命令(在装有 adb 的电脑上运行,手机需开启 USB 或无线调试)"
            else "# Permission Checkup restore commands (run on a computer with adb; USB or wireless debugging on)"
        )
        sb.appendLine(if (zh) "# 共 ${lines.size} 条,按时间从新到旧" else "# ${lines.size} command(s), newest first")
        for (argv in lines) sb.appendLine("adb shell " + argv.joinToString(" "))
        return sb.toString().trimEnd()
    }
}
