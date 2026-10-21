// SPDX-License-Identifier: GPL-3.0-or-later
// Drafted by DeepSeek (T7-a), reviewed and corrected by Claude.
package org.secureinchat.permcheck.core

data class AppPerms(
    val packageName: String,
    val label: String,
    val isSystem: Boolean,
    val granted: Set<String>,
    val specialAccess: Set<Special>,
)

enum class Special { ACCESSIBILITY, NOTIFICATION_LISTENER, DEVICE_ADMIN, DEFAULT_KEYBOARD, VPN, OVERLAY, USAGE_STATS }

/** Declared in order of severity: HIGH sorts first. */
enum class Risk { HIGH, MEDIUM, LOW }

data class Finding(val packageName: String, val label: String, val item: String, val risk: Risk, val reasonKey: String)
