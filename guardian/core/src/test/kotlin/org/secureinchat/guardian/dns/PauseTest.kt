// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.io.ByteArrayOutputStream

private var pn = 0
private fun pt(name: String, block: () -> Unit) {
    try { block(); pn++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun peq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

private fun pIpUdp(dns: ByteArray, srcPort: Int = 40000): ByteArray {
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

private fun pQuery(name: String, qtype: Int = 1): ByteArray {
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
    return pIpUdp(dns.toByteArray())
}

private fun pBlocklist(): Blocklist = Blocklist.parse("blocked.example.com")

fun main() {

    pt("paused forwards otherwise-blocked") {
        var now = 1_000_000L
        val h = QueryHandler(pBlocklist(), BlockMode.NULL_IP, { -1 }, { now })
        val pkt = pQuery("blocked.example.com")

        val a1 = h.handle(pkt, pkt.size)
        check(a1 is Action.Respond) { "not paused: expected Respond, got $a1" }
        peq(h.isPaused(), false)
        peq(h.recent()[0].blocked, true)
        peq(h.recent()[0].paused, false)

        h.pause(300_000L)
        peq(h.isPaused(), true)

        val a2 = h.handle(pkt, pkt.size)
        check(a2 is Action.Forward) { "paused: expected Forward, got $a2" }
        val e = h.recent()[0]
        peq(e.blocked, false)
        peq(e.paused, true)
        val s = h.snapshot()
        peq(s.blocked, 1L)
        peq(s.forwarded, 1L)
    }

    pt("expires after 5 minutes") {
        var now = 2_000_000L
        val h = QueryHandler(pBlocklist(), BlockMode.NULL_IP, { -1 }, { now })
        h.pause(300_000L)
        peq(h.isPaused(), true)
        now += 300_000L - 1
        peq(h.isPaused(), true)
        now += 1
        peq(h.isPaused(), false)
        val pkt = pQuery("blocked.example.com")
        val a = h.handle(pkt, pkt.size)
        check(a is Action.Respond) { "after expiry: expected Respond, got $a" }
    }

    pt("resume() takes effect immediately") {
        var now = 3_000_000L
        val h = QueryHandler(pBlocklist(), BlockMode.NULL_IP, { -1 }, { now })
        h.pause(300_000L)
        peq(h.isPaused(), true)
        h.resume()
        peq(h.isPaused(), false)
        peq(h.pausedUntilMs, 0L)
        val pkt = pQuery("blocked.example.com")
        val a = h.handle(pkt, pkt.size)
        check(a is Action.Respond) { "after resume: expected Respond, got $a" }
    }

    pt("pause(0) behaves like resume") {
        var now = 3_500_000L
        val h = QueryHandler(pBlocklist(), BlockMode.NULL_IP, { -1 }, { now })
        h.pause(300_000L)
        peq(h.isPaused(), true)
        h.pause(0L)
        peq(h.isPaused(), false)
        h.pause(300_000L)
        peq(h.isPaused(), true)
        h.pause(-1L)
        peq(h.isPaused(), false)
    }

    pt("malformed still malformed when paused") {
        var now = 4_000_000L
        val h = QueryHandler(pBlocklist(), BlockMode.NULL_IP, { -1 }, { now })
        h.pause(300_000L)
        val garbage = ByteArray(30)
        val a = h.handle(garbage, garbage.size)
        check(a is Action.Drop) { "expected Drop, got $a" }
        val s = h.snapshot()
        peq(s.queries, 1L)
        peq(s.malformed, 1L)
        peq(s.forwarded, 0L)
        peq(s.blocked, 0L)
        peq(h.recent().size, 0)
    }

    pt("paused does not raise tally blocked, non-hit still counted") {
        var now = 5_000_000L
        val h = QueryHandler(pBlocklist(), BlockMode.NULL_IP, { -1 }, { now })
        h.pause(300_000L)
        val blockedPkt = pQuery("blocked.example.com")
        val safePkt = pQuery("safe.example.org")
        check(h.handle(blockedPkt, blockedPkt.size) is Action.Forward) { "blocked should forward" }
        check(h.handle(safePkt, safePkt.size) is Action.Forward) { "safe should forward" }
        val snap = h.tally.snapshot(10)
        // Only the non-hit query is tallied; the would-be-blocked one is left out.
        peq(snap.size, 1)
        peq(snap[0].queries, 1L)
        peq(snap[0].blocked, 0L)
        peq(h.snapshot().forwarded, 2L)
        peq(h.snapshot().blocked, 0L)
    }

    pt("concurrent pause/resume/handle no throw") {
        var now = 6_000_000L
        val h = QueryHandler(pBlocklist(), BlockMode.NULL_IP, { -1 }, { now })
        val pkt = pQuery("blocked.example.com")
        val safe = pQuery("safe.example.org")
        val toggler = Thread {
            var i = 0
            while (i < 5000) {
                h.pause(1000L)
                h.resume()
                i++
            }
        }
        val workers = ArrayList<Thread>(4)
        for (k in 0 until 4) {
            workers.add(Thread {
                var i = 0
                while (i < 5000) {
                    h.handle(pkt, pkt.size)
                    h.handle(safe, safe.size)
                    i++
                }
            })
        }
        toggler.start()
        workers.forEach { it.start() }
        toggler.join()
        workers.forEach { it.join() }
        // Total accounting must be exact: each of 4 workers did 2*5000 handle() calls.
        peq(h.snapshot().queries, 40_000L)
        // Final state: last operation on toggler was resume(), so blocked counts for the hit packets.
        h.resume()
        val a = h.handle(pkt, pkt.size)
        check(a is Action.Respond) { "after join+resume: expected Respond, got $a" }
    }

    println("PauseTest: $pn passed")
}
