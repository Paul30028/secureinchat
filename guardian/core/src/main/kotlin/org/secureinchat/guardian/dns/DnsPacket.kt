// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.io.ByteArrayOutputStream

enum class BlockMode { NXDOMAIN, NULL_IP }

data class DnsQuery(
    val srcIp: ByteArray,
    val dstIp: ByteArray,
    val srcPort: Int,
    val dstPort: Int,
    val ipHeaderLen: Int,
    val dnsId: Int,
    val flags: Int,
    val qname: String,
    val qtype: Int,
    val qclass: Int,
    val questionEnd: Int,
    val ipVersion: Int = 4
)

object DnsPacket {

    private class DnsPart(
        val dnsId: Int,
        val flags: Int,
        val qname: String,
        val qtype: Int,
        val qclass: Int,
        val questionEnd: Int
    )

    private fun parseDns(packet: ByteArray, dnsOff: Int, dnsEnd: Int): DnsPart? {
        if (dnsEnd - dnsOff < 12) return null
        val dnsId = ((packet[dnsOff].toInt() and 0xFF) shl 8) or (packet[dnsOff + 1].toInt() and 0xFF)
        val dnsFlags = ((packet[dnsOff + 2].toInt() and 0xFF) shl 8) or (packet[dnsOff + 3].toInt() and 0xFF)
        if (((dnsFlags ushr 15) and 1) != 0) return null
        if (((dnsFlags ushr 11) and 0xF) != 0) return null
        val qdcount = ((packet[dnsOff + 4].toInt() and 0xFF) shl 8) or (packet[dnsOff + 5].toInt() and 0xFF)
        if (qdcount != 1) return null

        var pos = dnsOff + 12
        val labels = ArrayList<String>(8)
        while (true) {
            if (pos >= dnsEnd) return null
            val b = packet[pos].toInt() and 0xFF
            if ((b and 0xC0) == 0xC0) return null
            if (b == 0) { pos++; break }
            if (b < 1 || b > 63) return null
            if (pos + 1 + b > dnsEnd) return null
            val sb = StringBuilder(b)
            for (i in 0 until b) {
                val c = packet[pos + 1 + i].toInt() and 0xFF
                if (c < 0x21 || c > 0x7E) return null
                sb.append(c.toChar())
            }
            labels.add(sb.toString())
            pos += 1 + b
        }
        if (labels.isEmpty()) return null
        val qname = labels.joinToString(".").lowercase()
        if (qname.length > 253) return null

        if (pos + 4 > dnsEnd) return null
        val qtype = ((packet[pos].toInt() and 0xFF) shl 8) or (packet[pos + 1].toInt() and 0xFF)
        val qclass = ((packet[pos + 2].toInt() and 0xFF) shl 8) or (packet[pos + 3].toInt() and 0xFF)
        pos += 4
        return DnsPart(dnsId, dnsFlags, qname, qtype, qclass, pos)
    }

    fun parseQuery(packet: ByteArray, length: Int): DnsQuery? {
        try {
            if (length < 1) return null
            if (length > packet.size) return null
            val version = (packet[0].toInt() ushr 4) and 0xF
            return when (version) {
                4 -> parseIpv4(packet, length)
                6 -> parseIpv6(packet, length)
                else -> null
            }
        } catch (t: Throwable) {
            return null
        }
    }

    private fun parseIpv4(packet: ByteArray, length: Int): DnsQuery? {
        if (length < 20) return null
        val ihl = packet[0].toInt() and 0xF
        if (ihl < 5) return null
        val ipHeaderLen = ihl * 4
        if (ipHeaderLen > length) return null
        val totalLen = ((packet[2].toInt() and 0xFF) shl 8) or (packet[3].toInt() and 0xFF)
        val packetLen = minOf(totalLen, length)
        if (packetLen < ipHeaderLen) return null
        if ((packet[9].toInt() and 0xFF) != 17) return null
        val flagsFrag = packet[6].toInt() and 0xFF
        val mf = (flagsFrag ushr 5) and 1
        val fragOffset = ((flagsFrag and 0x1F) shl 8) or (packet[7].toInt() and 0xFF)
        if (mf != 0 || fragOffset != 0) return null
        if (ipHeaderLen + 8 > packetLen) return null
        val srcPort = ((packet[ipHeaderLen].toInt() and 0xFF) shl 8) or (packet[ipHeaderLen + 1].toInt() and 0xFF)
        val dstPort = ((packet[ipHeaderLen + 2].toInt() and 0xFF) shl 8) or (packet[ipHeaderLen + 3].toInt() and 0xFF)
        if (dstPort != 53) return null
        val udpLen = ((packet[ipHeaderLen + 4].toInt() and 0xFF) shl 8) or (packet[ipHeaderLen + 5].toInt() and 0xFF)
        if (udpLen < 8) return null
        if (ipHeaderLen + udpLen > packetLen) return null
        val dnsOff = ipHeaderLen + 8
        val dnsEnd = dnsOff + (udpLen - 8)
        val dns = parseDns(packet, dnsOff, dnsEnd) ?: return null
        val srcIp = byteArrayOf(packet[12], packet[13], packet[14], packet[15])
        val dstIp = byteArrayOf(packet[16], packet[17], packet[18], packet[19])
        return DnsQuery(
            srcIp, dstIp, srcPort, dstPort, ipHeaderLen,
            dns.dnsId, dns.flags, dns.qname, dns.qtype, dns.qclass, dns.questionEnd, 4
        )
    }

    private fun parseIpv6(packet: ByteArray, length: Int): DnsQuery? {
        if (length < 40) return null
        val payloadLen = ((packet[4].toInt() and 0xFF) shl 8) or (packet[5].toInt() and 0xFF)
        if (40 + payloadLen != length) return null
        val nextHeader = packet[6].toInt() and 0xFF
        if (nextHeader != 17) return null
        if (payloadLen < 8) return null
        val srcPort = ((packet[40].toInt() and 0xFF) shl 8) or (packet[41].toInt() and 0xFF)
        val dstPort = ((packet[42].toInt() and 0xFF) shl 8) or (packet[43].toInt() and 0xFF)
        if (dstPort != 53) return null
        val udpLen = ((packet[44].toInt() and 0xFF) shl 8) or (packet[45].toInt() and 0xFF)
        if (udpLen < 8) return null
        if (udpLen > payloadLen) return null
        val dnsOff = 40 + 8
        val dnsEnd = dnsOff + (udpLen - 8)
        val dns = parseDns(packet, dnsOff, dnsEnd) ?: return null
        val srcIp = packet.copyOfRange(8, 24)
        val dstIp = packet.copyOfRange(24, 40)
        return DnsQuery(
            srcIp, dstIp, srcPort, dstPort, 40,
            dns.dnsId, dns.flags, dns.qname, dns.qtype, dns.qclass, dns.questionEnd, 6
        )
    }

    fun buildBlockedResponse(q: DnsQuery, mode: BlockMode): ByteArray {
        val dns = ByteArrayOutputStream(128)

        val rcode = if (mode == BlockMode.NXDOMAIN) 3 else 0
        var ancount = 0
        if (mode == BlockMode.NULL_IP && (q.qtype == 1 || q.qtype == 28)) ancount = 1

        var dnsFlags = 0
        dnsFlags = dnsFlags or (1 shl 15)               // QR = 1
        dnsFlags = dnsFlags or (q.flags and 0x0100)     // RD copied
        dnsFlags = dnsFlags or (1 shl 7)                // RA = 1
        dnsFlags = dnsFlags or rcode

        dns.write((q.dnsId ushr 8) and 0xFF)
        dns.write(q.dnsId and 0xFF)
        dns.write((dnsFlags ushr 8) and 0xFF)
        dns.write(dnsFlags and 0xFF)
        dns.write(0x00); dns.write(0x01)
        dns.write((ancount ushr 8) and 0xFF)
        dns.write(ancount and 0xFF)
        dns.write(0x00); dns.write(0x00)
        dns.write(0x00); dns.write(0x00)

        for (label in q.qname.split('.')) {
            dns.write(label.length and 0xFF)
            dns.write(label.toByteArray(Charsets.US_ASCII))
        }
        dns.write(0x00)
        dns.write((q.qtype ushr 8) and 0xFF)
        dns.write(q.qtype and 0xFF)
        dns.write((q.qclass ushr 8) and 0xFF)
        dns.write(q.qclass and 0xFF)

        if (mode == BlockMode.NULL_IP && q.qtype == 1) {
            dns.write(0xC0); dns.write(0x0C)
            dns.write(0x00); dns.write(0x01)
            dns.write(0x00); dns.write(0x01)
            dns.write(0x00); dns.write(0x00); dns.write(0x00); dns.write(60)
            dns.write(0x00); dns.write(0x04)
            dns.write(0x00); dns.write(0x00); dns.write(0x00); dns.write(0x00)
        } else if (mode == BlockMode.NULL_IP && q.qtype == 28) {
            dns.write(0xC0); dns.write(0x0C)
            dns.write(0x00); dns.write(28)
            dns.write(0x00); dns.write(0x01)
            dns.write(0x00); dns.write(0x00); dns.write(0x00); dns.write(60)
            dns.write(0x00); dns.write(16)
            for (i in 0 until 16) dns.write(0x00)
        }

        return wrapUdp(q.dstIp, q.srcIp, q.dstPort, q.srcPort, dns.toByteArray())
    }

    fun buildResponseFromUpstream(q: DnsQuery, upstream: ByteArray, upstreamLen: Int): ByteArray? {
        try {
            if (upstreamLen < 12) return null
            if (upstreamLen > upstream.size) return null
            if (upstreamLen > 65507) return null

            val id = ((upstream[0].toInt() and 0xFF) shl 8) or (upstream[1].toInt() and 0xFF)
            if (id != q.dnsId) return null

            val flags = ((upstream[2].toInt() and 0xFF) shl 8) or (upstream[3].toInt() and 0xFF)
            if (((flags ushr 15) and 1) != 1) return null

            val qd = ((upstream[4].toInt() and 0xFF) shl 8) or (upstream[5].toInt() and 0xFF)
            if (qd != 1) return null

            var pos = 12
            val labels = ArrayList<String>(8)
            while (true) {
                if (pos >= upstreamLen) return null
                val b = upstream[pos].toInt() and 0xFF
                if ((b and 0xC0) == 0xC0) return null
                if (b == 0) { pos++; break }
                if (b < 1 || b > 63) return null
                if (pos + 1 + b > upstreamLen) return null
                val sb = StringBuilder(b)
                for (i in 0 until b) {
                    val c = upstream[pos + 1 + i].toInt() and 0xFF
                    if (c < 0x21 || c > 0x7E) return null
                    sb.append(c.toChar())
                }
                labels.add(sb.toString())
                pos += 1 + b
            }
            if (labels.isEmpty()) return null
            val name = labels.joinToString(".").lowercase()
            if (name != q.qname) return null

            if (pos + 4 > upstreamLen) return null
            val qtype = ((upstream[pos].toInt() and 0xFF) shl 8) or (upstream[pos + 1].toInt() and 0xFF)
            val qclass = ((upstream[pos + 2].toInt() and 0xFF) shl 8) or (upstream[pos + 3].toInt() and 0xFF)
            if (qtype != q.qtype) return null
            if (qclass != q.qclass) return null

            val payload = upstream.copyOfRange(0, upstreamLen)
            return wrapUdp(q.dstIp, q.srcIp, q.dstPort, q.srcPort, payload)
        } catch (t: Throwable) {
            return null
        }
    }

    internal fun wrapUdp(
        srcIp: ByteArray,
        dstIp: ByteArray,
        srcPort: Int,
        dstPort: Int,
        payload: ByteArray
    ): ByteArray {
        return if (srcIp.size == 16 && dstIp.size == 16) {
            wrapUdp6(srcIp, dstIp, srcPort, dstPort, payload)
        } else {
            wrapUdp4(srcIp, dstIp, srcPort, dstPort, payload)
        }
    }

    private fun wrapUdp4(
        srcIp: ByteArray,
        dstIp: ByteArray,
        srcPort: Int,
        dstPort: Int,
        payload: ByteArray
    ): ByteArray {
        val udpLen = 8 + payload.size
        val udp = ByteArray(udpLen)
        udp[0] = ((srcPort ushr 8) and 0xFF).toByte()
        udp[1] = (srcPort and 0xFF).toByte()
        udp[2] = ((dstPort ushr 8) and 0xFF).toByte()
        udp[3] = (dstPort and 0xFF).toByte()
        udp[4] = ((udpLen ushr 8) and 0xFF).toByte()
        udp[5] = (udpLen and 0xFF).toByte()
        udp[6] = 0
        udp[7] = 0
        System.arraycopy(payload, 0, udp, 8, payload.size)

        val totalLen = 20 + udpLen
        val ip = ByteArray(totalLen)
        ip[0] = 0x45
        ip[1] = 0
        ip[2] = ((totalLen ushr 8) and 0xFF).toByte()
        ip[3] = (totalLen and 0xFF).toByte()
        ip[4] = 0
        ip[5] = 0
        ip[6] = 0x40
        ip[7] = 0
        ip[8] = 64
        ip[9] = 17
        ip[10] = 0
        ip[11] = 0
        System.arraycopy(srcIp, 0, ip, 12, 4)
        System.arraycopy(dstIp, 0, ip, 16, 4)

        val ipck = Checksum.ipv4Header(ip, 0, 20)
        ip[10] = ((ipck ushr 8) and 0xFF).toByte()
        ip[11] = (ipck and 0xFF).toByte()

        System.arraycopy(udp, 0, ip, 20, udpLen)

        val udpck = Checksum.udp(ip)
        ip[26] = ((udpck ushr 8) and 0xFF).toByte()
        ip[27] = (udpck and 0xFF).toByte()

        return ip
    }

    private fun wrapUdp6(
        srcIp: ByteArray,
        dstIp: ByteArray,
        srcPort: Int,
        dstPort: Int,
        payload: ByteArray
    ): ByteArray {
        val udpLen = 8 + payload.size
        val udp = ByteArray(udpLen)
        udp[0] = ((srcPort ushr 8) and 0xFF).toByte()
        udp[1] = (srcPort and 0xFF).toByte()
        udp[2] = ((dstPort ushr 8) and 0xFF).toByte()
        udp[3] = (dstPort and 0xFF).toByte()
        udp[4] = ((udpLen ushr 8) and 0xFF).toByte()
        udp[5] = (udpLen and 0xFF).toByte()
        udp[6] = 0
        udp[7] = 0
        System.arraycopy(payload, 0, udp, 8, payload.size)

        val totalLen = 40 + udpLen
        val ip = ByteArray(totalLen)
        ip[0] = 0x60
        ip[1] = 0; ip[2] = 0; ip[3] = 0
        ip[4] = ((udpLen ushr 8) and 0xFF).toByte()
        ip[5] = (udpLen and 0xFF).toByte()
        ip[6] = 17
        ip[7] = 64
        System.arraycopy(srcIp, 0, ip, 8, 16)
        System.arraycopy(dstIp, 0, ip, 24, 16)
        System.arraycopy(udp, 0, ip, 40, udpLen)

        val udpck = Checksum.udp6(ip)
        ip[46] = ((udpck ushr 8) and 0xFF).toByte()
        ip[47] = (udpck and 0xFF).toByte()

        return ip
    }
}

object DnsWire {
    fun extractQueryPayload(packet: ByteArray, q: DnsQuery): ByteArray {
        val ihl = q.ipHeaderLen
        val udpLen = ((packet[ihl + 4].toInt() and 0xFF) shl 8) or (packet[ihl + 5].toInt() and 0xFF)
        val dnsLen = udpLen - 8
        val dnsOff = ihl + 8
        return packet.copyOfRange(dnsOff, dnsOff + dnsLen)
    }
}

object Checksum {

    fun ipv4Header(buf: ByteArray, off: Int, len: Int): Int {
        var sum = 0L
        var i = 0
        while (i + 1 < len) {
            sum += ((buf[off + i].toInt() and 0xFF) shl 8) or (buf[off + i + 1].toInt() and 0xFF)
            i += 2
        }
        if (i < len) {
            sum += (buf[off + i].toInt() and 0xFF) shl 8
        }
        while ((sum shr 16) != 0L) {
            sum = (sum and 0xFFFF) + (sum shr 16)
        }
        return (sum.inv() and 0xFFFF).toInt()
    }

    fun udp(packet: ByteArray): Int {
        val ihl = (packet[0].toInt() and 0xF) * 4
        val udpLen = ((packet[ihl + 4].toInt() and 0xFF) shl 8) or (packet[ihl + 5].toInt() and 0xFF)
        var sum = 0L

        sum += ((packet[12].toInt() and 0xFF) shl 8) or (packet[13].toInt() and 0xFF)
        sum += ((packet[14].toInt() and 0xFF) shl 8) or (packet[15].toInt() and 0xFF)
        sum += ((packet[16].toInt() and 0xFF) shl 8) or (packet[17].toInt() and 0xFF)
        sum += ((packet[18].toInt() and 0xFF) shl 8) or (packet[19].toInt() and 0xFF)
        sum += 17L
        sum += udpLen.toLong()

        var i = 0
        while (i + 1 < udpLen) {
            if (i != 6) {
                sum += ((packet[ihl + i].toInt() and 0xFF) shl 8) or (packet[ihl + i + 1].toInt() and 0xFF)
            }
            i += 2
        }
        if (i < udpLen) {
            sum += (packet[ihl + i].toInt() and 0xFF) shl 8
        }
        while ((sum shr 16) != 0L) {
            sum = (sum and 0xFFFF) + (sum shr 16)
        }
        val c = (sum.inv() and 0xFFFF).toInt()
        return if (c == 0) 0xFFFF else c
    }

    fun udp6(packet: ByteArray): Int {
        if (packet.size < 48) return 0
        val udpLen = ((packet[4].toInt() and 0xFF) shl 8) or (packet[5].toInt() and 0xFF)
        if (40 + udpLen > packet.size) return 0
        var sum = 0L

        // Pseudo header src (16 bytes)
        var i = 8
        while (i < 24) {
            sum += ((packet[i].toInt() and 0xFF) shl 8) or (packet[i + 1].toInt() and 0xFF)
            i += 2
        }
        // Pseudo header dst (16 bytes)
        i = 24
        while (i < 40) {
            sum += ((packet[i].toInt() and 0xFF) shl 8) or (packet[i + 1].toInt() and 0xFF)
            i += 2
        }
        // UDP length (32 bits, upper 16 = 0) + zero(24) + next header(8)
        sum += udpLen.toLong()
        sum += 17L

        var j = 0
        while (j + 1 < udpLen) {
            if (j != 6) {
                sum += ((packet[40 + j].toInt() and 0xFF) shl 8) or (packet[40 + j + 1].toInt() and 0xFF)
            }
            j += 2
        }
        if (j < udpLen) {
            sum += (packet[40 + j].toInt() and 0xFF) shl 8
        }
        while ((sum shr 16) != 0L) {
            sum = (sum and 0xFFFF) + (sum shr 16)
        }
        val c = (sum.inv() and 0xFFFF).toInt()
        return if (c == 0) 0xFFFF else c
    }

    fun verify(packet: ByteArray): Boolean {
        if (packet.isEmpty()) return false
        val version = (packet[0].toInt() ushr 4) and 0xF
        return when (version) {
            4 -> verify4(packet)
            6 -> verify6(packet)
            else -> false
        }
    }

    private fun verify4(packet: ByteArray): Boolean {
        if (packet.size < 20) return false
        val ihl = (packet[0].toInt() and 0xF) * 4
        if (ihl < 20 || ihl > packet.size) return false
        if (ipv4Header(packet, 0, ihl) != 0) return false
        if (packet.size < ihl + 8) return false
        val stored = ((packet[ihl + 6].toInt() and 0xFF) shl 8) or (packet[ihl + 7].toInt() and 0xFF)
        val computed = udp(packet)
        return stored == computed
    }

    fun verify6(packet: ByteArray): Boolean {
        if (packet.size < 48) return false
        val version = (packet[0].toInt() ushr 4) and 0xF
        if (version != 6) return false
        val nextHeader = packet[6].toInt() and 0xFF
        if (nextHeader != 17) return false
        val payloadLen = ((packet[4].toInt() and 0xFF) shl 8) or (packet[5].toInt() and 0xFF)
        if (40 + payloadLen > packet.size) return false
        if (payloadLen < 8) return false
        val stored = ((packet[46].toInt() and 0xFF) shl 8) or (packet[47].toInt() and 0xFF)
        if (stored == 0) return false
        val computed = udp6(packet)
        return stored == computed
    }
}
