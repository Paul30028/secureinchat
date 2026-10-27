// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

class Blocklist private constructor(
    private val blocked: HashSet<String>,
    private val allowed: HashSet<String>
) {
    val blockedCount: Int get() = blocked.size
    val allowedCount: Int get() = allowed.size

    fun isBlocked(name: String): Boolean {
        try {
            val n = normalizeHostname(name) ?: return false
            var cur = n
            while (true) {
                if (allowed.contains(cur)) return false
                val dot = cur.indexOf('.')
                if (dot < 0) break
                cur = cur.substring(dot + 1)
            }
            cur = n
            while (true) {
                if (blocked.contains(cur)) return true
                val dot = cur.indexOf('.')
                if (dot < 0) break
                cur = cur.substring(dot + 1)
            }
            return false
        } catch (t: Throwable) {
            return false
        }
    }

    companion object {
        private val WS = Regex("\\s+")

        private val IGNORED = setOf(
            "localhost", "localhost.localdomain", "broadcasthost", "local",
            "0.0.0.0", "127.0.0.1", "ip6-localhost", "ip6-loopback"
        )

        fun parse(text: String): Blocklist {
            val blocked = HashSet<String>(1024)
            val allowed = HashSet<String>(64)

            for (rawLine in text.lineSequence()) {
                var line = rawLine.trim()
                if (line.isEmpty()) continue
                if (line.startsWith("#") || line.startsWith("!")) continue

                val hash = line.indexOf('#')
                if (hash >= 0) line = line.substring(0, hash).trim()
                if (line.isEmpty()) continue

                var ascii = true
                for (ch in line) {
                    if (ch.code >= 128) { ascii = false; break }
                }
                if (!ascii) continue

                if (line.startsWith("@@")) {
                    val domain = parseAdblock(line.substring(2))
                    if (domain != null) allowed.add(domain)
                    continue
                }

                if (line.startsWith("||")) {
                    val domain = parseAdblock(line)
                    if (domain != null) blocked.add(domain)
                    continue
                }

                val tokens = line.split(WS)
                if (tokens.size >= 2 && looksLikeIp(tokens[0])) {
                    for (k in 1 until tokens.size) {
                        val d = normalizeHostname(tokens[k]) ?: continue
                        if (d in IGNORED) continue
                        blocked.add(d)
                    }
                    continue
                }

                val d = normalizeHostname(line) ?: continue
                if (d in IGNORED) continue
                blocked.add(d)
            }

            return Blocklist(blocked, allowed)
        }

        private fun parseAdblock(s: String): String? {
            if (!s.startsWith("||")) return null
            var body = s.substring(2)
            if (!body.endsWith("^")) return null
            body = body.substring(0, body.length - 1)
            if (body.contains('*') || body.contains('/') || body.contains('$') || body.contains('|')) return null
            return normalizeHostname(body)
        }

        private fun looksLikeIp(s: String): Boolean {
            val parts = s.split('.')
            if (parts.size != 4) return false
            for (p in parts) {
                if (p.isEmpty()) return false
                for (ch in p) if (!ch.isDigit()) return false
                val v = p.toIntOrNull() ?: return false
                if (v < 0 || v > 255) return false
            }
            return true
        }

        private fun normalizeHostname(s: String): String? {
            val d = s.trim().lowercase().trimEnd('.')
            if (d.isEmpty()) return null
            if (d.length > 253) return null
            if (!d.contains('.')) return null
            if (d.contains("..")) return null
            for (label in d.split('.')) {
                if (label.isEmpty()) return null
                if (label.length > 63) return null
                if (label.startsWith('-') || label.endsWith('-')) return null
                for (ch in label) {
                    val ok = (ch in 'a'..'z') || (ch in '0'..'9') || ch == '-' || ch == '_'
                    if (!ok) return null
                }
            }
            return d
        }
    }
}
