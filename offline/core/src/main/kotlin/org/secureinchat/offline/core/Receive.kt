// SPDX-License-Identifier: GPL-3.0-or-later
// Drafted by DeepSeek (T12), reviewed by Claude.
package org.secureinchat.offline.core

sealed class ReceiveResult {
    data class Accepted(val plaintext: ByteArray) : ReceiveResult()
    object Duplicate : ReceiveResult()
    object Replay : ReceiveResult()
    object Expired : ReceiveResult()
    object BadAuth : ReceiveResult()
    object Malformed : ReceiveResult()
}

class SeenCache(private val capacity: Int = 4096) {
    private val order = LinkedHashMap<String, Unit>(capacity, 0.75f, true)

    fun contains(id: ByteArray): Boolean = order.containsKey(hex(id))

    fun add(id: ByteArray) {
        val k = hex(id)
        order[k] = Unit
        while (order.size > capacity) {
            val it = order.keys.iterator()
            if (it.hasNext()) { it.next(); it.remove() } else break
        }
    }

    fun encode(): String = order.keys.joinToString("\n")

    companion object {
        fun decode(text: String, capacity: Int = 4096): SeenCache {
            val c = SeenCache(capacity)
            for (line in text.split('\n')) {
                // Review fix: skip damaged lines instead of throwing on non-hex input.
                if (line.length == 32 && line.all { it in '0'..'9' || it in 'a'..'f' }) c.add(hexToBytes(line))
            }
            return c
        }
    }
}

class ReplayGuard {
    private val highest = HashMap<String, Long>()

    fun accept(senderId: ByteArray, counter: Long): Boolean {
        val k = hex(senderId)
        val prev = highest[k]
        if (prev != null && counter <= prev) return false
        highest[k] = counter
        return true
    }

    fun encode(): String = highest.entries.joinToString("\n") { "${it.key}\t${it.value}" }

    companion object {
        fun decode(text: String): ReplayGuard {
            val g = ReplayGuard()
            for (line in text.split('\n')) {
                val parts = line.split('\t')
                if (parts.size == 2 && parts[0].length == 64 && parts[0].all { it in '0'..'9' || it in 'a'..'f' }) {
                    val c = parts[1].toLongOrNull() ?: continue
                    g.highest[parts[0]] = c
                }
            }
            return g
        }
    }
}

private fun hex(b: ByteArray): String = b.joinToString("") { "%02x".format(it) }
private fun hexToBytes(s: String): ByteArray =
    ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

/** Associated data a sender must pass to Aead.seal (review fix: was private, so senders could not build it). */
fun associatedData(env: Envelope): ByteArray = adOf(env)

private fun adOf(env: Envelope): ByteArray {
    val out = ArrayList<Byte>()
    out.add(env.version.toByte())
    out.addAll(env.senderId.toList())
    out.addAll(env.messageId.toList())
    for (i in 7 downTo 0) out.add(((env.counter ushr (8 * i)) and 0xFF).toByte())
    for (i in 7 downTo 0) out.add(((env.expiresAtMillis ushr (8 * i)) and 0xFF).toByte())
    out.addAll(env.nonce.toList())
    return out.toByteArray()
}

fun receive(
    env: Envelope?,
    nowMillis: Long,
    guard: ReplayGuard,
    seen: SeenCache,
    aead: Aead,
    keyFor: (ByteArray) -> ByteArray
): ReceiveResult {
    if (env == null) return ReceiveResult.Malformed
    if (env.version != 1) return ReceiveResult.Malformed
    if (env.senderId.size != 32 || env.messageId.size != 16) return ReceiveResult.Malformed
    if (env.nonce.isEmpty() || env.ciphertext.isEmpty()) return ReceiveResult.Malformed

    if (nowMillis >= env.expiresAtMillis) return ReceiveResult.Expired
    if (seen.contains(env.messageId)) return ReceiveResult.Duplicate

    // Review fix: an unknown sender (keyFor throws) is an authentication failure, never a crash.
    val key = try { keyFor(env.senderId) } catch (t: Throwable) { return ReceiveResult.BadAuth }
    val plain = aead.open(key, env.nonce, env.ciphertext, adOf(env)) ?: return ReceiveResult.BadAuth

    if (!guard.accept(env.senderId, env.counter)) return ReceiveResult.Replay

    seen.add(env.messageId)
    return ReceiveResult.Accepted(plain)
}

fun relay(env: Envelope?, nowMillis: Long): Envelope? {
    if (env == null) return null
    if (nowMillis >= env.expiresAtMillis) return null
    if (env.hopLimit <= 1) return null
    return env.copy(hopLimit = env.hopLimit - 1)
}
