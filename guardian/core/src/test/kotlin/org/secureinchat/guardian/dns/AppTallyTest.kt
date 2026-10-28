// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.io.ByteArrayOutputStream

private var tn = 0
private fun t(name: String, block: () -> Unit) {
    try { block(); tn++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun teq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

private fun tIpUdp(dns: ByteArray, srcPort: Int = 40000): ByteArray {
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

private fun tBuildQuery(name: String, qtype: Int = 1): ByteArray {
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
    return tIpUdp(dns.toByteArray())
}

fun main() {

    t("a: sort by blocked then queries then uid; topBlocked tie order") {
        val tally = AppTally()
        repeat(3) { tally.record(10, "b.com", true) }
        repeat(3) { tally.record(10, "a.com", true) }
        repeat(1) { tally.record(10, "c.com", true) }
        repeat(5) { tally.record(20, "d.com", true) }
        repeat(7) { tally.record(30, "e.com", false) }
        repeat(3) { tally.record(30, "f.com", true) }
        repeat(2) { tally.record(40, "g.com", true) }

        val snap = tally.snapshot(10)
        teq(snap.size, 4)
        teq(snap[0].uid, 10)
        teq(snap[0].queries, 7L)
        teq(snap[0].blocked, 7L)
        teq(snap[1].uid, 20)
        teq(snap[2].uid, 30)
        teq(snap[2].queries, 10L)
        teq(snap[2].blocked, 3L)
        teq(snap[3].uid, 40)
        teq(snap[0].topBlocked, listOf("a.com" to 3, "b.com" to 3, "c.com" to 1))
    }

    t("a2: tie on blocked and queries -> uid ascending") {
        val tally = AppTally()
        repeat(5) { tally.record(20, "x.com", true) }
        repeat(5) { tally.record(10, "y.com", true) }
        val snap = tally.snapshot(10)
        teq(snap.size, 2)
        teq(snap[0].uid, 10)
        teq(snap[1].uid, 20)
    }

    t("b: maxApps overflow goes to -2") {
        val tally = AppTally(maxApps = 3, maxDomainsPerApp = 100)
        for (uid in 1..10) tally.record(uid, "d$uid.com", true)
        val snap = tally.snapshot(50)
        val uids = snap.map { it.uid }.toSet()
        check(uids.contains(-2)) { "expected -2 row, got $uids" }
        val other = snap.first { it.uid == -2 }
        teq(other.queries, 7L)
        teq(other.blocked, 7L)
        teq(snap.size, 4)
    }

    t("b2: maxDomainsPerApp overflow, blocked count still correct") {
        val tally = AppTally(maxApps = 100, maxDomainsPerApp = 3)
        for (i in 1..5) tally.record(1, "d$i.com", true)
        val snap = tally.snapshot(10)
        val row = snap.first { it.uid == 1 }
        teq(row.blocked, 5L)
        teq(row.queries, 5L)
        teq(row.topBlocked.size, 3)
        teq(row.topBlocked.map { it.first }.toSet(), setOf("d1.com", "d2.com", "d3.com"))
    }

    t("c: 4 threads x 5000 records") {
        val tally = AppTally()
        val threads = ArrayList<Thread>(4)
        for (tid in 0 until 4) {
            val uid = 100 + tid
            threads.add(Thread {
                for (i in 0 until 5000) {
                    tally.record(uid, "d${i % 10}.com", i % 2 == 0)
                }
            })
        }
        threads.forEach { it.start() }
        threads.forEach { it.join() }
        val snap = tally.snapshot(10)
        teq(snap.size, 4)
        teq(snap.sumOf { it.queries }, 20000L)
        teq(snap.sumOf { it.blocked }, 10000L)
    }

    t("d: plusAllowed overrides subdomain, base unchanged") {
        val base = Blocklist.parse("example.com")
        val extended = base.plusAllowed(listOf("safe.example.com"))
        check(extended.isBlocked("example.com")) { "parent still blocked" }
        check(extended.isBlocked("other.example.com")) { "other subdomain still blocked" }
        check(!extended.isBlocked("safe.example.com")) { "explicit allow" }
        check(!extended.isBlocked("sub.safe.example.com")) { "sub of allow" }
        check(base.isBlocked("safe.example.com")) { "base unchanged" }
    }

    t("d2: plusAllowed ignores invalid inputs") {
        val base = Blocklist.parse("example.com")
        val extended = base.plusAllowed(listOf(
            "", "com", "..", "a".repeat(64) + ".com", "\u4e2d\u6587.com", "a..b.com", "-a.com"
        ))
        teq(extended.allowedCount, base.allowedCount)
        teq(extended.blockedCount, base.blockedCount)
    }

    t("e: uidOf returns 10123 -> recent + tally reflect it") {
        val h = QueryHandler(Blocklist.parse("bad.com"), BlockMode.NULL_IP, { _ -> 10123 })
        val pkt = tBuildQuery("bad.com")
        val act = h.handle(pkt, pkt.size)
        check(act is Action.Respond) { "should block, got $act" }
        teq(h.recent()[0].uid, 10123)
        val snap = h.tally.snapshot(10)
        teq(snap.size, 1)
        teq(snap[0].uid, 10123)
        teq(snap[0].blocked, 1L)
        teq(snap[0].queries, 1L)
    }

    t("e2: uidOf throws -> uid -1, block still works") {
        val h = QueryHandler(Blocklist.parse("bad.com"), BlockMode.NULL_IP, { _ ->
            throw RuntimeException("boom")
        })
        val pkt = tBuildQuery("bad.com")
        val act = h.handle(pkt, pkt.size)
        check(act is Action.Respond) { "should still block" }
        teq(h.recent()[0].uid, -1)
        val snap = h.tally.snapshot(10)
        teq(snap.size, 1)
        teq(snap[0].uid, -1)
    }

    println("AppTallyTest: $tn groups ok")
}
