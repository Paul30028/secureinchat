// SPDX-License-Identifier: GPL-3.0-or-later
// Drafted by DeepSeek (T11-b), reviewed by Claude.
package org.secureinchat.permcheck.core

/** Thin port implemented later by the Shizuku layer. */
interface Runner {
    fun run(argv: List<String>): Result
}

data class Result(val exitCode: Int, val stderr: String)

sealed class Outcome {
    object Done : Outcome()
    data class Failed(val exitCode: Int, val stderr: String) : Outcome()
    data class Refused(val reason: String) : Outcome()
}

data class RestoreReport(
    val restored: Int,
    val failed: List<Pair<Change, String>>,
    val stillPending: Int
)

/**
 * Orchestrates a [Runner] against a [Ledger]. Never lets a runner exception escape;
 * never records a change whose command failed; never silently skips a change that
 * [Ledger.record] refuses to track (that would give the user false confidence that
 * everything has been undone).
 */
class ApplyFlow(private val runner: Runner) {

    fun revoke(ledger: Ledger, c: Change.RuntimeRevoke): Pair<Ledger, Outcome> {
        val argv = try {
            Commands.revoke(c)
        } catch (t: Throwable) {
            return ledger to Outcome.Refused(t.message ?: "invalid change")
        }
        val result = safeRun(argv)
        if (result.exitCode != 0) {
            return ledger to Outcome.Failed(result.exitCode, result.stderr)
        }
        val next = ledger.record(c)
        return if (next === ledger && !ledger.pending().contains(c)) {
            // record() refused to track the change; report the untracked application.
            ledger to Outcome.Failed(-1, "change applied but cannot be undone")
        } else {
            next to Outcome.Done
        }
    }

    fun setOp(ledger: Ledger, c: Change.AppOpSet): Pair<Ledger, Outcome> {
        val argv = try {
            Commands.set(c)
        } catch (t: Throwable) {
            return ledger to Outcome.Refused(t.message ?: "invalid change")
        }
        val result = safeRun(argv)
        if (result.exitCode != 0) {
            return ledger to Outcome.Failed(result.exitCode, result.stderr)
        }
        val next = ledger.record(c)
        return if (next === ledger && !ledger.pending().contains(c)) {
            ledger to Outcome.Failed(-1, "change applied but cannot be undone")
        } else {
            next to Outcome.Done
        }
    }

    fun restoreAll(ledger: Ledger): Pair<Ledger, RestoreReport> =
        restore(ledger, ledger.pending())

    fun restorePackage(ledger: Ledger, packageName: String): Pair<Ledger, RestoreReport> =
        restore(ledger, ledger.pending().filter { it.packageName == packageName })

    private fun restore(ledger: Ledger, targets: List<Change>): Pair<Ledger, RestoreReport> {
        var current = ledger
        var restored = 0
        val failed = mutableListOf<Pair<Change, String>>()
        for (c in targets) {
            val result = safeUndo(c)
            if (result.exitCode == 0) {
                current = current.markRestored(c)
                restored++
            } else {
                failed.add(c to result.stderr.trim().take(200))
            }
        }
        return current to RestoreReport(restored, failed, current.pending().size)
    }

    private fun safeUndo(c: Change): Result {
        val argv = try {
            Commands.undo(c)
        } catch (t: Throwable) {
            return Result(-1, t.message ?: "invalid change")
        }
        return safeRun(argv)
    }

    private fun safeRun(argv: List<String>): Result =
        try {
            runner.run(argv)
        } catch (t: Throwable) {
            Result(-1, t.message ?: t.javaClass.simpleName)
        }
}
