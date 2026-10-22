// SPDX-License-Identifier: GPL-3.0-or-later
// T11-c: keeps the change record so "turn it back on" still works after the app is closed.
// The only file this app writes. It lives in noBackupFilesDir, which Android leaves out of cloud
// backup and device-to-device transfer, so the record stays on this phone. "Clear record" deletes it.
package org.secureinchat.permcheck

import android.content.Context
import org.secureinchat.permcheck.core.Ledger
import java.io.File
import java.io.IOException

class LedgerStore(private val ctx: Context) {
    private fun file() = File(ctx.noBackupFilesDir, "change-record.txt")

    fun load(): Ledger = try {
        val f = file()
        if (f.exists()) Ledger.decode(f.readText()).first else Ledger.EMPTY
    } catch (e: IOException) {
        Ledger.EMPTY
    }

    /** Writes to a temporary file first, so a crash mid-write cannot leave half a record. */
    fun save(ledger: Ledger): Boolean = try {
        val f = file()
        val tmp = File(f.parentFile, f.name + ".tmp")
        tmp.writeText(ledger.encode())
        tmp.renameTo(f) || run { f.delete(); tmp.renameTo(f) }
    } catch (e: IOException) {
        false
    }

    fun clear() {
        file().delete()
    }
}
