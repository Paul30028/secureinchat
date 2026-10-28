// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.content.Context

object AppLabels {
    private val cache = HashMap<Int, String>()
    private val lock = Any()

    fun label(ctx: Context, uid: Int): String {
        when (uid) {
            -1 -> return "Unknown app / 未知应用"
            -2 -> return "Other apps / 其他应用"
            1000 -> return "Android system / Android 系统"
        }
        synchronized(lock) { cache[uid]?.let { return it } }
        val label = try {
            val pm = ctx.packageManager
            val pkgs = pm.getPackagesForUid(uid)
            if (pkgs.isNullOrEmpty()) {
                "uid $uid"
            } else {
                val appInfo = pm.getApplicationInfo(pkgs[0], 0)
                pm.getApplicationLabel(appInfo).toString()
            }
        } catch (_: Throwable) {
            "uid $uid"
        }
        synchronized(lock) { cache[uid] = label }
        return label
    }
}
