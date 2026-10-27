// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.io.ByteArrayOutputStream
import java.util.Random

private var un = 0
private fun ut(name: String, block: () -> Unit) {
    try { block(); un++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun ueq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

private fun uIpUdp(dns: ByteArray, srcPort: Int = 40000): ByteArray {
    val udpLen = 8 + dns.size
    val udp = ByteArray(udpLen)
    udp[0] = ((srcPort ushr 8) and 0xFF).toByte()
    udp[1] = (srcPort and 0xFF).toByte()
    udp[2] = 0; udp[3] = 53
    udp[4] = ((udpLen ushr 8) and 0xFF).toByte()
    udp[5] = (udpLen and 0xFF).toByte()
    System.arraycopy(dns, 0, udp, 8, dns.size)
    val totalLen = 20 + udpLen
    val ip = ByteArray(totalLen)
    ip[0] = 0x45
    ip[2] = ((totalLen ushr 8) and 0xFF).toByte()
    ip[3] = (totalLen and 0xFF).toByte()
    ip[6] = 0x40; ip[8] = 64; ip[9] = 17
    ip[12] = 192.toByte(); ip[13] = 168.toByte(); ip[14] = 1; ip[15] = 100
    ip[16] = 8; ip[17] = 8; ip[18] = 8; ip[19] = 8
    val ipck = Checksum.ipv4Header(ip, 0, 20)
    ip[10] = ((ipck ushr 8) and 0xFF).toByte()
    ip[11] = (ipck and 0xFF).toByte()
    System.arraycopy(udp, 0, ip, 20, udpLen)
    val udpck = Checksum.udp(ip)
    ip[26] = ((udpck ushr 8) and 0xFF).toByte()
    ip[27] = (udpck and 0xFF).toByte()
    return ip
}

private fun uBuildQuery(name: String, qtype: Int, id: Int = 0x1234, srcPort: Int = 40000): ByteArray {
    val dns = ByteArrayOutputStream()
    dns.write((id ushr 8) and 0xFF); dns.write(id and 0xFF)
    dns.write(0x01); dns.write(0x00)
    dns.write(0x00); dns.write(0x01)
    dns.write(0x00); dns.write(0x00)
    dns.write(0x00); dns.write(0x00)
    dns.write(0x00); dns.write(0x00)
    for (label in name.split('.')) {
        dns.write(label.length and 0xFF)
        dns.write(label.toByteArray(Charsets.US_ASCII))
    }
    dns.write(0x00)
    dns.write((qtype ushr 8) and 0xFF); dns.write(qtype and 0xFF)
    dns.write(0x00); dns.write(0x01)
    return uIpUdp(dns.toByteArray(), srcPort)
}

private fun uBuildQueryEdns(name: String, qtype: Int, id: Int = 0xABCD, srcPort: Int = 40000): ByteArray {
    val dns = ByteArrayOutputStream()
    dns.write((id ushr 8) and 0xFF); dns.write(id and 0xFF)
    dns.write(0x01); dns.write(0x00)
    dns.write(0x00); dns.write(0x01)
    dns.write(0x00); dns.write(0x00)
    dns.write(0x00); dns.write(0x00)
    dns.write(0x00); dns.write(0x01)   // ARCOUNT = 1
    for (label in name.split('.')) {
        dns.write(label.length and 0xFF)
        dns.write(label.toByteArray(Charsets.US_ASCII))
    }
    dns.write(0x00)
    dns.write((qtype ushr 8) and 0xFF); dns.write(qtype and 0xFF)
    dns.write(0x00); dns.write(0x01)
    // EDNS OPT RR
    dns.write(0x00)                     // root name
    dns.write(0x00); dns.write(0x29)    // TYPE 41
    dns.write(0x10); dns.write(0x00)    // CLASS 4096
    dns.write(0x00); dns.write(0x00); dns.write(0x00); dns.write(0x00)
    dns.write(0x00); dns.write(0x00)    // RDLEN 0
    return uIpUdp(dns.toByteArray(), srcPort)
}

private fun uBuildUpstream(
    id: Int, qname: String, qtype: Int, qclass: Int, aIp: String, qr: Boolean = true
): ByteArray {
    val out = ByteArrayOutputStream()
    out.write((id ushr 8) and 0xFF); out.write(id and 0xFF)
    var flags = 0
    if (qr) flags = flags or 0x8000
    flags = flags or 0x0100 or 0x0080
    out.write((flags ushr 8) and 0xFF); out.write(flags and 0xFF)
    out.write(0x00); out.write(0x01)
    out.write(0x00); out.write(0x01)
    out.write(0x00); out.write(0x00)
    out.write(0x00); out.write(0x00)
    for (label in qname.split('.')) {
        out.write(label.length and 0xFF)
        out.write(label.toByteArray(Charsets.US_ASCII))
    }
    out.write(0x00)
    out.write((qtype ushr 8) and 0xFF); out.write(qtype and 0xFF)
    out.write((qclass ushr 8) and 0xFF); out.write(qclass and 0xFF)
    out.write(0xC0); out.write(0x0C)
    out.write(0x00); out.write(0x01)
    out.write(0x00); out.write(0x01)
    out.write(0x00); out.write(0x00); out.write(0x01); out.write(0x2C)
    out.write(0x00); out.write(0x04)
    for (p in aIp.split('.')) out.write(p.toInt() and 0xFF)
    return out.toByteArray()
}

fun main() {

    ut("blocklist hardening") {
        val text = """
            com
            -a.com
            a-.com
            a..b.com
            ${"a".repeat(64)}.com
            _dmarc.example.com
            good.example.com
        """.trimIndent()
        val bl = Blocklist.parse(text)
        ueq(bl.blockedCount, 2)
        check(bl.isBlocked("_dmarc.example.com")) { "dmarc" }
        check(bl.isBlocked("sub._dmarc.example.com")) { "subdmarc" }
        check(bl.isBlocked("good.example.com")) { "good" }
        check(!bl.isBlocked("com")) { "com" }
        check(!bl.isBlocked("")) { "empty" }
        check(!bl.isBlocked("..")) { "dotdot" }
        check(!bl.isBlocked("a.b")) { "ab" }
    }

    ut("upstream valid wrapped") {
        val pkt = uBuildQuery("example.com", 1)
        val q = DnsPacket.parseQuery(pkt, pkt.size) ?: error("null")
        val up = uBuildUpstream(0x1234, "example.com", 1, 1, "93.184.216.34")
        val resp = DnsPacket.buildResponseFromUpstream(q, up, up.size) ?: error("null")
        check(Checksum.verify(resp)) { "checksum" }
        val ihl = (resp[0].toInt() and 0xF) * 4
        val respDns = resp.copyOfRange(ihl + 8, resp.size)
        check(respDns.contentEquals(up)) { "payload mismatch" }
        check(resp.copyOfRange(12, 16).contentEquals(q.dstIp)) { "src ip" }
        check(resp.copyOfRange(16, 20).contentEquals(q.srcIp)) { "dst ip" }
        ueq(((resp[20].toInt() and 0xFF) shl 8) or (resp[21].toInt() and 0xFF), q.dstPort)
        ueq(((resp[22].toInt() and 0xFF) shl 8) or (resp[23].toInt() and 0xFF), q.srcPort)
    }

    ut("upstream rejection") {
        val pkt = uBuildQuery("example.com", 1)
        val q = DnsPacket.parseQuery(pkt, pkt.size) ?: error("null")
        run {
            val up = uBuildUpstream(0x9999, "example.com", 1, 1, "1.2.3.4")
            ueq(DnsPacket.buildResponseFromUpstream(q, up, up.size), null)
        }
        run {
            val up = uBuildUpstream(0x1234, "example.com", 1, 1, "1.2.3.4", qr = false)
            ueq(DnsPacket.buildResponseFromUpstream(q, up, up.size), null)
        }
        run {
            val up = uBuildUpstream(0x1234, "other.com", 1, 1, "1.2.3.4")
            ueq(DnsPacket.buildResponseFromUpstream(q, up, up.size), null)
        }
        run {
            val up = uBuildUpstream(0x1234, "example.com", 28, 1, "1.2.3.4")
            ueq(DnsPacket.buildResponseFromUpstream(q, up, up.size), null)
        }
        val up = uBuildUpstream(0x1234, "example.com", 1, 1, "1.2.3.4")
        for (len in 0..11) {
            ueq(DnsPacket.buildResponseFromUpstream(q, up, len), null)
        }
    }

    ut("random bytes no throw") {
        val pkt = uBuildQuery("example.com", 1)
        val q = DnsPacket.parseQuery(pkt, pkt.size) ?: error("null")
        val r = Random(7)
        for (i in 0 until 20000) {
            val len = r.nextInt(601)
            val b = ByteArray(len)
            r.nextBytes(b)
            DnsPacket.buildResponseFromUpstream(q, b, len)
        }
    }

    ut("extractQueryPayload EDNS") {
        val pkt = uBuildQueryEdns("tracker.example.com", 1)
        val q = DnsPacket.parseQuery(pkt, pkt.size) ?: error("null")
        val payload = DnsWire.extractQueryPayload(pkt, q)
        val udpLen = ((pkt[q.ipHeaderLen + 4].toInt() and 0xFF) shl 8) or (pkt[q.ipHeaderLen + 5].toInt() and 0xFF)
        ueq(payload.size, udpLen - 8)
        ueq(((payload[0].toInt() and 0xFF) shl 8) or (payload[1].toInt() and 0xFF), q.dnsId)
    }

    println("DnsUpstreamTest: $un passed")
}
