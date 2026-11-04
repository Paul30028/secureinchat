// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLPeerUnverifiedException
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory
import org.secureinchat.guardian.dns.Action
import org.secureinchat.guardian.dns.Blocklist
import org.secureinchat.guardian.dns.BlockMode
import org.secureinchat.guardian.dns.DotClient
import org.secureinchat.guardian.dns.DotProvider
import org.secureinchat.guardian.dns.QueryHandler
import org.secureinchat.guardian.dns.SpywareDb
import org.secureinchat.guardian.dns.SpywareKind
import org.secureinchat.guardian.dns.SpywareWatch
import org.secureinchat.guardian.dns.TrackerDb

class GuardianVpnService : VpnService() {

    private var tun: ParcelFileDescriptor? = null
    private var tunIn: FileInputStream? = null
    private var tunOut: FileOutputStream? = null
    private val writeLock = Any()
    private var readThread: Thread? = null
    private var pool: ExecutorService? = null
    @Volatile private var running = false
    private var handler: QueryHandler? = null
    private var upstream: Upstream? = null

    // G18: encrypted DNS. null = off (the default): allowed queries go to the network's resolver.
    // When set, allowed queries go only through this DoT client; if it cannot reach the provider the
    // query fails (SERVFAIL). There is deliberately no fallback to the network's clear-text resolver.
    @Volatile private var dot: DotClient? = null
    // After a failed DoT query, fail the next ones fast instead of letting every queued query wait out
    // the connect timeouts; one query is let through after the backoff to see if the provider is back.
    @Volatile private var dotFailedAtMs = 0L

    // Pause expires on its own (QueryHandler.isPaused() returns false once the absolute timestamp
    // passes), so the notification needs a one-shot timer that rewrites it back to "DNS filtering
    // active" when the pause ends. Posted on the main looper; cancelled on resume or stop.
    private val mainHandler = Handler(Looper.getMainLooper())
    @Volatile private var notifRefresh: Runnable? = null

    // G12: durable per-day block counts live in StatsStore. The running blocked counter is a Long
    // in QueryHandler and resets on every service start; every STATS_FLUSH_MS we take the delta
    // since the last flush and record it. A process kill between flushes costs at most one interval
    // of counts, and a long session only writes on the flush tick, never once per query.
    @Volatile private var lastFlushedBlocked: Long = 0L
    @Volatile private var statsFlush: Runnable? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopVpnInternal()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_PAUSE -> {
                val h = handler
                if (h != null) {
                    h.pause(PAUSE_DURATION_MS)
                    updateNotification()
                    scheduleNotifRefresh(PAUSE_DURATION_MS)
                    try {
                        android.service.quicksettings.TileService.requestListeningState(
                            applicationContext,
                            android.content.ComponentName(applicationContext, GuardianTileService::class.java)
                        )
                    } catch (_: Throwable) {}
                }
                return START_STICKY
            }
            ACTION_RESUME -> {
                val h = handler
                if (h != null) {
                    h.resume()
                    updateNotification()
                    cancelNotifRefresh()
                    try {
                        android.service.quicksettings.TileService.requestListeningState(
                            applicationContext,
                            android.content.ComponentName(applicationContext, GuardianTileService::class.java)
                        )
                    } catch (_: Throwable) {}
                }
                return START_STICKY
            }
            else -> {
                // Besides our own Start, two ways to get here: the system starts us for Always-on
                // VPN (action "android.net.VpnService"), or START_STICKY restarts us with a null
                // intent. Consent may have been revoked since; without it establish() would fail,
                // so stop and do not ask to be restarted.
                if (VpnService.prepare(this) != null) {
                    stopVpnInternal()
                    stopSelf()
                    return START_NOT_STICKY
                }
                if (!running && !isLoading) {
                    // startForeground can be refused (e.g. systemExempted on API 34+ when this app
                    // is no longer the configured VPN after a sticky restart). Stop rather than run unpromoted.
                    val promoted = try { startForegroundSafe(); true } catch (_: RuntimeException) { false }
                    if (!promoted) {
                        stopSelf()
                        return START_NOT_STICKY
                    }
                    isLoading = true
                    val gen = ++startGeneration
                    Thread { startVpnBackground(gen) }.apply { name = "guardian-start" }.start()
                }
            }
        }
        return START_STICKY
    }

    // Bumped by every start and stop. A start thread that finds a newer generation after loading the
    // list gives up, so Stop pressed while the list is loading cannot be overtaken by a late establish().
    @Volatile private var startGeneration = 0

    private fun startVpnBackground(gen: Int) {
        try {
            val blocklist = loadBlocklist()
            // G15: load the Exodus tracker database once per process, on the same background
            // thread as the blocklist. Failure is non-fatal: trackerDb() then returns null and
            // the UI simply does not show company names.
            loadTrackerDb(applicationContext)
            // G20: known stalkerware servers; same once-per-process loading as the tracker names.
            loadSpywareWatch(applicationContext)
            val effective = applyUserRulesTo(blocklist, applicationContext)
            // No uid lookup: on Android 10+ every query reaching the VPN is sent by the system DNS
            // service, so getConnectionOwnerUid names that service, not the app (seen in the emulator flow).
            val h = QueryHandler(effective, BlockMode.NULL_IP)
            if (gen != startGeneration) return

            val builder = Builder()
            builder.setSession("Guardian")
            // IPv4 DNS hijack target. Only DNS-server traffic is routed into the VPN; everything else
            // stays on the underlying network.
            builder.addAddress("10.111.222.1", 32)
            builder.addDnsServer("10.111.222.2")
            builder.addRoute("10.111.222.2", 32)
            // IPv6 DNS hijack target, a unique local address (fc00::/7, not routable on the internet). Some networks only
            // hand out IPv6 DNS servers; without this, those queries bypass Guardian. If the platform
            // refuses the IPv6 address (old build, unusual ROM), fall back to IPv4-only rather than
            // failing the whole session.
            var ipv6Configured = false
            try {
                builder.addAddress("fd00:6a72:6764::1", 128)
                ipv6Configured = true
            } catch (_: Throwable) {
                ipv6Configured = false
            }
            if (ipv6Configured) {
                try {
                    builder.addDnsServer("fd00:6a72:6764::2")
                    builder.addRoute("fd00:6a72:6764::2", 128)
                } catch (_: Throwable) {
                    // Address already added; a partially configured IPv6 side is harmless: no route
                    // is installed, so no IPv6 DNS traffic will enter the VPN from this side.
                }
            }
            builder.setMtu(1500)
            builder.setBlocking(true)

            val pfd = try { builder.establish() } catch (_: Throwable) { null }
            if (gen != startGeneration) {
                try { pfd?.close() } catch (_: Throwable) {}
                return
            }
            if (pfd == null) {
                isLoading = false
                stopSelf()
                return
            }
            tun = pfd
            tunIn = FileInputStream(pfd.fileDescriptor)
            tunOut = FileOutputStream(pfd.fileDescriptor)

            val up = Upstream(applicationContext) { sock -> protect(sock) }
            up.start()
            upstream = up
            setDot(DnsSettingsStore.provider(applicationContext))

            handler = h
            activeHandler = h
            pool = Executors.newFixedThreadPool(8)
            running = true
            isRunning = true
            isLoading = false
            instance = this
            readAlwaysOn()
            // Let the Quick Settings tile refresh from "Starting…" to "On" without waiting for a tap.
            // Fully qualified to avoid touching this file's imports.
            try {
                android.service.quicksettings.TileService.requestListeningState(
                    applicationContext,
                    android.content.ComponentName(applicationContext, GuardianTileService::class.java)
                )
            } catch (_: Throwable) {}

            // G12: baseline the running counter, then start the periodic flush.
            lastFlushedBlocked = 0L
            scheduleStatsFlush()

            val t = Thread { readLoop(pfd) }
            t.name = "guardian-tun-read"
            readThread = t
            t.start()
        } catch (_: Throwable) {
            isLoading = false
            stopSelf()
        }
    }

    // API 29 added isAlwaysOn/isLockdownEnabled. Before that, or on failure, both stay null and the
    // UI hides the row instead of guessing.
    private fun readAlwaysOn() {
        if (Build.VERSION.SDK_INT >= 29) {
            try {
                alwaysOn = isAlwaysOn
                lockdown = isLockdownEnabled
                return
            } catch (_: Throwable) {}
        }
        alwaysOn = null
        lockdown = null
    }

    override fun onRevoke() {
        stopVpnInternal()
        stopSelf()
        super.onRevoke()
    }

    override fun onDestroy() {
        stopVpnInternal()
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Guardian VPN", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val stopIntent = Intent(this, GuardianVpnService::class.java).setAction(ACTION_STOP)
        val stopPi = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Guardian")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
        val h = handler
        if (h != null && h.isPaused()) {
            val fmt = SimpleDateFormat("HH:mm", Locale.getDefault())
            val until = fmt.format(Date(h.pausedUntilMs))
            builder.setContentText("Paused until $until")
            val resumeIntent = Intent(this, GuardianVpnService::class.java).setAction(ACTION_RESUME)
            val resumePi = PendingIntent.getService(
                this, 2, resumeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(0, "Resume", resumePi)
        } else {
            builder.setContentText("DNS filtering active")
        }
        builder.addAction(0, "Stop", stopPi)
        return builder.build()
    }

    private fun updateNotification() {
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(NOTIF_ID, buildNotification())
        } catch (_: Throwable) {}
    }

    private fun scheduleNotifRefresh(delayMs: Long) {
        cancelNotifRefresh()
        val r = Runnable {
            notifRefresh = null
            updateNotification()
        }
        notifRefresh = r
        mainHandler.postDelayed(r, delayMs)
    }

    private fun cancelNotifRefresh() {
        notifRefresh?.let { mainHandler.removeCallbacks(it) }
        notifRefresh = null
    }

    // G12: every STATS_FLUSH_MS write the delta since the last flush into StatsStore, then re-arm.
    // The Runnable re-schedules itself rather than using a fixed-rate executor so the interval
    // survives the main looper being busy. The first tick is a full interval after start.
    private fun scheduleStatsFlush() {
        cancelStatsFlush()
        val r = Runnable {
            statsFlush = null
            flushStatsNow()
            scheduleStatsFlush()
        }
        statsFlush = r
        mainHandler.postDelayed(r, STATS_FLUSH_MS)
    }

    private fun cancelStatsFlush() {
        statsFlush?.let { mainHandler.removeCallbacks(it) }
        statsFlush = null
    }

    // Snapshot the running counter, record the difference from the last flush, and remember the new
    // baseline. Reading the snapshot first, then moving the baseline, is safe: any block that
    // happens between the two steps is still counted in the next flush's delta, never double counted.
    private fun flushStatsNow() {
        val h = handler ?: return
        val cur = h.snapshot().blocked
        val prev = lastFlushedBlocked
        if (cur <= prev) return
        val delta = cur - prev
        lastFlushedBlocked = cur
        try {
            StatsStore.record(
                applicationContext,
                if (delta > Int.MAX_VALUE.toLong()) Int.MAX_VALUE else delta.toInt()
            )
        } catch (_: Throwable) {}
    }

    private fun startForegroundSafe() {
        val notif = buildNotification()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED)
        } else if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, notif, 0)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    private fun readLoop(pfd: ParcelFileDescriptor) {
        val buf = ByteArray(32767)
        val input = tunIn ?: return
        while (running) {
            val n = try { input.read(buf) } catch (_: Throwable) { if (!running) break else continue }
            if (n <= 0) continue
            val copy = buf.copyOf(n)
            val exec = pool ?: break
            try { exec.execute { processPacket(copy) } } catch (_: Throwable) {}
        }
    }

    private fun processPacket(packet: ByteArray) {
        val h = handler ?: return
        when (val act = h.handle(packet, packet.size)) {
            is Action.Respond -> {
                writeTun(act.packet)
                checkSpyware(act.name)
            }
            is Action.Forward -> {
                checkSpyware(act.query.qname)
                val exec = pool ?: return
                try {
                    exec.execute {
                        val ans = sendUpstream(act.payload)
                        if (ans == null) {
                            h.onUpstreamFailed(act.query)
                        } else {
                            val resp = h.onUpstreamAnswer(act.query, ans, ans.size)
                            if (resp != null) writeTun(resp)
                        }
                    }
                } catch (_: Throwable) {}
            }
            Action.Drop -> {}
        }
    }

    /** G18: DoT when chosen (fail closed), otherwise the network's resolver as before. */
    private fun sendUpstream(payload: ByteArray): ByteArray? {
        val d = dot ?: return upstream?.sendQuery(payload)
        val now = System.currentTimeMillis()
        if (now - dotFailedAtMs < DOT_BACKOFF_MS) return null
        val ans = d.query(payload)
        if (ans == null) {
            dotFailedAtMs = System.currentTimeMillis()
            dotState = DotState(d.hostname, connected = false)
        } else {
            dotFailedAtMs = 0L
            if (dotState?.connected != true) dotState = DotState(d.hostname, connected = true)
        }
        return ans
    }

    /** Swaps the DoT client; null turns encrypted DNS off. May block briefly on the old client's lock. */
    private fun setDot(p: DotProvider?) {
        val old = dot
        dot = p?.let { makeDot(it) }
        dotFailedAtMs = 0L
        dotState = p?.let { DotState(it.tlsName, connected = null) }
        try { old?.close() } catch (_: Throwable) {}
    }

    private fun makeDot(p: DotProvider): DotClient = DotClient(
        hostname = p.tlsName,
        // Address literals from DotProviders: InetAddress.getByName does no DNS lookup for these.
        addresses = p.addresses.map { InetSocketAddress(InetAddress.getByName(it), DOT_PORT) },
        openSocket = {
            // protect() before connect, so the TLS connection bypasses Guardian's own tunnel.
            val s = Socket()
            if (!protect(s)) {
                try { s.close() } catch (_: Throwable) {}
                throw IOException("VpnService.protect failed")
            }
            s
        },
        wrapTls = { raw, host -> wrapTls(raw, host) }
    )

    // Platform trust store, hostname checked twice: by the TLS stack (endpoint identification) and
    // again explicitly after the handshake. No pinning (it would break when the provider rotates keys).
    private fun wrapTls(raw: Socket, host: String): Socket {
        val factory = SSLSocketFactory.getDefault() as SSLSocketFactory
        val tls = factory.createSocket(raw, host, DOT_PORT, true) as SSLSocket
        try {
            val params = tls.sslParameters
            params.endpointIdentificationAlgorithm = "HTTPS"
            tls.sslParameters = params
            tls.startHandshake()
            if (!HttpsURLConnection.getDefaultHostnameVerifier().verify(host, tls.session)) {
                throw SSLPeerUnverifiedException("certificate does not match $host")
            }
            return tls
        } catch (e: Exception) {
            try { tls.close() } catch (_: Throwable) {}
            throw e
        }
    }

    /**
     * G20: alert when a lookup goes to a known stalkerware server. Alert only, never block: blocking can
     * tell whoever installed the stalkerware that it was found, which can put the person in danger.
     * The query itself is answered exactly as it would be without this check.
     */
    private fun checkSpyware(name: String) {
        val alert = try { spywareWatch?.check(name) } catch (_: Throwable) { null } ?: return
        try { postSpywareAlert(alert) } catch (_: Throwable) {}
    }

    private fun postSpywareAlert(alert: SpywareWatch.Alert) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(ALERT_CHANNEL_ID) == null) {
            nm.createNotificationChannel(
                NotificationChannel(ALERT_CHANNEL_ID, tr("Safety alerts", "安全提醒"), NotificationManager.IMPORTANCE_HIGH)
            )
        }
        val open = PendingIntent.getActivity(
            this, 3, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val ind = alert.indicator
        // What the lock screen shows: nothing about the app or the domain, so someone glancing at the
        // phone (possibly the person who installed it) learns nothing.
        val public = Notification.Builder(this, ALERT_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle(tr("Guardian has a safety alert", "Guardian 有一条安全提醒"))
            .setContentText(tr("Unlock to see it", "解锁后查看"))
            .build()
        val (title, body) = spywareAlertText(ind.app, ind.kind, ind.alsoWebsite, alert.queryName)
        val n = Notification.Builder(this, ALERT_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setPublicVersion(public)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        nm.notify(ALERT_NOTIF_BASE + (ind.domain.hashCode() and 0xFFFF), n)
    }

    private fun writeTun(packet: ByteArray) {
        val out = tunOut ?: return
        synchronized(writeLock) {
            try { out.write(packet) } catch (_: Throwable) {}
        }
    }

    private fun stopVpnInternal() {
        cancelNotifRefresh()
        // G12: capture whatever was blocked in the last interval before the handler goes away.
        cancelStatsFlush()
        flushStatsNow()
        startGeneration++
        running = false
        isRunning = false
        isLoading = false
        instance = null
        alwaysOn = null
        lockdown = null
        try { tun?.close() } catch (_: Throwable) {}
        try { tunIn?.close() } catch (_: Throwable) {}
        try { tunOut?.close() } catch (_: Throwable) {}
        tun = null; tunIn = null; tunOut = null
        try { readThread?.join(1000) } catch (_: Throwable) {}
        readThread = null
        try { pool?.shutdownNow() } catch (_: Throwable) {}
        pool = null
        try { upstream?.stop() } catch (_: Throwable) {}
        upstream = null
        try { dot?.close() } catch (_: Throwable) {}
        dot = null
        dotState = null
        handler = null
        activeHandler = null

        // Let the Quick Settings tile flip back to "Off" without waiting for a tap.
        try {
            android.service.quicksettings.TileService.requestListeningState(
                applicationContext,
                android.content.ComponentName(applicationContext, GuardianTileService::class.java)
            )
        } catch (_: Throwable) {}
    }

    private fun loadBlocklist(): Blocklist = loadBlocklistStatic(applicationContext)

    companion object {
        const val ACTION_START = "org.secureinchat.guardian.action.START"
        const val ACTION_STOP = "org.secureinchat.guardian.action.STOP"
        const val ACTION_PAUSE = "org.secureinchat.guardian.action.PAUSE"
        const val ACTION_RESUME = "org.secureinchat.guardian.action.RESUME"
        const val PAUSE_DURATION_MS = 5 * 60 * 1000L
        private const val STATS_FLUSH_MS = 60_000L
        private const val DOT_PORT = 853
        private const val DOT_BACKOFF_MS = 10_000L
        private const val CHANNEL_ID = "guardian_vpn"
        private const val NOTIF_ID = 1
        private const val ALERT_CHANNEL_ID = "guardian_safety_alerts"
        private const val ALERT_NOTIF_BASE = 1000
        private val LIST_ASSETS = listOf("blocklist-hagezi-light.txt", "blocklist-extra.txt")
        private val rulesLock = Any()

        @Volatile var isRunning: Boolean = false
            private set

        @Volatile var isLoading: Boolean = false
            private set

        @Volatile var activeHandler: QueryHandler? = null
            private set

        // null = unknown (not running, or API < 29). The UI hides the row on null.
        @Volatile var alwaysOn: Boolean? = null
            private set
        @Volatile var lockdown: Boolean? = null
            private set
        @Volatile private var instance: GuardianVpnService? = null

        /**
         * G18: what the encrypted DNS line shows. null while stopped or off. [connected] is null until
         * the first query after start or a provider change, then the outcome of the latest query.
         */
        data class DotState(val hostname: String, val connected: Boolean?)

        @Volatile var dotState: DotState? = null
            private set

        /** G18: apply the stored encrypted DNS choice to the running service. Call off the UI thread. */
        fun applyDnsSetting(ctx: Context) {
            val svc = instance ?: return
            svc.setDot(DnsSettingsStore.provider(ctx))
        }

        /** Re-reads the Always-on state, e.g. when the user comes back from system settings. */
        fun refreshAlwaysOn() {
            instance?.readAlwaysOn()
        }

        // G15: Exodus tracker database, loaded once per process on the same thread as the blocklist.
        // trackerDbLoaded covers both success and failure so a bad/missing asset is not retried on
        // every start; trackerDb() returns whatever the one attempt produced (a TrackerDb or null).
        @Volatile private var trackerDbCache: TrackerDb? = null
        @Volatile private var trackerDbLoaded: Boolean = false

        private fun loadTrackerDb(ctx: Context) {
            if (trackerDbLoaded) return
            trackerDbLoaded = true
            trackerDbCache = try {
                val text = ctx.assets.open("trackers-exodus.tsv")
                    .use { it.bufferedReader().readText() }
                TrackerDb.parse(text)
            } catch (_: Throwable) {
                null
            }
        }

        // G20: Echap stalkerware C2 domains. Loaded once per process; a failed load leaves alerts off
        // (the UI then says the list is unavailable rather than implying the phone was checked).
        @Volatile private var spywareWatch: SpywareWatch? = null
        @Volatile private var spywareLoaded: Boolean = false
        @Volatile var spywareListSize: Int = 0
            private set

        private fun loadSpywareWatch(ctx: Context) {
            if (spywareLoaded) return
            spywareLoaded = true
            spywareWatch = try {
                val text = ctx.assets.open("stalkerware-echap.tsv").use { it.bufferedReader().readText() }
                SpywareDb.parse(text).also { spywareListSize = it.size }.let { SpywareWatch(it) }
            } catch (_: Throwable) {
                null
            }
        }

        /** Alerts raised in this process, newest first (memory only; gone when the process ends). */
        fun recentSpywareAlerts(): List<SpywareWatch.Alert> = spywareWatch?.recent() ?: emptyList()

        private fun tr(en: String, zh: String): String =
            if (Locale.getDefault().language == "zh") zh else en

        /** Title and body for one alert; shared by the notification and the in-app list. */
        fun spywareAlertText(app: String, kind: SpywareKind, alsoWebsite: Boolean, queryName: String): Pair<String, String> {
            val title = when {
                kind == SpywareKind.WATCHWARE ->
                    tr("An app contacted the servers of the monitoring app $app", "有 App 连接了远程监控软件「$app」的服务器")
                alsoWebsite ->
                    tr("This phone contacted the website or servers of the stalkerware $app", "这台手机连接了跟踪软件「$app」的网站或服务器")
                else ->
                    tr("An app contacted the servers of the stalkerware $app", "有 App 连接了跟踪软件「$app」的服务器")
            }
            val detail = when {
                kind == SpywareKind.WATCHWARE -> tr(
                    "Apps like this also have legitimate uses (parental control, remote work). If you did not install it yourself, take a look.",
                    "这类软件也有正当用途(家长监控、远程办公)。如果不是你自己装的，请注意。"
                )
                alsoWebsite -> tr(
                    "If you were only reading about it in a browser, you can ignore this.",
                    "如果你只是在浏览器里查看它的网站，可以忽略。"
                )
                else -> tr(
                    "Guardian cannot tell which app it was.",
                    "Guardian 无法知道是哪个 App。"
                )
            }
            val body = tr(
                "Domain: $queryName. $detail Not blocked, so whoever installed it is not tipped off. Open Guardian to see how to handle this safely.",
                "域名:$queryName。$detail 没有替你拦截，以免惊动安装它的人。打开 Guardian 查看怎么安全处理。"
            )
            return title to body
        }

        /** Exodus tracker DB, or null if it failed to load. Cheap; safe to call from the UI thread. */
        fun trackerDb(): TrackerDb? = trackerDbCache

        // The bundled lists never change while the app runs, so parse them once per process.
        @Volatile private var baseCache: Blocklist? = null

        private fun loadBlocklistStatic(ctx: Context): Blocklist {
            baseCache?.let { return it }
            return try {
                val text = LIST_ASSETS.joinToString("\n") { name ->
                    ctx.assets.open(name).use { it.bufferedReader().readText() }
                }
                Blocklist.parse(text).also { baseCache = it }
            } catch (_: Throwable) {
                Blocklist.parse("")
            }
        }

        // Bundled list + user blocks + user allows. Precedence inside Blocklist is
        // "user allow > user block > builtin allow > builtin block", so the order of the two calls
        // below only matters for building the object, not for matching.
        private fun applyUserRulesTo(base: Blocklist, ctx: Context): Blocklist {
            var eff = base
            val userBlocked = UserRulesStore.blocked(ctx)
            if (userBlocked.isNotEmpty()) eff = eff.plusBlocked(userBlocked)
            val userAllowed = UserRulesStore.allowed(ctx)
            if (userAllowed.isNotEmpty()) eff = eff.plusAllowed(userAllowed)
            return eff
        }

        fun applyUserRules(ctx: Context) {
            val h = activeHandler ?: return
            Thread {
                synchronized(rulesLock) {
                    try {
                        val base = loadBlocklistStatic(ctx)
                        h.blocklist = applyUserRulesTo(base, ctx)
                    } catch (_: Throwable) {}
                }
            }.apply { name = "guardian-rules" }.start()
        }
    }
}
