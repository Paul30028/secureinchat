// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

/**
 * Domain block/allow matcher.
 *
 * Four rule sets are kept separately so that precedence is explicit and stable:
 *
 *   user allow  >  user block  >  builtin allow (@@)  >  builtin block
 *
 * The first three are consulted in that order, walking the query name and each of its parent
 * domains one label at a time. The first hit decides the answer. This means:
 *
 *  - a user allow always wins, even over a user block of the same name or a builtin block;
 *  - a user block beats a builtin @@ allow, which is the point of letting users blacklist a
 *    domain whose builtin whitelisting they disagree with;
 *  - builtin @@ still overrides builtin block, as before.
 *
 * The bundled lists are immutable per process; the user lists are applied with plusAllowed /
 * plusBlocked, both of which return a new instance and leave the receiver untouched.
 *
 * matched by suffix: "example.com" covers "a.b.example.com" but not "badexample.com".
 */
class Blocklist private constructor(
    private val builtinBlocked: HashSet<String>,
    private val builtinAllowed: HashSet<String>,
    private val userBlocked: HashSet<String>,
    private val userAllowed: HashSet<String>
) {
    /** Number of domains in the bundled block list (not counting user blocks). */
    val blockedCount: Int get() = builtinBlocked.size

    /** Number of builtin @@ allow rules (not counting user allows). */
    val allowedCount: Int get() = builtinAllowed.size

    fun isBlocked(name: String): Boolean {
        try {
            val n = normalizeHostname(name) ?: return false
            var cur = n
            while (true) {
                if (userAllowed.contains(cur)) return false
                val dot = cur.indexOf('.')
                if (dot < 0) break
                cur = cur.substring(dot + 1)
            }
            cur = n
            while (true) {
                if (userBlocked.contains(cur)) return true
                val dot = cur.indexOf('.')
                if (dot < 0) break
                cur = cur.substring(dot + 1)
            }
            cur = n
            while (true) {
                if (builtinAllowed.contains(cur)) return false
                val dot = cur.indexOf('.')
                if (dot < 0) break
                cur = cur.substring(dot + 1)
            }
            cur = n
            while (true) {
                if (builtinBlocked.contains(cur)) return true
                val dot = cur.indexOf('.')
                if (dot < 0) break
                cur = cur.substring(dot + 1)
            }
            return false
        } catch (t: Throwable) {
            return false
        }
    }

    /**
     * Returns a new Blocklist with [extra] added to the user allow set. Invalid entries are ignored.
     * User allow is the highest-priority set, so a user allow overrides both user blocks and the
     * builtin lists.
     */
    fun plusAllowed(extra: Collection<String>): Blocklist {
        val newAllowed = HashSet<String>(userAllowed)
        for (s in extra) {
            val n = normalizeOrNull(s) ?: continue
            newAllowed.add(n)
        }
        return Blocklist(HashSet(builtinBlocked), HashSet(builtinAllowed), HashSet(userBlocked), newAllowed)
    }

    /**
     * Returns a new Blocklist with [extra] added to the user block set. Invalid entries are ignored.
     * User block is consulted after user allow but before the builtin lists, so it overrides
     * builtin @@ rules while still losing to an explicit user allow of the same name.
     */
    fun plusBlocked(extra: Collection<String>): Blocklist {
        val newBlocked = HashSet<String>(userBlocked)
        for (s in extra) {
            val n = normalizeOrNull(s) ?: continue
            newBlocked.add(n)
        }
        return Blocklist(HashSet(builtinBlocked), HashSet(builtinAllowed), newBlocked, HashSet(userAllowed))
    }

    companion object {
        private val WS = Regex("\\s+")

        private val IGNORED = setOf(
            "localhost", "localhost.localdomain", "broadcasthost", "local",
            "0.0.0.0", "127.0.0.1", "ip6-localhost", "ip6-loopback"
        )

        fun normalizeOrNull(s: String): String? = normalizeHostname(s)

        fun parse(text: String): Blocklist {
            val builtinBlocked = HashSet<String>(1024)
            val builtinAllowed = HashSet<String>(64)

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
                    if (domain != null) builtinAllowed.add(domain)
                    continue
                }

                if (line.startsWith("||")) {
                    val domain = parseAdblock(line)
                    if (domain != null) builtinBlocked.add(domain)
                    continue
                }

                val tokens = line.split(WS)
                if (tokens.size >= 2 && looksLikeIp(tokens[0])) {
                    for (k in 1 until tokens.size) {
                        val d = normalizeHostname(tokens[k]) ?: continue
                        if (d in IGNORED) continue
                        builtinBlocked.add(d)
                    }
                    continue
                }

                val d = normalizeHostname(line) ?: continue
                if (d in IGNORED) continue
                builtinBlocked.add(d)
            }

            return Blocklist(builtinBlocked, builtinAllowed, HashSet(16), HashSet(16))
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
