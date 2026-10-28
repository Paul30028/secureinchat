// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.content.Context
import org.secureinchat.guardian.dns.Blocklist

object UserRulesStore {
    private const val PREFS = "user_rules"
    private const val KEY = "allowed"

    fun allowed(ctx: Context): Set<String> {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getStringSet(KEY, emptySet()) ?: emptySet()
        return HashSet(raw)
    }

    fun add(ctx: Context, domain: String): Boolean {
        val n = Blocklist.normalizeOrNull(domain) ?: return false
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val cur = HashSet(prefs.getStringSet(KEY, emptySet()) ?: emptySet())
        if (!cur.add(n)) return true
        prefs.edit().putStringSet(KEY, cur).apply()
        return true
    }

    fun remove(ctx: Context, domain: String) {
        val n = Blocklist.normalizeOrNull(domain) ?: domain.trim().lowercase().trimEnd('.')
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val cur = HashSet(prefs.getStringSet(KEY, emptySet()) ?: emptySet())
        if (cur.remove(n)) prefs.edit().putStringSet(KEY, cur).apply()
    }
}
