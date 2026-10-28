// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

data class AppRow(
    val uid: Int,
    val queries: Long,
    val blocked: Long,
    val topBlocked: List<Pair<String, Int>>
)

class AppTally(
    val maxApps: Int = 300,
    val maxDomainsPerApp: Int = 100
) {
    private class AppData(val uid: Int) {
        var queries: Long = 0
        var blocked: Long = 0
        val domains = HashMap<String, Int>(16)
    }

    private val lock = Any()
    private val apps = HashMap<Int, AppData>(64)
    private val other = AppData(-2)

    fun record(uid: Int, name: String, blocked: Boolean) {
        synchronized(lock) {
            val app: AppData = if (uid == -2) {
                other
            } else {
                apps[uid] ?: run {
                    if (apps.size >= maxApps) other
                    else AppData(uid).also { apps[uid] = it }
                }
            }
            app.queries++
            if (blocked) {
                app.blocked++
                val existing = app.domains[name]
                if (existing != null) {
                    app.domains[name] = existing + 1
                } else if (app.domains.size < maxDomainsPerApp) {
                    app.domains[name] = 1
                }
            }
        }
    }

    fun snapshot(limit: Int = 30): List<AppRow> {
        synchronized(lock) {
            val all = ArrayList<AppData>(apps.size + 1)
            for (a in apps.values) if (a.queries > 0) all.add(a)
            if (other.queries > 0) all.add(other)
            all.sortWith(
                compareByDescending<AppData> { it.blocked }
                    .thenByDescending { it.queries }
                    .thenBy { it.uid }
            )
            val n = minOf(limit, all.size)
            val out = ArrayList<AppRow>(n)
            for (i in 0 until n) {
                val a = all[i]
                val top = a.domains.entries
                    .sortedWith(
                        compareByDescending<Map.Entry<String, Int>> { it.value }
                            .thenBy { it.key }
                    )
                    .take(20)
                    .map { it.key to it.value }
                out.add(AppRow(a.uid, a.queries, a.blocked, top))
            }
            return out
        }
    }

    fun clear() {
        synchronized(lock) {
            apps.clear()
            other.queries = 0
            other.blocked = 0
            other.domains.clear()
        }
    }
}
