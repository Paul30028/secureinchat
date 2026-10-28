// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

/**
 * Plain-text serialization of the user's own rules ("blocked by you" / "allowed by you").
 *
 * File format (UTF-8, LF line endings):
 *
 *     # Guardian rules v1
 *     block ads.example.com
 *     allow tracker.example.com
 *
 * Empty lines and lines starting with '#' are ignored. Keywords are case-insensitive. Domains are
 * validated with Blocklist.normalizeOrNull, so a line whose domain is not a valid hostname is
 * skipped and counted in [ParseResult.skipped]. A domain that appears both as block and allow keeps
 * the last occurrence, matching UserRulesStore's rule that a domain lives in at most one list.
 *
 * The parser is deliberately forgiving: the header line is not required, and a hand-written file
 * with only "block"/"allow" lines is accepted. Very large inputs are truncated (see [MAX_BYTES] and
 * [MAX_LINES]); the remaining lines are counted as skipped instead of failing the whole import.
 */
object RulesText {

    const val HEADER = "# Guardian rules v1"

    // A rules file is tiny (tens or hundreds of domains). These caps only guard against a wrong file
    // being picked in the document picker; they are not expected to be reached in practice.
    const val MAX_BYTES = 1 * 1024 * 1024
    const val MAX_LINES = 10_000

    data class ParseResult(
        val blocked: Set<String>,
        val allowed: Set<String>,
        val skipped: Int
    )

    fun format(blocked: Collection<String>, allowed: Collection<String>): String {
        val sb = StringBuilder(HEADER).append('\n')
        for (d in blocked.sorted()) sb.append("block ").append(d).append('\n')
        for (d in allowed.sorted()) sb.append("allow ").append(d).append('\n')
        return sb.toString()
    }

    fun parse(text: String): ParseResult {
        // Truncate first so the line loop never sees more than the cap. A character is not a byte in
        // UTF-8, but a 1 MB character budget is at least as strict as a 1 MB byte budget for the
        // ASCII rules we expect, and never larger than ~4 MB of input. That is fine for a guard.
        val body = if (text.length > MAX_BYTES) text.substring(0, MAX_BYTES) else text

        // domain -> isAllowed; later lines for the same domain overwrite earlier ones.
        val chosen = LinkedHashMap<String, Boolean>()
        // Lines cut off by the size cap count as skipped too (a cut line in the middle counts once).
        var skipped = if (text.length > MAX_BYTES) text.substring(MAX_BYTES).count { it == '\n' } + 1 else 0
        var seen = 0

        for (raw in body.lineSequence()) {
            if (seen >= MAX_LINES) {
                // Remaining non-blank lines are counted as skipped (the trailing empty "line" after the
                // final newline is not a line the user wrote).
                if (raw.isNotBlank()) skipped++
                continue
            }
            seen++

            val line = raw.trim().removeSuffix("\r").trim()
            if (line.isEmpty()) continue
            if (line.startsWith("#")) continue

            val sp = line.indexOfFirst { it == ' ' || it == '\t' }
            if (sp <= 0) {
                skipped++
                continue
            }
            val keyword = line.substring(0, sp).lowercase()
            val rest = line.substring(sp + 1).trim()
            if (rest.isEmpty()) {
                skipped++
                continue
            }
            val allow = when (keyword) {
                "block" -> false
                "allow" -> true
                else -> {
                    skipped++
                    continue
                }
            }
            val domain = Blocklist.normalizeOrNull(rest)
            if (domain == null) {
                skipped++
                continue
            }
            chosen[domain] = allow
        }

        val blocked = LinkedHashSet<String>()
        val allowed = LinkedHashSet<String>()
        for ((d, isAllow) in chosen) {
            if (isAllow) allowed.add(d) else blocked.add(d)
        }
        return ParseResult(blocked, allowed, skipped)
    }
}
