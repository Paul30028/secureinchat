// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

/**
 * Reads the CNAME chain out of an upstream DNS answer (G14, CNAME uncloaking).
 *
 * Trackers hide behind a first-party subdomain ("metrics.shop.example") whose CNAME points at the
 * tracker ("shop.tracker.example"). The query name is not on any list, so a filter that only checks
 * the question lets it through. Checking every CNAME target in the answer closes that gap.
 *
 * Only the answer section is read, and only CNAME (type 5) records are returned. Names may use
 * compression pointers anywhere in the message. Every read is bounds-checked; a pointer loop, an
 * oversized name or any other malformed input returns the targets read so far (possibly none), so a
 * bad answer is never blocked or thrown on here: buildResponseFromUpstream has already validated the
 * header and question, and anything unreadable is simply forwarded as before.
 */
object DnsAnswer {
    private const val TYPE_CNAME = 5
    private const val MAX_ANSWERS = 64
    private const val MAX_JUMPS = 16
    private const val MAX_NAME = 255

    /** Lower-cased CNAME targets in answer order, without duplicates. */
    fun cnameTargets(msg: ByteArray, len: Int): List<String> {
        val out = ArrayList<String>(2)
        try {
            if (len < 12 || len > msg.size) return out
            val qd = u16(msg, 4)
            val an = minOf(u16(msg, 6), MAX_ANSWERS)
            var pos = 12
            repeat(qd) {
                pos = skipName(msg, len, pos) ?: return out
                pos += 4
                if (pos > len) return out
            }
            repeat(an) {
                pos = skipName(msg, len, pos) ?: return out
                if (pos + 10 > len) return out
                val type = u16(msg, pos)
                val rdlen = u16(msg, pos + 8)
                val rdata = pos + 10
                if (rdata + rdlen > len) return out
                if (type == TYPE_CNAME) {
                    val target = readName(msg, len, rdata) ?: return out
                    if (target.isNotEmpty() && target !in out) out.add(target)
                }
                pos = rdata + rdlen
            }
        } catch (_: IndexOutOfBoundsException) {
            // Bounds are checked above; this is only a backstop so a parsing slip forwards the answer.
        }
        return out
    }

    private fun u16(b: ByteArray, i: Int): Int = ((b[i].toInt() and 0xFF) shl 8) or (b[i + 1].toInt() and 0xFF)

    /** Position just after the name at [start] (a pointer ends the name in two bytes). */
    private fun skipName(msg: ByteArray, len: Int, start: Int): Int? {
        var pos = start
        while (true) {
            if (pos >= len) return null
            val b = msg[pos].toInt() and 0xFF
            when {
                b == 0 -> return pos + 1
                (b and 0xC0) == 0xC0 -> return if (pos + 2 <= len) pos + 2 else null
                (b and 0xC0) != 0 -> return null
                else -> pos += 1 + b
            }
        }
    }

    /** Dotted, lower-cased name at [start], following compression pointers; null if malformed. */
    private fun readName(msg: ByteArray, len: Int, start: Int): String? {
        val sb = StringBuilder()
        var pos = start
        var jumps = 0
        while (true) {
            if (pos >= len) return null
            val b = msg[pos].toInt() and 0xFF
            when {
                b == 0 -> return sb.toString().lowercase()
                (b and 0xC0) == 0xC0 -> {
                    if (pos + 2 > len || ++jumps > MAX_JUMPS) return null
                    pos = ((b and 0x3F) shl 8) or (msg[pos + 1].toInt() and 0xFF)
                }
                (b and 0xC0) != 0 -> return null
                else -> {
                    if (pos + 1 + b > len) return null
                    if (sb.isNotEmpty()) sb.append('.')
                    for (i in 1..b) {
                        val c = msg[pos + i].toInt() and 0xFF
                        if (c < 0x21 || c > 0x7E) return null
                        sb.append(c.toChar())
                    }
                    if (sb.length > MAX_NAME) return null
                    pos += 1 + b
                }
            }
        }
    }
}
