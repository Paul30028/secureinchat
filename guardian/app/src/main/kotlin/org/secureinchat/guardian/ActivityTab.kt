// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.graphics.Typeface
import android.os.SystemClock
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.secureinchat.guardian.MainActivity.Companion.setIfChanged
import org.secureinchat.guardian.MainActivity.Companion.showIf
import org.secureinchat.guardian.dns.Blocklist
import org.secureinchat.guardian.dns.LogEntry
import org.secureinchat.guardian.dns.QueryHandler
import org.secureinchat.guardian.dns.Tracker

/**
 * What was blocked, and the place to fix a false positive: first "something not working?" with Pause and
 * the names blocked just now, then the names blocked most often; each row has Allow. Not per app: on
 * Android 10+ apps resolve names through the system DNS service, so every query reaching the VPN comes
 * from that service, not from the app. The live log is for the curious and starts folded.
 */
class ActivityTab(a: MainActivity) : Tab(a) {
    companion object {
        /** Kept for the process, so a language change or rotation does not fold the log again. */
        private var liveShown = false
    }

    private lateinit var recentBox: LinearLayout
    private lateinit var pause: Button
    private var recentSig = ""
    private lateinit var topBox: LinearLayout
    private lateinit var history: TextView
    private lateinit var liveToggle: Button
    private lateinit var liveBox: LinearLayout
    private lateinit var stats: TextView
    private lateinit var log: TextView
    private var topSig = ""
    private var topBuiltAt = 0L
    private var historySig = ""

    override fun build(root: LinearLayout) {
        root.addView(ui.title(s(R.string.tab_activity)))

        // First what people come here for after something broke: pause, or allow a name blocked just now.
        root.addView(ui.card(16).apply {
            addView(ui.section(s(R.string.activity_broken_title)))
            addView(ui.caption(s(R.string.activity_broken_body)).apply { layoutParams = ui.matchWidth(4) })
            pause = ui.secondaryButton("") { a.onPauseResumeClicked() }
            addView(pause)
            addView(ui.body(s(R.string.recent_blocks)).apply { layoutParams = ui.matchWidth(12) })
            recentBox = ui.vertical()
            addView(recentBox)
        })

        root.addView(ui.card(12).apply {
            addView(ui.section(s(R.string.blocked_most_often)))
            addView(ui.caption(s(R.string.blocked_most_often_hint)).apply { layoutParams = ui.matchWidth(4) })
            // Said up front, because "which app was it?" is the first question people ask.
            addView(ui.caption(s(R.string.activity_attribution)).apply { layoutParams = ui.matchWidth(4) })
            topBox = ui.vertical().apply { layoutParams = ui.matchWidth(8) }
            addView(topBox)
        })

        root.addView(ui.card(12).apply {
            history = ui.body()
            addView(history)
            addView(ui.textButton(s(R.string.clear_block_history)) {
                // No confirmation: it is a small counter, and the result is visible at once.
                StatsStore.clear(a)
                historySig = ""
                a.uiHandler.post { a.refreshUi() }
            })
        })

        root.addView(ui.card(12).apply {
            liveToggle = ui.textButton("") {
                liveShown = !liveShown
                a.refreshUi()
            }
            addView(liveToggle)
            liveBox = ui.vertical().apply {
                stats = ui.caption().apply { typeface = Typeface.MONOSPACE }
                addView(stats)
                log = ui.caption().apply { typeface = Typeface.MONOSPACE; layoutParams = ui.matchWidth(8) }
                addView(log)
            }
            addView(liveBox)
        })
    }

    override fun refresh() {
        val h = GuardianVpnService.activeHandler
        val running = GuardianVpnService.isRunning && !GuardianVpnService.isLoading
        val paused = running && h != null && h.isPaused()
        showIf(pause, running)
        setIfChanged(pause, if (paused) s(R.string.resume) else s(R.string.pause_5_min))
        renderRecent(h)
        renderTop(h)
        renderHistory()
        setIfChanged(liveToggle, if (liveShown) s(R.string.hide_live_log) else s(R.string.show_live_log))
        showIf(liveBox, liveShown)
        if (liveShown) {
            if (h == null) {
                setIfChanged(stats, s(R.string.live_off))
                setIfChanged(log, "")
            } else {
                val st = h.snapshot()
                setIfChanged(stats, s(R.string.live_stats, st.queries, st.blocked, st.forwarded, st.answered, st.failed, st.malformed))
                renderLog(h.recent())
            }
        }
    }

    private fun renderHistory() {
        val today = StatsStore.today(a)
        val last7 = StatsStore.last7(a)
        val sig = "$today/$last7"
        if (sig == historySig) return
        historySig = sig
        setIfChanged(history, s(R.string.history_line, today, last7))
    }

    private fun renderLog(entries: List<LogEntry>) {
        val sb = SpannableStringBuilder()
        val fmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        val trackers = GuardianVpnService.trackerDb()
        // Last 10: a glance at what is happening; the list above is what people act on.
        for (e in entries.take(10)) {
            val start = sb.length
            val tag = when {
                e.blocked -> s(R.string.log_block)
                e.paused -> s(R.string.log_pause)
                else -> s(R.string.log_allow)
            }
            sb.append(fmt.format(Date(e.timeMs))).append(' ').append(tag).append(' ')
                .append(e.name).append(" (type ").append(e.qtype.toString()).append(")")
            // G14: blocked because the answer's CNAME pointed at a listed tracker.
            e.via?.let { sb.append(s(R.string.log_really, it)) }
            if (e.blocked) trackers?.byDomain(e.via ?: e.name)?.let { sb.append(" · ").append(it.name) }
            sb.append('\n')
            val color = when { e.blocked -> p.danger; e.paused -> p.warn; else -> null }
            if (color != null) sb.setSpan(ForegroundColorSpan(color), start, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
        setIfChanged(log, sb)
    }

    /** The last few distinct blocked names, newest first, each with Allow. */
    private fun renderRecent(h: QueryHandler?) {
        val names = h?.recent()?.filter { it.blocked }?.map { it.name }?.distinct()?.take(5) ?: emptyList()
        val sig = (h != null).toString() + names.joinToString(";")
        if (sig == recentSig) return
        recentSig = sig
        recentBox.removeAllViews()
        if (h == null) { recentBox.addView(ui.empty(s(R.string.recent_empty_off))); return }
        if (names.isEmpty()) { recentBox.addView(ui.empty(s(R.string.nothing_blocked_yet))); return }
        val trackers = GuardianVpnService.trackerDb()
        for (name in names) {
            val lines = mutableListOf<CharSequence>()
            trackers?.byDomain(name)?.let { lines.add(s(R.string.tracker_line, it.name)) }
            val allow = ui.textButton(s(R.string.allow)) {
                UserRulesStore.add(a, name)
                a.rulesChanged()
            }.apply { contentDescription = s(R.string.allow_domain, name) }
            recentBox.addView(ui.row(name, lines, allow))
        }
    }

    private fun renderTop(h: QueryHandler?) {
        val top = h?.tally?.snapshot(1)?.firstOrNull()?.topBlocked ?: emptyList()
        val trackers = GuardianVpnService.trackerDb()
        // G11: the rule behind each row, worked out from the live rules; part of the signature so a rule
        // change rebuilds the rows once the background rules thread has swapped the list.
        val bl = h?.blocklist
        val rules = top.map { bl?.match(it.first) }
        val sig = (h != null).toString() + "|" + top.joinToString(";") { "${it.first}:${it.second}" } + "|" +
            rules.joinToString(";") { m -> if (m == null) "-" else "${m.rule}:${m.source}" } + "|" + (trackers != null)
        if (sig == topSig) return
        // Counts change with every query: rebuild at most every 5 s unless a tap reset the signature.
        val now = SystemClock.uptimeMillis()
        if (topSig.isNotEmpty() && now - topBuiltAt < 5000) return
        topBuiltAt = now
        topSig = sig
        topBox.removeAllViews()
        if (h == null) { topBox.addView(ui.empty(s(R.string.recent_empty_off))); return }
        if (top.isEmpty()) { topBox.addView(ui.empty(s(R.string.nothing_blocked_yet))); return }
        for ((i, d) in top.withIndex()) {
            val lines = mutableListOf<CharSequence>(ruleLine(rules[i]))
            trackers?.byDomain(d.first)?.let { lines.add(trackerLine(it)) }
            val allow = ui.textButton(s(R.string.allow)) {
                UserRulesStore.add(a, d.first)
                a.rulesChanged()
            }.apply { contentDescription = s(R.string.allow_domain, d.first) }
            topBox.addView(ui.row("${d.first} (${d.second})", lines, allow))
        }
    }

    /** The list counts past blocks, so the current rules may no longer block the name: say so. */
    private fun ruleLine(m: Blocklist.Match?): String = if (m == null) s(R.string.rule_no_longer) else when (m.source) {
        Blocklist.RuleSource.BUILTIN_BLOCK -> s(R.string.rule_builtin, m.rule)
        Blocklist.RuleSource.USER_BLOCK -> s(R.string.rule_user_block, m.rule)
        Blocklist.RuleSource.USER_ALLOW -> s(R.string.rule_user_allow, m.rule)
        Blocklist.RuleSource.BUILTIN_ALLOW -> s(R.string.rule_builtin_allow, m.rule)
    }

    private fun trackerLine(t: Tracker): String {
        if (t.categories.isEmpty()) return s(R.string.tracker_line, t.name)
        val cats = t.categories.joinToString(s(R.string.list_separator)) { catLabel(it) }
        return s(R.string.tracker_line_with_categories, t.name, cats)
    }

    // The Exodus categories are a fixed short list; unknown values pass through unchanged.
    private fun catLabel(cat: String): String = when (cat) {
        "Advertisement" -> s(R.string.cat_advertisement)
        "Analytics" -> s(R.string.cat_analytics)
        "Location" -> s(R.string.cat_location)
        "Profiling" -> s(R.string.cat_profiling)
        "Identification" -> s(R.string.cat_identification)
        "Crash reporting" -> s(R.string.cat_crash_reporting)
        else -> cat
    }

    override fun invalidate() { topSig = ""; historySig = ""; recentSig = "" }
    override fun onShown() { topSig = "" }

}
