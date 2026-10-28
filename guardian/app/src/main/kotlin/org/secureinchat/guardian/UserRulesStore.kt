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

    /**
     * Replace both lists in one atomic write. Entries are normalized; a domain that appears in both
     * input sets ends up only in "allowed", matching the store's invariant that a domain lives in at
     * most one list and that allow wins in Blocklist.
     */
    fun replaceAll(ctx: Context, blocked: Set<String>, allowed: Set<String>) {
        val nextAllowed = HashSet<String>(allowed.size)
        for (s in allowed) {
            val n = Blocklist.normalizeOrNull(s) ?: continue
            nextAllowed.add(n)
        }
        val nextBlocked = HashSet<String>(blocked.size)
        for (s in blocked) {
            val n = Blocklist.normalizeOrNull(s) ?: continue
            if (nextAllowed.contains(n)) continue
            nextBlocked.add(n)
        }
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putStringSet(KEY_ALLOWED, nextAllowed)
            .putStringSet(KEY_BLOCKED, nextBlocked)
            .apply()
    }

    /**
     * Merge imported rules into the existing lists. Each imported entry replaces the previous choice
     * for that domain, like add()/addBlocked(): an imported allow removes it from the block list and
     * an imported block removes it from the allow list. RulesText.parse never returns a domain in
     * both sets, so the order of the two loops does not matter.
     */
    fun mergeIn(ctx: Context, blocked: Set<String>, allowed: Set<String>) {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val curAllowed = HashSet(prefs.getStringSet(KEY_ALLOWED, emptySet()) ?: emptySet())
        val curBlocked = HashSet(prefs.getStringSet(KEY_BLOCKED, emptySet()) ?: emptySet())
        for (s in allowed) {
            val n = Blocklist.normalizeOrNull(s) ?: continue
            curBlocked.remove(n)
            curAllowed.add(n)
        }
        for (s in blocked) {
            val n = Blocklist.normalizeOrNull(s) ?: continue
            curAllowed.remove(n)
            curBlocked.add(n)
        }
        prefs.edit()
            .putStringSet(KEY_ALLOWED, curAllowed)
            .putStringSet(KEY_BLOCKED, curBlocked)
            .apply()
    }

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
