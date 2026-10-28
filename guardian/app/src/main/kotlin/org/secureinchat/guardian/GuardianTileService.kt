// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import java.util.Locale

class GuardianTileService : TileService() {

    private val uiHandler = Handler(Looper.getMainLooper())

    private fun txt(en: String, zh: String): String =
        if (Locale.getDefault().language == "zh") zh else en

    override fun onStartListening() {
        super.onStartListening()
        refreshTile()
    }

    private fun refreshTile() {
        val tile = qsTile ?: return
        val running = GuardianVpnService.isRunning
        val loading = GuardianVpnService.isLoading
        // Paused is a sub-state of "running": the VPN session stays up and the tile remains ACTIVE,
        // only the label changes. activeHandler is set while running, so this read is a plain null
        // check; isPaused() is clock-based and safe to call from the main thread.
        val paused = running && (GuardianVpnService.activeHandler?.isPaused() ?: false)
        tile.state = if (running) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.label = "Guardian"
        if (Build.VERSION.SDK_INT >= 29) {
            tile.subtitle = when {
                loading -> txt("Starting…", "正在启动…")
                paused -> txt("Paused", "已暂停")
                running -> txt("On", "已开启")
                else -> txt("Off", "已关闭")
            }
        }
        try { tile.updateTile() } catch (_: Throwable) {}
    }

    override fun onClick() {
        super.onClick()
        // While the list is loading, ignore clicks. GuardianVpnService.isLoading is written from the
        // service thread but is @Volatile, and the service is a singleton within the process, so we
        // can rely on it here without extra coordination.
        if (GuardianVpnService.isLoading) return

        if (GuardianVpnService.isRunning) {
            // Plain startService: the stop path never calls startForeground, and a
            // startForegroundService() call that is not followed by startForeground() within a
            // few seconds crashes with ForegroundServiceDidNotStartInTimeException.
            val i = Intent(this, GuardianVpnService::class.java)
                .setAction(GuardianVpnService.ACTION_STOP)
            startService(i)
        } else {
            val prep = VpnService.prepare(this)
            if (prep != null) {
                // Consent has not been granted yet. TileService cannot startActivityForResult, so open
                // MainActivity; the user taps Start there, which shows the system consent dialog.
                openMainActivityForConsent()
            } else {
                val i = Intent(this, GuardianVpnService::class.java)
                    .setAction(GuardianVpnService.ACTION_START)
                startForegroundService(i)
            }
        }
        // Service start/stop is asynchronous, so refresh the tile once more a second later.
        uiHandler.postDelayed({ refreshTile() }, 1000)
    }

    // The Intent overload is the only one before API 34; the PendingIntent overload is used from 34 on.
    @SuppressLint("StartActivityAndCollapseDeprecated")
    private fun openMainActivityForConsent() {
        val activityIntent = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= 34) {
            val pi = PendingIntent.getActivity(
                this, 0, activityIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            startActivityAndCollapse(pi)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(activityIntent)
        }
    }
}
