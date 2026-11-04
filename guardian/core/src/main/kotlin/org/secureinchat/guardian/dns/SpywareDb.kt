// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

/**
 * G20: known stalkerware command-and-control (C2) domains, from Echap's stalkerware-indicators
 * (CC-BY 4.0; see app/src/main/assets/stalkerware-echap.tsv and tools/update_stalkerware.py).
 *
 * A hit means some app on this phone looked up a server that a known stalkerware product uses to send
 * out what it collected. It does not say which app (on Android 10+ every lookup reaches Guardian from
 * the system DNS service), and no hit does not mean the phone is clean: the list is incomplete, and
 * spyware with root access can avoid Guardian altogether. The UI says both.
 */
enum class SpywareKind { STALKERWARE, WATCHWARE }

data class SpywareIndicator(
    /** The listed domain that matched (the query may be a subdomain of it). */
    val domain: String,
    val app: String,
    val kind: SpywareKind,
    /** Echap also lists this domain as the vendor's website: a hit may just be someone reading it. */
    val alsoWebsite: Boolean
)

class SpywareDb private constructor(private val byDomain: Map<String, SpywareIndicator>) {

    val size: Int get() = byDomain.size

    /**
     * The indicator for [name] itself or its closest listed parent domain, or null. Exact labels only:
     * `x.copy9.com` matches a listed `copy9.com`, `notcopy9.com` does not. Cost is one map lookup per
     * label, cheap enough to run on every query.
     */
    fun match(name: String): SpywareIndicator? {
        var n = name.trim().trimEnd('.').lowercase()
        while (n.isNotEmpty()) {
            byDomain[n]?.let { return it }
            val dot = n.indexOf('.')
            if (dot < 0) return null
            n = n.substring(dot + 1)
        }
        return null
    }

    companion object {
        /**
         * Shared hosting and platform domains. If one of these were ever listed on its own, every app
         * using the platform would raise an alert, so such rows are dropped at load time (the update
         * tool's data has none; SpywareDbTest checks).
         */
        val SHARED_PLATFORMS: Set<String> = setOf(
            "appspot.com", "firebaseio.com", "firebaseapp.com", "web.app", "googleapis.com", "google.com",
            "amazonaws.com", "cloudfront.net", "azurewebsites.net", "herokuapp.com", "github.io",
            "blogspot.com", "wordpress.com", "000webhostapp.com", "netlify.app", "vercel.app",
            "duckdns.org", "no-ip.org", "ddns.net", "ngrok.io"
        )

        /** Parses the bundled TSV. Bad rows, comments and shared-platform rows are skipped, never thrown. */
        fun parse(tsv: String): SpywareDb {
            val map = HashMap<String, SpywareIndicator>(2048)
            for (raw in tsv.lineSequence()) {
                if (raw.isBlank() || raw.startsWith("#")) continue
                val p = raw.split('\t')
                if (p.size < 4) continue
                val domain = p[0].trim().trimEnd('.').lowercase()
                if (domain.isEmpty() || !domain.contains('.') || domain in SHARED_PLATFORMS) continue
                val kind = when (p[2].trim()) {
                    "stalkerware" -> SpywareKind.STALKERWARE
                    "watchware" -> SpywareKind.WATCHWARE
                    else -> continue
                }
                val app = p[1].trim()
                if (app.isEmpty()) continue
                map.putIfAbsent(domain, SpywareIndicator(domain, app, kind, p[3].trim() == "1"))
            }
            return SpywareDb(map)
        }
    }
}

/**
 * G20: turns matches into alerts without flooding the user. Each listed domain alerts at most once per
 * [quietMs] (a stalkerware app may phone home every few minutes); different domains alert separately.
 * Memory only: nothing about what was looked up is written to disk.
 */
class SpywareWatch(
    private val db: SpywareDb,
    private val quietMs: Long = 6 * 60 * 60 * 1000L,
    private val clock: () -> Long = System::currentTimeMillis
) {
    data class Alert(val queryName: String, val indicator: SpywareIndicator, val timeMs: Long)

    private val lastAlert = HashMap<String, Long>()
    private val recentAlerts = ArrayDeque<Alert>()
    private val lock = Any()

    /** Returns an alert to show for this query, or null (no match, or this domain alerted recently). */
    fun check(queryName: String): Alert? {
        val hit = db.match(queryName) ?: return null
        val now = clock()
        synchronized(lock) {
            val last = lastAlert[hit.domain]
            if (last != null && now - last < quietMs) return null
            lastAlert[hit.domain] = now
            val alert = Alert(queryName.trim().trimEnd('.').lowercase(), hit, now)
            recentAlerts.addFirst(alert)
            while (recentAlerts.size > MAX_RECENT) recentAlerts.removeLast()
            return alert
        }
    }

    /** Newest first; for the in-app list. */
    fun recent(): List<Alert> = synchronized(lock) { recentAlerts.toList() }

    companion object {
        const val MAX_RECENT = 20
    }
}
