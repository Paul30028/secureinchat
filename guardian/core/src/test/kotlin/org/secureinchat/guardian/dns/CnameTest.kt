// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.io.ByteArrayOutputStream
import kotlin.random.Random

private var cn = 0
private fun ct(name: String, block: () -> Unit) {
    try { block(); cn++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun ceq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

private fun ByteArrayOutputStream.u16(v: Int) { write((v ushr 8) and 0xFF); write(v and 0xFF) }
private fun ByteArrayOutputStream.name(n: String) {
    for (l in n.split('.')) { write(l.length); write(l.toByteArray(Charsets.US_ASCII)) }
    write(0)
}

/** An RR in the answer section; [owner] null = pointer to the question name (offset 12). */
private class Rr(val type: Int, val owner: ByteArray?, val rdata: ByteArray)

private fun nameBytes(n: String): ByteArray = ByteArrayOutputStream().apply { name(n) }.toByteArray()
private fun ptr(off: Int): ByteArray = byteArrayOf((0xC0 or (off ushr 8)).toByte(), (off and 0xFF).toByte())

/** DNS response (no IP/UDP): question [qname] type A, then [rrs]. */
private fun answer(id: Int, qname: String, rrs: List<Rr>): ByteArray {
    val o = ByteArrayOutputStream()
    o.u16(id); o.u16(0x8180); o.u16(1); o.u16(rrs.size); o.u16(0); o.u16(0)
    o.name(qname); o.u16(1); o.u16(1)
    for (r in rrs) {
        o.write(r.owner ?: ptr(12))
        o.u16(r.type); o.u16(1); o.u16(0); o.u16(300)
        o.u16(r.rdata.size); o.write(r.rdata)
    }
    return o.toByteArray()
}

private fun ip4(a: String) = a.split('.').map { it.toInt().toByte() }.toByteArray()

/** Same IPv4/UDP wrapping as QueryHandlerTest, so handle() accepts it. */
private fun query(name: String, id: Int): ByteArray {
    val dns = ByteArrayOutputStream()
    dns.u16(id); dns.u16(0x0100); dns.u16(1); dns.u16(0); dns.u16(0); dns.u16(0)
    dns.name(name); dns.u16(1); dns.u16(1)
    val d = dns.toByteArray()
    val udpLen = 8 + d.size
    val total = 20 + udpLen
    val ip = ByteArray(total)
    ip[0] = 0x45; ip[2] = (total ushr 8).toByte(); ip[3] = total.toByte()
    ip[6] = 0x40; ip[8] = 64; ip[9] = 17
    ip[12] = 10; ip[13] = 0; ip[14] = 0; ip[15] = 2
    ip[16] = 10; ip[17] = 0; ip[18] = 0; ip[19] = 1
    ip[20] = (40000 ushr 8).toByte(); ip[21] = 40000.toByte(); ip[22] = 0; ip[23] = 53
    ip[24] = (udpLen ushr 8).toByte(); ip[25] = udpLen.toByte()
    System.arraycopy(d, 0, ip, 28, d.size)
    val hck = Checksum.ipv4Header(ip, 0, 20); ip[10] = (hck ushr 8).toByte(); ip[11] = hck.toByte()
    val uck = Checksum.udp(ip); ip[26] = (uck ushr 8).toByte(); ip[27] = uck.toByte()
    return ip
}

/** Answer A record bytes of a built response are at the end: returns true if it carries [ip]. */
private fun endsWithIp(resp: ByteArray, ip: String) = resp.copyOfRange(resp.size - 4, resp.size).contentEquals(ip4(ip))

private fun forward(h: QueryHandler, name: String, id: Int): DnsQuery {
    val p = query(name, id)
    val a = h.handle(p, p.size)
    check(a is Action.Forward) { "expected Forward for $name, got $a" }
    return a.query
}

fun main() {
    // Answer: metrics.shop.example CNAME shop.tracker.example; shop.tracker.example A 1.2.3.4.
    // The CNAME target name is written in full; the A owner points back at it (offset of that rdata).
    fun cloaked(id: Int): ByteArray {
        val qn = "metrics.shop.example"
        val headerAndQ = 12 + nameBytes(qn).size + 4
        val cnameRdataOffset = headerAndQ + 2 + 10
        return answer(id, qn, listOf(
            Rr(5, null, nameBytes("shop.tracker.example")),
            Rr(1, ptr(cnameRdataOffset), ip4("1.2.3.4"))
        ))
    }

    ct("cnameTargets reads a CNAME and follows pointers") {
        ceq(DnsAnswer.cnameTargets(cloaked(1).let { it }, cloaked(1).size), listOf("shop.tracker.example"))
    }

    ct("chain of two CNAMEs, second target compressed against the first") {
        val qn = "a.site.example"
        val first = nameBytes("edge.cdn.example")
        val headerAndQ = 12 + nameBytes(qn).size + 4
        val firstRdata = headerAndQ + 2 + 10
        // "x." + pointer to "cdn.example" inside the first target (skip the "edge" label: 1 + 4 bytes).
        val second = byteArrayOf(1, 'x'.code.toByte()) + ptr(firstRdata + 5)
        val msg = answer(2, qn, listOf(Rr(5, null, first), Rr(5, ptr(firstRdata), second), Rr(1, ptr(firstRdata + 5), ip4("9.9.9.9"))))
        ceq(DnsAnswer.cnameTargets(msg, msg.size), listOf("edge.cdn.example", "x.cdn.example"))
    }

    ct("no CNAME, plain A answer -> empty") {
        val msg = answer(3, "plain.example", listOf(Rr(1, null, ip4("5.6.7.8"))))
        ceq(DnsAnswer.cnameTargets(msg, msg.size), emptyList<String>())
    }

    ct("pointer loop, truncation and garbage return what was read, never throw") {
        val loop = answer(4, "l.example", listOf(Rr(5, null, ptr(0x30)))) // points into itself or past the end
        DnsAnswer.cnameTargets(loop, loop.size)
        val ok = cloaked(5)
        for (cut in 0 until ok.size) DnsAnswer.cnameTargets(ok, cut)
        val rnd = Random(14)
        repeat(20_000) {
            val b = ByteArray(rnd.nextInt(0, 300)).also { rnd.nextBytes(it) }
            if (b.size >= 8) { b[4] = 0; b[5] = 1 }
            DnsAnswer.cnameTargets(b, b.size)
            DnsAnswer.cnameTargets(b, (b.size + 10)) // len beyond the array: must be rejected, not read
        }
        // Self-referencing pointer inside the CNAME rdata (offset of the rdata itself).
        val qn = "s.example"
        val rdataOff = 12 + nameBytes(qn).size + 4 + 2 + 10
        val self = answer(6, qn, listOf(Rr(5, null, ptr(rdataOff))))
        ceq(DnsAnswer.cnameTargets(self, self.size), emptyList<String>())
    }

    ct("handler blocks a cloaked tracker and logs the real target") {
        val h = QueryHandler(Blocklist.parse("tracker.example"))
        val q = forward(h, "metrics.shop.example", 0x1111)
        val up = cloaked(0x1111)
        val resp = h.onUpstreamAnswer(q, up, up.size)!!
        check(endsWithIp(resp, "0.0.0.0")) { "expected the null-IP blocked answer" }
        ceq(h.snapshot().blocked, 1L)
        ceq(h.snapshot().answered, 0L)
        val e = h.recent().first()
        ceq(e.blocked, true); ceq(e.name, "metrics.shop.example"); ceq(e.via, "shop.tracker.example")
    }

    ct("unrelated CNAME passes through unchanged") {
        val h = QueryHandler(Blocklist.parse("other.example"))
        val q = forward(h, "metrics.shop.example", 0x2222)
        val up = cloaked(0x2222)
        val resp = h.onUpstreamAnswer(q, up, up.size)!!
        check(endsWithIp(resp, "1.2.3.4")) { "expected the real answer" }
        ceq(h.snapshot().blocked, 0L); ceq(h.snapshot().answered, 1L)
    }

    ct("user allow on the query name wins") {
        val h = QueryHandler(Blocklist.parse("tracker.example").plusAllowed(listOf("metrics.shop.example")))
        val q = forward(h, "metrics.shop.example", 0x3333)
        val up = cloaked(0x3333)
        check(endsWithIp(h.onUpstreamAnswer(q, up, up.size)!!, "1.2.3.4")) { "user allow ignored" }
    }

    ct("user allow on the target lets it through") {
        val h = QueryHandler(Blocklist.parse("tracker.example").plusAllowed(listOf("shop.tracker.example")))
        val q = forward(h, "metrics.shop.example", 0x4444)
        val up = cloaked(0x4444)
        check(endsWithIp(h.onUpstreamAnswer(q, up, up.size)!!, "1.2.3.4")) { "target allow ignored" }
    }

    ct("user block on the target is enforced") {
        val h = QueryHandler(Blocklist.parse("").plusBlocked(listOf("tracker.example")))
        val q = forward(h, "metrics.shop.example", 0x5555)
        val up = cloaked(0x5555)
        check(endsWithIp(h.onUpstreamAnswer(q, up, up.size)!!, "0.0.0.0")) { "user block on target ignored" }
    }

    ct("paused: no uncloaking") {
        var now = 1_000L
        val h = QueryHandler(Blocklist.parse("tracker.example"), clock = { now })
        h.pause(60_000)
        val q = forward(h, "metrics.shop.example", 0x6666)
        val up = cloaked(0x6666)
        check(endsWithIp(h.onUpstreamAnswer(q, up, up.size)!!, "1.2.3.4")) { "paused but blocked" }
        now += 61_000
        val q2 = forward(h, "metrics.shop.example", 0x6667)
        val up2 = cloaked(0x6667)
        check(endsWithIp(h.onUpstreamAnswer(q2, up2, up2.size)!!, "0.0.0.0")) { "not blocked after pause ended" }
    }

    ct("a mismatched answer is still refused (no blocked answer invented for it)") {
        val h = QueryHandler(Blocklist.parse("tracker.example"))
        val q = forward(h, "metrics.shop.example", 0x7777)
        val wrongId = cloaked(0x7778)
        ceq(h.onUpstreamAnswer(q, wrongId, wrongId.size), null)
        ceq(h.snapshot().blocked, 0L)
    }

    println("CnameTest: $cn passed")
}
