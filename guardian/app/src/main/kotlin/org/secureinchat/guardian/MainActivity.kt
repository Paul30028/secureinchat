// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.VpnService
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import org.secureinchat.guardian.dns.LogEntry

class MainActivity : Activity() {

    private lateinit var statusView: TextView
    private lateinit var statsView: TextView
    private lateinit var logView: TextView
    private lateinit var hintView: TextView
    private lateinit var toggleBtn: Button

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

    override fun onResume() { super.onResume(); uiHandler.post(refreshTick) }
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

        val root = LinearLayout(this)
        root.orientation = LinearLayout.VERTICAL
        root.setPadding(pad, pad, pad, pad)

        root.addView(TextView(this).apply {
            text = "Guardian"
            textSize = 22f
        })

        statusView = TextView(this).apply { textSize = 16f }
        root.addView(statusView)

        toggleBtn = Button(this).apply {
            setOnClickListener { onToggleClicked() }
        }
        root.addView(toggleBtn)

        statsView = TextView(this).apply {
            textSize = 14f
            typeface = Typeface.MONOSPACE
            setPadding(0, pad / 2, 0, 0)
        }
        root.addView(statsView)

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

        setContentView(ScrollView(this).apply { addView(root) })
    }

    private fun onToggleClicked() {
        if (GuardianVpnService.isRunning) {
            val i = Intent(this, GuardianVpnService::class.java).setAction(GuardianVpnService.ACTION_STOP)
            startForegroundService(i)
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

    @Deprecated("Deprecated in Activity, unavoidable without AndroidX")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_VPN_PREPARE && resultCode == RESULT_OK) {
            startVpnService()
        }
    }

    private fun startVpnService() {
        val i = Intent(this, GuardianVpnService::class.java).setAction(GuardianVpnService.ACTION_START)
        startForegroundService(i)
    }

    private fun refreshUi() {
        val running = GuardianVpnService.isRunning
        statusView.text = if (running) {
            txt("Status: Running", "状态：运行中")
        } else {
            txt("Status: Stopped", "状态：已停止")
        }
        toggleBtn.text = if (running) {
            txt("Stop", "停止")
        } else {
            txt("Start", "启动")
        }
        val h = GuardianVpnService.activeHandler
        if (h == null) {
            statsView.text = ""
            logView.text = ""
        } else {
            val s = h.snapshot()
            statsView.text = txt(
                "Queries: ${s.queries}  Blocked: ${s.blocked}  Forwarded: ${s.forwarded}\n" +
                "Answered: ${s.answered}  Failed: ${s.failed}  Malformed: ${s.malformed}",
                "查询: ${s.queries}  拦截: ${s.blocked}  转发: ${s.forwarded}\n" +
                "应答: ${s.answered}  失败: ${s.failed}  畸形: ${s.malformed}"
            )
            renderLog(h.recent())
        }
        if (pdnsOn.isNotEmpty()) {
            hintView.visibility = View.VISIBLE
            hintView.text = txt(
                "Private DNS is enabled. Some queries may bypass Guardian.",
                "私人 DNS 开启时部分查询可能不经过 Guardian"
            )
        } else {
            hintView.visibility = View.GONE
        }
    }

    private fun renderLog(entries: List<LogEntry>) {
        val sb = SpannableStringBuilder()
        val fmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        for (e in entries.take(50)) {
            val start = sb.length
            val tag = if (e.blocked) txt("BLOCK", "拦截") else txt("ALLOW", "放行")
            sb.append(fmt.format(Date(e.timeMs)))
                .append(' ').append(tag).append(' ')
                .append(e.name).append(" (type ").append(e.qtype.toString()).append(")\n")
            if (e.blocked) {
                sb.setSpan(
                    ForegroundColorSpan(0xFFFF4444.toInt()),
                    start, sb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }
        }
        logView.text = sb
    }

    private fun txt(en: String, zh: String): String =
        if (Locale.getDefault().language == "zh") zh else en

    companion object {
        private const val REQ_VPN_PREPARE = 100
        private const val REQ_NOTIF = 101
    }
}
