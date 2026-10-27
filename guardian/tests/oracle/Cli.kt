// SPDX-License-Identifier: GPL-3.0-or-later
// Test-only CLI for guardian/tests/dns_oracle.py.
import org.secureinchat.guardian.dns.*
fun main(args: Array<String>) {
    // stdin lines: "<mode> <hex>" -> prints "null" or response hex
    generateSequence(::readLine).forEach { line ->
        val parts = line.split(' ')
        val mode = parts[0]
        fun hx(h: String) = ByteArray(h.length / 2) { h.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
        val b = hx(parts[1])
        val q = DnsPacket.parseQuery(b, b.size)
        if (mode == "UP") {
            // UP <query packet> <upstream dns payload>: wrap the upstream answer, or print null
            val u = hx(parts[2])
            val r = q?.let { DnsPacket.buildResponseFromUpstream(it, u, u.size) }
            println(r?.joinToString("") { "%02x".format(it) } ?: "null")
            return@forEach
        }
        if (q == null) println("null") else println(q.qname + " " + DnsPacket.buildBlockedResponse(q, BlockMode.valueOf(mode)).joinToString("") { "%02x".format(it) })
    }
}
