// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.system.OsConstants
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import org.secureinchat.guardian.dns.Action
import org.secureinchat.guardian.dns.Blocklist
import org.secureinchat.guardian.dns.BlockMode
import org.secureinchat.guardian.dns.DnsQuery
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

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopVpnInternal()
                stopSelf()
                return START_NOT_STICKY
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
            val h = QueryHandler(effective, BlockMode.NULL_IP, { q -> uidOfQuery(q) })
            if (gen != startGeneration) return

            val builder = Builder()
            builder.setSession("Guardian")
            builder.addAddress("10.111.222.1", 32)
            builder.addDnsServer("10.111.222.2")
            builder.addRoute("10.111.222.2", 32)
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

            val t = Thread { readLoop(pfd) }
            t.name = "guardian-tun-read"
            readThread = t
            t.start()
        } catch (_: Throwable) {
            isLoading = false
            stopSelf()
        }
    }

    private fun uidOfQuery(q: DnsQuery): Int {
        if (Build.VERSION.SDK_INT < 29) return -1
        return try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val src = InetSocketAddress(InetAddress.getByAddress(q.srcIp), q.srcPort)
            val dst = InetSocketAddress(InetAddress.getByAddress(q.dstIp), q.dstPort)
            cm.getConnectionOwnerUid(OsConstants.IPPROTO_UDP, src, dst)
        } catch (_: Throwable) {
            -1
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

    private fun startForegroundSafe() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Guardian VPN", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val stopIntent = Intent(this, GuardianVpnService::class.java).setAction(ACTION_STOP)
        val pi = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notif: Notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Guardian")
            .setContentText("DNS filtering active")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .addAction(0, "Stop", pi)
            .setOngoing(true)
            .build()
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
    }

    private fun loadBlocklist(): Blocklist = loadBlocklistStatic(applicationContext)

    companion object {
        const val ACTION_START = "org.secureinchat.guardian.action.START"
        const val ACTION_STOP = "org.secureinchat.guardian.action.STOP"
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
