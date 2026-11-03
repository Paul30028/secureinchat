// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian

import android.content.Context
import org.secureinchat.guardian.dns.DotProvider
import org.secureinchat.guardian.dns.DotProviders

/**
 * G18: the user's encrypted DNS choice. Stores one value, the id of a provider in [DotProviders]
 * (absent = off, the default). tests/policy_check.py keeps this file to that one setting.
 */
object DnsSettingsStore {
    private const val PREFS = "dns_settings"
    private const val KEY_PROVIDER = "dot_provider"

    /** The chosen provider, or null for off. An id this build does not know also reads as off. */
    fun provider(ctx: Context): DotProvider? = try {
        DotProviders.byId(prefs(ctx).getString(KEY_PROVIDER, null))
    } catch (_: Throwable) {
        null
    }

    /** null turns encrypted DNS off. Only ids from [DotProviders] are stored. */
    fun setProvider(ctx: Context, id: String?) {
        val known = DotProviders.byId(id)
        val e = prefs(ctx).edit()
        if (known == null) e.remove(KEY_PROVIDER) else e.putString(KEY_PROVIDER, known.id)
        e.apply()
    }

    private fun prefs(ctx: Context) =
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
