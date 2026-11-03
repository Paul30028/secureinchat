// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.nio.file.Files
import java.nio.file.Paths

private var tn = 0
private fun t(name: String, block: () -> Unit) {
    try { block(); tn++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun eq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

fun main() {

    t("parse normal rows") {
        val tsv = """
            # comment
            1	Teemo	Analytics	https://www.teemo.co	databerries\.com	com.databerries.|com.geolocstation.
            2	FidZup	Analytics	https://www.fidzup.com	fidzup	com.fidzup.
            3	Audience Studio (Krux)	Analytics,Profiling	https://www.salesforce.com	krxd\.net	com.krux.androidsdk
        """.trimIndent()
        val db = TrackerDb.parse(tsv)
        eq(db.size, 3)
        eq(db.withNetwork, 3)
        val teemo = db.byDomain("x.databerries.com")
        eq(teemo?.name, "Teemo")
        eq(teemo?.id, 1)
        eq(teemo?.categories, listOf("Analytics"))
    }

    t("empty categories kept as empty list") {
        val tsv = "1	Empty		http://x.com	x\\.com	"
        val db = TrackerDb.parse(tsv)
        eq(db.size, 1)
        val tr = db.byDomain("x.com")
        eq(tr?.name, "Empty")
        eq(tr?.categories, emptyList<String>())
    }

    t("bad rows skipped, bad regex dropped to null") {
        val tsv = """
            1	Good	Analytics	http://good.com	good\.com	com.good.
            notanumber	Bad	X	http://bad.com	bad\.com	com.bad.
            2	OnlyThree	X
            3	NoRegexCompiles	Analytics	http://nre.com	*invalid(	com.nre.
            4	NoSigs	Analytics	http://ns.com	ns\.com	
        """.trimIndent()
        val db = TrackerDb.parse(tsv)
        // Rows kept: Good, NoRegexCompiles (tracker row valid, regex null), NoSigs (empty sigs).
        eq(db.size, 3)
        // Only Good and NoSigs have a usable network regex.
        eq(db.withNetwork, 2)
        eq(db.byDomain("good.com")?.name, "Good")
        eq(db.byDomain("nre.com"), null)  // bad regex means no network match
    }

    t("byDomain uses containsMatchIn, not full match") {
        val tsv = "1	InMobi	Advertisement	http://inmobi.com	inmobi\\.com	com.inmobi."
        val db = TrackerDb.parse(tsv)
        eq(db.byDomain("w.inmobi.com")?.name, "InMobi")
        eq(db.byDomain("inmobi.com")?.name, "InMobi")
        eq(db.byDomain("example.org"), null)
    }

    t("multiple matches pick the smallest id") {
        val tsv = """
            10	LowPrio	Advertisement	http://x.com	doubleclick\.net	com.x.
            3	HighPrio	Advertisement	http://y.com	doubleclick\.net	com.y.
            7	Mid	Advertisement	http://z.com	doubleclick\.net	com.z.
        """.trimIndent()
        val db = TrackerDb.parse(tsv)
        eq(db.byDomain("stats.g.doubleclick.net")?.id, 3)
        // Same lookup, cached; must be identical.
        eq(db.byDomain("stats.g.doubleclick.net")?.id, 3)
    }

    t("misses are cached and stay null") {
        val tsv = "1	A	Analytics	http://a.com	a\\.com	"
        val db = TrackerDb.parse(tsv)
        eq(db.byDomain("nomatch.org"), null)
        eq(db.byDomain("nomatch.org"), null)
        eq(db.byDomain("x.a.com")?.id, 1)
        eq(db.byDomain("x.a.com")?.id, 1)
    }

    t("byClassName prefix, with and without trailing dot") {
        val tsv = """
            1	Teemo	Analytics	http://teemo.co	databerries\.com	com.databerries.
            2	Krux	Analytics	http://krux.com	krxd\.net	com.krux.androidsdk
        """.trimIndent()
        val db = TrackerDb.parse(tsv)
        // Trailing-dot signature: matches only when the dot is present in the prefix.
        eq(db.byClassName("com.databerries.Foo")?.id, 1)
        eq(db.byClassName("com.databerries")?.id, null)
        eq(db.byClassName("com.databerriesx")?.id, null)
        // Non-dotted signature: matches any class name with that prefix, including "com.krux.androidsdkx".
        eq(db.byClassName("com.krux.androidsdk.Foo")?.id, 2)
        eq(db.byClassName("com.krux.androidsdkx")?.id, 2)
        eq(db.byClassName("org.other")?.id, null)
    }

    t("empty tsv gives empty db") {
        val db = TrackerDb.parse("")
        eq(db.size, 0)
        eq(db.withNetwork, 0)
        eq(db.byDomain("example.com"), null)
        eq(db.byClassName("com.example.Foo"), null)
    }

    t("real exodus tsv loads") {
        // CWD is guardian/ when CI runs; this path is relative to that.
        val path = Paths.get("app/src/main/assets/trackers-exodus.tsv")
        check(Files.exists(path)) {
            "trackers-exodus.tsv not found at $path (CWD=${Paths.get("").toAbsolutePath()})"
        }
        val text = Files.readString(path)
        val db = TrackerDb.parse(text)
        check(db.size >= 400) { "expected >= 400 trackers, got ${db.size}" }
        check(db.withNetwork >= 250) { "expected >= 250 with network, got ${db.withNetwork}" }
        // At least one of these two must map to some tracker. The spec explicitly says: if neither
        // does, report it, do not weaken the assertion. Per the TSV excerpt line 5 ("Google
        // DoubleClick" with doubleclick\\.net in its regex) this should pass on doubleclick.net.
        val dc = db.byDomain("doubleclick.net")
        val bb = db.byDomain("bat.bing.com")
        check(dc != null || bb != null) {
            "neither doubleclick.net nor bat.bing.com maps to a tracker (dc=$dc, bb=$bb)"
        }
        println(
            "real tsv: size=${db.size} withNetwork=${db.withNetwork} " +
            "doubleclick.net->${dc?.name} bat.bing.com->${bb?.name}"
        )
    }

    println("TrackerDbTest: $tn passed")
}
