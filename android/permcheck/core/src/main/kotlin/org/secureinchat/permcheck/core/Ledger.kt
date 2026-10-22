// SPDX-License-Identifier: GPL-3.0-or-later
// Drafted by DeepSeek (T11-a), reviewed by Claude.
package org.secureinchat.permcheck.core

/**
 * A single, reversible modification performed by the advanced mode.
 *
 * Timestamps are always supplied by the caller; the core never reads a clock.
 */
sealed class Change {

    abstract val packageName: String
    abstract val atMillis: Long

    /** A runtime permission that was granted before we revoked it. */
    data class RuntimeRevoke(
        override val packageName: String,
        val permission: String,
        override val atMillis: Long
    ) : Change()

    /** An app-op mode that was changed from [previousMode] to [newMode]. */
    data class AppOpSet(
        override val packageName: String,
        val op: String,
        val previousMode: String,
        val newMode: String,
        override val atMillis: Long
    ) : Change()
}

/** Strict field validators. Everything entering [Commands] or [Ledger] goes through these. */
object Validate {

    private val PKG = Regex("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$")
    private val PERMISSION = Regex("^[A-Za-z][A-Za-z0-9_.]*$")
    private val OP = Regex("^[A-Z][A-Z0-9_]*$")
    private val MODES = setOf("allow", "ignore", "deny", "default", "foreground")

    fun pkg(s: String): Boolean = PKG.matches(s)

    fun permission(s: String): Boolean = s.length in 1..200 && PERMISSION.matches(s)

    fun op(s: String): Boolean = OP.matches(s)

    fun mode(s: String): Boolean = s in MODES
}

/**
 * Builds argument vectors (never shell strings) for the privileged helper.
 * Every field is validated and protected packages are refused outright.
 */
object Commands {

    const val SELF: String = "org.secureinchat.permcheck"

    private val PROTECTED: Set<String> = setOf(
        SELF,
        "com.android.systemui",
        "com.android.settings",
        "com.android.phone"
    )

    private fun checkPackage(pkg: String) {
        require(Validate.pkg(pkg)) { "invalid package name: $pkg" }
        require(!PROTECTED.contains(pkg)) { "refusing to touch protected package: $pkg" }
        require(!pkg.startsWith("android")) { "refusing to touch system package: $pkg" }
    }

    private fun checkPermission(permission: String) {
        require(Validate.permission(permission)) { "invalid permission: $permission" }
    }

    private fun checkOp(op: String) {
        require(Validate.op(op)) { "invalid app-op: $op" }
    }

    private fun checkMode(mode: String) {
        require(Validate.mode(mode)) { "invalid app-op mode: $mode" }
    }

    fun revoke(c: Change.RuntimeRevoke): List<String> {
        checkPackage(c.packageName)
        checkPermission(c.permission)
        return listOf("pm", "revoke", c.packageName, c.permission)
    }

    fun undo(c: Change.RuntimeRevoke): List<String> {
        checkPackage(c.packageName)
        checkPermission(c.permission)
        return listOf("pm", "grant", c.packageName, c.permission)
    }

    fun set(c: Change.AppOpSet): List<String> {
        checkPackage(c.packageName)
        checkOp(c.op)
        checkMode(c.previousMode)
        checkMode(c.newMode)
        return listOf("appops", "set", c.packageName, c.op, c.newMode)
    }

    fun undo(c: Change.AppOpSet): List<String> {
        checkPackage(c.packageName)
        checkOp(c.op)
        checkMode(c.previousMode)
        checkMode(c.newMode)
        return listOf("appops", "set", c.packageName, c.op, c.previousMode)
    }

    /** Dispatches to the right undo vector. */
    fun undo(c: Change): List<String> = when (c) {
        is Change.RuntimeRevoke -> undo(c)
        is Change.AppOpSet -> undo(c)
    }
}

/**
 * Immutable, serialisable record of every change made in advanced mode, so that
 * the user can undo everything with one tap even after a process restart.
 */
class Ledger private constructor(private val entries: List<Entry>) {

    private data class Entry(val change: Change, val restored: Boolean)

    /**
     * Appends [change], unless an identical, not-yet-restored change is already
     * recorded — the first record wins because its "previous" value is the true
     * original state.
     */
    fun record(change: Change): Ledger {
        // Review fix (Claude): only accept changes we can undo. Otherwise restorePlan() would silently
        // drop them and the user would believe everything was restored. Throws IllegalArgumentException.
        Commands.undo(change)
        val key = keyOf(change)
        val alreadyPending = entries.any { !it.restored && keyOf(it.change) == key }
        return if (alreadyPending) this else Ledger(entries + Entry(change, false))
    }

    /** Changes that still need to be undone, newest first. */
    fun pending(): List<Change> =
        entries.withIndex().filter { !it.value.restored }
            // Review fix (Claude): equal timestamps undo in reverse insertion order too.
            .sortedWith(compareByDescending<IndexedValue<Entry>> { it.value.change.atMillis }.thenByDescending { it.index })
            .map { it.value.change }

    /** Undo vectors for every pending change, newest first. */
    fun restorePlan(): List<List<String>> = pending().mapNotNull { undoOf(it) }

    /** Undo vectors for the pending changes of one package, newest first. */
    fun restorePlanFor(packageName: String): List<List<String>> =
        pending().filter { it.packageName == packageName }.mapNotNull { undoOf(it) }

    /** Marks the matching pending change as restored; unknown or already-restored changes are a no-op. */
    fun markRestored(change: Change): Ledger {
        val index = entries.indexOfFirst { !it.restored && it.change == change }
        if (index < 0) return this
        val next = entries.toMutableList()
        next[index] = next[index].copy(restored = true)
        return Ledger(next)
    }

    /** Line-based text form; see [decode] for the exact grammar. */
    fun encode(): String {
        val sb = StringBuilder(HEADER)
        for (e in entries) {
            sb.append('\n')
            when (val c = e.change) {
                is Change.RuntimeRevoke ->
                    sb.append("R\t").append(c.atMillis).append('\t')
                        .append(if (e.restored) '1' else '0').append('\t')
                        .append(c.packageName).append('\t').append(c.permission)

                is Change.AppOpSet ->
                    sb.append("A\t").append(c.atMillis).append('\t')
                        .append(if (e.restored) '1' else '0').append('\t')
                        .append(c.packageName).append('\t').append(c.op).append('\t')
                        .append(c.previousMode).append('\t').append(c.newMode)
            }
        }
        return sb.toString()
    }

    private fun keyOf(c: Change): String = when (c) {
        is Change.RuntimeRevoke -> "R|${c.packageName}|${c.permission}"
        is Change.AppOpSet -> "A|${c.packageName}|${c.op}"
    }

    private fun undoOf(change: Change): List<String>? =
        try {
            Commands.undo(change)
        } catch (t: Throwable) {
            // A change that cannot be turned into a safe command is never executed.
            null
        }

    companion object {

        private const val HEADER = "permcheck-ledger v1"

        val EMPTY: Ledger = Ledger(emptyList())

        /**
         * Parses [encode] output. Never throws: a wrong or missing header yields an
         * empty ledger, and every malformed body line is skipped and counted.
         */
        fun decode(text: String): Pair<Ledger, Int> {
            val lines = try {
                text.split('\n').map { line -> if (line.endsWith("\r")) line.dropLast(1) else line }
            } catch (t: Throwable) {
                return EMPTY to 0
            }

            if (lines.isEmpty() || lines[0] != HEADER) {
                return EMPTY to lines.count { it.isNotBlank() }
            }

            val parsed = ArrayList<Entry>()
            var skipped = 0
            for (index in 1 until lines.size) {
                val line = lines[index]
                if (line.isEmpty()) continue
                val entry = try {
                    parseLine(line)
                } catch (t: Throwable) {
                    null
                }
                if (entry == null) skipped++ else parsed.add(entry)
            }
            return Ledger(parsed) to skipped
        }

        private fun parseLine(line: String): Entry? {
            val f = line.split('\t')
            return when (f[0]) {
                "R" -> {
                    if (f.size != 5) return null
                    val at = f[1].toLongOrNull() ?: return null
                    val restored = when (f[2]) {
                        "0" -> false
                        "1" -> true
                        else -> return null
                    }
                    if (!Validate.pkg(f[3]) || !Validate.permission(f[4])) return null
                    Entry(Change.RuntimeRevoke(f[3], f[4], at), restored)
                }

                "A" -> {
                    if (f.size != 7) return null
                    val at = f[1].toLongOrNull() ?: return null
                    val restored = when (f[2]) {
                        "0" -> false
                        "1" -> true
                        else -> return null
                    }
                    if (!Validate.pkg(f[3]) || !Validate.op(f[4]) ||
                        !Validate.mode(f[5]) || !Validate.mode(f[6])
                    ) return null
                    Entry(Change.AppOpSet(f[3], f[4], f[5], f[6], at), restored)
                }

                else -> null
            }
        }
    }
}
