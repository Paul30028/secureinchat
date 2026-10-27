// SPDX-License-Identifier: GPL-3.0-or-later
// Test-only CLI for guardian/tests/dns_oracle.py.
import org.secureinchat.guardian.dns.*
fun main(args: Array<String>) {
    // stdin lines: "<mode> <hex>" -> prints "null" or response hex
    generateSequence(::readLine).forEach { line ->
        val (mode, hex) = line.split(' ')
        val b = ByteArray(hex.length / 2) { hex.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
        val q = DnsPacket.parseQuery(b, b.size)
        if (q == null) println("null") else println(q.qname + " " + DnsPacket.buildBlockedResponse(q, BlockMode.valueOf(mode)).joinToString("") { "%02x".format(it) })
    }
}
