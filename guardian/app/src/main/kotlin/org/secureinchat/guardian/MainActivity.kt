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

class MainActivity : Activity() {

    private lateinit var statusView: TextView
    private lateinit var alwaysOnView: TextView
    private lateinit var alwaysOnError: TextView
    private lateinit var statsView: TextView
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

    private var appListSignature: String = ""
    private var blockedSignature: String = ""
    private var allowedSignature: String = ""
    private var appListBuiltAt = 0L

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

        statsView = TextView(this).apply {
            textSize = 14f
            typeface = Typeface.MONOSPACE
            setPadding(0, pad / 2, 0, 0)
        }
        root.addView(statsView)

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

        val privacy = TextView(this).apply {
            textSize = 12f
            text = txt(
                "Only DNS queries go through Guardian. Allowed queries are sent to your current network's DNS servers. No logs are saved.",
                "只有 DNS 查询经过 Guardian。放行的查询发给你当前网络的 DNS 服务器。记录不保存。"
            )
            setPadding(0, pad / 2, 0, 0)
        }
        root.addView(privacy)

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

    private fun renderLog(entries: List<LogEntry>) {
        val sb = SpannableStringBuilder()
        val fmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
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
                .append(e.name).append(" (type ").append(e.qtype.toString()).append(")\n")
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
