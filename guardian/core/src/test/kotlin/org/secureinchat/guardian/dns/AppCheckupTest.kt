// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.nio.file.Files
import java.nio.file.Paths
import org.secureinchat.guardian.dns.AppCheckup.AppFacts
import org.secureinchat.guardian.dns.AppCheckup.Level
import org.secureinchat.guardian.dns.AppCheckup.PhoneFacts
import org.secureinchat.guardian.dns.AppCheckup.PhoneIssue
import org.secureinchat.guardian.dns.AppCheckup.Signal

private var an = 0
private fun at(name: String, block: () -> Unit) {
    try { block(); an++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun aeq(actual: Any?, expected: Any?) { check(actual == expected) { "expected $expected, got $actual" } }

private const val P = "android.permission."
private fun app(
    pkg: String, label: String = pkg, system: Boolean = false, launcher: Boolean = true, game: Boolean = false,
    granted: Set<String> = emptySet(), a11y: Boolean = false, admin: Boolean = false, notif: Boolean = false,
    overlay: Boolean = false,
) = AppFacts(pkg, label, system, launcher, game, granted, a11y, admin, notif, overlay)

private val LIST = AppCheckup.parseList(
    "# header\n# package\tapp\tkind\n" +
        "com.spy.thing\tSpyThing\tstalkerware\n" +
        "com.parent.watch\tWatchKid\twatchware\n" +
        "bad line without tabs\n"
)

fun main() {
    at("list parsing: comments and malformed lines skipped, kinds kept") {
        aeq(LIST.size, 2)
        aeq(LIST["com.spy.thing"]?.watchware, false)
        aeq(LIST["com.parent.watch"]?.watchware, true)
    }

    at("a plain app with ordinary permissions is not reported") {
        val r = AppCheckup.evaluate(listOf(app("com.notes", granted = setOf(P + "INTERNET", P + "CAMERA"))), LIST)
        aeq(r, emptyList<AppCheckup.Finding>())
    }

    at("listed stalkerware is HIGH even with no permissions; watchware is REVIEW") {
        val r = AppCheckup.evaluate(listOf(app("com.spy.thing", "Calculator"), app("com.parent.watch")), LIST)
        aeq(r.map { it.app.packageName to it.level }, listOf("com.spy.thing" to Level.HIGH, "com.parent.watch" to Level.REVIEW))
        aeq(r[0].signals, listOf(Signal.STALKERWARE))
        aeq(r[0].listedAs, "SpyThing") // the real product name, not the disguise label
    }

    at("screen reading, device admin and notification access are HIGH") {
        for ((a, sig) in listOf(
            app("x.a", a11y = true) to Signal.ACCESSIBILITY,
            app("x.b", admin = true) to Signal.DEVICE_ADMIN,
            app("x.c", notif = true) to Signal.NOTIFICATION_LISTENER,
        )) {
            val f = AppCheckup.evaluate(listOf(a), LIST).single()
            aeq(f.level, Level.HIGH); aeq(f.signals, listOf(sig))
        }
    }

    at("hidden app is HIGH only when it holds a sensitive permission") {
        aeq(AppCheckup.evaluate(listOf(app("h.a", launcher = false, granted = setOf(P + "INTERNET"))), LIST), emptyList<AppCheckup.Finding>())
        val f = AppCheckup.evaluate(listOf(app("h.b", launcher = false, granted = setOf(P + "RECORD_AUDIO"))), LIST).single()
        aeq(f.signals, listOf(Signal.HIDDEN_WITH_SENSITIVE)); aeq(f.level, Level.HIGH)
    }

    at("background location, SMS and call log are REVIEW") {
        val f = AppCheckup.evaluate(listOf(app("r.a", granted = setOf(P + "ACCESS_BACKGROUND_LOCATION", P + "READ_SMS", P + "READ_CALL_LOG"))), LIST).single()
        aeq(f.level, Level.REVIEW)
        aeq(f.signals, listOf(Signal.BACKGROUND_LOCATION, Signal.SMS, Signal.CALL_LOG))
    }

    at("a game with microphone is REVIEW; a non-game with microphone is not reported") {
        aeq(AppCheckup.evaluate(listOf(app("g.a", game = true, granted = setOf(P + "RECORD_AUDIO"))), LIST).single().signals, listOf(Signal.GAME_SENSITIVE))
        aeq(AppCheckup.evaluate(listOf(app("g.b", game = false, granted = setOf(P + "RECORD_AUDIO"))), LIST), emptyList<AppCheckup.Finding>())
    }

    at("preinstalled system apps are only reported when listed") {
        aeq(AppCheckup.evaluate(listOf(app("sys.a", system = true, a11y = true, admin = true, launcher = false,
            granted = AppCheckup.SENSITIVE)), LIST), emptyList<AppCheckup.Finding>())
        aeq(AppCheckup.evaluate(listOf(app("com.spy.thing", system = true)), LIST).single().signals, listOf(Signal.STALKERWARE))
    }

    at("drawing over other apps is REVIEW") {
        val f = AppCheckup.evaluate(listOf(app("o.a", overlay = true)), LIST).single()
        aeq(f.level, Level.REVIEW); aeq(f.signals, listOf(Signal.OVERLAY))
    }

    at("component lists from secure settings: packages, malformed parts skipped") {
        aeq(AppCheckup.packagesOfComponents("com.a/com.a.Svc:com.b/.L"), setOf("com.a", "com.b"))
        aeq(AppCheckup.packagesOfComponents("garbage::/x:"), emptySet<String>())
        aeq(AppCheckup.packagesOfComponents(null), emptySet<String>())
    }

    at("Guardian itself is never reported") {
        aeq(AppCheckup.evaluate(listOf(app("org.secureinchat.guardian", a11y = true)), LIST, "org.secureinchat.guardian"), emptyList<AppCheckup.Finding>())
    }

    at("order: HIGH first, then more signals, then name") {
        val r = AppCheckup.evaluate(listOf(
            app("z.review", "Zed", granted = setOf(P + "READ_SMS")),
            app("b.high1", "Bee", a11y = true),
            app("a.high2", "Ant", a11y = true, admin = true),
            app("c.high1", "Cat", admin = true),
        ), LIST)
        aeq(r.map { it.app.label }, listOf("Ant", "Bee", "Cat", "Zed"))
    }

    at("counts and per-kind lists skip system apps and Guardian") {
        val apps = listOf(
            app("u.a", "Alpha", granted = setOf(P + "ACCESS_FINE_LOCATION", P + "RECORD_AUDIO")),
            app("u.b", "beta", granted = setOf(P + "ACCESS_COARSE_LOCATION")),
            app("s.c", system = true, granted = setOf(P + "ACCESS_FINE_LOCATION")),
            app("me", granted = setOf(P + "ACCESS_FINE_LOCATION")),
        )
        val c = AppCheckup.counts(apps, "me")
        aeq(c[AppCheckup.Kind.LOCATION], 2); aeq(c[AppCheckup.Kind.MICROPHONE], 1); aeq(c[AppCheckup.Kind.SMS], 0)
        aeq(AppCheckup.appsWith(AppCheckup.Kind.LOCATION, apps, "me").map { it.label }, listOf("Alpha", "beta"))
    }

    at("phone: no screen lock is HIGH, USB debugging and an old patch are REVIEW, unknown facts are left out") {
        val all = AppCheckup.phoneIssues(PhoneFacts(false, true, "2025-01-05", 2026, 11))
        aeq(all, listOf(PhoneIssue.NO_SCREEN_LOCK, PhoneIssue.USB_DEBUGGING, PhoneIssue.OLD_SECURITY_PATCH))
        aeq(PhoneIssue.NO_SCREEN_LOCK.level, Level.HIGH)
        aeq(AppCheckup.phoneIssues(PhoneFacts(true, false, "2026-10-01", 2026, 11)), emptyList<PhoneIssue>())
        aeq(AppCheckup.phoneIssues(PhoneFacts(null, null, null, 2026, 11)), emptyList<PhoneIssue>())
    }

    at("patch age: exact month boundary and malformed dates") {
        aeq(AppCheckup.patchAgeMonths("2026-05-01", 2026, 11), 6)
        aeq(AppCheckup.patchAgeMonths("2026-06-01", 2026, 11), 5)
        aeq(AppCheckup.patchAgeMonths("2025-12-05", 2026, 1), 1)
        aeq(AppCheckup.patchAgeMonths("garbage", 2026, 11), null)
        aeq(AppCheckup.patchAgeMonths("2026-13-01", 2026, 11), null)
        aeq(AppCheckup.phoneIssues(PhoneFacts(true, false, "2026-06-01", 2026, 11)), emptyList<PhoneIssue>())
        aeq(AppCheckup.phoneIssues(PhoneFacts(true, false, "2026-05-01", 2026, 11)), listOf(PhoneIssue.OLD_SECURITY_PATCH))
    }

    at("real Echap package list: attributed, large, no real Google or Android core package listed") {
        val path = Paths.get("app/src/main/assets/stalkerware-packages-echap.tsv")
        val text = String(Files.readAllBytes(path), Charsets.UTF_8)
        check(text.startsWith("# Stalkerware Android packages: Echap")) { "missing attribution header" }
        check("CC-BY 4.0" in text)
        val list = AppCheckup.parseList(text)
        check(list.size >= 500) { "only ${list.size} packages" }
        for (real in listOf("com.android.chrome", "com.google.android.gms", "com.android.settings", "com.whatsapp",
                "com.android.vending", "com.google.android.apps.maps", "com.facebook.katana")) {
            check(real !in list) { "$real is on the list" }
        }
        println("real list: ${list.size} packages")
    }

    println("AppCheckupTest: $an passed")
}
