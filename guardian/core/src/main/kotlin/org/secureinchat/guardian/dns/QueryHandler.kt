// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.util.concurrent.atomic.AtomicLong

class Stats {
    val queries = AtomicLong()
    val blocked = AtomicLong()
    val forwarded = AtomicLong()
    val answered = AtomicLong()
    val failed = AtomicLong()
    val malformed = AtomicLong()

    fun snapshot(): StatsSnapshot = StatsSnapshot(
        queries.get(), blocked.get(), forwarded.get(),
        answered.get(), failed.get(), malformed.get()
    )
}

data class StatsSnapshot(
    val queries: Long,
    val blocked: Long,
    val forwarded: Long,
    val answered: Long,
    val failed: Long,
    val malformed: Long
)

data class LogEntry(
    val timeMs: Long,
    val name: String,
    val qtype: Int,
    val blocked: Boolean,
    val uid: Int = -1,
    val paused: Boolean = false
)

sealed interface Action {
    data class Respond(val packet: ByteArray, val name: String) : Action
    class Forward(val query: DnsQuery, val payload: ByteArray) : Action
    object Drop : Action
}

class QueryHandler(
    @Volatile var blocklist: Blocklist,
    val mode: BlockMode = BlockMode.NULL_IP,
    private val uidOf: (DnsQuery) -> Int = { -1 },
    private val clock: () -> Long = System::currentTimeMillis
) {
    val stats = Stats()
    val tally = AppTally()

    // Pause is set from the service thread and read from every forwarding thread; @Volatile keeps the
    // read/write visible without a lock. The absolute timestamp makes "until" survive clock reads
    // (the field is not a countdown).
    @Volatile var pausedUntilMs: Long = 0

    private val logCapacity = 200
    private val logEntries = arrayOfNulls<LogEntry>(logCapacity)
    private var logWritePos = 0
    private var logCount = 0
    private val logLock = Any()

    fun pause(durationMs: Long) {
        if (durationMs <= 0L) {
            resume()
            return
        }
        pausedUntilMs = clock() + durationMs
    }

    fun resume() {
        pausedUntilMs = 0L
    }

    fun isPaused(): Boolean = clock() < pausedUntilMs

    fun handle(packet: ByteArray, length: Int): Action {
        stats.queries.incrementAndGet()
        val q = DnsPacket.parseQuery(packet, length)
        if (q == null) {
            stats.malformed.incrementAndGet()
            return Action.Drop
        }
        val uid = try { uidOf(q) } catch (_: Throwable) { -1 }
        val hitBlocklist = blocklist.isBlocked(q.qname)
        val paused = isPaused()
        if (paused) {
            // Paused: every well-formed query is forwarded. A query that would have been blocked is
            // left out of the tally entirely (its "blocked" bookkeeping would otherwise keep rising
            // while blocking is suspended); ordinary allowed queries still count toward queries.
            if (!hitBlocklist) tally.record(uid, q.qname, false)
            stats.forwarded.incrementAndGet()
            val payload = DnsWire.extractQueryPayload(packet, q)
            appendLog(q.qname, q.qtype, blocked = false, uid = uid, paused = true)
            return Action.Forward(q, payload)
        }
        tally.record(uid, q.qname, hitBlocklist)
        if (hitBlocklist) {
            stats.blocked.incrementAndGet()
            val resp = DnsPacket.buildBlockedResponse(q, mode)
            appendLog(q.qname, q.qtype, blocked = true, uid = uid, paused = false)
            return Action.Respond(resp, q.qname)
        }
        stats.forwarded.incrementAndGet()
        val payload = DnsWire.extractQueryPayload(packet, q)
        appendLog(q.qname, q.qtype, blocked = false, uid = uid, paused = false)
        return Action.Forward(q, payload)
    }

    fun onUpstreamAnswer(q: DnsQuery, answer: ByteArray, len: Int): ByteArray? {
        val resp = DnsPacket.buildResponseFromUpstream(q, answer, len)
        if (resp != null) {
            stats.answered.incrementAndGet()
        } else {
            stats.failed.incrementAndGet()
        }
        return resp
    }

    fun onUpstreamFailed(q: DnsQuery) {
        stats.failed.incrementAndGet()
    }

    fun snapshot(): StatsSnapshot = stats.snapshot()

    fun recent(): List<LogEntry> {
        synchronized(logLock) {
            val result = ArrayList<LogEntry>(logCount)
            for (i in 1..logCount) {
                val idx = (logWritePos - i + logCapacity) % logCapacity
                result.add(logEntries[idx]!!)
            }
            return result
        }
    }

    fun clearLog() {
        synchronized(logLock) {
            for (i in logEntries.indices) logEntries[i] = null
            logWritePos = 0
            logCount = 0
        }
        tally.clear()
    }

    private fun appendLog(name: String, qtype: Int, blocked: Boolean, uid: Int, paused: Boolean) {
        val entry = LogEntry(clock(), name, qtype, blocked, uid, paused)
        synchronized(logLock) {
            logEntries[logWritePos] = entry
            logWritePos = (logWritePos + 1) % logCapacity
            if (logCount < logCapacity) logCount++
        }
    }
}
