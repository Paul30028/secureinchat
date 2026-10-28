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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import org.secureinchat.guardian.dns.Action
import org.secureinchat.guardian.dns.Blocklist
import org.secureinchat.guardian.dns.BlockMode
import org.secureinchat.guardian.dns.QueryHandler

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

    // Pause expires on its own (QueryHandler.isPaused() returns false once the absolute timestamp
    // passes), so the notification needs a one-shot timer that rewrites it back to "DNS filtering
    // active" when the pause ends. Posted on the main looper; cancelled on resume or stop.
    private val mainHandler = Handler(Looper.getMainLooper())
    @Volatile private var notifRefresh: Runnable? = null

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
            val userAllowed = UserRulesStore.allowed(applicationContext)
            val effective = if (userAllowed.isEmpty()) blocklist else blocklist.plusAllowed(userAllowed)
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

            handler = h
            activeHandler = h
            pool = Executors.newFixedThreadPool(8)
            running = true
            isRunning = true
            isLoading = false
            // Let the Quick Settings tile refresh from "Starting…" to "On" without waiting for a tap.
            // Fully qualified to avoid touching this file's imports.
            try {
                android.service.quicksettings.TileService.requestListeningState(
                    applicationContext,
                    android.content.ComponentName(applicationContext, GuardianTileService::class.java)
                )
            } catch (_: Throwable) {}

            val t = Thread { readLoop(pfd) }
            t.name = "guardian-tun-read"
            readThread = t
            t.start()
        } catch (_: Throwable) {
            isLoading = false
            stopSelf()
        }
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
            is Action.Respond -> writeTun(act.packet)
            is Action.Forward -> {
                val exec = pool ?: return
                try {
                    exec.execute {
                        val ans = upstream?.sendQuery(act.payload)
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

    private fun writeTun(packet: ByteArray) {
        val out = tunOut ?: return
        synchronized(writeLock) {
            try { out.write(packet) } catch (_: Throwable) {}
        }
    }

    private fun stopVpnInternal() {
        cancelNotifRefresh()
        startGeneration++
        running = false
        isRunning = false
        isLoading = false
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
        private const val CHANNEL_ID = "guardian_vpn"
        private const val NOTIF_ID = 1
        private val LIST_ASSETS = listOf("blocklist-hagezi-light.txt", "blocklist-extra.txt")
        private val rulesLock = Any()

        @Volatile var isRunning: Boolean = false
            private set

        @Volatile var isLoading: Boolean = false
            private set

        @Volatile var activeHandler: QueryHandler? = null
            private set

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

        fun applyUserRules(ctx: Context) {
            val h = activeHandler ?: return
            Thread {
                synchronized(rulesLock) {
                    try {
                        val base = loadBlocklistStatic(ctx)
                        val userAllowed = UserRulesStore.allowed(ctx)
                        val effective = if (userAllowed.isEmpty()) base else base.plusAllowed(userAllowed)
                        h.blocklist = effective
                    } catch (_: Throwable) {}
                }
            }.apply { name = "guardian-rules" }.start()
        }
    }
}
