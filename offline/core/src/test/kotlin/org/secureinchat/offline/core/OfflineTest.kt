// SPDX-License-Identifier: GPL-3.0-or-later
// Drafted by DeepSeek (T12), reviewed by Claude.
package org.secureinchat.offline.core

private var n = 0
private fun t(name: String, block: () -> Unit) { try { block(); n++ } catch (e: Throwable) { println("FAIL $name: ${e.message}"); throw e } }
private fun eq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

// Test-only AEAD (review fix by Claude): the 4-byte tag depends on key, nonce, AD and plaintext,
// so wrong keys and tampered fields really fail. NOT real cryptography.
private class FakeAead : Aead {
    private fun tag(key: ByteArray, nonce: ByteArray, pt: ByteArray, ad: ByteArray): ByteArray {
        var h = 0x811C9DC5.toInt()
        for (arr in listOf(key, nonce, ad, pt)) { for (x in arr) { h = (h xor (x.toInt() and 0xFF)) * 0x01000193 }; h = h * 0x01000193 + arr.size }
        return byteArrayOf((h ushr 24).toByte(), (h ushr 16).toByte(), (h ushr 8).toByte(), h.toByte())
    }
    private fun ks(key: ByteArray, nonce: ByteArray, i: Int): Int =
        (if (key.isEmpty()) 0 else key[i % key.size].toInt()) xor (if (nonce.isEmpty()) 0 else nonce[i % nonce.size].toInt())
    override fun seal(key: ByteArray, nonce: ByteArray, plaintext: ByteArray, ad: ByteArray): ByteArray {
        val ct = ByteArray(plaintext.size) { (plaintext[it].toInt() xor ks(key, nonce, it)).toByte() }
        return ct + tag(key, nonce, plaintext, ad)
    }
    override fun open(key: ByteArray, nonce: ByteArray, ciphertext: ByteArray, ad: ByteArray): ByteArray? {
        if (ciphertext.size < 4) return null
        val body = ciphertext.copyOfRange(0, ciphertext.size - 4)
        val pt = ByteArray(body.size) { (body[it].toInt() xor ks(key, nonce, it)).toByte() }
        return if (tag(key, nonce, pt, ad).contentEquals(ciphertext.copyOfRange(ciphertext.size - 4, ciphertext.size))) pt else null
    }
}

private fun sender(id: Int): ByteArray = ByteArray(32) { id.toByte() }
private fun mid(id: Int): ByteArray = ByteArray(16) { id.toByte() }
private fun key(b: ByteArray): ByteArray = b

private fun env(
    counter: Long = 1,
    expires: Long = 1000,
    hop: Int = 5,
    sid: ByteArray = sender(1),
    mid: ByteArray = mid(1),
    pt: String = "hello"
): Envelope {
    val a = FakeAead()
    val nonce = ByteArray(12) { 1 }
    // Review fix: seal with the real associated data so the tests exercise AD binding.
    val draft = Envelope(1, sid, mid, counter, expires, hop, nonce, ByteArray(0))
    val ct = a.seal(key(sid), nonce, pt.toByteArray(), associatedData(draft))
    return draft.copy(ciphertext = ct)
}

fun main() {

    // ---- Envelope encode/decode -----------------------------------------
    t("envelope round trip") {
        val e = env()
        val d = Envelope.decode(e.encode())!!
        eq(e.counter, d.counter)
        eq(e.expiresAtMillis, d.expiresAtMillis)
        eq(e.hopLimit, d.hopLimit)
        eq(e.senderId.toList(), d.senderId.toList())
        eq(e.messageId.toList(), d.messageId.toList())
        eq(e.nonce.toList(), d.nonce.toList())
        eq(e.ciphertext.toList(), d.ciphertext.toList())
    }
    t("decode empty returns null") { eq(null, Envelope.decode(ByteArray(0))) }
    t("decode truncated sender returns null") { eq(null, Envelope.decode(ByteArray(10))) }
    t("decode bad version returns null") {
        val e = env()
        val b = e.encode(); b[0] = 2
        eq(null, Envelope.decode(b))
    }
    t("decode truncated ciphertext length returns null") {
        val e = env()
        val b = e.encode()
        eq(null, Envelope.decode(b.copyOfRange(0, b.size - 2)))
    }
    t("decode oversized nonce length returns null") {
        val e = env()
        val b = e.encode()
        b[1 + 32 + 16 + 8 + 8 + 1] = 255.toByte() // nonce length
        eq(null, Envelope.decode(b))
    }

    // ---- SeenCache ------------------------------------------------------
    t("seen cache detects duplicate") {
        val c = SeenCache(10)
        val id = mid(1)
        c.add(id)
        eq(true, c.contains(id))
    }
    t("seen cache does not falsely contain") { eq(false, SeenCache(10).contains(mid(9))) }
    t("seen cache evicts oldest") {
        val c = SeenCache(2)
        c.add(mid(1)); c.add(mid(2)); c.add(mid(3))
        eq(false, c.contains(mid(1)))
        eq(true, c.contains(mid(3)))
    }
    t("seen cache encode/decode round trip") {
        val c = SeenCache(10); c.add(mid(1)); c.add(mid(2))
        val d = SeenCache.decode(c.encode())
        eq(true, d.contains(mid(1)))
        eq(true, d.contains(mid(2)))
    }

    // ---- ReplayGuard ----------------------------------------------------
    t("replay guard accepts increasing counters") {
        val g = ReplayGuard()
        eq(true, g.accept(sender(1), 1))
        eq(true, g.accept(sender(1), 2))
        eq(true, g.accept(sender(1), 3))
    }
    t("replay guard rejects equal or lower") {
        val g = ReplayGuard()
        g.accept(sender(1), 5)
        eq(false, g.accept(sender(1), 5))
        eq(false, g.accept(sender(1), 4))
    }
    t("replay guard is per sender") {
        val g = ReplayGuard()
        g.accept(sender(1), 5)
        eq(true, g.accept(sender(2), 1))
    }
    t("replay guard encode/decode round trip") {
        val g = ReplayGuard(); g.accept(sender(1), 7)
        val d = ReplayGuard.decode(g.encode())
        eq(false, d.accept(sender(1), 7))
        eq(true, d.accept(sender(1), 8))
    }

    // ---- receive order --------------------------------------------------
    t("receive malformed first") {
        val r = receive(null, 0, ReplayGuard(), SeenCache(), FakeAead()) { key(it) }
        eq(ReceiveResult.Malformed, r)
    }
    t("receive expired before duplicate") {
        val e = env(expires = 10)
        val seen = SeenCache(); seen.add(e.messageId)
        val r = receive(e, 20, ReplayGuard(), seen, FakeAead()) { key(it) }
        eq(ReceiveResult.Expired, r)
    }
    t("receive duplicate before auth") {
        val e = env()
        val seen = SeenCache(); seen.add(e.messageId)
        val r = receive(e, 0, ReplayGuard(), seen, FakeAead()) { key(it) }
        eq(ReceiveResult.Duplicate, r)
    }
    t("receive bad auth does not update state") {
        val e = env()
        val guard = ReplayGuard()
        val seen = SeenCache()
        val bad = FakeAead()
        val r = receive(e, 0, guard, seen, object : Aead {
            override fun seal(key: ByteArray, nonce: ByteArray, plaintext: ByteArray, ad: ByteArray): ByteArray = byteArrayOf()
            override fun open(key: ByteArray, nonce: ByteArray, ciphertext: ByteArray, ad: ByteArray): ByteArray? = null
        }) { key(it) }
        eq(ReceiveResult.BadAuth, r)
        eq(true, seen.contains(e.messageId).not())
        eq(true, guard.accept(e.senderId, e.counter))
    }
    t("receive replay after successful auth") {
        val e = env(counter = 5)
        val guard = ReplayGuard()
        guard.accept(e.senderId, 5)
        val r = receive(e, 0, guard, SeenCache(), FakeAead()) { key(it) }
        eq(ReceiveResult.Replay, r)
    }
    t("receive accepted updates seen and guard") {
        val e = env()
        val guard = ReplayGuard()
        val seen = SeenCache()
        val r = receive(e, 0, guard, seen, FakeAead()) { key(it) }
        eq(true, r is ReceiveResult.Accepted)
        eq(true, seen.contains(e.messageId))
        eq(false, guard.accept(e.senderId, e.counter))
    }
    t("receive accepted plaintext matches") {
        val e = env(pt = "hi")
        val r = receive(e, 0, ReplayGuard(), SeenCache(), FakeAead()) { key(it) }
        eq("hi", String((r as ReceiveResult.Accepted).plaintext))
    }
    t("receive wrong key is BadAuth") {
        val e = env()
        val r = receive(e, 0, ReplayGuard(), SeenCache(), FakeAead()) { ByteArray(32) { 9 } }
        eq(ReceiveResult.BadAuth, r)
    }
    t("receive hopLimit tamper still authenticates") {
        val e = env()
        val tampered = e.copy(hopLimit = 0)
        val r = receive(tampered, 0, ReplayGuard(), SeenCache(), FakeAead()) { key(it) }
        eq(true, r is ReceiveResult.Accepted)
    }

    // ---- relay ----------------------------------------------------------
    t("relay decrements hop") {
        val e = env(hop = 5)
        val r = relay(e, 0)!!
        eq(4, r.hopLimit)
    }
    t("relay drops expired") {
        val e = env(expires = 10)
        eq(null, relay(e, 10))
    }
    t("relay drops hop 1") {
        val e = env(hop = 1)
        eq(null, relay(e, 0))
    }
    t("relay does not mutate original") {
        val e = env(hop = 5)
        relay(e, 0)
        eq(5, e.hopLimit)
    }
    t("relay preserves ciphertext and ids") {
        val e = env(hop = 3)
        val r = relay(e, 0)!!
        eq(e.messageId.toList(), r.messageId.toList())
        eq(e.ciphertext.toList(), r.ciphertext.toList())
    }
    t("relay null for null") { eq(null, relay(null, 0)) }

    // ---- more receive edge cases ---------------------------------------
    t("receive zero-length nonce is malformed") {
        val e = env().copy(nonce = ByteArray(0))
        val r = receive(e, 0, ReplayGuard(), SeenCache(), FakeAead()) { key(it) }
        eq(ReceiveResult.Malformed, r)
    }
    t("receive zero-length ciphertext is malformed") {
        val e = env().copy(ciphertext = ByteArray(0))
        val r = receive(e, 0, ReplayGuard(), SeenCache(), FakeAead()) { key(it) }
        eq(ReceiveResult.Malformed, r)
    }
    t("receive wrong version is malformed") {
        val e = env().copy(version = 2)
        val r = receive(e, 0, ReplayGuard(), SeenCache(), FakeAead()) { key(it) }
        eq(ReceiveResult.Malformed, r)
    }
    t("receive exactly-expired is Expired") {
        val e = env(expires = 100)
        val r = receive(e, 100, ReplayGuard(), SeenCache(), FakeAead()) { key(it) }
        eq(ReceiveResult.Expired, r)
    }
    t("receive one millisecond before expiry is Accepted") {
        val e = env(expires = 100)
        val r = receive(e, 99, ReplayGuard(), SeenCache(), FakeAead()) { key(it) }
        eq(true, r is ReceiveResult.Accepted)
    }

        // Review tests (Claude)
    t("tampered counter fails auth") {
        val e = env(counter = 5)
        val r = receive(e.copy(counter = 6), 0, ReplayGuard(), SeenCache(), FakeAead()) { it }
        check(r == ReceiveResult.BadAuth) { "got $r" }
    }
    t("hopLimit change does not break auth") {
        val e = env(hop = 5)
        val r = receive(e.copy(hopLimit = 2), 0, ReplayGuard(), SeenCache(), FakeAead()) { it }
        check(r is ReceiveResult.Accepted) { "got $r" }
    }
    t("unknown sender is BadAuth, not a crash") {
        val r = receive(env(), 0, ReplayGuard(), SeenCache(), FakeAead()) { throw IllegalStateException("no key") }
        check(r == ReceiveResult.BadAuth) { "got $r" }
    }
    t("damaged persisted state is skipped") {
        SeenCache.decode("zz" + "0".repeat(30) + "\n" + "x"); ReplayGuard.decode("nothex\t5\n\t\n")
    }
    println("ProtocolTest: $n passed")
}
