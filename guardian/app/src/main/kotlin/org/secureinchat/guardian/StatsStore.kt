// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.content.Context
import java.time.LocalDate
import org.secureinchat.guardian.dns.DailyCounts

/**
 * Durable per-day block counts. The only thing written to disk here is a number per day
 * ("yyyy-MM-dd=N;..."); nothing that could identify which names were blocked. The file is excluded
 * from Android backup by res/xml/data_extraction_rules.xml, and clear() removes it entirely.
 *
 * SharedPreferences is used here because it is the same lightweight mechanism UserRulesStore uses;
 * tests/policy_check.py allows this file to touch it alongside UserRulesStore.kt, and separately
 * checks that it never grows to hold what was blocked (only how many).
 *
 * Counts use the device's current local date, so a user crossing midnight follows the device clock.
 * Old days are pruned on write by DailyCounts (7-day window), so this file never grows past a small
 * fixed size.
 */
object StatsStore {
    private const val PREFS = "stats"
    private const val KEY_COUNTS = "counts"

    /**
     * Adds [n] blocks to today's count. n <= 0 is a no-op (nothing to record). Reads, updates and
     * writes in one go; concurrent calls from the service and the UI are both serialized on the
     * SharedPreferences instance, so the read-modify-write is safe.
     */
    fun record(ctx: Context, n: Int) {
        if (n <= 0) return
        val today = LocalDate.now().toString()
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val cur = DailyCounts.decode(prefs.getString(KEY_COUNTS, "") ?: "")
        val next = DailyCounts.add(cur, today, n, DailyCounts.DEFAULT_KEEP_DAYS, today)
        prefs.edit().putString(KEY_COUNTS, DailyCounts.encode(next)).apply()
    }

    fun today(ctx: Context): Long {
        val today = LocalDate.now().toString()
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val cur = DailyCounts.decode(prefs.getString(KEY_COUNTS, "") ?: "")
        return DailyCounts.total(cur, today, 1)
    }

    fun last7(ctx: Context): Long {
        val today = LocalDate.now().toString()
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val cur = DailyCounts.decode(prefs.getString(KEY_COUNTS, "") ?: "")
        return DailyCounts.total(cur, today, 7)
    }

    fun clear(ctx: Context) {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_COUNTS).apply()
    }
}
