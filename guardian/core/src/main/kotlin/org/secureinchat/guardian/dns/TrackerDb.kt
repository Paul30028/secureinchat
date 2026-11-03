// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

/**
 * One row of the Exodus tracker database (see app/src/main/assets/trackers-exodus.tsv).
 *
 * [networkRegex] is null when the source row has no network signature, or when its signature is not
 * a valid Java regex: in both cases the tracker has no network face and byDomain will never return
 * it. [codeSignatures] are class-name prefixes; the G17 scanner matches an installed app's DEX
 * class names against them, so they are kept verbatim (with or without a trailing dot).
 *
 * [broad] (G15b): the network regex only says "any subdomain of one registrable domain", e.g.
 * `\.google\.com` (filed under Google Ads) or `\.facebook\.com`. Most names under such a domain are
 * the company's own services (mail, login, maps), so naming a tracker for them would mislead;
 * byDomain skips these rows. The code signatures are unaffected (G17 still uses them).
 */
data class Tracker(
    val id: Int,
    val name: String,
    val categories: List<String>,
    val website: String,
    val networkRegex: Regex?,
    val codeSignatures: List<String>,
    val broad: Boolean = false
)

/**
 * Lookup over the Exodus tracker set.
 *
 * Domain matching is "the domain contains a match for the tracker's network regex", which is what
 * Exodus/TrackerControl mean: a row for `doubleclick\.net` matches both `doubleclick.net` and
 * `stats.g.doubleclick.net` without the DB having to list every subdomain. When several rows match
 * one domain, the smallest id wins so the answer is stable across runs.
 *
 * The source data is licensed ODbL v1.0 / DbCL v1.0; see the attribution in MainActivity and the
 * header of the asset file.
 */
class TrackerDb private constructor(
    private val trackers: List<Tracker>
) {
    /**
     * Trackers byDomain may return: a working network regex that is not [Tracker.broad], sorted by id
     * so the first hit is the smallest id.
     */
    private val networkTrackers: List<Tracker> =
        trackers.filter { it.networkRegex != null && !it.broad }.sortedBy { it.id }

    val size: Int get() = trackers.size
    /** Rows with a working network regex, broad ones included. */
    val withNetwork: Int = trackers.count { it.networkRegex != null }
    /** Rows whose network regex is only "any subdomain of one domain"; byDomain skips them. */
    val broadCount: Int = trackers.count { it.broad }

    /**
     * LRU of byDomain results, misses included. A domain is looked up for every visible log line
     * and every "Blocked most often" row on each UI refresh (1 Hz), so the cache turns repeated
     * lookups of the same handful of names into O(1). The regex scan itself is O(networkTrackers)
     * per miss; with 260 trackers and short hostnames that is tens of microseconds, fine for a
     * cache miss but not for a per-frame loop.
     */
    private val cache = object : LinkedHashMap<String, Tracker?>(CACHE_INITIAL, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Tracker?>?): Boolean =
            size > CACHE_SIZE
    }

    /** First tracker whose network regex matches [name] (containsMatchIn, not full match), or null. */
    fun byDomain(name: String): Tracker? {
        val key = name.lowercase()
        synchronized(cache) {
            if (cache.containsKey(key)) return cache[key]
        }
        var found: Tracker? = null
        for (t in networkTrackers) {
            val r = t.networkRegex ?: continue
            if (r.containsMatchIn(key)) { found = t; break }
        }
        synchronized(cache) { cache[key] = found }
        return found
    }

    /**
     * Tracker whose DEX class-name signature is a prefix of [className], or null.
     *
     * Both dotted signatures ("com.krux.androidsdk") and non-dotted ones ("com.databerries") are
     * treated as plain prefixes, per the G17 spec. Not cached: the G17 scanner walks many class
     * names once per scan, so per-call cost is negligible and a per-process cache would just hold
     * garbage.
     */
    fun byClassName(className: String): Tracker? {
        for (t in trackers) {
            for (sig in t.codeSignatures) {
                if (sig.isEmpty()) continue
                if (className.startsWith(sig)) return t
            }
        }
        return null
    }

    companion object {
        private const val CACHE_SIZE = 512
        private const val CACHE_INITIAL = 128
        private const val EXPECTED_COLS = 6

        /** One alternative of the form `\.<label>\.<tld>`: any subdomain of one registrable domain. */
        private val BROAD_ALTERNATIVE = Regex("""^\\\.[a-z0-9-]+\\\.[a-z]{2,}$""")

        /**
         * True when every `|` alternative of [regex] is a [BROAD_ALTERNATIVE] (so the row says nothing
         * more specific than "somewhere under this domain"). A regex with groups is never split, and is
         * not treated as broad.
         */
        fun isBroadRegex(regex: String): Boolean {
            if (regex.isEmpty() || regex.contains('(')) return false
            return regex.split('|').all { BROAD_ALTERNATIVE.matches(it) }
        }

        /**
         * Parses a TSV as produced by tools/update_trackers.py. Comment lines start with '#';
         * blank lines are ignored. A row with fewer than 6 tab-separated columns is dropped; a
         * row whose network regex does not compile is kept but gets a null regex (the tracker has
         * code signatures only). Rows are returned sorted by id so iteration is deterministic.
         */
        fun parse(tsv: String): TrackerDb {
            val list = ArrayList<Tracker>(512)
            for (raw in tsv.lineSequence()) {
                if (raw.isEmpty()) continue
                if (raw.startsWith("#")) continue
                val parts = raw.split('\t')
                if (parts.size < EXPECTED_COLS) continue
                val id = parts[0].trim().toIntOrNull() ?: continue
                val name = parts[1]
                if (name.isEmpty()) continue
                val catRaw = parts[2].trim()
                val cats = if (catRaw.isEmpty()) emptyList()
                else catRaw.split(',').map { it.trim() }.filter { it.isNotEmpty() }
                val website = parts[3]
                val regexRaw = parts[4]
                val rx = if (regexRaw.isEmpty()) null
                else try { Regex(regexRaw) } catch (_: Throwable) { null }
                val sigsRaw = parts[5]
                val sigs = if (sigsRaw.isEmpty()) emptyList()
                else sigsRaw.split('|').filter { it.isNotEmpty() }
                list.add(Tracker(id, name, cats, website, rx, sigs, broad = rx != null && isBroadRegex(regexRaw)))
            }
            return TrackerDb(list.sortedBy { it.id })
        }
    }
}
