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
private fun eq(actual: Any?, expected: Any?) { check(actual == expected) { "expected $expected, got $actual" } }

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

    t("byDomain ignores case") {
        val db = TrackerDb.parse("1\tInMobi\tAdvertisement\thttp://inmobi.com\tinmobi\\.com\tcom.inmobi.")
        eq(db.byDomain("W.InMobi.COM")?.name, "InMobi")
    }

    t("results stay correct after the LRU evicts") {
        val db = TrackerDb.parse("1\tA\tAnalytics\thttp://a.com\ttrk\\.example\t")
        eq(db.byDomain("x.trk.example")?.id, 1)
        eq(db.byDomain("miss.example"), null)
        // Far more distinct names than the 512-entry cache holds, so both earlier entries are evicted.
        for (i in 0 until 2000) db.byDomain("n$i.other.example")
        eq(db.byDomain("x.trk.example")?.id, 1)
        eq(db.byDomain("miss.example"), null)
    }

    t("concurrent lookups agree") {
        val db = TrackerDb.parse("1\tA\tAnalytics\thttp://a.com\ttrk\\.example\t")
        val errors = java.util.concurrent.atomic.AtomicInteger()
        val threads = (0 until 8).map { k ->
            Thread {
                for (i in 0 until 3000) {
                    val hit = db.byDomain("h${i % 700}.trk.example")
                    val miss = db.byDomain("m${(i + k) % 700}.none.example")
                    if (hit?.id != 1 || miss != null) errors.incrementAndGet()
                }
            }
        }
        threads.forEach { it.start() }
        threads.forEach { it.join() }
        eq(errors.get(), 0)
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
        // DoubleClick" with doubleclick\.net in its regex) this should pass on doubleclick.net.
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

    // G15b: rows that only say "any subdomain of one domain" do not name a tracker.
    t("broad regex detection") {
        check(TrackerDb.isBroadRegex("\\.google\\.com"))
        check(TrackerDb.isBroadRegex("\\.facebook\\.com|\\.fb\\.com"))
        check(!TrackerDb.isBroadRegex("doubleclick\\.net"))                  // the tracker's own domain, no leading dot
        check(!TrackerDb.isBroadRegex("ads\\.bigco\\.com"))                 // a specific host
        check(!TrackerDb.isBroadRegex("\\.bigco\\.com|ads\\.other\\.com"))   // mixed: something specific remains
        check(!TrackerDb.isBroadRegex("\\.(bigco)\\.com"))                  // groups are never treated as broad
        check(!TrackerDb.isBroadRegex(""))
    }

    t("byDomain skips broad rows but keeps their other data") {
        val tsv = "1\tBigCo Ads\tAdvertisement\thttp://bigco.com\t\\.bigco\\.com\tcom.bigco.ads.\n" +
            "2\tBigCo Metrics\tAnalytics\thttp://bigco.com\tmetrics\\.bigco\\.com\t"
        val db = TrackerDb.parse(tsv)
        eq(db.byDomain("mail.bigco.com"), null)
        eq(db.byDomain("metrics.bigco.com")?.id, 2)   // a specific row under the same domain still matches
        eq(db.byClassName("com.bigco.ads.Banner")?.id, 1) // code signatures are unaffected (G17)
        eq(db.broadCount, 1)
        eq(db.withNetwork, 2)
    }

    t("real data: Google and Facebook first-party names get no tracker label") {
        val db = TrackerDb.parse(Files.readString(Paths.get("app/src/main/assets/trackers-exodus.tsv")))
        eq(db.byDomain("mail.google.com"), null)
        eq(db.byDomain("www.google.com"), null)
        eq(db.byDomain("graph.facebook.com"), null)
        eq(db.byDomain("doubleclick.net")?.name, "Google DoubleClick")
        eq(db.byDomain("stats.g.doubleclick.net")?.name, "Google DoubleClick")
        eq(db.byDomain("pagead2.googlesyndication.com")?.name, "Google AdMob")
        check(db.broadCount in 1..30) { "broadCount ${db.broadCount}" }
        println("real tsv: ${db.broadCount} broad rows skipped by byDomain")
    }

    println("TrackerDbTest: $tn passed")
}
