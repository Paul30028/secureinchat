// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.content.Context

/**
 * Whether the user wants protection on, so Guardian can tell "you stopped it" from "something else stopped
 * it" (battery saver killing the service, a reboot without Always-on, another VPN taking the VPN slot).
 * Two booleans, nothing else; set by the service, read by the Protect tab.
 */
object ProtectionStateStore {
    private const val PREFS = "protection_state"
    private const val KEY_WANTED = "wanted"
    private const val KEY_REVOKED = "revoked"

    fun wanted(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_WANTED, false)
    fun revoked(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_REVOKED, false)

    /** Protection came up. */
    fun started(ctx: Context) = prefs(ctx).edit().putBoolean(KEY_WANTED, true).putBoolean(KEY_REVOKED, false).apply()

    /** The user stopped it (app, notification or tile): nothing to warn about. */
    fun stoppedByUser(ctx: Context) = prefs(ctx).edit().putBoolean(KEY_WANTED, false).putBoolean(KEY_REVOKED, false).apply()

    /** Android took the VPN slot away (another VPN app was turned on). The user still wants protection. */
    fun revokedBySystem(ctx: Context) = prefs(ctx).edit().putBoolean(KEY_REVOKED, true).apply()

    private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
