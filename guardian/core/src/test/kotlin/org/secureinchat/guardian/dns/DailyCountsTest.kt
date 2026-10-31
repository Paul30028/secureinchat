// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

private var dn = 0
private fun dt(name: String, block: () -> Unit) {
    try { block(); dn++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun deq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

fun main() {

    dt("accumulates into an existing day") {
        var c: Map<String, Int> = emptyMap()
        c = DailyCounts.add(c, "2026-01-02", 3, 7, "2026-01-02")
        c = DailyCounts.add(c, "2026-01-02", 5, 7, "2026-01-02")
        deq(c["2026-01-02"], 8)
        deq(c.size, 1)
    }

    dt("keeps previous days inside the window") {
        var c: Map<String, Int> = emptyMap()
        c = DailyCounts.add(c, "2026-01-01", 4, 7, "2026-01-01")
        c = DailyCounts.add(c, "2026-01-02", 6, 7, "2026-01-02")
        deq(c["2026-01-01"], 4)
        deq(c["2026-01-02"], 6)
        deq(c.size, 2)
    }

    dt("entries older than keepDays are dropped") {
        var c: Map<String, Int> = hashMapOf(
            "2025-12-24" to 1,
            "2025-12-25" to 1,
            "2025-12-26" to 1,
            "2025-12-27" to 1,   // cutoff for today=2026-01-02, keep=7 is 2025-12-27
            "2025-12-30" to 2,
            "2026-01-01" to 3
        )
        c = DailyCounts.add(c, "2026-01-02", 1, 7, "2026-01-02")
        // 2025-12-24..26 pruned; 12-27..01-02 kept (7 days).
        deq(c.keys.sorted(), listOf(
            "2025-12-27", "2025-12-30", "2026-01-01", "2026-01-02"
        ))
    }

    dt("n <= 0 returns the map unchanged") {
        val c = hashMapOf("2026-01-02" to 5)
        deq(DailyCounts.add(c, "2026-01-02", 0, 7, "2026-01-02"), c)
        deq(DailyCounts.add(c, "2026-01-02", -3, 7, "2026-01-02"), c)
    }

    dt("counter saturates at Int.MAX_VALUE") {
        val c = hashMapOf("2026-01-02" to Int.MAX_VALUE - 5)
        val r = DailyCounts.add(c, "2026-01-02", 10, 7, "2026-01-02")
        deq(r["2026-01-02"], Int.MAX_VALUE)
    }

    dt("add with a malformed today is a no-op") {
        val c = hashMapOf("2026-01-02" to 5)
        deq(DailyCounts.add(c, "2026-01-02", 10, 7, "not-a-date"), c)
    }

    dt("malformed keys are pruned on the next add") {
        var c: Map<String, Int> = hashMapOf("garbage" to 9, "2026-01-02" to 1)
        c = DailyCounts.add(c, "2026-01-02", 1, 7, "2026-01-02")
        deq(c.keys, setOf("2026-01-02"))
        deq(c["2026-01-02"], 2)
    }

    dt("total sums the last N days inclusive") {
        val c = hashMapOf(
            "2025-12-26" to 100,   // outside
            "2025-12-27" to 1,     // 7 days back from 2026-01-02
            "2025-12-28" to 2,
            "2025-12-29" to 4,
            "2025-12-30" to 8,
            "2025-12-31" to 16,
            "2026-01-01" to 32,
            "2026-01-02" to 64
        )
        deq(DailyCounts.total(c, "2026-01-02", 7), 127L)
        deq(DailyCounts.total(c, "2026-01-02", 1), 64L)
        deq(DailyCounts.total(c, "2026-01-02", 0), 0L)
        deq(DailyCounts.total(c, "2026-01-02", -1), 0L)
        deq(DailyCounts.total(c, "2026-01-03", 7), 126L)   // window moves to 12-28..01-03: 12-27 drops out, 01-03 has no entry
    }

    dt("total ignores malformed keys and dates") {
        val c = hashMapOf(
            "garbage" to 999,
            "2026-13-01" to 999,
            "2026-01-02" to 3
        )
        deq(DailyCounts.total(c, "2026-01-02", 1), 3L)
        deq(DailyCounts.total(c, "bad", 7), 0L)
    }

    dt("encode/decode round trip") {
        val c = hashMapOf(
            "2026-01-02" to 3,
            "2025-12-30" to 10,
            "2026-01-01" to 0
        )
        val s = DailyCounts.encode(c)
        // Sorted by date, so the string is deterministic.
        deq(s, "2025-12-30=10;2026-01-01=0;2026-01-02=3")
        deq(DailyCounts.decode(s), c)
    }

    dt("decode tolerates bad entries") {
        val s = "2026-01-02=3;; 2026-01-01 = 5 ;garbage;2026-01-03=abc;2026-01-04=-1;bad=1"
        val d = DailyCounts.decode(s)
        deq(d["2026-01-02"], 3)
        deq(d["2026-01-01"], 5)
        check(!d.containsKey("2026-01-03")) { "non-numeric value kept" }
        check(!d.containsKey("2026-01-04")) { "negative value kept" }
        check(!d.containsKey("bad")) { "non-date key kept" }
    }

    dt("encode/decode of empty") {
        deq(DailyCounts.encode(emptyMap()), "")
        deq(DailyCounts.decode(""), emptyMap<String, Int>())
    }

    dt("integrated: add, encode, decode, total") {
        var c: Map<String, Int> = emptyMap()
        c = DailyCounts.add(c, "2026-01-02", 3, 7, "2026-01-02")
        c = DailyCounts.add(c, "2026-01-02", 4, 7, "2026-01-02")
        c = DailyCounts.add(c, "2026-01-03", 5, 7, "2026-01-03")
        val round = DailyCounts.decode(DailyCounts.encode(c))
        deq(round, c)
        deq(DailyCounts.total(round, "2026-01-03", 2), 12L)
        deq(DailyCounts.total(round, "2026-01-03", 7), 12L)
    }

    println("DailyCountsTest: $dn passed")
}
