// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.text.format.DateFormat
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Date
import org.secureinchat.guardian.MainActivity.Companion.setIfChanged
import org.secureinchat.guardian.MainActivity.Companion.showIf

/**
 * Home screen: one large status (shape, colour and words, so it never depends on colour alone), one
 * main button, pause, today's numbers and the last few blocks. Warnings that need action (a safety
 * alert, Private DNS bypassing Guardian, encrypted DNS unreachable) appear here as cards that lead to
 * the tab where they are handled.
 */
class ProtectTab(a: MainActivity) : Tab(a) {
    private lateinit var shield: ImageView
    private lateinit var statusTitle: TextView
    private lateinit var statusBody: TextView
    private lateinit var toggle: Button
    private lateinit var pause: Button
    private lateinit var alertCard: LinearLayout
    private lateinit var alertText: TextView
    private lateinit var pdnsCard: LinearLayout
    private lateinit var dotCard: LinearLayout
    private lateinit var dotText: TextView
    private lateinit var todayNum: TextView
    private lateinit var weekNum: TextView
    private lateinit var recentBox: LinearLayout
    private lateinit var privacy: TextView
    private var shieldState = -1
    private var recentSig = ""

    override fun build(root: LinearLayout) {
        root.addView(ui.caption(s(R.string.app_name)).apply { gravity = Gravity.CENTER; layoutParams = ui.matchWidth(0) })

        shield = ImageView(a).apply {
            layoutParams = LinearLayout.LayoutParams(ui.dp(112), ui.dp(112)).apply {
                gravity = Gravity.CENTER_HORIZONTAL; topMargin = ui.dp(16)
            }
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        root.addView(shield)
        statusTitle = ui.title("", 24f).apply {
            gravity = Gravity.CENTER
            layoutParams = ui.matchWidth(12)
            // Announced when it changes (on, off, paused).
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        root.addView(statusTitle)
        statusBody = ui.caption().apply { gravity = Gravity.CENTER; layoutParams = ui.matchWidth(4) }
        root.addView(statusBody)

        toggle = ui.primaryButton("") { a.onToggleClicked() }
        root.addView(toggle)
        pause = ui.secondaryButton("") { a.onPauseResumeClicked() }
        root.addView(pause)

        alertCard = ui.card(16, p.dangerContainer).apply {
            alertText = ui.body().apply { setTextColor(p.danger) }
            addView(alertText)
            addView(ui.textButton(s(R.string.view_alerts), p.danger) { a.selectTab(2) })
            visibility = View.GONE
        }
        root.addView(alertCard)

        pdnsCard = ui.card(12, p.warnContainer).apply {
            addView(ui.body(s(R.string.private_dns_hint)).apply { setTextColor(p.warn) })
            visibility = View.GONE
        }
        root.addView(pdnsCard)

        dotCard = ui.card(12, p.warnContainer).apply {
            dotText = ui.body().apply { setTextColor(p.warn) }
            addView(dotText)
            addView(ui.textButton(s(R.string.open_settings), p.warn) { a.selectTab(3) })
            visibility = View.GONE
        }
        root.addView(dotCard)

        val stats = LinearLayout(a).apply { orientation = LinearLayout.HORIZONTAL; layoutParams = ui.matchWidth(16) }
        fun tile(label: String): TextView {
            val num = ui.title("0", 28f)
            stats.addView(ui.card(0).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    if (stats.childCount > 0) marginStart = ui.dp(12)
                }
                addView(num)
                addView(ui.caption(label))
            })
            return num
        }
        todayNum = tile(s(R.string.blocked_today_label))
        weekNum = tile(s(R.string.last_7_days_label))
        root.addView(stats)

        root.addView(ui.card(12).apply {
            val head = LinearLayout(a).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
            head.addView(ui.section(s(R.string.recent_blocks)).apply {
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            head.addView(ui.textButton(s(R.string.see_all)) { a.selectTab(1) })
            addView(head)
            recentBox = ui.vertical()
            addView(recentBox)
        })

        privacy = ui.caption().apply { layoutParams = ui.matchWidth(16) }
        root.addView(privacy)
    }

    override fun refresh() {
        val loading = GuardianVpnService.isLoading
        val running = GuardianVpnService.isRunning
        val h = GuardianVpnService.activeHandler
        val paused = running && h != null && h.isPaused()

        val state = when { loading -> 3; paused -> 2; running -> 1; else -> 0 }
        if (state != shieldState) {
            shieldState = state
            val (icon, color) = when (state) {
                1 -> R.drawable.ic_shield_on to p.accent
                2 -> R.drawable.ic_shield_pause to p.warn
                else -> R.drawable.ic_shield_off to p.secondary
            }
            shield.setImageDrawable(ui.tinted(icon, color))
        }
        setIfChanged(statusTitle, when (state) {
            3 -> s(R.string.status_loading)
            2 -> s(R.string.status_paused_until, DateFormat.getTimeFormat(a).format(Date(h!!.pausedUntilMs)))
            1 -> s(R.string.status_on)
            else -> s(R.string.status_off)
        })
        setIfChanged(statusBody, when (state) {
            3 -> ""
            2 -> s(R.string.status_paused_body)
            1 -> s(R.string.status_on_body)
            else -> s(R.string.status_off_body)
        })

        toggle.isEnabled = !loading
        setIfChanged(toggle, if (running) s(R.string.turn_off) else s(R.string.turn_on))
        showIf(pause, running && !loading)
        setIfChanged(pause, if (paused) s(R.string.resume) else s(R.string.pause_5_min))

        val alerts = GuardianVpnService.recentSpywareAlerts().size
        showIf(alertCard, alerts > 0)
        if (alerts > 0) setIfChanged(alertText, a.resources.getQuantityString(R.plurals.safety_alerts_count, alerts, alerts))

        showIf(pdnsCard, a.privateDnsOn)

        val dot = DnsSettingsStore.provider(a)
        val st = GuardianVpnService.dotState
        val dotDown = running && dot != null && st != null && st.hostname == dot.tlsName && st.connected == false
        showIf(dotCard, dotDown)
        if (dotDown) setIfChanged(dotText, s(R.string.dot_down_card, dot!!.label))

        setIfChanged(todayNum, StatsStore.today(a).toString())
        setIfChanged(weekNum, StatsStore.last7(a).toString())

        renderRecent(h)
        setIfChanged(privacy, if (dot == null) s(R.string.privacy_plain) else s(R.string.privacy_dot, dot.label))
    }

    private fun renderRecent(h: org.secureinchat.guardian.dns.QueryHandler?) {
        val entries = h?.recent()?.filter { it.blocked }?.take(3) ?: emptyList()
        val sig = (h != null).toString() + entries.joinToString(";") { "${it.timeMs}:${it.name}" }
        if (sig == recentSig) return
        recentSig = sig
        recentBox.removeAllViews()
        if (h == null) { recentBox.addView(ui.empty(s(R.string.recent_empty_off))); return }
        if (entries.isEmpty()) { recentBox.addView(ui.empty(s(R.string.nothing_blocked_yet))); return }
        val trackers = GuardianVpnService.trackerDb()
        val fmt = DateFormat.getTimeFormat(a)
        for (e in entries) {
            val domain = e.via ?: e.name
            val company = trackers?.byDomain(domain)?.name
            val lines = mutableListOf<CharSequence>(fmt.format(Date(e.timeMs)))
            if (company != null) lines.add(0, s(R.string.tracker_line, company))
            recentBox.addView(ui.row(e.name, lines))
        }
    }

    override fun invalidate() { recentSig = "" }
}
