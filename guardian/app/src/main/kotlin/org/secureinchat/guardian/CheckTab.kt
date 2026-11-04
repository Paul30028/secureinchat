// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.content.Intent
import android.provider.Settings
import android.text.format.DateFormat
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Date
import org.secureinchat.guardian.MainActivity.Companion.setIfChanged
import org.secureinchat.guardian.MainActivity.Companion.showIf

/**
 * Checks of this phone. G20 safety alerts come first while there are any; then what the stalkerware
 * watch does and does not mean (never "you are safe"); then the G16 privacy checkup, which only opens
 * system settings screens and never claims to know whether a setting was changed.
 */
class CheckTab(a: MainActivity) : Tab(a) {
    private lateinit var alertsCard: LinearLayout
    private lateinit var alertsBox: LinearLayout
    private lateinit var watch: TextView
    private var alertsSig = ""

    override fun build(root: LinearLayout) {
        root.addView(ui.title(s(R.string.tab_check)))

        alertsCard = ui.card(16, p.dangerContainer).apply {
            addView(ui.section(s(R.string.safety_alerts)).apply { setTextColor(p.danger) })
            alertsBox = ui.vertical()
            addView(alertsBox)
            addView(ui.body(s(R.string.safety_advice)).apply { layoutParams = ui.matchWidth(8) })
        }
        root.addView(alertsCard)

        root.addView(ui.card(12).apply {
            addView(ui.section(s(R.string.stalkerware_watch)))
            watch = ui.caption().apply { layoutParams = ui.matchWidth(4) }
            addView(watch)
        })

        root.addView(ui.card(12).apply {
            addView(ui.section(s(R.string.privacy_checkup)))
            addView(ui.caption(s(R.string.privacy_checkup_hint)).apply { layoutParams = ui.matchWidth(4) })
            privacyRow(this, R.string.pc_ad_title, R.string.pc_ad_body,
                listOf(Intent("com.google.android.gms.settings.ADS_PRIVACY"), Intent(Settings.ACTION_PRIVACY_SETTINGS)),
                R.string.pc_ad_button, R.string.pc_ad_fallback)
            // Only the documented location action; per-app precise/approximate is chosen from there.
            privacyRow(this, R.string.pc_loc_title, R.string.pc_loc_body,
                listOf(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)),
                R.string.pc_loc_button, R.string.pc_loc_fallback)
            privacyRow(this, R.string.pc_perm_title, R.string.pc_perm_body,
                listOf(Intent(Settings.ACTION_APPLICATION_SETTINGS)),
                R.string.pc_perm_button, R.string.pc_perm_fallback)
        })

        // G20: attribution for the stalkerware indicators (CC-BY 4.0).
        root.addView(ui.textButton(s(R.string.credit_echap)) {
            a.openUrl("https://github.com/AssoEchap/stalkerware-indicators")
        }.apply { textSize = 12f })
    }

    /** First candidate the system can handle, or null (API too low, or the OEM removed the screen). */
    private fun firstResolvable(candidates: List<Intent>): Intent? {
        for (i in candidates) {
            try { if (i.resolveActivity(a.packageManager) != null) return i } catch (_: Throwable) {}
        }
        return null
    }

    // A row with an unreachable screen keeps its explanation and says where to look instead, so the
    // checkup never shows a button that would do nothing.
    private fun privacyRow(parent: LinearLayout, title: Int, body: Int, candidates: List<Intent>, button: Int, fallback: Int) {
        parent.addView(ui.divider())
        parent.addView(ui.body(s(title)).apply { textSize = 15f })
        parent.addView(ui.caption(s(body)))
        val target = firstResolvable(candidates)
        if (target != null) {
            parent.addView(ui.textButton(s(button)) { a.tryStart(target) })
        } else {
            parent.addView(ui.caption(s(fallback)).apply { layoutParams = ui.matchWidth(4) })
        }
    }

    override fun refresh() {
        val running = GuardianVpnService.isRunning
        val n = GuardianVpnService.spywareListSize
        setIfChanged(watch, when {
            !running -> s(R.string.watch_off)
            n == 0 -> s(R.string.watch_unavailable)
            else -> a.resources.getQuantityString(R.plurals.watch_on, n, n)
        })
        val alerts = GuardianVpnService.recentSpywareAlerts()
        showIf(alertsCard, alerts.isNotEmpty())
        val sig = alerts.joinToString(";") { "${it.timeMs}:${it.queryName}" }
        if (sig == alertsSig) return
        alertsSig = sig
        alertsBox.removeAllViews()
        val fmt = DateFormat.getTimeFormat(a)
        for (al in alerts) {
            val (title, body) = GuardianVpnService.spywareAlertText(
                a, al.indicator.app, al.indicator.kind, al.indicator.alsoWebsite, al.queryName
            )
            alertsBox.addView(ui.body("${fmt.format(Date(al.timeMs))}  $title").apply {
                layoutParams = ui.matchWidth(8)
                setTextColor(p.danger)
            })
            alertsBox.addView(ui.caption(body))
        }
    }

    override fun invalidate() { alertsSig = "" }
}
