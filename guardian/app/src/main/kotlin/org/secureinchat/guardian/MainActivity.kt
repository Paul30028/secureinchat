// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
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
import android.provider.Settings
import android.text.InputType
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import org.secureinchat.guardian.dns.Blocklist
import org.secureinchat.guardian.dns.LogEntry
import org.secureinchat.guardian.dns.QueryHandler
import org.secureinchat.guardian.dns.RulesText
import org.secureinchat.guardian.dns.Tracker
import org.secureinchat.guardian.dns.TrackerDb

class MainActivity : Activity() {

    private lateinit var statusView: TextView
    private lateinit var alwaysOnView: TextView
    private lateinit var alwaysOnError: TextView
    private lateinit var statsView: TextView
    private lateinit var historyView: TextView
    private lateinit var rulesView: TextView
    private lateinit var logView: TextView
    private lateinit var hintView: TextView
    private lateinit var toggleBtn: Button
    private lateinit var pauseBtn: Button
    private lateinit var appListContainer: LinearLayout
    private lateinit var blockedListContainer: LinearLayout
    private lateinit var allowedListContainer: LinearLayout

    // The "Block by you" input is only rebuilt when the activity is created, so its text and error
    // state survive the 1 Hz refresh; refreshUi() never touches these views.
    private lateinit var addBlockedInput: EditText
    private lateinit var addBlockedBtn: Button
    private lateinit var addBlockedError: TextView
    // Only shown when an export/import fails or the document picker cannot be opened; cleared on
    // the next successful action. A TextView rather than a Toast so it does not disappear before
    // the user can read it (and so the emulator flow can find it).
    private lateinit var rulesIoError: TextView

    // G13: blocking strength radio group. The flag prevents the OnCheckedChangeListener from
    // firing back to storage when refreshUi/onResume syncs the buttons from prefs.
    private lateinit var levelGroup: RadioGroup
    private var settingLevelProgrammatically = false

    private var appListSignature: String = ""
    private var blockedSignature: String = ""
    private var allowedSignature: String = ""
    private var appListBuiltAt = 0L
    // G12: signature so the "Blocked today" row is only re-rendered when its numbers change.
    private var historySignature: String = ""

    private val uiHandler = Handler(Looper.getMainLooper())
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        requestNotificationPermissionIfNeeded()
        registerPdnsCallback()
    }

    override fun onResume() {
        super.onResume()
        // The user may have just changed Always-on in system settings.
        GuardianVpnService.refreshAlwaysOn()
        // G13: if the stored level changed elsewhere (or a reload fell back to light on error),
        // bring the radio buttons back in line. Runs after onCreate, so it also covers the first
        // frame.
        syncLevelRadio()
        uiHandler.post(refreshTick)
    }
    override fun onPause() { super.onPause(); uiHandler.removeCallbacks(refreshTick) }

    override fun onDestroy() {
        try { cm?.unregisterNetworkCallback(pdnsCallback) } catch (_: Throwable) {}
        super.onDestroy()
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
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIF)
            }
        }
    }

    private fun buildUi() {
        val density = resources.displayMetrics.density
        val pad = (16 * density).toInt()
        val small = (8 * density).toInt()

        val root = LinearLayout(this)
        root.orientation = LinearLayout.VERTICAL
        root.setPadding(pad, pad, pad, pad)

        root.addView(TextView(this).apply {
            text = "Guardian"
            textSize = 22f
        })

        statusView = TextView(this).apply { textSize = 16f }
        root.addView(statusView)

        // Always-on row: shown only when the service can answer (running, API 29+); no placeholder.
        alwaysOnView = TextView(this).apply {
            textSize = 13f
            visibility = View.GONE
        }
        root.addView(alwaysOnView)

        toggleBtn = Button(this).apply { setOnClickListener { onToggleClicked() } }
        root.addView(toggleBtn)

        // Only shown when the VPN is actually running; MainActivity is where users go to pause for a
        // few minutes without stopping the whole session. The notification and the tile also expose
        // the Resume side of the state.
        pauseBtn = Button(this).apply {
            visibility = View.GONE
            setOnClickListener { onPauseResumeClicked() }
        }
        root.addView(pauseBtn)

        // G13: blocking strength. Radio buttons rather than a spinner: three options fit on screen
        // and each one needs a one-line description the user can compare. The chosen tier is saved
        // immediately; GuardianVpnService.applyLevel reloads the asset in the background if the VPN
        // is running, otherwise it takes effect on the next start.
        root.addView(TextView(this).apply {
            textSize = 14f
            text = txt("Blocking strength", "拦截强度")
            setPadding(0, pad / 2, 0, pad / 4)
        })
        val levelKeys = arrayOf("light", "normal", "pro")
        val levelLabels = arrayOf(
            txt("Light — fewest broken sites (default)", "轻度——最少误拦(默认)"),
            txt("Standard — more trackers blocked", "标准——拦得更多"),
            txt(
                "Strict — most blocked; some sites or apps may break, use Allow to fix",
                "严格——拦得最多;个别网站或应用可能出问题,可用「放行」修复"
            )
        )
        levelGroup = RadioGroup(this).apply { orientation = RadioGroup.VERTICAL }
        for (i in levelKeys.indices) {
            levelGroup.addView(RadioButton(this).apply {
                text = levelLabels[i]
                textSize = 13f
                tag = levelKeys[i]
            })
        }
        levelGroup.setOnCheckedChangeListener { _, checkedId ->
            if (settingLevelProgrammatically) return@setOnCheckedChangeListener
            val rb = levelGroup.findViewById<RadioButton>(checkedId) ?: return@setOnCheckedChangeListener
            val level = rb.tag as? String ?: return@setOnCheckedChangeListener
            UserRulesStore.setLevel(this, level)
            GuardianVpnService.applyLevel(applicationContext)
            uiHandler.post { refreshUi() }
        }
        root.addView(levelGroup)

        statsView = TextView(this).apply {
            textSize = 14f
            typeface = Typeface.MONOSPACE
            setPadding(0, pad / 2, 0, 0)
        }
        root.addView(statsView)

        // G12: per-day block history, read from storage so it is shown even when the VPN is stopped.
        // The in-session "Blocked: N" counter above resets on every service start; this does not.
        historyView = TextView(this).apply {
            textSize = 13f
            setPadding(0, pad / 4, 0, 0)
        }
        root.addView(historyView)
        // G21: say what the durable numbers are (and are not) right under the row they explain.
        // StatsStore stores one integer per day and drops entries older than seven days.
        root.addView(TextView(this).apply {
            textSize = 12f
            text = getString(R.string.history_policy_note)
        })

        rulesView = TextView(this).apply {
            textSize = 13f
            setPadding(0, pad / 4, 0, 0)
        }
        root.addView(rulesView)

        hintView = TextView(this).apply {
            textSize = 13f
            setTextColor(0xFFFF8800.toInt())
            visibility = View.GONE
            setPadding(0, pad / 2, 0, 0)
        }
        root.addView(hintView)

        // G21: the total explanation replaces the old "No logs are saved", which wrongly suggested
        // that Guardian never keeps anything and said nothing about where allowed queries go.
        val privacy = TextView(this).apply {
            textSize = 12f
            text = getString(R.string.data_boundary_note)
            setPadding(0, pad / 2, 0, 0)
        }
        root.addView(privacy)

        // G21: the log is a 200-entry ring in QueryHandler; only the latest 10 are drawn. Say both
        // facts next to the log rather than leaving "No logs" to be misread as "nothing is kept".
        root.addView(TextView(this).apply {
            textSize = 12f
            text = getString(R.string.recent_queries_note)
            setPadding(0, pad / 2, 0, 0)
        })

        logView = TextView(this).apply {
            textSize = 12f
            typeface = Typeface.MONOSPACE
            setPadding(0, pad, 0, 0)
        }
        root.addView(logView)

        root.addView(TextView(this).apply {
            textSize = 16f
            text = txt("Blocked most often", "拦截最多的域名")
            setPadding(0, pad, 0, pad / 4)
        })
        appListContainer = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(appListContainer)

        // --- Blocked by you ---------------------------------------------------
        root.addView(TextView(this).apply {
            textSize = 16f
            text = txt("Blocked by you", "你拦截的")
            setPadding(0, pad, 0, pad / 4)
        })

        val addRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
        }
        addBlockedInput = EditText(this).apply {
            hint = "example.com"
            // contentDescription is what `adb shell input text` and most UI tools pick up; the
            // emulator script types into the focused EditText, but having this makes the field
            // discoverable for "input text" without needing the specific view id.
            contentDescription = "Domain to block"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            imeOptions = EditorInfo.IME_ACTION_DONE
            maxLines = 1
            isSingleLine = true
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_DONE) {
                    submitBlockedDomain()
                    true
                } else {
                    false
                }
            }
        }
        addBlockedBtn = Button(this).apply {
            text = txt("Block", "拦截")
            textSize = 12f
            setOnClickListener { submitBlockedDomain() }
        }
        addRow.addView(addBlockedInput)
        addRow.addView(addBlockedBtn)
        root.addView(addRow)

        addBlockedError = TextView(this).apply {
            textSize = 12f
            setTextColor(0xFFFF4444.toInt())
            visibility = View.GONE
            text = txt("Not a valid domain", "不是有效的域名")
            setPadding(0, pad / 4, 0, 0)
        }
        root.addView(addBlockedError)

        blockedListContainer = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(blockedListContainer)

        // --- Allowed by you ---------------------------------------------------
        root.addView(TextView(this).apply {
            textSize = 16f
            text = txt("Allowed by you", "你放行的")
            setPadding(0, pad, 0, pad / 4)
        })
        allowedListContainer = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(allowedListContainer)

        // --- Export / import (G10) -------------------------------------------
        // Two side-by-side buttons; a full-width row each would push the Always-on controls further
        // down for no benefit. Both pick a file through the Storage Access Framework, so no storage
        // permission is needed and nothing is written into the app's private directory.
        val ioRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, pad / 2, 0, 0)
        }
        ioRow.addView(Button(this).apply {
            text = txt("Export rules", "导出规则")
            textSize = 12f
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnClickListener { onExportClicked() }
        })
        ioRow.addView(Button(this).apply {
            text = txt("Import rules", "导入规则")
            textSize = 12f
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnClickListener { onImportClicked() }
        })
        root.addView(ioRow)

        rulesIoError = TextView(this).apply {
            textSize = 12f
            setTextColor(0xFFFF4444.toInt())
            visibility = View.GONE
            setPadding(0, pad / 4, 0, 0)
        }
        root.addView(rulesIoError)

        // G21: clearing the durable history asks first. The dialog names exactly what is deleted
        // (the on-device daily totals) and what is not (custom rules, the in-memory recent queries),
        // with Cancel as the safe default.
        root.addView(Button(this).apply {
            text = getString(R.string.clear_block_history)
            textSize = 12f
            setOnClickListener { onClearHistoryClicked() }
        })

        // --- Privacy checkup (G16) -------------------------------------------
        // Three quick checks, each of which opens a system settings screen. This block reads and
        // changes nothing: every button is only shown if its intent actually resolves (checked with
        // resolveActivity), so the app never shows a control that would do nothing.
        root.addView(TextView(this).apply {
            textSize = 16f
            text = txt("Privacy checkup", "隐私快速检查")
            setPadding(0, pad, 0, pad / 4)
        })
        addPrivacyRow(
            parent = root,
            pad = pad,
            titleEn = "Delete your advertising ID",
            titleZh = "删除广告 ID",
            descEn = "Apps use the advertising ID to link your activity across apps. On Android 12 and later, deleting it gives apps a blank ID.",
            descZh = "广告 ID 让各个 App 把你的行为串起来；Android 12 及以上删除后，App 拿到的是空白 ID。",
            candidates = listOf(
                Intent("com.google.android.gms.settings.ADS_PRIVACY"),
                Intent(Settings.ACTION_PRIVACY_SETTINGS)
            ),
            buttonEn = "Open ad settings",
            buttonZh = "打开广告设置",
            fallbackEn = "Search Settings for \"Ads\"",
            fallbackZh = "在系统设置里搜索\"广告\""
        )
        // Only the documented location-settings action; per-app precise/approximate is chosen from there.
        val locationCandidates = listOf(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
        addPrivacyRow(
            parent = root,
            pad = pad,
            titleEn = "Precise location",
            titleZh = "精确位置",
            descEn = "Apps with precise location can know where you are to within a few metres. Many work fine with approximate location.",
            descZh = "有精确位置权限的 App 能把你的位置精确到几米。很多 App 用大致位置就够了。",
            candidates = locationCandidates,
            buttonEn = "Open location settings",
            buttonZh = "打开位置设置",
            fallbackEn = "Search Settings for \"Location\"",
            fallbackZh = "在系统设置里搜索\"位置\""
        )
        addPrivacyRow(
            parent = root,
            pad = pad,
            titleEn = "Review app permissions",
            titleZh = "检查应用权限",
            descEn = "Open an app to see its permissions. On Android 11 and later you can also turn on removing permissions if the app is not used.",
            descZh = "打开某个 App 可查看它的权限；Android 11 及以上还可开启「App 未使用时移除权限」。",
            candidates = listOf(Intent(Settings.ACTION_APPLICATION_SETTINGS)),
            buttonEn = "Open app settings",
            buttonZh = "打开应用设置",
            fallbackEn = "Search Settings for \"Apps\"",
            fallbackZh = "在系统设置里搜索\"应用\""
        )

        // A little slack at the bottom so the last row is not glued to the scroll edge.
        // --- Always-on VPN (G9) ---------------------------------------------
        // At the bottom so the controls people use daily keep their place.
        root.addView(Button(this).apply {
            text = txt("Always-on VPN settings", "始终开启设置")
            textSize = 13f
            setOnClickListener { openVpnSettings() }
        })
        root.addView(TextView(this).apply {
            textSize = 12f
            text = txt(
                "In system settings, tap the gear next to Guardian and turn on Always-on VPN. Android then restarts Guardian after a reboot.",
                "在系统设置里点 Guardian 旁边的齿轮,打开「始终开启的 VPN」。之后手机重启时 Android 会自动启动 Guardian。"
            )
        })
        alwaysOnError = TextView(this).apply {
            textSize = 12f
            visibility = View.GONE
            text = txt("Open Settings > Network > VPN", "请打开 设置 > 网络 > VPN")
        }
        root.addView(alwaysOnError)

        // G15: attribution for the Exodus tracker data (ODbL v1.0 / DbCL v1.0). The link opens in
        // the user's browser via ACTION_VIEW; Guardian itself makes no network call here.
        root.addView(TextView(this).apply {
            textSize = 10f
            setTextColor(0xFF0088CC.toInt())
            text = txt("Tracker names: Exodus Privacy (ODbL)", "追踪者名称来自 Exodus Privacy(ODbL)")
            setPadding(0, pad / 2, 0, 0)
            setOnClickListener {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://exodus-privacy.eu.org/")))
                } catch (_: ActivityNotFoundException) {}
            }
        })

        root.addView(View(this).apply { minimumHeight = small })

        setContentView(ScrollView(this).apply { addView(root) })
    }

    private fun submitBlockedDomain() {
        val raw = addBlockedInput.text?.toString().orEmpty()
        val ok = UserRulesStore.addBlocked(this, raw)
        if (!ok) {
            addBlockedError.visibility = View.VISIBLE
            return
        }
        addBlockedInput.setText("")
        addBlockedError.visibility = View.GONE
        GuardianVpnService.applyUserRules(applicationContext)
        // Clear signatures so the list is rebuilt on the next refresh even if it is inside the
        // 5 s throttle window used for the "blocked most often" list.
        blockedSignature = ""
        allowedSignature = ""
        appListSignature = ""
        uiHandler.post { refreshUi() }
    }

    private fun openVpnSettings() {
        try {
            startActivity(Intent(Settings.ACTION_VPN_SETTINGS))
            alwaysOnError.visibility = View.GONE
        } catch (_: ActivityNotFoundException) {
            alwaysOnError.visibility = View.VISIBLE
        }
    }

    // G21: deleting the durable history is confirmed first. Only StatsStore changes here: the
    // in-session "Blocked: N" counter and the in-memory recent queries keep their values, and rule
    // storage is not touched. Cancel is the default focus, so the destructive button needs a
    // deliberate second action.
    private fun onClearHistoryClicked() {
        val dialog = AlertDialog.Builder(this)
            .setTitle(getString(R.string.clear_history_title))
            .setMessage(getString(R.string.clear_history_message))
            .setPositiveButton(getString(R.string.clear_history_confirm)) { _, _ ->
                StatsStore.clear(this)
                historySignature = ""
                uiHandler.post { refreshUi() }
            }
            .setNegativeButton(getString(R.string.cancel), null)
            .setCancelable(true)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE)?.requestFocus()
        }
        dialog.show()
    }

    // G16: return the first candidate intent the system can actually handle, or null. resolveActivity
    // covers both cases that make a settings screen unreachable: the API level is too low, or the
    // OEM removed that screen. Wrapped in try/catch because a malformed action string would make
    // resolveActivity throw on some old platforms.
    private fun firstResolvable(candidates: List<Intent>): Intent? {
        for (i in candidates) {
            try {
                if (i.resolveActivity(packageManager) != null) return i
            } catch (_: Throwable) {}
        }
        return null
    }

    // G16: one privacy row is a title, a one-sentence explanation, and either a button that opens
    // the first resolvable settings screen or (if none resolve) a plain hint telling the user where
    // to look in Settings. A row with an unreachable screen still shows its explanation; only the
    // button is hidden, so the checkup never lies about what it can do.
    private fun addPrivacyRow(
        parent: LinearLayout,
        pad: Int,
        titleEn: String,
        titleZh: String,
        descEn: String,
        descZh: String,
        candidates: List<Intent>,
        buttonEn: String,
        buttonZh: String,
        fallbackEn: String,
        fallbackZh: String
    ) {
        parent.addView(TextView(this).apply {
            textSize = 14f
            text = txt(titleEn, titleZh)
            setPadding(0, pad, 0, pad / 4)
        })
        parent.addView(TextView(this).apply {
            textSize = 12f
            text = txt(descEn, descZh)
        })
        val target = firstResolvable(candidates)
        if (target != null) {
            parent.addView(Button(this).apply {
                text = txt(buttonEn, buttonZh)
                textSize = 12f
                setOnClickListener {
                    try { startActivity(target) } catch (_: ActivityNotFoundException) {}
                }
            })
        } else {
            parent.addView(TextView(this).apply {
                textSize = 12f
                text = txt(fallbackEn, fallbackZh)
                setPadding(0, pad / 4, 0, 0)
            })
        }
    }

    // ACTION_CREATE_DOCUMENT opens the system picker in "save as" mode. The app never touches the
    // file path itself; it only receives a content Uri back and streams into it.
    private fun onExportClicked() {
        try {
            val i = Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_TITLE, "guardian-rules.txt")
            startActivityForResult(i, REQ_EXPORT)
            rulesIoError.visibility = View.GONE
        } catch (_: ActivityNotFoundException) {
            rulesIoError.visibility = View.VISIBLE
            rulesIoError.text = txt("Could not open the file picker", "无法打开文件选择器")
        }
    }

    // ACTION_OPEN_DOCUMENT, same picker but in "open" mode. Some file managers report .txt as
    // application/octet-stream, so the accepted types are widened rather than trusting the name.
    private fun onImportClicked() {
        try {
            val i = Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("text/plain")
                .putExtra(
                    Intent.EXTRA_MIME_TYPES,
                    arrayOf("text/plain", "text/*", "application/octet-stream")
                )
            startActivityForResult(i, REQ_IMPORT)
            rulesIoError.visibility = View.GONE
        } catch (_: ActivityNotFoundException) {
            rulesIoError.visibility = View.VISIBLE
            rulesIoError.text = txt("Could not open the file picker", "无法打开文件选择器")
        }
    }

    private fun handleExportResult(uri: Uri?) {
        if (uri == null) return
        try {
            val text = RulesText.format(
                UserRulesStore.blocked(this),
                UserRulesStore.allowed(this)
            )
            // "wt" truncates, so re-exporting over an existing file does not leave trailing bytes.
            contentResolver.openOutputStream(uri, "wt").use { out ->
                if (out == null) throw IllegalStateException("no output stream")
                out.write(text.toByteArray(Charsets.UTF_8))
            }
            rulesIoError.visibility = View.GONE
        } catch (_: Throwable) {
            rulesIoError.visibility = View.VISIBLE
            rulesIoError.text = txt("Could not write the file", "无法写入文件")
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
        } catch (_: Throwable) {
            null
        }
        if (text == null) {
            rulesIoError.visibility = View.VISIBLE
            rulesIoError.text = txt("Could not read the file", "无法读取文件")
            return
        }
        val parsed = RulesText.parse(text)
        val summary = txt(
            "${parsed.blocked.size} to block, ${parsed.allowed.size} to allow, ${parsed.skipped} lines skipped",
            "拦截 ${parsed.blocked.size} 条,放行 ${parsed.allowed.size} 条,跳过 ${parsed.skipped} 行"
        )
        // Three-way choice. Merge keeps the existing rules and lets imported entries replace the
        // current choice for a domain; Replace discards the current lists entirely.
        AlertDialog.Builder(this)
            .setTitle(txt("Import rules", "导入规则"))
            .setMessage(summary)
            .setPositiveButton(txt("Merge", "合并")) { _, _ -> applyImport(parsed, merge = true) }
            .setNeutralButton(txt("Replace", "替换")) { _, _ -> applyImport(parsed, merge = false) }
            .setNegativeButton(txt("Cancel", "取消"), null)
            .show()
    }

    private fun applyImport(parsed: RulesText.ParseResult, merge: Boolean) {
        if (merge) {
            UserRulesStore.mergeIn(this, parsed.blocked, parsed.allowed)
        } else {
            UserRulesStore.replaceAll(this, parsed.blocked, parsed.allowed)
        }
        GuardianVpnService.applyUserRules(applicationContext)
        // Clear signatures so both lists rebuild on the next refresh even inside the throttle window.
        blockedSignature = ""
        allowedSignature = ""
        appListSignature = ""
        rulesIoError.visibility = View.GONE
        uiHandler.post { refreshUi() }
    }

    // G13: make the radio buttons reflect what UserRulesStore says. Setting isChecked fires the
    // OnCheckedChangeListener, so the flag is set for the whole loop and the listener short-circuits.
    private fun syncLevelRadio() {
        if (!::levelGroup.isInitialized) return
        val level = UserRulesStore.level(this)
        settingLevelProgrammatically = true
        try {
            for (i in 0 until levelGroup.childCount) {
                val rb = levelGroup.getChildAt(i) as? RadioButton ?: continue
                val match = (rb.tag as? String) == level
                if (rb.isChecked != match) rb.isChecked = match
            }
        } finally {
            settingLevelProgrammatically = false
        }
    }

    private fun renderAlwaysOnRow() {
        val on = GuardianVpnService.alwaysOn
        if (on == null) {
            if (alwaysOnView.visibility != View.GONE) alwaysOnView.visibility = View.GONE
            setIfChanged(alwaysOnView, "")
            return
        }
        if (alwaysOnView.visibility != View.VISIBLE) alwaysOnView.visibility = View.VISIBLE
        var text = if (on) txt("Always-on: On", "始终开启:已开启") else txt("Always-on: Off", "始终开启:未开启")
        if (GuardianVpnService.lockdown == true) text += txt(", blocks connections without VPN", ",未连 VPN 时断网")
        setIfChanged(alwaysOnView, text)
    }

    private fun onToggleClicked() {
        if (GuardianVpnService.isLoading) return
        if (GuardianVpnService.isRunning) {
            // Plain startService: the stop path never calls startForeground, and a
            // startForegroundService() call that is not followed by startForeground() within a
            // few seconds crashes with ForegroundServiceDidNotStartInTimeException.
            val i = Intent(this, GuardianVpnService::class.java).setAction(GuardianVpnService.ACTION_STOP)
            startService(i)
        } else {
            val prep = VpnService.prepare(this)
            if (prep != null) {
                @Suppress("DEPRECATION")
                startActivityForResult(prep, REQ_VPN_PREPARE)
            } else {
                startVpnService()
            }
        }
    }

    private fun onPauseResumeClicked() {
        val h = GuardianVpnService.activeHandler ?: return
        val action = if (h.isPaused()) GuardianVpnService.ACTION_RESUME else GuardianVpnService.ACTION_PAUSE
        val i = Intent(this, GuardianVpnService::class.java).setAction(action)
        startService(i)
        // The service handles the action asynchronously; refresh soon so the button/status catch up.
        uiHandler.postDelayed({ refreshUi() }, 200)
    }

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

    private fun startVpnService() {
        val i = Intent(this, GuardianVpnService::class.java).setAction(GuardianVpnService.ACTION_START)
        startForegroundService(i)
    }

    private fun refreshUi() {
        val loading = GuardianVpnService.isLoading
        val running = GuardianVpnService.isRunning
        val h = GuardianVpnService.activeHandler
        val paused = running && h != null && h.isPaused()

        setIfChanged(statusView, when {
            loading -> txt("Loading list…", "正在加载名单…")
            paused -> {
                val fmt = SimpleDateFormat("HH:mm", Locale.getDefault())
                val until = fmt.format(Date(h!!.pausedUntilMs))
                txt("Status: Paused until $until", "状态：已暂停至 $until")
            }
            running -> txt("Status: Running", "状态：运行中")
            else -> txt("Status: Stopped", "状态：已停止")
        })

        renderAlwaysOnRow()

        toggleBtn.isEnabled = !loading
        setIfChanged(toggleBtn, if (running) txt("Stop", "停止") else txt("Start", "启动"))

        if (running && !loading) {
            if (pauseBtn.visibility != View.VISIBLE) pauseBtn.visibility = View.VISIBLE
            setIfChanged(
                pauseBtn,
                if (paused) txt("Resume", "恢复") else txt("Pause 5 min", "暂停 5 分钟")
            )
        } else if (pauseBtn.visibility != View.GONE) {
            pauseBtn.visibility = View.GONE
        }

        if (h == null) {
            setIfChanged(statsView, "")
            setIfChanged(rulesView, "")
            setIfChanged(logView, "")
            renderAppList(null)
            renderBlockedList()
            renderAllowedList()
        } else {
            val s = h.snapshot()
            setIfChanged(statsView, txt(
                "Queries: ${s.queries}  Blocked: ${s.blocked}  Forwarded: ${s.forwarded}\n" +
                "Answered: ${s.answered}  Failed: ${s.failed}  Malformed: ${s.malformed}",
                "查询: ${s.queries}  拦截: ${s.blocked}  转发: ${s.forwarded}\n" +
                "应答: ${s.answered}  失败: ${s.failed}  畸形: ${s.malformed}"
            ))
            val userAllowed = UserRulesStore.allowed(this).size
            val userBlocked = UserRulesStore.blocked(this).size
            // The substring "N allowed by you" is matched by the emulator flow; keep it verbatim.
            setIfChanged(rulesView, txt(
                "Rules: ${h.blocklist.blockedCount} blocked, $userAllowed allowed by you, $userBlocked blocked by you",
                "规则:拦截 ${h.blocklist.blockedCount},你放行 $userAllowed,你拦截 $userBlocked"
            ))
            renderLog(h.recent())
            renderAppList(h)
            renderBlockedList()
            renderAllowedList()
        }

        renderHistory()

        if (pdnsOn.isNotEmpty()) {
            if (hintView.visibility != View.VISIBLE) hintView.visibility = View.VISIBLE
            setIfChanged(hintView, txt(
                "Private DNS is enabled. Some queries may bypass Guardian.",
                "私人 DNS 开启时部分查询可能不经过 Guardian"
            ))
        } else if (hintView.visibility != View.GONE) {
            hintView.visibility = View.GONE
        }
    }

    // G12: cheap to read, so it is refreshed every tick alongside the in-session stats. The
    // signature check keeps a setText off the common path when the numbers have not changed.
    private fun renderHistory() {
        val today = StatsStore.today(this)
        val last7 = StatsStore.last7(this)
        val sig = "$today/$last7"
        if (sig == historySignature) return
        historySignature = sig
        setIfChanged(historyView, txt(
            "Blocked today: $today · last 7 days: $last7",
            "今天拦截 $today 次 · 最近 7 天 $last7 次"
        ))
    }

    private fun renderLog(entries: List<LogEntry>) {
        val sb = SpannableStringBuilder()
        val fmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        // G15: only the visible 10 lines get a tracker lookup, and byDomain caches misses too.
        val trackerDb = GuardianVpnService.trackerDb()
        // Last 10 only: a glance at what is happening; the per-domain view below is what people act on.
        for (e in entries.take(10)) {
            val start = sb.length
            val tag = when {
                e.blocked -> txt("BLOCK", "拦截")
                e.paused -> txt("PAUSE", "暂停")
                else -> txt("ALLOW", "放行")
            }
            sb.append(fmt.format(Date(e.timeMs)))
                .append(' ').append(tag).append(' ')
                .append(e.name).append(" (type ").append(e.qtype.toString()).append(")")
            // G14: blocked because the answer's CNAME pointed at a listed tracker.
            e.via?.let { sb.append(txt(" → really $it", " → 实际指向 $it")) }
            // G15: " · InMobi" when the blocked domain (or, when set, the CNAME target) is a
            // known tracker. Same suffix in both languages: the company name is not translated.
            if (e.blocked) {
                val domain = e.via ?: e.name
                val tracker = trackerDb?.byDomain(domain)
                if (tracker != null) sb.append(" · ").append(tracker.name)
            }
            sb.append('\n')
            if (e.blocked) {
                sb.setSpan(
                    ForegroundColorSpan(0xFFFF4444.toInt()),
                    start, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            } else if (e.paused) {
                sb.setSpan(
                    ForegroundColorSpan(0xFFFFA500.toInt()),
                    start, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }
        }
        setIfChanged(logView, sb)
    }

    // "Blocked most often": the domains blocked in this session, each with an Allow button for false
    // positives. Not per app: on Android 10+ apps resolve names through the system DNS service, so every
    // query reaching the VPN comes from that service's uid (1051 on the emulator), not from the app.
    private fun renderAppList(h: QueryHandler?) {
        val top = h?.tally?.snapshot(1)?.firstOrNull()?.topBlocked ?: emptyList()
        // G15: looked up once per rebuild for the few visible rows only; byDomain is LRU-cached,
        // so repeated rebuilds do not re-scan the tracker regexes.
        val trackerDb = GuardianVpnService.trackerDb()
        // G11: the rule behind each row, worked out now from the live rules (the log does not store
        // it). It is part of the signature so a rule change (Allow, Block, import) rebuilds the rows
        // once the background rules thread has swapped the list, not only when counts change.
        val bl = h?.blocklist
        val rules = top.map { bl?.match(it.first) }
        val sig = top.joinToString(";") { "${it.first}:${it.second}" } + "|" +
            rules.joinToString(";") { m -> if (m == null) "-" else "${m.rule}:${m.source}" }
        if (sig == appListSignature) return
        // Counts change with every DNS query. Rebuild the list at most every 5 s unless a tap reset the
        // signature, so background traffic does not re-lay out the screen every second.
        val now = android.os.SystemClock.uptimeMillis()
        if (appListSignature.isNotEmpty() && now - appListBuiltAt < 5000) return
        appListBuiltAt = now
        appListSignature = sig
        appListContainer.removeAllViews()
        if (h == null) return
        val density = resources.displayMetrics.density
        val vpad = (4 * density).toInt()
        if (top.isEmpty()) {
            appListContainer.addView(TextView(this).apply {
                textSize = 12f
                text = txt("(nothing blocked yet)", "(还没有拦截)")
                setPadding(0, vpad, 0, vpad)
            })
            return
        }
        val secondary = secondaryTextColors()
        for ((i, d) in top.withIndex()) {
            val domRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, vpad, 0, vpad)
            }
            // Domain on the first line, the rule that blocked it in small grey text below.
            val texts = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val dom = TextView(this).apply {
                textSize = 13f
                text = "${d.first} (${d.second})"
            }
            texts.addView(dom)
            texts.addView(TextView(this).apply {
                textSize = 11f
                if (secondary != null) setTextColor(secondary)
                text = ruleLine(rules[i])
            })
            // G15: company and categories from the Exodus DB. Omitted when the domain does not
            // match any tracker (or the DB failed to load), never shown as a placeholder.
            val tracker = trackerDb?.byDomain(d.first)
            if (tracker != null) {
                texts.addView(TextView(this).apply {
                    textSize = 11f
                    if (secondary != null) setTextColor(secondary)
                    text = trackerLine(tracker)
                })
            }
            val allowBtn = Button(this).apply {
                text = txt("Allow", "放行")
                textSize = 12f
                setOnClickListener {
                    UserRulesStore.add(this@MainActivity, d.first)
                    GuardianVpnService.applyUserRules(applicationContext)
                    appListSignature = ""
                    blockedSignature = ""
                    allowedSignature = ""
                    uiHandler.post { refreshUi() }
                }
            }
            domRow.addView(texts)
            domRow.addView(allowBtn)
            appListContainer.addView(domRow)
        }
    }

    /**
     * Text for the rule line under a "Blocked most often" row. The list counts past blocks, so the
     * current rules may no longer block the name (the user allowed it, or removed their own block);
     * say so rather than showing a rule that no longer applies.
     */
    private fun ruleLine(m: Blocklist.Match?): String = if (m == null) {
        txt("No longer blocked", "现在不再拦截")
    } else when (m.source) {
        Blocklist.RuleSource.BUILTIN_BLOCK -> txt("Rule: ${m.rule} (built-in list)", "规则:${m.rule}(内置名单)")
        Blocklist.RuleSource.USER_BLOCK -> txt("Rule: ${m.rule} (blocked by you)", "规则:${m.rule}(你拦截的)")
        Blocklist.RuleSource.USER_ALLOW -> txt("Now allowed by you: ${m.rule}", "现已被你放行:${m.rule}")
        Blocklist.RuleSource.BUILTIN_ALLOW -> txt("Now allowed by the built-in list: ${m.rule}", "现已被内置名单放行:${m.rule}")
    }

    // G15: "Tracker: InMobi · Advertisement" / "追踪者:InMobi · 广告". A tracker with no categories
    // shows just the name, since the Exodus DB has a few rows without any (e.g. Google DoubleClick).
    private fun trackerLine(t: Tracker): String {
        val name = t.name
        if (t.categories.isEmpty()) return txt("Tracker: $name", "追踪者:$name")
        val joined = if (Locale.getDefault().language == "zh") {
            t.categories.joinToString("、") { catLabel(it) }
        } else {
            t.categories.joinToString(", ") { catLabel(it) }
        }
        return txt("Tracker: $name · $joined", "追踪者:$name · $joined")
    }

    // The Exodus category names are a fixed short list. Unknown values are passed through
    // unchanged rather than dropped, so a future data update never hides information.
    private fun catLabel(cat: String): String = when (cat) {
        "Advertisement" -> txt("Advertisement", "广告")
        "Analytics" -> txt("Analytics", "分析")
        "Location" -> txt("Location", "位置")
        "Profiling" -> txt("Profiling", "用户画像")
        "Identification" -> txt("Identification", "身份识别")
        "Crash reporting" -> txt("Crash reporting", "崩溃报告")
        else -> cat
    }

    /** The theme's secondary text colour, or null to keep the default colour. */
    private fun secondaryTextColors(): android.content.res.ColorStateList? {
        val a = obtainStyledAttributes(intArrayOf(android.R.attr.textColorSecondary))
        try {
            return a.getColorStateList(0)
        } finally {
            a.recycle()
        }
    }

    // "Blocked by you": the user's own block list. Mirror of the allow list below it; both are
    // read from UserRulesStore each refresh and rendered only when the serialized set changes.
    private fun renderBlockedList() {
        val blocked = UserRulesStore.blocked(this).sorted()
        // "#" prefix: an empty list must differ from the "" that taps write to force a rebuild,
        // or removing the last entry would leave its row on screen.
        val sig = "#" + blocked.joinToString(",")
        if (sig == blockedSignature) return
        blockedSignature = sig
        blockedListContainer.removeAllViews()
        val density = resources.displayMetrics.density
        val vpad = (4 * density).toInt()
        if (blocked.isEmpty()) {
            blockedListContainer.addView(TextView(this).apply {
                textSize = 12f
                text = txt("(none)", "(无)")
                setPadding(0, vpad, 0, vpad)
            })
            return
        }
        for (d in blocked) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, vpad, 0, vpad)
            }
            val dom = TextView(this).apply {
                textSize = 13f
                text = d
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val removeBtn = Button(this).apply {
                text = txt("Remove", "移除")
                textSize = 12f
                setOnClickListener {
                    UserRulesStore.removeBlocked(this@MainActivity, d)
                    GuardianVpnService.applyUserRules(applicationContext)
                    appListSignature = ""
                    blockedSignature = ""
                    allowedSignature = ""
                    uiHandler.post { refreshUi() }
                }
            }
            row.addView(dom)
            row.addView(removeBtn)
            blockedListContainer.addView(row)
        }
    }

    private fun renderAllowedList() {
        val allowed = UserRulesStore.allowed(this).sorted()
        // "#" prefix: an empty list must differ from the "" that taps write to force a rebuild,
        // or removing the last entry would leave its row on screen.
        val sig = "#" + allowed.joinToString(",")
        if (sig == allowedSignature) return
        allowedSignature = sig
        allowedListContainer.removeAllViews()
        val density = resources.displayMetrics.density
        val vpad = (4 * density).toInt()
        if (allowed.isEmpty()) {
            allowedListContainer.addView(TextView(this).apply {
                textSize = 12f
                text = txt("(none)", "(无)")
                setPadding(0, vpad, 0, vpad)
            })
            return
        }
        for (d in allowed) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, vpad, 0, vpad)
            }
            val dom = TextView(this).apply {
                textSize = 13f
                text = d
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val removeBtn = Button(this).apply {
                text = txt("Remove", "移除")
                textSize = 12f
                setOnClickListener {
                    UserRulesStore.remove(this@MainActivity, d)
                    GuardianVpnService.applyUserRules(applicationContext)
                    appListSignature = ""
                    blockedSignature = ""
                    allowedSignature = ""
                    uiHandler.post { refreshUi() }
                }
            }
            row.addView(dom)
            row.addView(removeBtn)
            allowedListContainer.addView(row)
        }
    }

    // The screen refreshes every second; setting identical text still re-lays out the view, which keeps
    // the window from ever being idle (wasted work, and UI tests cannot read the screen).
    private fun setIfChanged(view: TextView, value: CharSequence) {
        if (view.text.toString() != value.toString()) view.text = value
    }

    private fun txt(en: String, zh: String): String =
        if (Locale.getDefault().language == "zh") zh else en

    companion object {
        private const val REQ_VPN_PREPARE = 100
        private const val REQ_NOTIF = 101
        private const val REQ_EXPORT = 102
        private const val REQ_IMPORT = 103
    }
}
