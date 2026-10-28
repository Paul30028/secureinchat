// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.content.Context
import org.secureinchat.guardian.dns.Blocklist

object UserRulesStore {
    private const val PREFS = "user_rules"
    private const val KEY_ALLOWED = "allowed"
    private const val KEY_BLOCKED = "blocked"

    fun allowed(ctx: Context): Set<String> = readSet(ctx, KEY_ALLOWED)

    fun blocked(ctx: Context): Set<String> = readSet(ctx, KEY_BLOCKED)

    fun add(ctx: Context, domain: String): Boolean = addTo(ctx, KEY_ALLOWED, domain)

    fun remove(ctx: Context, domain: String) = removeFrom(ctx, KEY_ALLOWED, domain)

    fun addBlocked(ctx: Context, domain: String): Boolean = addTo(ctx, KEY_BLOCKED, domain)

    fun removeBlocked(ctx: Context, domain: String) = removeFrom(ctx, KEY_BLOCKED, domain)

    private fun readSet(ctx: Context, key: String): Set<String> {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getStringSet(key, emptySet()) ?: emptySet()
        return HashSet(raw)
    }

    private fun addTo(ctx: Context, key: String, domain: String): Boolean {
        val n = Blocklist.normalizeOrNull(domain) ?: return false
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val cur = HashSet(prefs.getStringSet(key, emptySet()) ?: emptySet())
        // A domain lives in at most one of the two lists: the newest choice replaces the old one,
        // so "Blocked by you" never shows a domain that is silently allowed (allow wins in Blocklist).
        val otherKey = if (key == KEY_ALLOWED) KEY_BLOCKED else KEY_ALLOWED
        val other = HashSet(prefs.getStringSet(otherKey, emptySet()) ?: emptySet())
        val otherChanged = other.remove(n)
        if (!cur.add(n) && !otherChanged) return true
        prefs.edit().putStringSet(key, cur).putStringSet(otherKey, other).apply()
        return true
    }

    private fun removeFrom(ctx: Context, key: String, domain: String) {
        val n = Blocklist.normalizeOrNull(domain) ?: domain.trim().lowercase().trimEnd('.')
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val cur = HashSet(prefs.getStringSet(key, emptySet()) ?: emptySet())
        if (cur.remove(n)) prefs.edit().putStringSet(key, cur).apply()
    }
}
