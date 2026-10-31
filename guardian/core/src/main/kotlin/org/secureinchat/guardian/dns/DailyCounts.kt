// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.time.LocalDate
import java.time.format.DateTimeParseException

/**
 * Per-day block counters. The only thing stored per day is a number: no domains, no timestamps
 * inside the day, no app ids. Callers pass already-pruned maps around, so the whole module is a
 * set of pure functions and can be tested on the JVM.
 *
 * Day keys are "yyyy-MM-dd", which sorts lexicographically in the same order as the dates.
 */
object DailyCounts {

    const val DEFAULT_KEEP_DAYS = 7

    /**
     * Adds [n] to [day] and drops every entry older than [today] minus ([keepDays] - 1).
     *
     * [n] <= 0 returns [counts] unchanged (no pruning either): there is nothing to record and the
     * caller is not expected to use a zero add as a maintenance pass.
     *
     * Counters saturate at [Int.MAX_VALUE] instead of wrapping, so a long-running session cannot
     * turn a huge count into a small one.
     *
     * Malformed keys already in [counts] are dropped, so a corrupt pref from an older build does
     * not survive forever. A malformed [day] or [today] returns [counts] unchanged: there is no
     * sensible cutoff without a parseable "today".
     */
    fun add(
        counts: Map<String, Int>,
        day: String,
        n: Int,
        keepDays: Int = DEFAULT_KEEP_DAYS,
        today: String = day
    ): Map<String, Int> {
        if (n <= 0) return counts
        val todayDate = parseOrNull(today) ?: return counts
        if (parseOrNull(day) == null) return counts
        val keep = if (keepDays < 1) 1 else keepDays
        val cutoff = todayDate.minusDays((keep - 1).toLong())

        val result = HashMap<String, Int>(counts.size + 1)
        for ((k, v) in counts) {
            val kd = parseOrNull(k) ?: continue
            if (kd.isBefore(cutoff)) continue
            result[k] = v
        }
        val current = result[day] ?: 0
        val summed = current.toLong() + n.toLong()
        result[day] = if (summed > Int.MAX_VALUE.toLong()) Int.MAX_VALUE else summed.toInt()
        // Pruning already dropped old keys above, but a caller can pass a day older than the cutoff;
        // adding it back and re-pruning keeps the invariant "only the last keepDays survive".
        val dayDate = parseOrNull(day)!!
        if (dayDate.isBefore(cutoff)) result.remove(day)
        return result
    }

    /**
     * Sum of the counts for [today] and the [days] - 1 days before it. [days] <= 0 yields 0.
     * Malformed keys and malformed [today] are ignored rather than thrown.
     */
    fun total(counts: Map<String, Int>, today: String, days: Int): Long {
        if (days <= 0) return 0L
        val todayDate = parseOrNull(today) ?: return 0L
        val from = todayDate.minusDays((days - 1).toLong())
        var sum = 0L
        for ((k, v) in counts) {
            val kd = parseOrNull(k) ?: continue
            if (kd.isBefore(from)) continue
            if (kd.isAfter(todayDate)) continue
            sum += v.toLong()
        }
        return sum
    }

    /**
     * "2026-10-31=12;2026-10-30=5", sorted by date so a re-encode of an unchanged map is identical.
     * Keys that do not parse as a date, or values that are not non-negative ints, are skipped.
     */
    fun encode(counts: Map<String, Int>): String {
        if (counts.isEmpty()) return ""
        val keys = ArrayList<String>(counts.size)
        for (k in counts.keys) if (parseOrNull(k) != null) keys.add(k)
        keys.sort()
        val sb = StringBuilder(keys.size * 16)
        for (i in keys.indices) {
            if (i > 0) sb.append(';')
            sb.append(keys[i]).append('=').append(counts[keys[i]])
        }
        return sb.toString()
    }

    /**
     * Inverse of [encode]. Tolerates whitespace, empty entries, missing '=', non-numeric or negative
     * values, and non-date keys; each bad entry is dropped and the rest is kept.
     */
    fun decode(s: String): Map<String, Int> {
        if (s.isEmpty()) return emptyMap()
        val result = HashMap<String, Int>()
        for (raw in s.split(';')) {
            val piece = raw.trim()
            if (piece.isEmpty()) continue
            val eq = piece.indexOf('=')
            if (eq <= 0 || eq == piece.length - 1) continue
            val key = piece.substring(0, eq).trim()
            val valStr = piece.substring(eq + 1).trim()
            if (parseOrNull(key) == null) continue
            val v = valStr.toIntOrNull() ?: continue
            if (v < 0) continue
            result[key] = v
        }
        return result
    }

    private fun parseOrNull(s: String): LocalDate? = try {
        // LocalDate.parse with ISO_LOCAL_DATE accepts yyyy-MM-dd and rejects everything else,
        // including strings with a time part, which is what we want for these keys.
        LocalDate.parse(s)
    } catch (_: DateTimeParseException) {
        null
    }
}
