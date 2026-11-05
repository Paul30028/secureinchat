// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.text.format.DateFormat
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Calendar
import java.util.Date
import org.secureinchat.guardian.MainActivity.Companion.setIfChanged
import org.secureinchat.guardian.MainActivity.Companion.showIf
import org.secureinchat.guardian.dns.AppCheckup

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
    private lateinit var scanButton: Button
    private lateinit var scanSummary: TextView
    private lateinit var scanBox: LinearLayout
    private var scanning = false

    companion object {
        /** The last scan, for this process only: never written to storage. */
        @Volatile private var lastScan: AppScanner.Result? = null
    }

    override fun build(root: LinearLayout) {
        root.addView(ui.title(s(R.string.tab_check)))

        alertsCard = ui.card(16, p.dangerContainer).apply {
            addView(ui.section(s(R.string.safety_alerts)).apply { setTextColor(p.danger) })
            alertsBox = ui.vertical()
            addView(alertsBox)
            addView(ui.body(s(R.string.safety_advice)).apply { layoutParams = ui.matchWidth(8) })
        }
        root.addView(alertsCard)

        // --- G19 app checkup -----------------------------------------------------------------
        root.addView(ui.card(12).apply {
            addView(ui.section(s(R.string.scan_title)))
            addView(ui.caption(s(R.string.scan_intro)).apply { layoutParams = ui.matchWidth(4) })
            // Why it asks to see every app (QUERY_ALL_PACKAGES), in one line.
            addView(ui.caption(s(R.string.scan_read_only)).apply { layoutParams = ui.matchWidth(4) })
            scanButton = ui.primaryButton(s(R.string.scan_button)) { startScan() }
            addView(scanButton)
            scanSummary = ui.body().apply { layoutParams = ui.matchWidth(12); visibility = View.GONE }
            addView(scanSummary)
            scanBox = ui.vertical()
            addView(scanBox)
        })

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

    private fun startScan() {
        if (scanning) return
        scanning = true
        scanButton.isEnabled = false
        setIfChanged(scanButton, s(R.string.scan_running))
        val ctx = a.applicationContext
        Thread {
            val result = try { AppScanner(ctx).scan(AppScanner.stalkerwarePackages(ctx)) } catch (_: Throwable) { null }
            a.uiHandler.post {
                scanning = false
                scanButton.isEnabled = true
                setIfChanged(scanButton, s(R.string.scan_again))
                if (result == null) {
                    showIf(scanSummary, true)
                    setIfChanged(scanSummary, s(R.string.scan_failed))
                } else {
                    lastScan = result
                    renderScan(result)
                    // Results start below the fold when a safety alert is shown: bring them into view.
                    scanSummary.post {
                        val card = scanSummary.parent as? View ?: return@post
                        (view as? android.widget.ScrollView)?.smoothScrollTo(0, (card.top + scanSummary.top - ui.dp(16)).coerceAtLeast(0))
                    }
                }
            }
        }.apply { name = "guardian-app-checkup" }.start()
    }

    private fun appSettings(pkg: String): Intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))

    private fun renderScan(r: AppScanner.Result) {
        // Three numbers first (apps that need attention, apps worth a look, phone settings), then the list.
        val high = r.findings.count { it.level == AppCheckup.Level.HIGH }
        val review = r.findings.count { it.level == AppCheckup.Level.REVIEW }
        val phone = r.phone.size
        val phoneHigh = r.phone.any { it.level == AppCheckup.Level.HIGH }
        showIf(scanSummary, true)
        setIfChanged(scanSummary, if (high + review + phone == 0) s(R.string.scan_clean, r.apps.size)
            else s(R.string.scan_summary, high, review, phone, r.apps.size))
        scanSummary.setTextColor(if (high > 0 || phoneHigh) p.danger else p.text)
        scanBox.removeAllViews()

        // This phone's own settings first: they make every other risk easier.
        if (r.phone.isNotEmpty()) {
            scanBox.addView(ui.body(s(R.string.scan_phone)).apply { layoutParams = ui.matchWidth(12); textSize = 15f })
            for (issue in r.phone) scanBox.addView(phoneRow(issue))
        }
        val highList = r.findings.filter { it.level == AppCheckup.Level.HIGH }
        val reviewList = r.findings.filter { it.level == AppCheckup.Level.REVIEW }
        if (highList.isNotEmpty()) {
            scanBox.addView(ui.body(s(R.string.scan_high)).apply {
                layoutParams = ui.matchWidth(12); textSize = 15f; setTextColor(p.danger)
            })
            for (f in highList) scanBox.addView(findingRow(f))
            if (highList.any { AppCheckup.Signal.STALKERWARE in it.signals }) {
                scanBox.addView(ui.caption(s(R.string.safety_advice)).apply { layoutParams = ui.matchWidth(4) })
            }
        }
        if (reviewList.isNotEmpty()) {
            // Folded: "needs attention" first; the longer, calmer list one tap away.
            scanBox.addView(ui.body(s(R.string.scan_review)).apply { layoutParams = ui.matchWidth(12); textSize = 15f })
            val box = ui.vertical().apply { visibility = View.GONE }
            lateinit var toggle: android.widget.Button
            toggle = ui.textButton(s(R.string.scan_review_show, reviewList.size)) {
                val show = box.visibility != View.VISIBLE
                showIf(box, show)
                toggle.text = if (show) s(R.string.scan_review_hide) else s(R.string.scan_review_show, reviewList.size)
            }
            scanBox.addView(toggle)
            for (f in reviewList) box.addView(findingRow(f))
            scanBox.addView(box)
        }

        // Browse by kind of access: how many apps, and which.
        scanBox.addView(ui.divider())
        scanBox.addView(ui.body(s(R.string.scan_by_permission)).apply { textSize = 15f })
        for ((kind, n) in r.counts) {
            if (n == 0) continue
            val names = AppCheckup.appsWith(kind, r.apps, a.packageName).map { it.label }
            val shown = names.take(4).joinToString(s(R.string.list_separator)) + if (names.size > 4) "…" else ""
            scanBox.addView(ui.row(a.resources.getQuantityString(kindPlural(kind), n, n), listOf(shown)))
        }
        if (r.notificationAccessUnknown) scanBox.addView(ui.caption(s(R.string.scan_notif_unknown)).apply { layoutParams = ui.matchWidth(8) })
        scanBox.addView(ui.caption(s(R.string.scan_footer)).apply { layoutParams = ui.matchWidth(8) })
    }

    private fun kindPlural(k: AppCheckup.Kind): Int = when (k) {
        AppCheckup.Kind.LOCATION -> R.plurals.kind_location
        AppCheckup.Kind.BACKGROUND_LOCATION -> R.plurals.kind_background_location
        AppCheckup.Kind.MICROPHONE -> R.plurals.kind_microphone
        AppCheckup.Kind.CAMERA -> R.plurals.kind_camera
        AppCheckup.Kind.CONTACTS -> R.plurals.kind_contacts
        AppCheckup.Kind.SMS -> R.plurals.kind_sms
        AppCheckup.Kind.CALL_LOG -> R.plurals.kind_call_log
        AppCheckup.Kind.PHOTOS -> R.plurals.kind_photos
    }

    private fun signalText(sig: AppCheckup.Signal): String = s(when (sig) {
        AppCheckup.Signal.STALKERWARE -> R.string.sig_stalkerware
        AppCheckup.Signal.WATCHWARE -> R.string.sig_watchware
        AppCheckup.Signal.ACCESSIBILITY -> R.string.sig_accessibility
        AppCheckup.Signal.DEVICE_ADMIN -> R.string.sig_device_admin
        AppCheckup.Signal.NOTIFICATION_LISTENER -> R.string.sig_notification
        AppCheckup.Signal.HIDDEN_WITH_SENSITIVE -> R.string.sig_hidden
        AppCheckup.Signal.BACKGROUND_LOCATION -> R.string.sig_background_location
        AppCheckup.Signal.SMS -> R.string.sig_sms
        AppCheckup.Signal.CALL_LOG -> R.string.sig_call_log
        AppCheckup.Signal.GAME_SENSITIVE -> R.string.sig_game
        AppCheckup.Signal.OVERLAY -> R.string.sig_overlay
    })

    private fun findingRow(f: AppCheckup.Finding): LinearLayout {
        val lines = mutableListOf<CharSequence>()
        // A stalkerware app often disguises its name; say which product the list knows it as.
        if (f.listedAs != null && f.listedAs != f.app.label) lines += s(R.string.scan_listed_as, f.listedAs)
        f.signals.forEach { lines += "· " + signalText(it) }
        val open = ui.textButton(s(R.string.scan_open_permissions)) { a.tryStart(appSettings(f.app.packageName)) }
            .apply { contentDescription = s(R.string.scan_open_permissions_for, f.app.label) }
        return ui.row(f.app.label, lines, open)
    }

    private fun phoneRow(issue: AppCheckup.PhoneIssue): LinearLayout {
        val (text, target) = when (issue) {
            AppCheckup.PhoneIssue.NO_SCREEN_LOCK ->
                s(R.string.phone_no_lock) to Intent(Settings.ACTION_SECURITY_SETTINGS)
            AppCheckup.PhoneIssue.USB_DEBUGGING ->
                s(R.string.phone_usb_debugging) to Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS)
            AppCheckup.PhoneIssue.OLD_SECURITY_PATCH -> {
                val now = Calendar.getInstance()
                val months = AppCheckup.patchAgeMonths(Build.VERSION.SECURITY_PATCH, now.get(Calendar.YEAR), now.get(Calendar.MONTH) + 1) ?: 0
                s(R.string.phone_old_patch, Build.VERSION.SECURITY_PATCH, months) to Intent(Settings.ACTION_DEVICE_INFO_SETTINGS)
            }
        }
        val fix = ui.textButton(s(R.string.open_settings)) { a.tryStart(target) }
        return ui.row(text, emptyList(), fix).apply {
            if (issue.level == AppCheckup.Level.HIGH) (getChildAt(0) as? LinearLayout)?.getChildAt(0)?.let { (it as TextView).setTextColor(p.danger) }
        }
    }

    override fun onShown() { lastScan?.let { if (!scanning && scanBox.childCount == 0) renderScan(it) } }

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
