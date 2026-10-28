// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.io.ByteArrayOutputStream
import java.util.Random

private var i6n = 0
private fun i6t(name: String, block: () -> Unit) {
    try { block(); i6n++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun i6eq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

private fun v6(a: Int, b: Int, c: Int, d: Int, e: Int, f: Int, g: Int, h: Int): ByteArray =
    byteArrayOf(
        (a shr 8).toByte(), a.toByte(),
        (b shr 8).toByte(), b.toByte(),
        (c shr 8).toByte(), c.toByte(),
        (d shr 8).toByte(), d.toByte(),
        (e shr 8).toByte(), e.toByte(),
        (f shr 8).toByte(), f.toByte(),
        (g shr 8).toByte(), g.toByte(),
        (h shr 8).toByte(), h.toByte()
    )

private val I6_SRC = v6(0xfd00, 0x6a72, 0x6764, 0, 0, 0, 0, 1)
private val I6_DST = v6(0xfd00, 0x6a72, 0x6764, 0, 0, 0, 0, 2)

private fun i6UdpChecksum(packet: ByteArray): Int {
    val udpLen = ((packet[4].toInt() and 0xFF) shl 8) or (packet[5].toInt() and 0xFF)
    var acc = 0L
    var k = 8
    while (k < 40) {
        acc += ((packet[k].toInt() and 0xFF) shl 8) or (packet[k + 1].toInt() and 0xFF)
        k += 2
    }
    acc += udpLen.toLong()
    acc += 17L
    var m = 0
    while (m + 1 < udpLen) {
        if (m != 6) {
            acc += ((packet[40 + m].toInt() and 0xFF) shl 8) or (packet[40 + m + 1].toInt() and 0xFF)
        }
        m += 2
    }
    if (m < udpLen) {
        acc += (packet[40 + m].toInt() and 0xFF) shl 8
    }
    while ((acc shr 16) != 0L) {
        acc = (acc and 0xFFFF) + (acc shr 16)
    }
    val r = (acc.inv() and 0xFFFF).toInt()
    return if (r == 0) 0xFFFF else r
}

private fun i6DnsQuery(name: String, qtype: Int): ByteArray {
    val dns = ByteArrayOutputStream()
    dns.write(0x12); dns.write(0x34)
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
    return dns.toByteArray()
}

private fun i6BuildQuery(name: String, qtype: Int, srcPort: Int = 40000, nextHeader: Int = 17): ByteArray {
    val dnsBytes = i6DnsQuery(name, qtype)
    val udpLen = 8 + dnsBytes.size
    val udp = ByteArray(udpLen)
    udp[0] = ((srcPort ushr 8) and 0xFF).toByte()
    udp[1] = (srcPort and 0xFF).toByte()
    udp[2] = 0; udp[3] = 53
    udp[4] = ((udpLen ushr 8) and 0xFF).toByte()
    udp[5] = (udpLen and 0xFF).toByte()
    udp[6] = 0; udp[7] = 0
    System.arraycopy(dnsBytes, 0, udp, 8, dnsBytes.size)

    val totalLen = 40 + udpLen
    val ip = ByteArray(totalLen)
    ip[0] = 0x60
    ip[1] = 0; ip[2] = 0; ip[3] = 0
    ip[4] = ((udpLen ushr 8) and 0xFF).toByte()
    ip[5] = (udpLen and 0xFF).toByte()
    ip[6] = nextHeader.toByte()
    ip[7] = 64
    System.arraycopy(I6_SRC, 0, ip, 8, 16)
    System.arraycopy(I6_DST, 0, ip, 24, 16)
    System.arraycopy(udp, 0, ip, 40, udpLen)
    val ck = i6UdpChecksum(ip)
    ip[46] = ((ck ushr 8) and 0xFF).toByte()
    ip[47] = (ck and 0xFF).toByte()
    return ip
}

private fun i6BuildUpstream(
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

private fun i4BuildQuery(name: String, qtype: Int): ByteArray {
    val dnsBytes = i6DnsQuery(name, qtype)
    val udpLen = 8 + dnsBytes.size
    val udp = ByteArray(udpLen)
    udp[0] = 0x9C.toByte(); udp[1] = 0x40
    udp[2] = 0; udp[3] = 53
    udp[4] = ((udpLen ushr 8) and 0xFF).toByte()
    udp[5] = (udpLen and 0xFF).toByte()
    System.arraycopy(dnsBytes, 0, udp, 8, dnsBytes.size)
    val totalLen = 20 + udpLen
    val ip = ByteArray(totalLen)
    ip[0] = 0x45
    ip[2] = ((totalLen ushr 8) and 0xFF).toByte()
    ip[3] = (totalLen and 0xFF).toByte()
    ip[6] = 0x40
    ip[8] = 64; ip[9] = 17
    ip[12] = 10; ip[13] = 0; ip[14] = 0; ip[15] = 1
    ip[16] = 10; ip[17] = 0; ip[18] = 0; ip[19] = 2
    val ck = Checksum.ipv4Header(ip, 0, 20)
    ip[10] = ((ck ushr 8) and 0xFF).toByte()
    ip[11] = (ck and 0xFF).toByte()
    System.arraycopy(udp, 0, ip, 20, udpLen)
    return ip
}

fun main() {

    i6t("parse IPv6 A query") {
        val p = i6BuildQuery("example.com", 1)
        val q = DnsPacket.parseQuery(p, p.size) ?: error("null")
        i6eq(q.ipVersion, 6)
        i6eq(q.ipHeaderLen, 40)
        i6eq(q.srcIp.size, 16)
        i6eq(q.dstIp.size, 16)
        i6eq(q.srcIp.toList(), I6_SRC.toList())
        i6eq(q.dstIp.toList(), I6_DST.toList())
        i6eq(q.srcPort, 40000)
        i6eq(q.dstPort, 53)
        i6eq(q.qname, "example.com")
        i6eq(q.qtype, 1)
        i6eq(q.qclass, 1)
        i6eq(q.dnsId, 0x1234)
        i6eq(q.flags, 0x0100)
    }

    i6t("parse IPv6 AAAA query") {
        val p = i6BuildQuery("ipv6.example", 28)
        val q = DnsPacket.parseQuery(p, p.size) ?: error("null")
        i6eq(q.ipVersion, 6)
        i6eq(q.qtype, 28)
        i6eq(q.qname, "ipv6.example")
    }

    i6t("uppercase name lowercased in IPv6") {
        val p = i6BuildQuery("Graph.Facebook.COM", 1)
        val q = DnsPacket.parseQuery(p, p.size) ?: error("null")
        i6eq(q.qname, "graph.facebook.com")
    }

    i6t("reject extension headers") {
        for (nh in listOf(0, 43, 44, 60)) {
            val b = i6BuildQuery("example.com", 1, nextHeader = nh)
            i6eq(DnsPacket.parseQuery(b, b.size), null)
        }
    }

    i6t("reject mismatched payload length") {
        val base = i6BuildQuery("example.com", 1)
        val p0 = base[4].toInt() and 0xFF
        val p1 = base[5].toInt() and 0xFF
        val pl = (p0 shl 8) or p1

        val bigger = base.copyOf()
        bigger[4] = (((pl + 10) ushr 8) and 0xFF).toByte()
        bigger[5] = ((pl + 10) and 0xFF).toByte()
        i6eq(DnsPacket.parseQuery(bigger, bigger.size), null)

        val smaller = base.copyOf()
        smaller[4] = (((pl - 1) ushr 8) and 0xFF).toByte()
        smaller[5] = ((pl - 1) and 0xFF).toByte()
        i6eq(DnsPacket.parseQuery(smaller, smaller.size), null)
    }

    i6t("reject truncations") {
        val p = i6BuildQuery("example.com", 1)
        for (len in 0 until p.size) {
            i6eq(DnsPacket.parseQuery(p, len), null)
        }
    }

    i6t("reject non-53 port in IPv6") {
        val b = i6BuildQuery("example.com", 1)
        b[42] = 0; b[43] = 99
        i6eq(DnsPacket.parseQuery(b, b.size), null)
    }

    i6t("buildBlockedResponse IPv6 NXDOMAIN") {
        val p = i6BuildQuery("bad.example", 1)
        val q = DnsPacket.parseQuery(p, p.size) ?: error("null")
        val r = DnsPacket.buildBlockedResponse(q, BlockMode.NXDOMAIN)
        i6eq((r[0].toInt() ushr 4) and 0xF, 6)
        val pl = ((r[4].toInt() and 0xFF) shl 8) or (r[5].toInt() and 0xFF)
        i6eq(40 + pl, r.size)
        i6eq(r[6].toInt() and 0xFF, 17)
        i6eq(r[7].toInt() and 0xFF, 64)
        i6eq(r.copyOfRange(8, 24).toList(), q.dstIp.toList())
        i6eq(r.copyOfRange(24, 40).toList(), q.srcIp.toList())
        i6eq(((r[40].toInt() and 0xFF) shl 8) or (r[41].toInt() and 0xFF), 53)
        i6eq(((r[42].toInt() and 0xFF) shl 8) or (r[43].toInt() and 0xFF), 40000)
        val stored = ((r[46].toInt() and 0xFF) shl 8) or (r[47].toInt() and 0xFF)
        check(stored != 0) { "stored UDP checksum must not be 0 for IPv6" }
        i6eq(stored, i6UdpChecksum(r))
        check(Checksum.verify(r)) { "Checksum.verify" }
        check(Checksum.verify6(r)) { "Checksum.verify6" }
        i6eq(((r[48].toInt() and 0xFF) shl 8) or (r[49].toInt() and 0xFF), 0x1234)
        val rcode = ((r[50].toInt() and 0xFF) shl 8 or (r[51].toInt() and 0xFF)) and 0xF
        i6eq(rcode, 3)
    }

    i6t("buildBlockedResponse IPv6 NULL_IP A and AAAA") {
        run {
            val p = i6BuildQuery("x.example", 1)
            val q = DnsPacket.parseQuery(p, p.size) ?: error("null")
            val r = DnsPacket.buildBlockedResponse(q, BlockMode.NULL_IP)
            check(Checksum.verify6(r)) { "ck A" }
            val an = ((r[54].toInt() and 0xFF) shl 8) or (r[55].toInt() and 0xFF)
            i6eq(an, 1)
        }
        run {
            val p = i6BuildQuery("x.example", 28)
            val q = DnsPacket.parseQuery(p, p.size) ?: error("null")
            val r = DnsPacket.buildBlockedResponse(q, BlockMode.NULL_IP)
            check(Checksum.verify6(r)) { "ck AAAA" }
            val an = ((r[54].toInt() and 0xFF) shl 8) or (r[55].toInt() and 0xFF)
            i6eq(an, 1)
        }
    }

    i6t("buildResponseFromUpstream IPv6") {
        val p = i6BuildQuery("example.com", 1)
        val q = DnsPacket.parseQuery(p, p.size) ?: error("null")
        val up = i6BuildUpstream(0x1234, "example.com", 1, 1, "93.184.216.34")
        val r = DnsPacket.buildResponseFromUpstream(q, up, up.size) ?: error("null")
        i6eq((r[0].toInt() ushr 4) and 0xF, 6)
        i6eq(r.copyOfRange(8, 24).toList(), q.dstIp.toList())
        i6eq(r.copyOfRange(24, 40).toList(), q.srcIp.toList())
        i6eq(((r[40].toInt() and 0xFF) shl 8) or (r[41].toInt() and 0xFF), 53)
        i6eq(((r[42].toInt() and 0xFF) shl 8) or (r[43].toInt() and 0xFF), 40000)
        i6eq(r.copyOfRange(48, r.size).toList(), up.toList())
        check(Checksum.verify6(r)) { "ck" }

        val badId = i6BuildUpstream(0x9999, "example.com", 1, 1, "93.184.216.34")
        i6eq(DnsPacket.buildResponseFromUpstream(q, badId, badId.size), null)

        val badQr = i6BuildUpstream(0x1234, "example.com", 1, 1, "93.184.216.34", qr = false)
        i6eq(DnsPacket.buildResponseFromUpstream(q, badQr, badQr.size), null)

        val badName = i6BuildUpstream(0x1234, "other.com", 1, 1, "93.184.216.34")
        i6eq(DnsPacket.buildResponseFromUpstream(q, badName, badName.size), null)

        val badType = i6BuildUpstream(0x1234, "example.com", 28, 1, "93.184.216.34")
        i6eq(DnsPacket.buildResponseFromUpstream(q, badType, badType.size), null)

        for (len in 0..11) {
            i6eq(DnsPacket.buildResponseFromUpstream(q, up, len), null)
        }
    }

    i6t("extractQueryPayload on IPv6") {
        val p = i6BuildQuery("example.com", 1)
        val q = DnsPacket.parseQuery(p, p.size) ?: error("null")
        val payload = DnsWire.extractQueryPayload(p, q)
        val udpLen = ((p[44].toInt() and 0xFF) shl 8) or (p[45].toInt() and 0xFF)
        i6eq(payload.size, udpLen - 8)
        i6eq((payload[0].toInt() and 0xFF), 0x12)
        i6eq((payload[1].toInt() and 0xFF), 0x34)
    }

    i6t("fuzz 20000 IPv6 first byte") {
        val r = Random(42)
        for (i in 0 until 20000) {
            val len = r.nextInt(601)
            val b = ByteArray(len)
            r.nextBytes(b)
            if (len > 0) b[0] = ((6 shl 4) or (b[0].toInt() and 0x0F)).toByte()
            DnsPacket.parseQuery(b, len)
        }
    }

    i6t("fuzz byte flips on valid IPv6 query") {
        val base = i6BuildQuery("example.com", 1)
        val r = Random(7)
        for (i in 0 until 20000) {
            val b = base.copyOf()
            val flips = 1 + r.nextInt(5)
            for (j in 0 until flips) {
                val idx = r.nextInt(b.size)
                b[idx] = (b[idx].toInt() xor (1 + r.nextInt(255))).toByte()
            }
            DnsPacket.parseQuery(b, b.size)
        }
    }

    i6t("IPv4 path still works") {
        val p = i4BuildQuery("example.com", 1)
        val q = DnsPacket.parseQuery(p, p.size) ?: error("null")
        i6eq(q.ipVersion, 4)
        i6eq(q.ipHeaderLen, 20)
        i6eq(q.srcIp.size, 4)
        i6eq(q.dstIp.size, 4)
        i6eq(q.qname, "example.com")
        i6eq(q.qtype, 1)
        i6eq(q.srcPort, 40000)
        i6eq(q.dstPort, 53)

        val resp = DnsPacket.buildBlockedResponse(q, BlockMode.NULL_IP)
        i6eq((resp[0].toInt() ushr 4) and 0xF, 4)
        check(Checksum.verify(resp)) { "IPv4 verify" }
    }

    println("DnsIpv6Test: $i6n passed")
}
