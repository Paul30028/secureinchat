// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.TextView
import org.secureinchat.guardian.MainActivity.Companion.setIfChanged
import org.secureinchat.guardian.MainActivity.Companion.showIf
import org.secureinchat.guardian.dns.DotProvider
import org.secureinchat.guardian.dns.DotProviders

/** Everything people rarely change, grouped: blocking, encrypted DNS, own rules, start-up, language, about. */
class SettingsTab(a: MainActivity) : Tab(a) {
    private lateinit var levelGroup: RadioGroup
    private lateinit var levelStatus: TextView
    private var settingLevel = false
    private lateinit var dotStatus: TextView
    private var dotChoice: DotProvider? = null
    private lateinit var rulesLine: TextView
    private lateinit var input: EditText
    private lateinit var inputError: TextView
    private lateinit var blockedBox: LinearLayout
    private lateinit var allowedBox: LinearLayout
    private lateinit var ioError: TextView
    private lateinit var alwaysOnLine: TextView
    private lateinit var alwaysOnError: TextView
    private var blockedSig = ""
    private var allowedSig = ""
    private var built = false

    override fun build(root: LinearLayout) {
        root.addView(ui.title(s(R.string.tab_settings)))

        // --- Blocking strength (G13) ---
        root.addView(ui.card(16).apply {
            addView(ui.section(s(R.string.blocking_strength)))
            levelGroup = RadioGroup(a).apply { orientation = RadioGroup.VERTICAL; layoutParams = ui.matchWidth(4) }
            for ((key, label) in listOf("light" to R.string.level_light, "normal" to R.string.level_standard, "pro" to R.string.level_strict)) {
                levelGroup.addView(radio(s(label), key))
            }
            levelGroup.setOnCheckedChangeListener { g, id ->
                if (settingLevel) return@setOnCheckedChangeListener
                val level = g.findViewById<RadioButton>(id)?.tag as? String ?: return@setOnCheckedChangeListener
                UserRulesStore.setLevel(a, level)
                GuardianVpnService.applyLevel(a.applicationContext)
                a.uiHandler.post { a.refreshUi() }
            }
            addView(levelGroup)
            levelStatus = ui.caption()
            addView(levelStatus)
        })

        // --- Encrypted DNS (G18) ---
        dotChoice = DnsSettingsStore.provider(a)
        root.addView(ui.card(12).apply {
            addView(ui.section(s(R.string.encrypted_dns)))
            addView(ui.caption(s(R.string.encrypted_dns_explain)).apply { layoutParams = ui.matchWidth(4) })
            val group = RadioGroup(a).apply { orientation = RadioGroup.VERTICAL; layoutParams = ui.matchWidth(4) }
            val options = listOf<DotProvider?>(null) + DotProviders.ALL
            for ((i, prov) in options.withIndex()) {
                val label = if (prov == null) s(R.string.dot_off_default) else "${prov.label}: " + providerAbout(prov)
                group.addView(radio(label, i).apply { isChecked = prov?.id == dotChoice?.id })
            }
            group.setOnCheckedChangeListener { g, id ->
                val idx = g.findViewById<View>(id)?.tag as? Int ?: return@setOnCheckedChangeListener
                val prov = options[idx]
                if (prov?.id == dotChoice?.id) return@setOnCheckedChangeListener
                dotChoice = prov
                DnsSettingsStore.setProvider(a, prov?.id)
                // Closing the old client can wait on an in-flight query, so not on the UI thread.
                Thread { GuardianVpnService.applyDnsSetting(a.applicationContext) }.apply { name = "guardian-dns-setting" }.start()
                a.uiHandler.post { a.refreshUi() }
            }
            addView(group)
            dotStatus = ui.caption().apply { layoutParams = ui.matchWidth(4) }
            addView(dotStatus)
        })

        // --- Your rules (G3b, G8, G10) ---
        root.addView(ui.card(12).apply {
            addView(ui.section(s(R.string.your_rules)))
            rulesLine = ui.caption().apply { layoutParams = ui.matchWidth(4) }
            addView(rulesLine)

            addView(ui.body(s(R.string.blocked_by_you)).apply { layoutParams = ui.matchWidth(12) })
            val addRow = LinearLayout(a).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
            input = EditText(a).apply {
                hint = "example.com"
                // contentDescription: what TalkBack reads and what the emulator flow looks for.
                contentDescription = s(R.string.domain_to_block)
                inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
                imeOptions = EditorInfo.IME_ACTION_DONE
                isSingleLine = true
                setTextColor(p.text)
                setHintTextColor(p.secondary)
                minHeight = ui.dp(48)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                setOnEditorActionListener { _, actionId, _ ->
                    if (actionId == EditorInfo.IME_ACTION_DONE) { submitBlocked(); true } else false
                }
            }
            addRow.addView(input)
            addRow.addView(ui.textButton(s(R.string.block)) { submitBlocked() })
            addView(addRow)
            inputError = ui.caption(s(R.string.not_a_valid_domain)).apply { setTextColor(p.danger); visibility = View.GONE }
            addView(inputError)
            blockedBox = ui.vertical()
            addView(blockedBox)

            addView(ui.body(s(R.string.allowed_by_you)).apply { layoutParams = ui.matchWidth(12) })
            allowedBox = ui.vertical()
            addView(allowedBox)

            val io = LinearLayout(a).apply { orientation = LinearLayout.HORIZONTAL; layoutParams = ui.matchWidth(8) }
            io.addView(ui.textButton(s(R.string.export_rules)) {
                if (a.onExportClicked()) showRulesIoError(null) else showRulesIoError(s(R.string.rules_io_no_picker))
            })
            io.addView(ui.textButton(s(R.string.import_rules)) {
                if (a.onImportClicked()) showRulesIoError(null) else showRulesIoError(s(R.string.rules_io_no_picker))
            })
            addView(io)
            ioError = ui.caption().apply { setTextColor(p.danger); visibility = View.GONE }
            addView(ioError)
        })

        // --- Start automatically (G9) ---
        root.addView(ui.card(12).apply {
            addView(ui.section(s(R.string.start_automatically)))
            alwaysOnLine = ui.caption().apply { visibility = View.GONE; layoutParams = ui.matchWidth(4) }
            addView(alwaysOnLine)
            addView(ui.caption(s(R.string.always_on_explain)).apply { layoutParams = ui.matchWidth(4) })
            addView(ui.textButton(s(R.string.always_on_button)) {
                showIf(alwaysOnError, !a.tryStart(Intent(Settings.ACTION_VPN_SETTINGS)))
            })
            alwaysOnError = ui.caption(s(R.string.always_on_fallback)).apply { visibility = View.GONE }
            addView(alwaysOnError)
        })

        // --- Language (U1) ---
        root.addView(ui.card(12).apply {
            addView(ui.section(s(R.string.language)))
            if (Build.VERSION.SDK_INT >= 33) {
                addView(ui.caption(s(R.string.language_explain_13)).apply { layoutParams = ui.matchWidth(4) })
                addView(ui.textButton(s(R.string.language_button)) {
                    a.tryStart(Intent(Settings.ACTION_APP_LOCALE_SETTINGS).setData(Uri.parse("package:" + a.packageName)))
                })
            } else {
                addView(ui.caption(s(R.string.language_explain_old)).apply { layoutParams = ui.matchWidth(4) })
            }
            addView(ui.caption(s(R.string.translation_note)).apply { layoutParams = ui.matchWidth(8) })
        })

        // --- About ---
        root.addView(ui.card(12).apply {
            addView(ui.section(s(R.string.about)))
            addView(ui.caption(s(R.string.about_body)).apply { layoutParams = ui.matchWidth(4) })
            addView(ui.textButton(s(R.string.how_it_works)) { a.replayIntro() })
            // G15: Exodus tracker data (ODbL v1.0 / DbCL v1.0). Opens the browser; Guardian makes no call.
            addView(ui.textButton(s(R.string.credit_exodus)) { a.openUrl("https://exodus-privacy.eu.org/") }.apply { textSize = 12f })
            addView(ui.textButton(s(R.string.credit_echap)) {
                a.openUrl("https://github.com/AssoEchap/stalkerware-indicators")
            }.apply { textSize = 12f })
        })
        built = true
    }

    private fun providerAbout(prov: DotProvider): String = when (prov.id) {
        "quad9" -> s(R.string.dot_quad9_about)
        "cloudflare" -> s(R.string.dot_cloudflare_about)
        else -> prov.about
    }

    private fun radio(label: String, tag: Any): RadioButton = RadioButton(a).apply {
        id = View.generateViewId()
        text = label
        this.tag = tag
        textSize = 14f
        setTextColor(p.text)
        minHeight = ui.dp(48)
        buttonTintList = android.content.res.ColorStateList.valueOf(p.accent)
    }

    private fun submitBlocked() {
        if (!UserRulesStore.addBlocked(a, input.text?.toString().orEmpty())) {
            showIf(inputError, true)
            return
        }
        input.setText("")
        showIf(inputError, false)
        a.rulesChanged()
    }

    fun showRulesIoError(message: String?) {
        if (!built) return
        showIf(ioError, message != null)
        if (message != null) setIfChanged(ioError, message)
    }

    override fun onResume() { if (built) syncLevel() }
    override fun onShown() { syncLevel() }

    // Setting isChecked fires the listener, so the flag short-circuits it while syncing from storage.
    private fun syncLevel() {
        val level = UserRulesStore.level(a)
        settingLevel = true
        try {
            for (i in 0 until levelGroup.childCount) {
                val rb = levelGroup.getChildAt(i) as? RadioButton ?: continue
                val match = (rb.tag as? String) == level
                if (rb.isChecked != match) rb.isChecked = match
            }
        } finally { settingLevel = false }
    }

    override fun refresh() {
        val running = GuardianVpnService.isRunning
        setIfChanged(levelStatus, if (GuardianVpnService.isLoading) s(R.string.status_loading) else "")
        showIf(levelStatus, GuardianVpnService.isLoading)
        renderDot(running)

        val h = GuardianVpnService.activeHandler
        val userAllowed = UserRulesStore.allowed(a).size
        val userBlocked = UserRulesStore.blocked(a).size
        // "N allowed by you" / "N blocked by you" are matched by the emulator flow.
        setIfChanged(rulesLine, if (h != null) s(R.string.rules_line, h.blocklist.blockedCount, userAllowed, userBlocked)
            else s(R.string.rules_line_off, userAllowed, userBlocked))
        renderList(blockedBox, UserRulesStore.blocked(a).sorted(), blockedSig, true).also { blockedSig = it }
        renderList(allowedBox, UserRulesStore.allowed(a).sorted(), allowedSig, false).also { allowedSig = it }

        val on = GuardianVpnService.alwaysOn
        showIf(alwaysOnLine, on != null)
        if (on != null) {
            var t = if (on) s(R.string.always_on_on) else s(R.string.always_on_off)
            if (GuardianVpnService.lockdown == true) t += s(R.string.always_on_lockdown)
            setIfChanged(alwaysOnLine, t)
        }
    }

    private fun renderList(box: LinearLayout, items: List<String>, oldSig: String, blocked: Boolean): String {
        // "#" prefix: an empty list must differ from the "" that invalidate() writes.
        val sig = "#" + items.joinToString(",")
        if (sig == oldSig) return oldSig
        box.removeAllViews()
        if (items.isEmpty()) { box.addView(ui.empty(s(R.string.none))); return sig }
        for (d in items) {
            val remove = ui.textButton(s(R.string.remove)) {
                if (blocked) UserRulesStore.removeBlocked(a, d) else UserRulesStore.remove(a, d)
                a.rulesChanged()
            }.apply { contentDescription = s(R.string.remove_domain, d) }
            box.addView(ui.row(d, emptyList(), remove))
        }
        return sig
    }

    // Says plainly when the chosen provider cannot be reached, because lookups then fail.
    private fun renderDot(running: Boolean) {
        val prov = dotChoice
        val st = GuardianVpnService.dotState
        val text = when {
            prov == null -> s(R.string.dot_status_off)
            !running -> s(R.string.dot_status_idle, prov.label)
            st == null || st.hostname != prov.tlsName || st.connected == null -> s(R.string.dot_status_unused, prov.label)
            st.connected -> s(R.string.dot_status_connected, prov.label)
            else -> s(R.string.dot_status_down, prov.label) + (st.reason?.let { "\n" + s(R.string.dot_reason, it) } ?: "")
        }
        setIfChanged(dotStatus, text)
        val red = running && prov != null && st != null && st.connected == false
        dotStatus.setTextColor(if (red) p.danger else p.secondary)
    }

    override fun invalidate() { blockedSig = ""; allowedSig = "" }
}
