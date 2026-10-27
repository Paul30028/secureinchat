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
import android.os.ParcelFileDescriptor
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import org.secureinchat.guardian.dns.Action
import org.secureinchat.guardian.dns.Blocklist
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
                if (!running) {
                    startForegroundSafe()
                    startVpnInternal()
                }
            }
        }
        return START_STICKY
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

    private fun startVpnInternal() {
        val blocklist = loadBlocklist()
        val h = QueryHandler(blocklist)
        handler = h
        val builder = Builder()
        builder.setSession("Guardian")
        builder.addAddress("10.111.222.1", 32)
        builder.addDnsServer("10.111.222.2")
        builder.addRoute("10.111.222.2", 32)
        builder.setMtu(1500)
        builder.setBlocking(true)

        val pfd = try { builder.establish() } catch (_: Throwable) { null }
        if (pfd == null) {
            stopVpnInternal()
            stopSelf()
            return
        }
        tun = pfd
        tunIn = FileInputStream(pfd.fileDescriptor)
        tunOut = FileOutputStream(pfd.fileDescriptor)

        val up = Upstream(applicationContext) { sock -> protect(sock) }
        up.start()
        upstream = up

        running = true
        isRunning = true
        activeHandler = h
        pool = Executors.newFixedThreadPool(8)
        val t = Thread { readLoop(pfd) }
        t.name = "guardian-tun-read"
        readThread = t
        t.start()
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
        running = false
        isRunning = false
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

    private fun loadBlocklist(): Blocklist {
        return try {
            assets.open("blocklist.txt").use { input ->
                Blocklist.parse(input.bufferedReader().readText())
            }
        } catch (_: Throwable) {
            Blocklist.parse("")
        }
    }

    companion object {
        const val ACTION_START = "org.secureinchat.guardian.action.START"
        const val ACTION_STOP = "org.secureinchat.guardian.action.STOP"
        private const val CHANNEL_ID = "guardian_vpn"
        private const val NOTIF_ID = 1

        @Volatile var isRunning: Boolean = false
            private set

        @Volatile var activeHandler: QueryHandler? = null
            private set
    }
}
