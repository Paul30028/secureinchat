// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

private var urn = 0
private fun urt(name: String, block: () -> Unit) {
    try { block(); urn++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun ureq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

fun main() {

    urt("user block hits the domain and its subdomains, not siblings") {
        val base = Blocklist.parse("")
        val ext = base.plusBlocked(listOf("tracker.example.com"))
        check(ext.isBlocked("tracker.example.com")) { "exact" }
        check(ext.isBlocked("sub.tracker.example.com")) { "sub" }
        check(ext.isBlocked("a.b.tracker.example.com")) { "nested sub" }
        check(!ext.isBlocked("example.com")) { "parent" }
        check(!ext.isBlocked("badtracker.example.com")) { "sibling" }
        check(!ext.isBlocked("other.example.com")) { "other" }
        // base untouched
        check(!base.isBlocked("tracker.example.com")) { "base exact" }
        check(!base.isBlocked("sub.tracker.example.com")) { "base sub" }
    }

    urt("user allow wins over user block of the same name") {
        val base = Blocklist.parse("")
        val ext = base.plusBlocked(listOf("tracker.example.com"))
            .plusAllowed(listOf("tracker.example.com"))
        check(!ext.isBlocked("tracker.example.com")) { "exact allow" }
        check(!ext.isBlocked("sub.tracker.example.com")) { "sub allow" }
    }

    urt("order of plusBlocked / plusAllowed does not change the outcome") {
        val base = Blocklist.parse("")
        val a = base.plusBlocked(listOf("blocked.example.com"))
            .plusAllowed(listOf("safe.example.com"))
        val b = base.plusAllowed(listOf("safe.example.com"))
            .plusBlocked(listOf("blocked.example.com"))
        for (bl in listOf(a, b)) {
            check(bl.isBlocked("blocked.example.com")) { "blocked" }
            check(bl.isBlocked("x.blocked.example.com")) { "blocked sub" }
            check(!bl.isBlocked("safe.example.com")) { "safe" }
            check(!bl.isBlocked("y.safe.example.com")) { "safe sub" }
        }
    }

    urt("user block beats a builtin @@ allow") {
        // Builtin list contains both a block and an @@ allow for the same name. Without any user
        // rule, the builtin allow wins, as before.
        val text = "@@||internal.example.com^\ninternal.example.com"
        val base = Blocklist.parse(text)
        check(!base.isBlocked("internal.example.com")) { "builtin allow vs builtin block" }
        check(!base.isBlocked("sub.internal.example.com")) { "builtin allow sub" }

        // User block must override the builtin @@ rule.
        val ext = base.plusBlocked(listOf("internal.example.com"))
        check(ext.isBlocked("internal.example.com")) { "user block vs builtin allow" }
        check(ext.isBlocked("sub.internal.example.com")) { "user block vs builtin allow sub" }

        // base untouched
        check(!base.isBlocked("internal.example.com")) { "base unchanged" }
    }

    urt("user allow beats a builtin block") {
        val base = Blocklist.parse("tracker.example.com")
        check(base.isBlocked("tracker.example.com")) { "builtin block" }
        val ext = base.plusAllowed(listOf("tracker.example.com"))
        check(!ext.isBlocked("tracker.example.com")) { "user allow" }
        check(!ext.isBlocked("sub.tracker.example.com")) { "user allow sub" }
        // base untouched
        check(base.isBlocked("tracker.example.com")) { "base unchanged" }
    }

    urt("invalid inputs are ignored and leave the source untouched") {
        val base = Blocklist.parse("example.com")
        val bad = listOf(
            "", "com", "..", "a..b.com",
            "-x.com", "x-.com",
            "a".repeat(64) + ".com",
            "\u4e2d\u6587.com",
            " leading-space.com " // trims to a valid name, actually accepted
        )
        val extBlocked = base.plusBlocked(bad)
        // The entries that survive normalization are the trimmable one; everything else is dropped.
        check(extBlocked.isBlocked("leading-space.com")) { "trimmed accepted" }
        check(!extBlocked.isBlocked("com")) { "com not blocked" }
        check(extBlocked.isBlocked("example.com")) { "builtin still applies" }
        // base unchanged
        check(!base.isBlocked("leading-space.com")) { "base no user block" }
        check(base.isBlocked("example.com")) { "base builtin" }
        // Counts reflect the builtin list only.
        val ref = Blocklist.parse("example.com")
        ureq(extBlocked.blockedCount, ref.blockedCount)

        val extAllowed = base.plusAllowed(bad)
        check(extAllowed.isBlocked("example.com")) { "user allow of invalid ignored, builtin still active" }
        check(!extAllowed.isBlocked("leading-space.com")) { "user allow of trimmed name accepted" }
        check(!base.isBlocked("leading-space.com")) { "base no user allow" }
    }

    urt("blockedCount / allowedCount describe builtin lists, not user lists") {
        val base = Blocklist.parse("a.example.com\n@@||b.example.com^")
        ureq(base.blockedCount, 1)
        ureq(base.allowedCount, 1)
        val ext = base.plusBlocked(listOf("c.example.com"))
            .plusAllowed(listOf("d.example.com"))
        ureq(ext.blockedCount, 1)
        ureq(ext.allowedCount, 1)
    }

    println("UserRulesTest: $urn passed")
}
