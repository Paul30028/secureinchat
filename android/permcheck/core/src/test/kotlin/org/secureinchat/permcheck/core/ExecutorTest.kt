// SPDX-License-Identifier: GPL-3.0-or-later
// Drafted by DeepSeek (T11-b), reviewed by Claude.
package org.secureinchat.permcheck.core

private var n = 0
private fun t(name: String, block: () -> Unit) { try { block(); n++ } catch (e: Throwable) { println("FAIL $name: ${e.message}"); throw e } }
private fun eq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

private const val CAMERA = "android.permission.CAMERA"
private const val MIC = "android.permission.MICROPHONE"
private const val SAW = "SYSTEM_ALERT_WINDOW"

private class FakeRunner(vararg scripted: Result) : Runner {
    val calls = mutableListOf<List<String>>()
    private val queue = ArrayDeque<Result>().apply { addAll(scripted.toList()) }
    var throwOnNext: Throwable? = null
    var defaultResult: Result = Result(0, "")

    override fun run(argv: List<String>): Result {
        calls.add(argv)
        throwOnNext?.let { throwOnNext = null; throw it }
        return if (queue.isNotEmpty()) queue.removeFirst() else defaultResult
    }
}

fun main() {

    // ---- revoke --------------------------------------------------------
    t("revoke success records and passes exact argv") {
        val runner = FakeRunner(Result(0, ""))
        val flow = ApplyFlow(runner)
        val c = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val (ledger, outcome) = flow.revoke(Ledger.EMPTY, c)
        eq(Outcome.Done, outcome)
        eq(listOf<Change>(c), ledger.pending())
        eq(1, runner.calls.size)
        eq(listOf("pm", "revoke", "com.foo.a", CAMERA), runner.calls[0])
    }
    t("revoke failure does not record") {
        val runner = FakeRunner(Result(1, "boom"))
        val flow = ApplyFlow(runner)
        val c = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val (ledger, outcome) = flow.revoke(Ledger.EMPTY, c)
        eq(Outcome.Failed(1, "boom"), outcome)
        eq(emptyList<Change>(), ledger.pending())
    }
    t("revoke refused invalid pkg never calls runner") {
        val runner = FakeRunner(Result(0, ""))
        val flow = ApplyFlow(runner)
        val c = Change.RuntimeRevoke("bad pkg", CAMERA, 100L)
        val (ledger, outcome) = flow.revoke(Ledger.EMPTY, c)
        eq(true, outcome is Outcome.Refused)
        eq(0, runner.calls.size)
        eq(Ledger.EMPTY, ledger)
    }
    t("revoke refused self package") {
        val runner = FakeRunner(Result(0, ""))
        val flow = ApplyFlow(runner)
        val (_, outcome) = flow.revoke(Ledger.EMPTY, Change.RuntimeRevoke(Commands.SELF, CAMERA, 1L))
        eq(true, outcome is Outcome.Refused)
        eq(0, runner.calls.size)
    }
    t("revoke refused android package") {
        val runner = FakeRunner(Result(0, ""))
        val flow = ApplyFlow(runner)
        val (_, outcome) = flow.revoke(Ledger.EMPTY, Change.RuntimeRevoke("android.permission", CAMERA, 1L))
        eq(true, outcome is Outcome.Refused)
        eq(0, runner.calls.size)
    }
    t("revoke refused reason is non-empty") {
        val runner = FakeRunner(Result(0, ""))
        val flow = ApplyFlow(runner)
        val (_, outcome) = flow.revoke(Ledger.EMPTY, Change.RuntimeRevoke("bad pkg", CAMERA, 1L))
        val reason = (outcome as Outcome.Refused).reason
        eq(true, reason.isNotEmpty())
        eq(true, reason.contains("package"))
    }

    // ---- setOp ---------------------------------------------------------
    t("setOp success records and passes exact argv") {
        val runner = FakeRunner(Result(0, ""))
        val flow = ApplyFlow(runner)
        val c = Change.AppOpSet("com.foo.a", SAW, "allow", "deny", 100L)
        val (ledger, outcome) = flow.setOp(Ledger.EMPTY, c)
        eq(Outcome.Done, outcome)
        eq(listOf<Change>(c), ledger.pending())
        eq(listOf("appops", "set", "com.foo.a", SAW, "deny"), runner.calls[0])
    }
    t("setOp failure does not record") {
        val runner = FakeRunner(Result(2, "denied"))
        val flow = ApplyFlow(runner)
        val c = Change.AppOpSet("com.foo.a", SAW, "allow", "deny", 100L)
        val (ledger, outcome) = flow.setOp(Ledger.EMPTY, c)
        eq(Outcome.Failed(2, "denied"), outcome)
        eq(emptyList<Change>(), ledger.pending())
    }
    t("setOp refused lowercase op") {
        val runner = FakeRunner(Result(0, ""))
        val flow = ApplyFlow(runner)
        val (_, outcome) = flow.setOp(Ledger.EMPTY, Change.AppOpSet("com.foo.a", "system_alert_window", "allow", "deny", 1L))
        eq(true, outcome is Outcome.Refused)
        eq(0, runner.calls.size)
    }
    t("setOp refused bad mode") {
        val runner = FakeRunner(Result(0, ""))
        val flow = ApplyFlow(runner)
        val (_, outcome) = flow.setOp(Ledger.EMPTY, Change.AppOpSet("com.foo.a", SAW, "allow", "bogus", 1L))
        eq(true, outcome is Outcome.Refused)
        eq(0, runner.calls.size)
    }
    t("setOp refused self package") {
        val runner = FakeRunner(Result(0, ""))
        val flow = ApplyFlow(runner)
        val (_, outcome) = flow.setOp(Ledger.EMPTY, Change.AppOpSet(Commands.SELF, SAW, "allow", "deny", 1L))
        eq(true, outcome is Outcome.Refused)
        eq(0, runner.calls.size)
    }

    // ---- duplicate revoke ----------------------------------------------
    t("duplicate revoke returns Done with unchanged ledger") {
        val runner = FakeRunner(Result(0, ""), Result(0, ""))
        val flow = ApplyFlow(runner)
        val c = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val (l1, _) = flow.revoke(Ledger.EMPTY, c)
        val (l2, outcome) = flow.revoke(l1, c)
        eq(Outcome.Done, outcome)
        eq(l1, l2)
        eq(1, l2.pending().size)
        eq(2, runner.calls.size)
    }
    t("two distinct changes both pending") {
        val runner = FakeRunner(Result(0, ""), Result(0, ""))
        val flow = ApplyFlow(runner)
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.RuntimeRevoke("com.foo.a", MIC, 200L)
        val (l1, _) = flow.revoke(Ledger.EMPTY, a)
        val (l2, _) = flow.revoke(l1, b)
        eq(2, l2.pending().size)
    }

    // ---- restoreAll ----------------------------------------------------
    t("restoreAll newest first with correct undo argv") {
        val runner = FakeRunner(Result(0, ""), Result(0, ""), Result(0, ""))
        val flow = ApplyFlow(runner)
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.AppOpSet("com.foo.b", SAW, "allow", "deny", 200L)
        val c = Change.RuntimeRevoke("com.foo.c", MIC, 300L)
        val l = Ledger.EMPTY.record(a).record(b).record(c)
        val (l2, report) = flow.restoreAll(l)
        eq(3, report.restored)
        eq(0, report.failed.size)
        eq(0, report.stillPending)
        eq(0, l2.pending().size)
        eq(3, runner.calls.size)
        eq(listOf("pm", "grant", "com.foo.c", MIC), runner.calls[0])
        eq(listOf("appops", "set", "com.foo.b", SAW, "allow"), runner.calls[1])
        eq(listOf("pm", "grant", "com.foo.a", CAMERA), runner.calls[2])
    }
    t("restoreAll partial failure continues and reports correctly") {
        val runner = FakeRunner(Result(0, ""), Result(1, "nope"), Result(0, ""))
        val flow = ApplyFlow(runner)
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.AppOpSet("com.foo.b", SAW, "allow", "deny", 200L)
        val c = Change.RuntimeRevoke("com.foo.c", MIC, 300L)
        val l = Ledger.EMPTY.record(a).record(b).record(c)
        val (l2, report) = flow.restoreAll(l)
        eq(2, report.restored)
        eq(1, report.failed.size)
        eq(b, report.failed[0].first)
        eq("nope", report.failed[0].second)
        eq(1, report.stillPending)
        eq(listOf<Change>(b), l2.pending())
        eq(3, runner.calls.size)
    }
    t("second restoreAll after fixing runner restores remaining") {
        val runner = FakeRunner(Result(0, ""), Result(1, "boom"))
        val flow = ApplyFlow(runner)
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.RuntimeRevoke("com.foo.b", CAMERA, 200L)
        val l = Ledger.EMPTY.record(a).record(b)
        val (l1, r1) = flow.restoreAll(l)
        eq(1, r1.restored)
        eq(1, r1.failed.size)
        eq(1, r1.stillPending)
        runner.defaultResult = Result(0, "")
        val (l2, r2) = flow.restoreAll(l1)
        eq(1, r2.restored)
        eq(0, r2.failed.size)
        eq(0, r2.stillPending)
        eq(0, l2.pending().size)
    }
    t("restoreAll runner throws on undo is failure") {
        val runner = FakeRunner(Result(0, ""))
        runner.throwOnNext = RuntimeException("undo boom")
        val flow = ApplyFlow(runner)
        val c = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val (l2, report) = flow.restoreAll(Ledger.EMPTY.record(c))
        eq(0, report.restored)
        eq(1, report.failed.size)
        eq("undo boom", report.failed[0].second)
        eq(1, report.stillPending)
        eq(listOf<Change>(c), l2.pending())
    }
    t("restoreAll trims stderr to 200 chars") {
        val longMsg = "x".repeat(500)
        val runner = FakeRunner(Result(1, longMsg))
        val flow = ApplyFlow(runner)
        val c = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val (_, report) = flow.restoreAll(Ledger.EMPTY.record(c))
        eq(1, report.failed.size)
        eq(200, report.failed[0].second.length)
    }
    t("restoreAll empty ledger is a no-op") {
        val runner = FakeRunner()
        val flow = ApplyFlow(runner)
        val (_, report) = flow.restoreAll(Ledger.EMPTY)
        eq(0, report.restored)
        eq(0, report.failed.size)
        eq(0, report.stillPending)
        eq(0, runner.calls.size)
    }
    t("restoreAll handles protected package from decode gracefully") {
        val runner = FakeRunner(Result(0, ""))
        val flow = ApplyFlow(runner)
        val text = "permcheck-ledger v1\nR\t100\t0\tandroid.permission\t$CAMERA"
        val (l, skipped) = Ledger.decode(text)
        eq(0, skipped)
        eq(1, l.pending().size)
        val (_, report) = flow.restoreAll(l)
        eq(0, report.restored)
        eq(1, report.failed.size)
        eq(1, report.stillPending)
        eq(0, runner.calls.size)
    }
    t("restoreAll mixed types uses previous mode for undo") {
        val runner = FakeRunner(Result(0, ""), Result(0, ""))
        val flow = ApplyFlow(runner)
        val a = Change.AppOpSet("com.foo.a", SAW, "foreground", "deny", 100L)
        val b = Change.RuntimeRevoke("com.foo.a", CAMERA, 200L)
        val l = Ledger.EMPTY.record(a).record(b)
        val (_, report) = flow.restoreAll(l)
        eq(2, report.restored)
        eq(listOf("pm", "grant", "com.foo.a", CAMERA), runner.calls[0])
        eq(listOf("appops", "set", "com.foo.a", SAW, "foreground"), runner.calls[1])
    }

    // ---- runner exception in revoke ------------------------------------
    t("runner throw during revoke is Failed(-1)") {
        val runner = FakeRunner()
        runner.throwOnNext = RuntimeException("kaboom")
        val flow = ApplyFlow(runner)
        val c = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val (ledger, outcome) = flow.revoke(Ledger.EMPTY, c)
        eq(true, outcome is Outcome.Failed)
        eq(-1, (outcome as Outcome.Failed).exitCode)
        eq("kaboom", outcome.stderr)
        eq(emptyList<Change>(), ledger.pending())
    }

    // ---- restorePackage ------------------------------------------------
    t("restorePackage only touches that package") {
        val runner = FakeRunner(Result(0, ""), Result(0, ""))
        val flow = ApplyFlow(runner)
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.RuntimeRevoke("com.foo.b", CAMERA, 200L)
        val c = Change.RuntimeRevoke("com.foo.a", MIC, 300L)
        val l = Ledger.EMPTY.record(a).record(b).record(c)
        val (l2, report) = flow.restorePackage(l, "com.foo.a")
        eq(2, report.restored)
        eq(0, report.failed.size)
        eq(1, report.stillPending)
        eq(listOf<Change>(b), l2.pending())
        eq(2, runner.calls.size)
        eq(listOf("pm", "grant", "com.foo.a", MIC), runner.calls[0])
        eq(listOf("pm", "grant", "com.foo.a", CAMERA), runner.calls[1])
    }
    t("restorePackage unknown package is a no-op") {
        val runner = FakeRunner()
        val flow = ApplyFlow(runner)
        val l = Ledger.EMPTY.record(Change.RuntimeRevoke("com.foo.a", CAMERA, 1L))
        val (l2, report) = flow.restorePackage(l, "com.other.app")
        eq(0, report.restored)
        eq(0, report.failed.size)
        eq(1, report.stillPending)
        eq(0, runner.calls.size)
        eq(l, l2)
    }
    t("restorePackage newest first within package") {
        val runner = FakeRunner(Result(0, ""), Result(0, ""), Result(0, ""))
        val flow = ApplyFlow(runner)
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.RuntimeRevoke("com.foo.a", MIC, 300L)
        val c = Change.RuntimeRevoke("com.foo.a", "android.permission.CONTACTS", 200L)
        val l = Ledger.EMPTY.record(a).record(b).record(c)
        flow.restorePackage(l, "com.foo.a")
        eq(listOf("pm", "grant", "com.foo.a", MIC), runner.calls[0])
        eq(listOf("pm", "grant", "com.foo.a", "android.permission.CONTACTS"), runner.calls[1])
        eq(listOf("pm", "grant", "com.foo.a", CAMERA), runner.calls[2])
    }
    t("restorePackage partial failure keeps failing one pending") {
        val runner = FakeRunner(Result(1, "denied"), Result(0, ""))
        val flow = ApplyFlow(runner)
        val a = Change.RuntimeRevoke("com.foo.a", CAMERA, 100L)
        val b = Change.RuntimeRevoke("com.foo.a", MIC, 200L)
        val l = Ledger.EMPTY.record(a).record(b)
        val (l2, report) = flow.restorePackage(l, "com.foo.a")
        eq(1, report.restored)
        eq(1, report.failed.size)
        eq(b, report.failed[0].first)
        eq(1, report.stillPending)
        eq(listOf<Change>(b), l2.pending())
    }

        // Review test (Claude): a repeated revoke of a still-pending permission is Done, and the first record is kept
    t("repeat revoke is Done and keeps first record") {
        val ok = object : Runner { override fun run(argv: List<String>) = Result(0, "") }
        val flow = ApplyFlow(ok)
        val a = Change.RuntimeRevoke("com.foo.bar", "android.permission.CAMERA", 1)
        val b = Change.RuntimeRevoke("com.foo.bar", "android.permission.CAMERA", 2)
        val (l1, o1) = flow.revoke(Ledger.EMPTY, a)
        val (l2, o2) = flow.revoke(l1, b)
        check(o1 == Outcome.Done && o2 == Outcome.Done) { "outcomes $o1 $o2" }
        eq(listOf<Change>(a), l2.pending())
    }
    println("ExecutorTest: $n passed")
}
