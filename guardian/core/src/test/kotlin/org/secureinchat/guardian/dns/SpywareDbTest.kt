// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.nio.file.Files
import java.nio.file.Paths

private var sn = 0
private fun st(name: String, block: () -> Unit) {
    try { block(); sn++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun seq(actual: Any?, expected: Any?) { check(actual == expected) { "expected $expected, got $actual" } }

private const val SAMPLE = "# comment\n" +
    "copy9.com\tCopy9\tstalkerware\t1\n" +
    "12d60.firebaseio.com\tTrackplus\tstalkerware\t0\n" +
    "mycloud.wisemo.com\tWiseMo\twatchware\t0\n"

fun main() {
    st("exact and subdomain match, label boundaries respected") {
        val db = SpywareDb.parse(SAMPLE)
        seq(db.size, 3)
        seq(db.match("copy9.com")?.app, "Copy9")
        seq(db.match("api.v2.copy9.com")?.app, "Copy9")
        seq(db.match("COPY9.com.")?.app, "Copy9")          // case and trailing dot
        seq(db.match("notcopy9.com"), null)                 // not a label boundary
        seq(db.match("copy9.com.evil.net"), null)
        seq(db.match("com"), null)
    }

    st("a listed project subdomain does not flag the whole platform") {
        val db = SpywareDb.parse(SAMPLE)
        seq(db.match("12d60.firebaseio.com")?.app, "Trackplus")
        seq(db.match("myapp-123.firebaseio.com"), null)
        seq(db.match("firebaseio.com"), null)
    }

    st("kind and website flag are carried") {
        val db = SpywareDb.parse(SAMPLE)
        seq(db.match("mycloud.wisemo.com")?.kind, SpywareKind.WATCHWARE)
        seq(db.match("copy9.com")?.alsoWebsite, true)
        seq(db.match("12d60.firebaseio.com")?.alsoWebsite, false)
    }

    st("bad rows and shared-platform rows are skipped, never thrown") {
        val db = SpywareDb.parse(
            "firebaseio.com\tX\tstalkerware\t0\n" +   // whole platform: must be dropped
            "amazonaws.com\tX\tstalkerware\t0\n" +
            "nodot\tX\tstalkerware\t0\n" +
            "ok.example\tOk\tunknownkind\t0\n" +
            "short\trow\n" +
            "\tEmpty\tstalkerware\t0\n" +
            "good.example\tGood\tstalkerware\t0\n"
        )
        seq(db.size, 1)
        seq(db.match("x.amazonaws.com"), null)
        seq(db.match("good.example")?.app, "Good")
    }

    st("watch: one alert per domain per quiet period, separate domains separate") {
        var now = 1_000_000L
        val w = SpywareWatch(SpywareDb.parse(SAMPLE), quietMs = 60_000L, clock = { now })
        check(w.check("a.copy9.com") != null)
        seq(w.check("b.copy9.com"), null)          // same listed domain, still quiet
        check(w.check("12d60.firebaseio.com") != null)
        seq(w.check("example.org"), null)
        now += 60_000L
        check(w.check("copy9.com") != null)        // quiet period over
        seq(w.recent().map { it.indicator.app }, listOf("Copy9", "Trackplus", "Copy9"))
    }

    st("watch keeps only the most recent alerts") {
        var now = 0L
        val rows = (1..30).joinToString("") { "d$it.example\tApp$it\tstalkerware\t0\n" }
        val w = SpywareWatch(SpywareDb.parse(rows), clock = { now++ })
        for (i in 1..30) check(w.check("d$i.example") != null)
        seq(w.recent().size, SpywareWatch.MAX_RECENT)
        seq(w.recent().first().indicator.app, "App30")
    }

    st("watch is safe under concurrent queries: exactly one alert for a burst") {
        // Many short rounds, all threads released at once, so an unlocked check-then-set shows up as a
        // round with two alerts.
        val db = SpywareDb.parse(SAMPLE)
        var badRounds = 0
        repeat(300) {
            val w = SpywareWatch(db)
            val start = java.util.concurrent.CountDownLatch(1)
            val alerts = java.util.concurrent.atomic.AtomicInteger()
            val ts = (0 until 8).map { Thread { start.await(); repeat(20) { if (w.check("x.copy9.com") != null) alerts.incrementAndGet() } } }
            ts.forEach { it.start() }; start.countDown(); ts.forEach { it.join() }
            if (alerts.get() != 1) badRounds++
        }
        seq(badRounds, 0)
    }

    st("real Echap data loads and contains no shared-platform domain") {
        val path = Paths.get("app/src/main/assets/stalkerware-echap.tsv")
        val text = Files.readString(path)
        check(text.lineSequence().first().contains("CC-BY 4.0")) { "attribution header missing" }
        val raw = text.lineSequence().filter { it.isNotBlank() && !it.startsWith("#") }.map { it.split('\t')[0] }.toList()
        val shared = raw.filter { it in SpywareDb.SHARED_PLATFORMS }
        check(shared.isEmpty()) { "shared platforms listed: $shared" }
        val db = SpywareDb.parse(text)
        check(db.size >= 500) { "only ${db.size} domains" }
        seq(db.size, raw.size)
        // Ordinary names must not match.
        for (n in listOf("google.com", "www.wikipedia.org", "graph.facebook.com", "firebaseio.com", "example.com"))
            seq(db.match(n), null)
        println("real list: ${db.size} domains")
    }

    println("SpywareDbTest: $sn passed")
}
