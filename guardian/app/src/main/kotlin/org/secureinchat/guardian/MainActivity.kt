// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.net.VpnService
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.util.concurrent.ConcurrentHashMap
import org.secureinchat.guardian.dns.RulesText
import org.secureinchat.guardian.ui.Ui

/**
 * U2: four tabs instead of one long page. Protect is the home screen (one big status, one main button);
 * Activity is where blocked names are seen and false positives fixed; Check holds safety alerts and the
 * privacy checkup; Settings holds everything people rarely change. All text comes from string resources
 * (U1), so the app follows the phone's language (en, zh-CN, de, ja) or the per-app language on 13+.
 */
class MainActivity : Activity() {

    lateinit var ui: Ui
        private set
    private lateinit var tabs: List<Tab>
    private lateinit var content: FrameLayout
    private val barItems = mutableListOf<Pair<ImageView, TextView>>()
    private val barViews = mutableListOf<View>()
    private var current = 0
    private var showingIntro = false

    val uiHandler = Handler(Looper.getMainLooper())
    private val refreshTick = object : Runnable {
        override fun run() {
            refreshUi()
            uiHandler.postDelayed(this, 1000)
        }
    }

    private val pdnsOn = ConcurrentHashMap.newKeySet<Network>()
    private var cm: ConnectivityManager? = null
    private val pdnsCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onLinkPropertiesChanged(network: Network, lp: LinkProperties) {
            if (Build.VERSION.SDK_INT >= 28 && lp.isPrivateDnsActive) pdnsOn.add(network)
            else pdnsOn.remove(network)
        }
        override fun onLost(network: Network) { pdnsOn.remove(network) }
    }

    /** Private DNS on some network: queries may bypass Guardian. */
    val privateDnsOn: Boolean get() = pdnsOn.isNotEmpty()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ui = Ui(this)
        window.decorView.setBackgroundColor(ui.p.background)
        current = savedInstanceState?.getInt(STATE_TAB, 0) ?: 0
        tabs = listOf(ProtectTab(this), ActivityTab(this), CheckTab(this), SettingsTab(this))
        if (getPreferences(Context.MODE_PRIVATE).getBoolean(PREF_INTRO_DONE, false)) showMain() else showIntro()
        requestNotificationPermissionIfNeeded()
        registerPdnsCallback()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt(STATE_TAB, current)
    }

    override fun onResume() {
        super.onResume()
        // The user may have just changed Always-on in system settings.
        GuardianVpnService.refreshAlwaysOn()
        tabs.forEach { it.onResume() }
        uiHandler.post(refreshTick)
    }

    override fun onPause() { super.onPause(); uiHandler.removeCallbacks(refreshTick) }

    override fun onDestroy() {
        try { cm?.unregisterNetworkCallback(pdnsCallback) } catch (_: Throwable) {}
        super.onDestroy()
    }

    @Deprecated("Deprecated in Activity")
    override fun onBackPressed() {
        // Back from another tab goes home first, as in most tabbed apps.
        if (!showingIntro && current != 0) selectTab(0) else @Suppress("DEPRECATION") super.onBackPressed()
    }

    // --- Layout -------------------------------------------------------------------------------------

    private fun showIntro() {
        showingIntro = true
        val root = ui.vertical(24).apply { gravity = Gravity.CENTER_HORIZONTAL }
        root.addView(ImageView(this).apply {
            setImageDrawable(ui.tinted(R.drawable.ic_shield_on, ui.p.accent))
            contentDescription = null
            layoutParams = LinearLayout.LayoutParams(ui.dp(72), ui.dp(72)).apply { topMargin = ui.dp(24) }
        })
        root.addView(ui.title(getString(R.string.intro_title), 28f).apply {
            gravity = Gravity.CENTER
            layoutParams = ui.matchWidth(20)
        })
        // Three short promises, then one plain line on what it is not. Details live in Settings.
        val points = ui.vertical().apply { layoutParams = ui.matchWidth(28) }
        for (t in listOf(R.string.intro_point1, R.string.intro_point2, R.string.intro_point3)) {
            points.addView(LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                layoutParams = ui.matchWidth(14)
                addView(ImageView(this@MainActivity).apply {
                    setImageDrawable(ui.tinted(R.drawable.ic_tab_check, ui.p.accent))
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
                    layoutParams = LinearLayout.LayoutParams(ui.dp(24), ui.dp(24)).apply { marginEnd = ui.dp(12) }
                })
                addView(ui.body(getString(t), 17f))
            })
        }
        root.addView(points)
        root.addView(ui.caption(getString(R.string.intro_note)).apply {
            gravity = Gravity.CENTER
            layoutParams = ui.matchWidth(28)
        })
        // The text scrolls; the button stays pinned at the bottom so it is visible on any screen size.
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(ui.p.background)
        }
        page.addView(ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
            addView(root)
        })
        page.addView(ui.vertical(16).apply {
            setPadding(ui.dp(24), 0, ui.dp(24), ui.dp(16))
            addView(ui.primaryButton(getString(R.string.intro_start)) {
                getPreferences(Context.MODE_PRIVATE).edit().putBoolean(PREF_INTRO_DONE, true).apply()
                showMain()
            }.apply { layoutParams = ui.matchWidth(8) })
        })
        padForSystemBars(page)
        setContentView(page)
    }

    /** Settings → "How Guardian works" shows the intro again. */
    fun replayIntro() = showIntro()

    private fun showMain() {
        showingIntro = false
        val frame = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(ui.p.background)
        }
        content = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        frame.addView(content)
        frame.addView(buildBottomBar())
        padForSystemBars(frame)
        setContentView(frame)
        selectTab(current.coerceIn(0, tabs.lastIndex))
    }

    private fun buildBottomBar(): View {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(ui.p.surface)
            elevation = ui.dp(8).toFloat()
            setPadding(0, ui.dp(4), 0, ui.dp(4))
        }
        barItems.clear(); barViews.clear()
        val items = listOf(
            R.drawable.ic_tab_protect to R.string.tab_protect,
            R.drawable.ic_tab_activity to R.string.tab_activity,
            R.drawable.ic_tab_check to R.string.tab_check,
            R.drawable.ic_tab_settings to R.string.tab_settings,
        )
        for ((i, item) in items.withIndex()) {
            val label = getString(item.second)
            val icon = ImageView(this).apply {
                layoutParams = LinearLayout.LayoutParams(ui.dp(24), ui.dp(24))
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            val text = TextView(this).apply {
                this.text = label
                textSize = 12f
                gravity = Gravity.CENTER
                maxLines = 1
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            val cell = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                minimumHeight = ui.dp(56)
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                isClickable = true
                isFocusable = true
                contentDescription = label
                setOnClickListener { selectTab(i) }
                addView(icon); addView(text)
            }
            barItems += icon to text
            barViews += cell
            bar.addView(cell)
        }
        return bar
    }

    fun selectTab(i: Int) {
        if (showingIntro) return
        current = i
        content.removeAllViews()
        // After "How Guardian works" the old frame may still hold this view.
        (tabs[i].view.parent as? ViewGroup)?.removeView(tabs[i].view)
        content.addView(tabs[i].view)
        tabs[i].onShown()
        for ((j, pair) in barItems.withIndex()) {
            val selected = j == i
            val color = if (selected) ui.p.accent else ui.p.secondary
            pair.first.setImageDrawable(ui.tinted(listOf(
                R.drawable.ic_tab_protect, R.drawable.ic_tab_activity, R.drawable.ic_tab_check, R.drawable.ic_tab_settings
            )[j], color))
            pair.second.setTextColor(color)
            barViews[j].isSelected = selected
        }
        refreshUi()
    }

    /**
     * Target SDK 35+ draws edge to edge on Android 15+: content goes under the status bar and the
     * gesture/navigation bar. Pad the root by the system bars so the title and the bottom tabs stay
     * reachable (framework insets API).
     */
    private fun padForSystemBars(v: View) {
        // Before Android 15 this app's window is not edge to edge, so the system already insets it.
        if (Build.VERSION.SDK_INT < 35) return
        v.setOnApplyWindowInsetsListener { view, insets ->
            val bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() or android.view.WindowInsets.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        v.requestApplyInsets()
    }

    /** Shows a small count on the Check tab while there are safety alerts. */
    private fun refreshBadge() {
        if (barItems.size < 3) return
        val n = GuardianVpnService.recentSpywareAlerts().size
        val label = getString(R.string.tab_check)
        val text = if (n > 0) "$label ($n)" else label
        val tv = barItems[2].second
        if (tv.text.toString() != text) {
            tv.text = text
            // Starts with the tab name, so TalkBack users (and the emulator flow) still find "Check".
            barViews[2].contentDescription =
                if (n > 0) label + ", " + resources.getQuantityString(R.plurals.safety_alerts_count, n, n) else label
            tv.setTextColor(if (n > 0) ui.p.danger else if (current == 2) ui.p.accent else ui.p.secondary)
        }
    }

    fun refreshUi() {
        if (showingIntro || !::content.isInitialized) return
        tabs[current].refresh()
        refreshBadge()
    }

    /** Rules changed (allow, block, remove, import): every list rebuilds on the next refresh. */
    fun rulesChanged() {
        GuardianVpnService.applyUserRules(applicationContext)
        tabs.forEach { it.invalidate() }
        uiHandler.post { refreshUi() }
    }

    /** Encrypted DNS was changed outside Settings: keep its radio buttons in line. */
    fun dnsSettingChanged() {
        settings().syncDot()
        uiHandler.post { refreshUi() }
    }

    // --- Actions shared by tabs ---------------------------------------------------------------------

    fun onToggleClicked() {
        if (GuardianVpnService.isLoading) return
        if (GuardianVpnService.isRunning) {
            // Plain startService: the stop path never calls startForeground, and a
            // startForegroundService() call that is not followed by startForeground() within a
            // few seconds crashes with ForegroundServiceDidNotStartInTimeException.
            startService(Intent(this, GuardianVpnService::class.java).setAction(GuardianVpnService.ACTION_STOP))
        } else {
            val prep = VpnService.prepare(this)
            if (prep != null) {
                @Suppress("DEPRECATION")
                startActivityForResult(prep, REQ_VPN_PREPARE)
            } else {
                startVpnService()
            }
        }
        uiHandler.postDelayed({ refreshUi() }, 200)
    }

    fun onPauseResumeClicked() {
        val h = GuardianVpnService.activeHandler ?: return
        val action = if (h.isPaused()) GuardianVpnService.ACTION_RESUME else GuardianVpnService.ACTION_PAUSE
        startService(Intent(this, GuardianVpnService::class.java).setAction(action))
        // The service handles the action asynchronously; refresh soon so the button/status catch up.
        uiHandler.postDelayed({ refreshUi() }, 200)
    }

    private fun startVpnService() {
        startForegroundService(Intent(this, GuardianVpnService::class.java).setAction(GuardianVpnService.ACTION_START))
    }

    fun openUrl(url: String) {
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: ActivityNotFoundException) {}
    }

    /** Returns false when no screen could be opened, so the caller can show where to look instead. */
    fun tryStart(i: Intent): Boolean = try { startActivity(i); true } catch (_: ActivityNotFoundException) { false }

    // ACTION_CREATE_DOCUMENT opens the system picker in "save as" mode. The app never touches the file
    // path itself; it only receives a content Uri back and streams into it.
    fun onExportClicked(): Boolean = try {
        val i = Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_TITLE, "guardian-rules.txt")
        @Suppress("DEPRECATION")
        startActivityForResult(i, REQ_EXPORT)
        true
    } catch (_: ActivityNotFoundException) { false }

    // Same picker in "open" mode. Some file managers report .txt as application/octet-stream, so the
    // accepted types are widened rather than trusting the name.
    fun onImportClicked(): Boolean = try {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("text/plain", "text/*", "application/octet-stream"))
        @Suppress("DEPRECATION")
        startActivityForResult(i, REQ_IMPORT)
        true
    } catch (_: ActivityNotFoundException) { false }

    private fun handleExportResult(uri: Uri?) {
        if (uri == null) return
        try {
            val text = RulesText.format(UserRulesStore.blocked(this), UserRulesStore.allowed(this))
            // "wt" truncates, so re-exporting over an existing file does not leave trailing bytes.
            contentResolver.openOutputStream(uri, "wt").use { out ->
                if (out == null) throw IllegalStateException("no output stream")
                out.write(text.toByteArray(Charsets.UTF_8))
            }
            settings().showRulesIoError(null)
        } catch (_: Throwable) {
            settings().showRulesIoError(getString(R.string.rules_io_write_failed))
        }
    }

    private fun handleImportResult(uri: Uri?) {
        if (uri == null) return
        // Read at most MAX_BYTES so a wrong pick (a video, an APK) cannot tie up the main thread.
        val text: String? = try {
            contentResolver.openInputStream(uri)?.use { input ->
                val buf = ByteArray(RulesText.MAX_BYTES)
                var total = 0
                while (total < buf.size) {
                    val n = input.read(buf, total, buf.size - total)
                    if (n <= 0) break
                    total += n
                }
                String(buf, 0, total, Charsets.UTF_8)
            }
        } catch (_: Throwable) { null }
        if (text == null) {
            settings().showRulesIoError(getString(R.string.rules_io_read_failed))
            return
        }
        val parsed = RulesText.parse(text)
        val summary = getString(R.string.import_summary, parsed.blocked.size, parsed.allowed.size, parsed.skipped)
        // Merge keeps the existing rules and lets imported entries replace the current choice for a
        // domain; Replace discards the current lists entirely.
        AlertDialog.Builder(this)
            .setTitle(R.string.import_rules)
            .setMessage(summary)
            .setPositiveButton(R.string.import_merge) { _, _ -> applyImport(parsed, merge = true) }
            .setNeutralButton(R.string.import_replace) { _, _ -> applyImport(parsed, merge = false) }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun applyImport(parsed: RulesText.ParseResult, merge: Boolean) {
        if (merge) UserRulesStore.mergeIn(this, parsed.blocked, parsed.allowed)
        else UserRulesStore.replaceAll(this, parsed.blocked, parsed.allowed)
        settings().showRulesIoError(null)
        rulesChanged()
    }

    private fun settings(): SettingsTab = tabs[3] as SettingsTab

    @Deprecated("Deprecated in Activity, unavoidable without AndroidX")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        // Picker cancels and a denied VPN consent both arrive with RESULT_CANCELED; nothing to do.
        if (resultCode != RESULT_OK) return
        when (requestCode) {
            REQ_VPN_PREPARE -> startVpnService()
            REQ_EXPORT -> handleExportResult(data?.data)
            REQ_IMPORT -> handleImportResult(data?.data)
        }
    }

    private fun registerPdnsCallback() {
        try {
            val c = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            cm = c
            val req = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
                .build()
            c.registerNetworkCallback(req, pdnsCallback)
        } catch (_: Throwable) {}
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIF)
        }
    }

    companion object {
        private const val REQ_VPN_PREPARE = 100
        private const val REQ_NOTIF = 101
        private const val REQ_EXPORT = 102
        private const val REQ_IMPORT = 103
        private const val STATE_TAB = "tab"
        private const val PREF_INTRO_DONE = "intro_done"

        /**
         * The screen refreshes every second; setting identical text still re-lays out the view, which
         * keeps the window from ever being idle (wasted work, and UI tests cannot read the screen).
         */
        fun setIfChanged(view: TextView, value: CharSequence) {
            if (view.text.toString() != value.toString()) view.text = value
        }

        fun showIf(view: View, visible: Boolean) {
            val v = if (visible) View.VISIBLE else View.GONE
            if (view.visibility != v) view.visibility = v
        }
    }
}

/** One of the four screens. Built once; [refresh] runs every second while it is visible. */
abstract class Tab(val a: MainActivity) {
    protected val ui get() = a.ui
    protected val p get() = a.ui.p

    val view: View by lazy {
        ScrollView(a).apply {
            setBackgroundColor(p.background)
            isFillViewport = true
            addView(ui.vertical(16).apply { build(this) })
        }
    }

    protected abstract fun build(root: LinearLayout)
    abstract fun refresh()
    open fun onShown() {}
    open fun onResume() {}
    /** Forget cached signatures so lists rebuild on the next refresh. */
    open fun invalidate() {}

    protected fun s(id: Int, vararg args: Any): String = a.getString(id, *args)
}
