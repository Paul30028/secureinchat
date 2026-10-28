// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

import org.secureinchat.guardian.dns.Blocklist.Match
import org.secureinchat.guardian.dns.Blocklist.RuleSource

private var mtn = 0
private fun mtt(name: String, block: () -> Unit) {
    try { block(); mtn++ } catch (e: Throwable) {
        println("FAIL $name: ${e.message}")
        throw e
    }
}
private fun mteq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

/**
 * Copy of the pre-G11 isBlocked logic, kept here only as a reference to check that match() decides
 * exactly as before. The four sets are passed in because Blocklist keeps them private.
 */
private fun oldIsBlocked(
    name: String,
    builtinBlocked: Set<String>, builtinAllowed: Set<String>,
    userBlocked: Set<String>, userAllowed: Set<String>
): Boolean {
    val n = Blocklist.normalizeOrNull(name) ?: return false
    fun hit(set: Set<String>): Boolean {
        var cur = n
        while (true) {
            if (set.contains(cur)) return true
            val dot = cur.indexOf('.')
            if (dot < 0) return false
            cur = cur.substring(dot + 1)
        }
    }
    if (hit(userAllowed)) return false
    if (hit(userBlocked)) return true
    if (hit(builtinAllowed)) return false
    if (hit(builtinBlocked)) return true
    return false
}

fun main() {

    mtt("no rule: null, not blocked") {
        val bl = Blocklist.parse("ads.example.com")
        mteq(null, bl.match("example.org"))
        check(!bl.isBlocked("example.org"))
    }

    mtt("invalid names: null") {
        val bl = Blocklist.parse("ads.example.com")
        mteq(null, bl.match(""))
        mteq(null, bl.match("localhost"))
        mteq(null, bl.match("bad..example.com"))
        mteq(null, bl.match("ads.exämple.com"))
    }

    mtt("builtin block, exact and via parent") {
        val bl = Blocklist.parse("doubleclick.net")
        mteq(Match("doubleclick.net", RuleSource.BUILTIN_BLOCK), bl.match("doubleclick.net"))
        mteq(Match("doubleclick.net", RuleSource.BUILTIN_BLOCK), bl.match("stats.g.doubleclick.net"))
        mteq(Match("doubleclick.net", RuleSource.BUILTIN_BLOCK), bl.match("STATS.G.DoubleClick.NET."))
        mteq(null, bl.match("notdoubleclick.net"))
        check(bl.isBlocked("stats.g.doubleclick.net"))
    }

    mtt("the nearest parent rule is reported") {
        val bl = Blocklist.parse("example.com\ng.example.com")
        mteq(Match("g.example.com", RuleSource.BUILTIN_BLOCK), bl.match("a.g.example.com"))
        mteq(Match("example.com", RuleSource.BUILTIN_BLOCK), bl.match("a.h.example.com"))
    }

    mtt("builtin @@ allow") {
        val bl = Blocklist.parse("@@||cdn.example.com^\nexample.com")
        mteq(Match("cdn.example.com", RuleSource.BUILTIN_ALLOW), bl.match("x.cdn.example.com"))
        check(!bl.isBlocked("x.cdn.example.com"))
        mteq(Match("example.com", RuleSource.BUILTIN_BLOCK), bl.match("www.example.com"))
    }

    mtt("user block") {
        val bl = Blocklist.parse("").plusBlocked(listOf("example.org"))
        mteq(Match("example.org", RuleSource.USER_BLOCK), bl.match("www.example.org"))
        check(bl.isBlocked("www.example.org"))
    }

    mtt("user allow") {
        val bl = Blocklist.parse("doubleclick.net").plusAllowed(listOf("g.doubleclick.net"))
        mteq(Match("g.doubleclick.net", RuleSource.USER_ALLOW), bl.match("stats.g.doubleclick.net"))
        check(!bl.isBlocked("stats.g.doubleclick.net"))
        mteq(Match("doubleclick.net", RuleSource.BUILTIN_BLOCK), bl.match("ad.doubleclick.net"))
    }

    mtt("precedence: user allow > user block > builtin allow > builtin block") {
        // Every set holds a rule that covers a.b.c.example.com; the most specific one is in the
        // lowest-priority set so that precedence, not specificity, must decide.
        val base = Blocklist.parse("@@||c.example.com^\na.b.c.example.com")
        val all = base.plusBlocked(listOf("b.c.example.com")).plusAllowed(listOf("example.com"))
        mteq(Match("example.com", RuleSource.USER_ALLOW), all.match("a.b.c.example.com"))
        val noUA = base.plusBlocked(listOf("b.c.example.com"))
        mteq(Match("b.c.example.com", RuleSource.USER_BLOCK), noUA.match("a.b.c.example.com"))
        mteq(Match("c.example.com", RuleSource.BUILTIN_ALLOW), base.match("a.b.c.example.com"))
        val onlyBlock = Blocklist.parse("a.b.c.example.com")
        mteq(Match("a.b.c.example.com", RuleSource.BUILTIN_BLOCK), onlyBlock.match("a.b.c.example.com"))
    }

    mtt("blocks flag per source") {
        check(!Match("x.com", RuleSource.USER_ALLOW).blocks)
        check(Match("x.com", RuleSource.USER_BLOCK).blocks)
        check(!Match("x.com", RuleSource.BUILTIN_ALLOW).blocks)
        check(Match("x.com", RuleSource.BUILTIN_BLOCK).blocks)
    }

    mtt("random rule sets: match agrees with the old isBlocked, and the rule covers the name") {
        val rnd = java.util.Random(20261028L)
        val labels = listOf("a", "b", "c", "ads", "cdn", "x-y", "t_1")
        val tlds = listOf("com", "net", "org")
        fun randName(): String {
            val depth = 1 + rnd.nextInt(4)
            val parts = ArrayList<String>()
            repeat(depth) { parts.add(labels[rnd.nextInt(labels.size)]) }
            parts.add(tlds[rnd.nextInt(tlds.size)])
            return parts.joinToString(".")
        }
        fun randSet(max: Int): Set<String> {
            val s = HashSet<String>()
            repeat(rnd.nextInt(max + 1)) { s.add(randName()) }
            return s
        }
        var checked = 0
        repeat(300) {
            val bb = randSet(12); val ba = randSet(4); val ub = randSet(4); val ua = randSet(4)
            val text = (bb.toList() + ba.map { "@@||$it^" }).joinToString("\n")
            val bl = Blocklist.parse(text).plusBlocked(ub).plusAllowed(ua)
            repeat(40) {
                val q = if (rnd.nextInt(10) == 0) randName().uppercase() + "." else randName()
                val expected = oldIsBlocked(q, bb, ba, ub, ua)
                mteq(expected, bl.isBlocked(q))
                val m = bl.match(q)
                mteq(expected, m?.blocks ?: false)
                if (m != null) {
                    val n = Blocklist.normalizeOrNull(q)!!
                    check(n == m.rule || n.endsWith("." + m.rule)) { "${m.rule} does not cover $n" }
                    val set = when (m.source) {
                        RuleSource.USER_ALLOW -> ua; RuleSource.USER_BLOCK -> ub
                        RuleSource.BUILTIN_ALLOW -> ba; RuleSource.BUILTIN_BLOCK -> bb
                    }
                    check(m.rule in set) { "${m.rule} not in ${m.source}" }
                }
                checked++
            }
        }
        check(checked == 12000)
    }

    println("MatchTest: $mtn passed")
}
