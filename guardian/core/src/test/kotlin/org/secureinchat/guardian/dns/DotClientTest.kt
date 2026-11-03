// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

private var dn = 0
private fun dtt(name: String, block: () -> Unit) {
    try { block(); dn++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun deq2(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

private fun query(id: Int): ByteArray = ByteArray(17).also {
    it[0] = (id ushr 8).toByte(); it[1] = id.toByte(); it[2] = 1; it[5] = 1
}

/**
 * A plain-TCP stand-in for a DoT resolver (the TLS wrap is injected as identity in these tests; TLS
 * itself is the platform's job). [behaviour] gets each query and the stream to answer on.
 */
private class FakeResolver(val behaviour: (ByteArray, DataOutputStream, Int) -> Boolean) {
    val server = ServerSocket(0, 50, InetAddress.getLoopbackAddress())
    val accepted = AtomicInteger()
    val seen = AtomicInteger()
    init {
        thread(isDaemon = true) {
            while (!server.isClosed) {
                val s = try { server.accept() } catch (_: Exception) { break }
                accepted.incrementAndGet()
                thread(isDaemon = true) {
                    try {
                        val inp = DataInputStream(s.getInputStream()); val out = DataOutputStream(s.getOutputStream())
                        while (true) {
                            val len = inp.readUnsignedShort(); val q = ByteArray(len); inp.readFully(q)
                            if (!behaviour(q, out, seen.incrementAndGet())) { s.close(); break }
                            out.flush()
                        }
                    } catch (_: Exception) { try { s.close() } catch (_: Exception) {} }
                }
            }
        }
    }
    val addr get() = InetSocketAddress(InetAddress.getLoopbackAddress(), server.localPort)
}

private fun answerFor(q: ByteArray, id: Int = ((q[0].toInt() and 0xFF) shl 8) or (q[1].toInt() and 0xFF)): ByteArray =
    ByteArray(20).also { it[0] = (id ushr 8).toByte(); it[1] = id.toByte(); it[2] = 0x81.toByte(); it[3] = 0x80.toByte() }

private fun DataOutputStream.send(a: ByteArray) { writeShort(a.size); write(a) }

private fun client(vararg addrs: InetSocketAddress, readMs: Int = 1500) =
    DotClient("dns.example", addrs.toList(), { Socket() }, { s, _ -> s }, connectTimeoutMs = 1000, readTimeoutMs = readMs)

fun main() {
    dtt("length-framed round trip, connection reused") {
        val r = FakeResolver { q, out, _ -> out.send(answerFor(q)); true }
        val c = client(r.addr)
        for (i in 1..5) {
            val a = c.query(query(0x100 + i))!!
            deq2(((a[0].toInt() and 0xFF) shl 8) or (a[1].toInt() and 0xFF), 0x100 + i)
        }
        deq2(c.connectionsOpened, 1); deq2(r.accepted.get(), 1)
        c.close()
    }

    dtt("stale answer with another id is skipped") {
        val r = FakeResolver { q, out, _ -> out.send(answerFor(q, 0x7777)); out.send(answerFor(q)); true }
        val c = client(r.addr)
        val a = c.query(query(0x2222))!!
        deq2(((a[0].toInt() and 0xFF) shl 8) or (a[1].toInt() and 0xFF), 0x2222)
        c.close()
    }

    dtt("server closes the idle connection: reconnect once and succeed") {
        val r = FakeResolver { q, out, n -> out.send(answerFor(q)); n != 1 } // closes after the first answer
        val c = client(r.addr)
        check(c.query(query(1)) != null)
        Thread.sleep(100)
        check(c.query(query(2)) != null) { "no answer after reconnect" }
        deq2(c.connectionsOpened, 2)
        c.close()
    }

    dtt("first address dead, second answers") {
        val dead = ServerSocket(0, 1, InetAddress.getLoopbackAddress()).let { val p = it.localPort; it.close(); InetSocketAddress(InetAddress.getLoopbackAddress(), p) }
        val r = FakeResolver { q, out, _ -> out.send(answerFor(q)); true }
        val c = client(dead, r.addr)
        check(c.query(query(3)) != null)
        c.close()
    }

    dtt("fail closed: unreachable resolver returns null, never throws") {
        val dead = ServerSocket(0, 1, InetAddress.getLoopbackAddress()).let { val p = it.localPort; it.close(); InetSocketAddress(InetAddress.getLoopbackAddress(), p) }
        deq2(client(dead).query(query(4)), null)
    }

    dtt("silent resolver times out and returns null") {
        val r = FakeResolver { _, _, _ -> true } // reads, never answers
        val t0 = System.currentTimeMillis()
        deq2(client(r.addr, readMs = 300).query(query(5)), null)
        check(System.currentTimeMillis() - t0 < 5000) { "timeout not honoured" }
    }

    dtt("short or garbage answers are rejected") {
        val r = FakeResolver { _, out, _ -> out.writeShort(3); out.write(byteArrayOf(1, 2, 3)); true }
        deq2(client(r.addr, readMs = 300).query(query(6)), null)
        deq2(client(r.addr).query(ByteArray(5)), null) // query shorter than a DNS header is refused locally
    }

    dtt("concurrent callers each get their own answer") {
        val r = FakeResolver { q, out, _ -> out.send(answerFor(q)); true }
        val c = client(r.addr)
        val bad = AtomicInteger()
        val ts = (0 until 8).map { t -> thread { repeat(50) { i ->
            val id = t * 1000 + i
            val a = c.query(query(id))
            if (a == null || (((a[0].toInt() and 0xFF) shl 8) or (a[1].toInt() and 0xFF)) != (id and 0xFFFF)) bad.incrementAndGet()
        } } }
        ts.forEach { it.join() }
        deq2(bad.get(), 0)
        c.close()
    }

    dtt("blackholed provider: one lookup gives up within the connect budget, no second sweep") {
        // Every address drops packets: connect waits out its timeout. 4 addresses x 1 s with a 2.5 s
        // budget must stop after the budget, not try all four twice (that was ~32 s with the defaults).
        val attempts = AtomicInteger()
        class BlackholeSocket : Socket() {
            override fun connect(endpoint: java.net.SocketAddress?, timeout: Int) {
                attempts.incrementAndGet()
                Thread.sleep(timeout.toLong())
                throw java.net.SocketTimeoutException("blackholed")
            }
        }
        val addrs = (1..4).map { InetSocketAddress(InetAddress.getLoopbackAddress(), 1000 + it) }
        val c = DotClient("dns.example", addrs, { BlackholeSocket() }, { s, _ -> s },
            connectTimeoutMs = 1000, readTimeoutMs = 500, connectBudgetMs = 2500)
        val t0 = System.currentTimeMillis()
        deq2(c.query(query(7)), null)
        val took = System.currentTimeMillis() - t0
        check(took < 3500) { "took $took ms" }
        check(attempts.get() <= 3) { "${attempts.get()} connect attempts" }
    }

    dtt("a reused connection that the resolver closed is retried once on a fresh one") {
        // First connection answers once and then closes; the next query must reconnect and succeed.
        val r = FakeResolver { q, out, n -> out.send(answerFor(q)); n != 1 }
        val c = client(r.addr)
        check(c.query(query(8)) != null)
        Thread.sleep(100)
        check(c.query(query(9)) != null) { "no retry on a fresh connection" }
        deq2(c.connectionsOpened, 2)
        c.close()
    }

    println("DotClientTest: $dn passed")
}
