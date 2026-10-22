// SPDX-License-Identifier: GPL-3.0-or-later
// Drafted by DeepSeek (T11-a), reviewed by Claude.
package org.secureinchat.permcheck.core

private var n = 0
private fun t(name: String, block: () -> Unit) { try { block(); n++ } catch (e: Throwable) { println("FAIL $name: ${e.message}"); throw e } }
private fun eq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

private fun expectIae(block: () -> Unit) {
    try {
        block()
    } catch (e: IllegalArgumentException) {
        return
    }
    error("expected IllegalArgumentException")
}

private const val CAMERA = "android.permission.CAMERA"
private const val MIC = "android.permission.MICROPHONE"
private const val SAW = "SYSTEM_ALERT_WINDOW"

fun main() {

    // ---- Validate.pkg ------------------------------------------------------
    t("pkg accepts dotted name") { eq(true, Validate.pkg("com.foo.bar")) }
    t("pkg accepts underscores and digits") { eq(true, Validate.pkg("com.foo_2.bar9")) }
    t("pkg accepts single-letter segments") { eq(true, Validate.pkg("a.b")) }
    t("pkg rejects semicolon injection") { eq(false, Validate.pkg("com.foo; rm -rf /")) }
    t("pkg rejects space") { eq(false, Validate.pkg("com.foo bar")) }
    t("pkg rejects single segment") { eq(false, Validate.pkg("android")) }
    t("pkg rejects leading digit") { eq(false, Validate.pkg("1com.foo")) }
    t("pkg rejects empty") { eq(false, Validate.pkg("")) }
    t("pkg rejects trailing dot") { eq(false, Validate.pkg("com.foo.")) }

    // ---- Validate.permission ----------------------------------------------
    t("permission accepts standard") { eq(true, Validate.permission(CAMERA)) }
    t("permission rejects space") { eq(false, Validate.permission("android.permission CAMERA")) }
    t("permission rejects quote") { eq(false, Validate.permission("$CAMERA\"x")) }
    t("permission rejects empty") { eq(false, Validate.permission("")) }
    t("permission rejects over 200 chars") { eq(false, Validate.permission("a".repeat(201))) }
    t("permission accepts exactly 200 chars") { eq(true, Validate.permission("a".repeat(200))) }

    // ---- Validate.op / Validate.mode --------------------------------------
    t("op accepts uppercase") { eq(true, Validate.op(SAW)) }
    t("op rejects lowercase") { eq(false, Validate.op("system_alert_window")) }
    t("op rejects dash") { eq(false, Validate.op("SYSTEM-ALERT")) }
    t("op rejects leading digit") { eq(false, Validate.op("1OP")) }
    t("mode accepts all five") {
        for (m in listOf("allow", "ignore", "deny", "default", "foreground")) eq(true, Validate.mode(m))
    }
    t("mode rejects everything else") {
        for (m in listOf("Allow", "ALLOW", "ask", "", "deny ")) eq(false, Validate.mode(m))
    }

    // ---- Commands argv -----------------------------------------------------
    t("Commands.revoke builds argv") {
        eq(
            listOf("pm", "revoke", "com.foo.bar", CAMERA),
            Commands.revoke(Change.RuntimeRevoke("com.foo.bar", CAMERA, 1L))
        )
    }
    t("Commands.undo(revoke) grants again") {
        eq(
            listOf("pm", "grant", "com.foo.bar", CAMERA),
            Commands.undo(Change.RuntimeRevoke("com.foo.bar", CAMERA, 1L))
        )
    }
    t("Commands.set builds argv") {
        eq(
            listOf("appops", "set", "com.foo.bar", SAW, "deny"),
            Commands.set(Change.AppOpSet("com.foo.bar", SAW, "allow", "deny", 1L))
        )
    }
    t("Commands.undo(appop) restores previous mode") {
        eq(
            listOf("appops", "set", "com.foo.bar", SAW, "allow"),
            Commands.undo(Change.AppOpSet("com.foo.bar", SAW, "allow", "deny", 1L))
        )
    }
    t("Commands.undo(Change) dispatches") {
        val c: Change = Change.RuntimeRevoke("com.foo.bar", CAMERA, 1L)
        eq(listOf("pm", "grant", "com.foo.bar", CAMERA), Commands.undo(c))
    }

    // ---- Commands refusals -------------------------------------------------
    t("Commands refuses self") {
        expectIae { Commands.revoke(Change.RuntimeRevoke(Commands.SELF, CAMERA, 1L)) }
    }
    t("Commands refuses systemui") {
        expectIae { Commands.revoke(Change.RuntimeRevoke("com.android.systemui", CAMERA, 1L)) }
    }
    t("Commands refuses settings") {
        expectIae { Commands.set(Change.AppOpSet("com.android.settings", SAW, "allow", "deny", 1L)) }
    }
    t("Commands refuses phone") {
        expectIae { Commands.revoke(Change.RuntimeRevoke("com.android.phone", CAMERA, 1L)) }
    }
    t("Commands refuses android package") {
        expectIae { Commands.revoke(Change.RuntimeRevoke("android", CAMERA, 1L)) }
    }
    t("Commands refuses android.* package") {
        expectIae { Commands.set(Change.AppOpSet("android.permission", SAW, "allow", "deny", 1L)) }
    }
    t("Commands refuses injected package") {
        expectIae { Commands.revoke(Change.RuntimeRevoke("com.foo; rm -rf /", CAMERA, 1L)) }
    }
    t("Commands refuses injected permission") {
        expectIae { Commands.revoke(Change.RuntimeRevoke("com.foo.bar", "$CAMERA --user 0", 1L)) }
    }
    t("Commands refuses lowercase op") {
        expectIae { Commands.set(Change.AppOpSet("com.foo.bar", "system_alert_window", "allow", "deny", 1L)) }
    }
    t("Commands refuses bad mode") {
        expectIae { Commands.set(Change.AppOpSet("com.foo.bar", SAW, "allow", "bogus", 1L)) }
    }

    // ---- Ledger.record -----------------------------------------------------
    t("record keeps first for same app-op") {
        val a = Change.AppOpSet("com.foo.bar", SAW, "allow", "deny", 10L)
        val b = Change.AppOpSet("com.foo.bar", SAW, "deny", "ignore", 20L)
        eq(listOf<Change>(a), Ledger.EMPTY.record(a).record(b).pending())
    }
    t("record keeps first for same permission") {
        val a = Change.RuntimeRevoke("com.foo.bar", CAMERA, 10L)
        val b = Change.RuntimeRevoke("com.foo.bar", CAMERA, 20L)
        eq(listOf<Change>(a), Ledger.EMPTY.record(a).record(b).pending())
    }
    t("record allows new change after restore") {
        val a = Change.AppOpSet("com.foo.bar", SAW, "allow", "deny", 10L)
        val b = Change.AppOpSet("com.foo.bar", SAW, "deny", "ignore", 20L)
        eq(listOf<Change>(b), Ledger.EMPTY.record(a).markRestored(a).record(b).pending())
    }
    t("record allows distinct permissions on same package") {
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.RuntimeRevoke("com.foo.a", MIC, 200L)
        eq(listOf<Change>(b, a), Ledger.EMPTY.record(a).record(b).pending())
    }
    t("Ledger is immutable") {
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val l0 = Ledger.EMPTY
        val l1 = l0.record(a)
        eq(emptyList<Change>(), l0.pending())
        eq(listOf<Change>(a), l1.pending())
    }

    // ---- Ledger.pending / restore plans -----------------------------------
    t("pending is newest first") {
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.AppOpSet("com.foo.b", SAW, "allow", "deny", 300L)
        val c = Change.RuntimeRevoke("com.foo.c", MIC, 200L)
        eq(listOf<Change>(b, c, a), Ledger.EMPTY.record(a).record(b).record(c).pending())
    }
    t("pending excludes restored") {
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.RuntimeRevoke("com.foo.b", CAMERA, 200L)
        eq(listOf<Change>(a), Ledger.EMPTY.record(a).record(b).markRestored(b).pending())
    }
    t("markRestored of unknown change is a no-op") {
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val other = Change.RuntimeRevoke("com.foo.z", CAMERA, 5L)
        eq(listOf<Change>(a), Ledger.EMPTY.record(a).markRestored(other).pending())
    }
    t("markRestored twice is a no-op") {
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        eq(emptyList<Change>(), Ledger.EMPTY.record(a).markRestored(a).markRestored(a).pending())
    }
    t("restorePlan is newest first undo argv") {
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.AppOpSet("com.foo.b", SAW, "allow", "deny", 200L)
        eq(
            listOf(
                listOf("appops", "set", "com.foo.b", SAW, "allow"),
                listOf("pm", "grant", "com.foo.a", CAMERA)
            ),
            Ledger.EMPTY.record(a).record(b).restorePlan()
        )
    }
    t("restorePlanFor filters by package") {
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.RuntimeRevoke("com.foo.b", CAMERA, 200L)
        val c = Change.RuntimeRevoke("com.foo.a", MIC, 300L)
        eq(
            listOf(
                listOf("pm", "grant", "com.foo.a", MIC),
                listOf("pm", "grant", "com.foo.a", CAMERA)
            ),
            Ledger.EMPTY.record(a).record(b).record(c).restorePlanFor("com.foo.a")
        )
    }
    t("restorePlanFor unknown package is empty") {
        val l = Ledger.EMPTY.record(Change.RuntimeRevoke("com.foo.a", CAMERA, 1L))
        eq(emptyList<List<String>>(), l.restorePlanFor("com.other.app"))
    }
    t("restorePlanFor skips restored changes") {
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        eq(emptyList<List<String>>(), Ledger.EMPTY.record(a).markRestored(a).restorePlanFor("com.foo.a"))
    }

    // ---- encode ------------------------------------------------------------
    t("encode starts with header") { eq("permcheck-ledger v1", Ledger.EMPTY.encode()) }
    t("encode layout for revoke") {
        eq(
            "permcheck-ledger v1\nR\t100\t0\tcom.foo.a\t$CAMERA",
            Ledger.EMPTY.record(Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)).encode()
        )
    }
    t("encode layout for appop incl. restored flag") {
        val c = Change.AppOpSet("com.foo.b", SAW, "allow", "deny", 200L)
        eq(
            "permcheck-ledger v1\nA\t200\t1\tcom.foo.b\t$SAW\tallow\tdeny",
            Ledger.EMPTY.record(c).markRestored(c).encode()
        )
    }

    // ---- decode round trip -------------------------------------------------
    t("encode/decode round trip") {
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.AppOpSet("com.foo.b", SAW, "allow", "deny", 200L)
        val l = Ledger.EMPTY.record(a).record(b)
        val (back, skipped) = Ledger.decode(l.encode())
        eq(0, skipped)
        eq(l.pending(), back.pending())
    }
    t("round trip preserves restored flag and layout") {
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.RuntimeRevoke("com.foo.b", CAMERA, 200L)
        val l = Ledger.EMPTY.record(a).record(b).markRestored(b)
        val (back, skipped) = Ledger.decode(l.encode())
        eq(0, skipped)
        eq(l.pending(), back.pending())
        eq(l.encode(), back.encode())
    }

    // ---- decode failures ---------------------------------------------------
    t("decode empty text") {
        val (l, skipped) = Ledger.decode("")
        eq(0, skipped)
        eq(emptyList<Change>(), l.pending())
    }
    t("decode header only") {
        val (l, skipped) = Ledger.decode("permcheck-ledger v1")
        eq(0, skipped)
        eq(emptyList<Change>(), l.pending())
    }
    t("decode wrong header counts all non-blank lines") {
        val (l, skipped) = Ledger.decode("v1\nR\t100\t0\tcom.foo.a\t$CAMERA")
        eq(2, skipped)
        eq(emptyList<Change>(), l.pending())
    }
    t("decode missing header counts all non-blank lines") {
        val (l, skipped) = Ledger.decode("R\t100\t0\tcom.foo.a\t$CAMERA")
        eq(1, skipped)
        eq(emptyList<Change>(), l.pending())
    }
    t("decode counts garbage but keeps good lines") {
        val text = "permcheck-ledger v1\nhello\n\nR\t100\t0\tcom.foo.a\t$CAMERA"
        val (l, skipped) = Ledger.decode(text)
        eq(1, skipped)
        eq(1, l.pending().size)
    }
    t("decode missing fields is skipped") {
        val (_, skipped) = Ledger.decode("permcheck-ledger v1\nR\t100\t0\tcom.foo.a")
        eq(1, skipped)
    }
    t("decode extra fields is skipped") {
        val (_, skipped) = Ledger.decode("permcheck-ledger v1\nR\t100\t0\tcom.foo.a\t$CAMERA\textra")
        eq(1, skipped)
    }
    t("decode unknown type letter is skipped") {
        val (_, skipped) = Ledger.decode("permcheck-ledger v1\nX\t100\t0\tcom.foo.a\t$CAMERA")
        eq(1, skipped)
    }
    t("decode bad package is skipped") {
        val (_, skipped) = Ledger.decode("permcheck-ledger v1\nR\t100\t0\tcom.foo; rm -rf /\t$CAMERA")
        eq(1, skipped)
    }
    t("decode bad mode is skipped") {
        val (_, skipped) = Ledger.decode("permcheck-ledger v1\nA\t100\t0\tcom.foo.a\t$SAW\tallow\tbogus")
        eq(1, skipped)
    }
    t("decode bad timestamp is skipped") {
        val (_, skipped) = Ledger.decode("permcheck-ledger v1\nR\tnotanumber\t0\tcom.foo.a\t$CAMERA")
        eq(1, skipped)
    }
    t("decode bad restored flag is skipped") {
        val (_, skipped) = Ledger.decode("permcheck-ledger v1\nR\t100\t2\tcom.foo.a\t$CAMERA")
        eq(1, skipped)
    }
    t("decode mixed good and bad") {
        val text = "permcheck-ledger v1\n" +
            "R\t100\t0\tcom.foo.a\t$CAMERA\n" +
            "junk\n" +
            "A\t200\t0\tcom.foo.b\t$SAW\tallow\tdeny"
        val (l, skipped) = Ledger.decode(text)
        eq(1, skipped)
        eq(2, l.pending().size)
    }
    t("decode ignores trailing newline") {
        val (_, skipped) = Ledger.decode("permcheck-ledger v1\nR\t100\t0\tcom.foo.a\t$CAMERA\n")
        eq(0, skipped)
    }
    t("decode handles CRLF") {
        val text = "permcheck-ledger v1\r\nR\t100\t0\tcom.foo.a\t$CAMERA\r\n"
        val (l, skipped) = Ledger.decode(text)
        eq(0, skipped)
        eq(1, l.pending().size)
    }
    t("decode never throws on nasty strings") {
        val nasty = listOf(
            "",
            "\n",
            "\t",
            "permcheck-ledger v1",
            "permcheck-ledger v1\n",
            "permcheck-ledger v2\n",
            "\u0000\u0001\u0002",
            "R",
            "A",
            "R\t",
            "A\t\t\t\t\t\t",
            "permcheck-ledger v1\nR",
            "permcheck-ledger v1\nA\t1\t0\tcom.foo.a\tOP",
            "permcheck-ledger v1\nR\t-1\t1\tcom.foo.a\tA.B",
            "permcheck-ledger v1\nR\t9999999999999999999999\t0\tcom.foo.a\tA.B",
            "permcheck-ledger v1\n\t\t\t\t",
            "permcheck-ledger v1\nr\t1\t0\tcom.foo.a\tA.B",
            "permcheck-ledger v1\nR\t1\t0\tc\tA",
            "\uD83D\uDE00\n\uD83D\uDE00",
            "permcheck-ledger v1\nR\t1\t0\tcom.foo.a\t" + "x".repeat(500)
        )
        for (s in nasty) {
            val (l, skipped) = Ledger.decode(s)
            eq(true, skipped >= 0)
            eq(false, l.encode().isEmpty())
            l.pending()
            l.restorePlan()
        }
    }

    println("LedgerTest: $n passed")
}
