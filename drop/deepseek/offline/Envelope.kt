// SPDX-License-Identifier: GPL-3.0-or-later
// Drafted by DeepSeek (T12), reviewed by Claude.
package org.secureinchat.offline.core

/**
 * Crypto is deliberately behind an interface. The core never implements AEAD.
 */
interface Aead {
    fun seal(key: ByteArray, nonce: ByteArray, plaintext: ByteArray, ad: ByteArray): ByteArray
    fun open(key: ByteArray, nonce: ByteArray, ciphertext: ByteArray, ad: ByteArray): ByteArray?
}

/**
 * Wire envelope for offline mesh messages.
 *
 * [hopLimit] is intentionally NOT in the associated data: relays decrement it,
 * and if it were authenticated the first relay would invalidate the ciphertext.
 * The risk is that a malicious relay can set hopLimit to 0 or 255; the receiver
 * must therefore treat hopLimit as untrusted metadata and never use it for
 * security decisions beyond loop prevention.
 */
data class Envelope(
    val version: Int,
    val senderId: ByteArray,      // 32 bytes
    val messageId: ByteArray,     // 16 bytes
    val counter: Long,
    val expiresAtMillis: Long,
    val hopLimit: Int,
    val nonce: ByteArray,
    val ciphertext: ByteArray
) {
    fun encode(): ByteArray {
        val out = ArrayList<Byte>()
        out.add(version.toByte())
        require(senderId.size == 32) { "senderId must be 32 bytes" }
        require(messageId.size == 16) { "messageId must be 16 bytes" }
        out.addAll(senderId.toList())
        out.addAll(messageId.toList())
        writeLong(out, counter)
        writeLong(out, expiresAtMillis)
        out.add(hopLimit.toByte())
        out.add(nonce.size.toByte())
        out.addAll(nonce.toList())
        writeInt(out, ciphertext.size)
        out.addAll(ciphertext.toList())
        return out.toByteArray()
    }

    companion object {
        fun decode(bytes: ByteArray): Envelope? {
            var p = 0
            fun need(n: Int): Boolean = p + n <= bytes.size
            if (!need(1)) return null
            val version = bytes[p++].toInt() and 0xFF
            if (version != 1) return null
            if (!need(32)) return null
            val sender = bytes.copyOfRange(p, p + 32); p += 32
            if (!need(16)) return null
            val mid = bytes.copyOfRange(p, p + 16); p += 16
            if (!need(8)) return null
            val counter = readLong(bytes, p); p += 8
            if (!need(8)) return null
            val expires = readLong(bytes, p); p += 8
            if (!need(1)) return null
            val hop = bytes[p++].toInt() and 0xFF
            if (!need(1)) return null
            val nonceLen = bytes[p++].toInt() and 0xFF
            if (!need(nonceLen)) return null
            val nonce = bytes.copyOfRange(p, p + nonceLen); p += nonceLen
            if (!need(4)) return null
            val ctLen = readInt(bytes, p); p += 4
            if (ctLen < 0 || !need(ctLen)) return null
            val ct = bytes.copyOfRange(p, p + ctLen)
            return Envelope(version, sender, mid, counter, expires, hop, nonce, ct)
        }
    }
}

private fun writeLong(out: ArrayList<Byte>, v: Long) {
    for (i in 7 downTo 0) out.add(((v ushr (8 * i)) and 0xFF).toByte())
}
private fun readLong(b: ByteArray, p: Int): Long {
    var v = 0L
    for (i in 0 until 8) v = (v shl 8) or (b[p + i].toLong() and 0xFF)
    return v
}
private fun writeInt(out: ArrayList<Byte>, v: Int) {
    for (i in 3 downTo 0) out.add(((v ushr (8 * i)) and 0xFF).toByte())
}
private fun readInt(b: ByteArray, p: Int): Int {
    var v = 0
    for (i in 0 until 4) v = (v shl 8) or (b[p + i].toInt() and 0xFF)
    return v
}
