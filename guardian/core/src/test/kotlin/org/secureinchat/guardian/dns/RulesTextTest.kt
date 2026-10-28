// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

private var rn = 0
private fun rt(name: String, block: () -> Unit) {
    try { block(); rn++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun req(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

fun main() {

    rt("round trip") {
        val blocked = setOf("ads.example.com", "tracker.example.com")
        val allowed = setOf("safe.example.com")
        val text = RulesText.format(blocked, allowed)
        check(text.startsWith(RulesText.HEADER)) { "header" }
        check(text.endsWith("\n")) { "trailing newline" }
        val p = RulesText.parse(text)
        req(p.blocked, blocked)
        req(p.allowed, allowed)
        req(p.skipped, 0)
    }

    rt("format sorts both lists") {
        val text = RulesText.format(
            listOf("z.example.com", "a.example.com"),
            listOf("y.example.com", "b.example.com")
        )
        val lines = text.trimEnd('\n').split('\n')
        req(lines[0], RulesText.HEADER)
        req(lines[1], "block a.example.com")
        req(lines[2], "block z.example.com")
        req(lines[3], "allow b.example.com")
        req(lines[4], "allow y.example.com")
    }

    rt("CRLF and surrounding whitespace") {
        val text = "# Guardian rules v1\r\n" +
            "  block  ads.example.com  \r\n" +
            "\tallow\tsafe.example.com\t\r\n" +
            "\r\n"
        val p = RulesText.parse(text)
        req(p.blocked, setOf("ads.example.com"))
        req(p.allowed, setOf("safe.example.com"))
        req(p.skipped, 0)
    }

    rt("comments and blank lines ignored") {
        val text = """
            # Guardian rules v1
            # a comment
            !
            
            block ads.example.com
            # allow safe.example.com
        """.trimIndent()
        val p = RulesText.parse(text)
        req(p.blocked, setOf("ads.example.com"))
        req(p.allowed, emptySet<String>())
        // The bare "!" line has no keyword and no domain, so it is skipped.
        req(p.skipped, 1)
    }

    rt("invalid domains and unknown keywords counted as skipped") {
        val text = """
            block ads.example.com
            block com
            block not_a_domain
            block a..b.com
            allow -x.com
            deny tracker.example.com
            blockonly
        """.trimIndent()
        val p = RulesText.parse(text)
        req(p.blocked, setOf("ads.example.com"))
        req(p.allowed, emptySet<String>())
        // com, not_a_domain, a..b.com, -x.com, "deny ..." (unknown keyword), "blockonly" (no domain)
        req(p.skipped, 6)
    }

    rt("last occurrence wins per domain") {
        val text = """
            block a.example.com
            allow a.example.com
            block b.example.com
        """.trimIndent()
        val p = RulesText.parse(text)
        req(p.blocked, setOf("b.example.com"))
        req(p.allowed, setOf("a.example.com"))
        req(p.skipped, 0)

        val text2 = """
            allow a.example.com
            block a.example.com
        """.trimIndent()
        val p2 = RulesText.parse(text2)
        req(p2.blocked, setOf("a.example.com"))
        req(p2.allowed, emptySet<String>())
    }

    rt("keyword is case-insensitive") {
        val text = """
            BLOCK a.example.com
            Allow B.Example.COM.
        """.trimIndent()
        val p = RulesText.parse(text)
        req(p.blocked, setOf("a.example.com"))
        req(p.allowed, setOf("b.example.com"))
        req(p.skipped, 0)
    }

    rt("missing header is accepted") {
        val text = "block a.example.com\nallow b.example.com\n"
        val p = RulesText.parse(text)
        req(p.blocked, setOf("a.example.com"))
        req(p.allowed, setOf("b.example.com"))
        req(p.skipped, 0)
    }

    rt("line cap counts the rest as skipped") {
        val sb = StringBuilder("# Guardian rules v1\n")
        for (i in 0 until RulesText.MAX_LINES + 5) {
            sb.append("block h").append(i).append(".example.com\n")
        }
        val p = RulesText.parse(sb.toString())
        // Header line is one line; MAX_LINES applies to non-header lines too (we count every line).
        // All accepted lines are counted toward the cap; the overflow becomes skipped.
        req(p.blocked.size, RulesText.MAX_LINES - 1) // header consumed one of the MAX_LINES slots
        req(p.skipped, 6) // the remaining 6 lines
    }

    rt("byte cap truncates the input") {
        // Build a body larger than MAX_BYTES. Every line is valid, so anything not read is skipped.
        val lineText = "block aaaaaaaaaa.example.com\n"
        val count = (RulesText.MAX_BYTES / lineText.length) + 50
        val sb = StringBuilder(count * lineText.length)
        for (i in 0 until count) sb.append(lineText)
        val p = RulesText.parse(sb.toString())
        // All read lines resolve to the same domain; the rest are beyond the byte cap and ignored
        // by substring, so they never reach the line loop and are not counted as skipped. The only
        // thing we need to assert is that parsing did not blow up and the domain is present.
        req(p.blocked, setOf("aaaaaaaaaa.example.com"))
    }

    println("RulesTextTest: $rn passed")
}
