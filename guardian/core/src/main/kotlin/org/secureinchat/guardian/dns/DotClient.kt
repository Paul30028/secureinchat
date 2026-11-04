// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

/**
 * DNS over TLS (RFC 7858) to one resolver (G18, encrypted upstream DNS).
 *
 * Keeps one connection open and reuses it; on any I/O error it reconnects once and retries. Queries are
 * serialised on this object (one in flight per connection): simple, and DNS traffic on a phone is light.
 *
 * Socket creation and the TLS wrap are injected so the core stays testable on a plain JVM:
 *  - [openSocket] returns an unconnected socket (the app calls VpnService.protect() on it, so the TLS
 *    connection itself does not loop back into Guardian's own tunnel);
 *  - [wrapTls] turns a connected socket into a TLS socket for [hostname] with hostname verification on.
 * The app's wrapTls uses the platform trust store; there is no certificate pinning, which would break
 * when the resolver rotates certificates.
 *
 * Fail closed: [query] returns null when the resolver cannot be reached. The caller must not then send the
 * same query in clear text, or the user's lookups leak exactly when they asked for them not to.
 */
class DotClient(
    val hostname: String,
    private val addresses: List<InetSocketAddress>,
    private val openSocket: () -> Socket,
    private val wrapTls: (Socket, String) -> Socket,
    private val connectTimeoutMs: Int = 3000,
    private val readTimeoutMs: Int = 4000,
    /**
     * Total time one query may spend opening a connection across all addresses. Without it, a provider
     * whose packets are dropped costs (addresses × connect timeout) per lookup, and the system resolver
     * gives up long before Guardian answers (seen in the emulator: a lookup hung for over 30 s).
     */
    private val connectBudgetMs: Long = 5000
) {
    private val lock = Any()
    private var socket: Socket? = null
    private var input: DataInputStream? = null
    private var output: DataOutputStream? = null

    /** Number of TLS connections opened so far (for tests and the status line). */
    @Volatile var connectionsOpened = 0
        private set

    /**
     * Why the last failed query failed, per resolver address (exception type and message), or null after
     * a success. Shown on the status line so "cannot reach" says why. It only names the provider's own
     * addresses and the error, never the name that was looked up.
     */
    @Volatile var lastError: String? = null
        private set

    /** Sends a DNS message and returns the matching answer, or null if no resolver address answered. */
    fun query(payload: ByteArray): ByteArray? {
        if (payload.size < 12 || payload.size > 65535) return null
        val id = ((payload[0].toInt() and 0xFF) shl 8) or (payload[1].toInt() and 0xFF)
        synchronized(lock) {
            repeat(2) { attempt ->
                // The retry is for a reused connection the resolver closed in the meantime. When this
                // attempt had to open a fresh connection and still failed, a second sweep only doubles
                // the wait.
                val reused = socket != null
                try {
                    if (socket == null) connect()
                    val out = output!!
                    out.writeShort(payload.size)
                    out.write(payload)
                    out.flush()
                    val inp = input!!
                    // Skip stale answers (a previous query that timed out may still deliver late).
                    repeat(8) {
                        val len = inp.readUnsignedShort()
                        if (len < 12) throw IOException("short DNS answer")
                        val ans = ByteArray(len)
                        inp.readFully(ans)
                        val ansId = ((ans[0].toInt() and 0xFF) shl 8) or (ans[1].toInt() and 0xFF)
                        if (ansId == id) { lastError = null; return ans }
                    }
                    throw IOException("no answer with the query id")
                } catch (e: IOException) {
                    closeLocked()
                    if (e !is NoResolverReachable) lastError = describe(e)
                    if (attempt == 1 || !reused) return null
                } catch (e: RuntimeException) {
                    closeLocked()
                    lastError = describe(e)
                    if (attempt == 1 || !reused) return null
                }
            }
            return null
        }
    }

    fun close() = synchronized(lock) { closeLocked() }

    private class NoResolverReachable(cause: Exception?) : IOException("no resolver address reachable", cause)

    private fun describe(e: Throwable): String {
        val msg = e.message?.takeIf { it.isNotBlank() }
        return if (msg == null) e.javaClass.simpleName else "${e.javaClass.simpleName}: $msg"
    }

    private fun connect() {
        var last: Exception? = null
        val errors = mutableListOf<String>()
        val deadline = System.currentTimeMillis() + connectBudgetMs
        for (addr in addresses) {
            val remaining = deadline - System.currentTimeMillis()
            if (remaining <= 0) break
            var raw: Socket? = null
            try {
                raw = openSocket()
                raw.connect(addr, minOf(connectTimeoutMs.toLong(), remaining).toInt().coerceAtLeast(1))
                raw.soTimeout = readTimeoutMs
                val tls = wrapTls(raw, hostname)
                tls.soTimeout = readTimeoutMs
                socket = tls
                input = DataInputStream(tls.getInputStream().buffered())
                output = DataOutputStream(tls.getOutputStream().buffered())
                connectionsOpened++
                return
            } catch (e: Exception) {
                last = e
                errors += "${addr.address?.hostAddress ?: addr.hostString}: ${describe(e)}"
                try { raw?.close() } catch (_: Exception) {}
            }
        }
        if (errors.isEmpty()) errors += "connect time budget used up"
        lastError = errors.joinToString("; ").take(400)
        throw NoResolverReachable(last)
    }

    private fun closeLocked() {
        try { socket?.close() } catch (_: Exception) {}
        socket = null; input = null; output = null
    }
}
