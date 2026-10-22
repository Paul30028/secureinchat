// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.permcheck.core

private const val P = "android.permission."

object RiskRules {
    private val high = mapOf(
        "${P}ACCESS_BACKGROUND_LOCATION" to "background_location", "${P}READ_SMS" to "read_sms", "${P}RECEIVE_SMS" to "receive_sms",
        "${P}READ_CALL_LOG" to "read_call_log", "${P}BODY_SENSORS_BACKGROUND" to "body_sensors_background",
    )
    private val medium = mapOf(
        "${P}ACCESS_FINE_LOCATION" to "fine_location", "${P}RECORD_AUDIO" to "record_audio", "${P}CAMERA" to "camera",
        "${P}READ_CONTACTS" to "read_contacts", "${P}READ_MEDIA_IMAGES" to "read_media_images", "${P}READ_MEDIA_VIDEO" to "read_media_video",
        "${P}READ_EXTERNAL_STORAGE" to "read_external_storage", "${P}READ_PHONE_STATE" to "read_phone_state",
    )
    private val low = mapOf(
        "${P}ACCESS_COARSE_LOCATION" to "coarse_location", "${P}BLUETOOTH_CONNECT" to "bluetooth_connect",
        "${P}NEARBY_WIFI_DEVICES" to "nearby_wifi_devices", "${P}POST_NOTIFICATIONS" to "post_notifications",
    )
    private val highSpecial = setOf(Special.ACCESSIBILITY, Special.NOTIFICATION_LISTENER, Special.DEVICE_ADMIN)
    private val mediumSpecial = setOf(Special.VPN, Special.OVERLAY, Special.USAGE_STATS)
    private val aiUpgrade = setOf("${P}RECORD_AUDIO", "${P}CAMERA", "${P}READ_MEDIA_IMAGES")

    /** Every reasonKey [evaluate] can emit; used to check that each has explanatory text. */
    fun reasonKeys(): Set<String> = buildSet {
        addAll(high.values); addAll(medium.values); addAll(low.values)
        aiUpgrade.forEach { add(medium.getValue(it) + "_ai") }
        (highSpecial + mediumSpecial).forEach { add(it.name.lowercase()) }
        add(Special.OVERLAY.name.lowercase() + "_ai")
        add("keyboard_internet")
    }

    fun evaluate(app: AppPerms): List<Finding> {
        val ai = AiApps.isLikelyAi(app.packageName, app.label)
        val out = mutableListOf<Finding>()
        fun add(item: String, base: Risk, key: String, upgradable: Boolean) {
            val up = ai && upgradable && base == Risk.MEDIUM
            val risk = if (up) Risk.HIGH else base
            if (app.isSystem && risk != Risk.HIGH) return
            out += Finding(app.packageName, app.label, item, risk, if (up) "${key}_ai" else key)
        }
        for (perm in app.granted) {
            when (perm) {
                in high -> add(perm, Risk.HIGH, high.getValue(perm), false)
                in medium -> add(perm, Risk.MEDIUM, medium.getValue(perm), perm in aiUpgrade)
                in low -> add(perm, Risk.LOW, low.getValue(perm), false)
            }
        }
        for (s in app.specialAccess) {
            when {
                s in highSpecial -> add(s.name, Risk.HIGH, s.name.lowercase(), false)
                s in mediumSpecial -> add(s.name, Risk.MEDIUM, s.name.lowercase(), s == Special.OVERLAY)
                s == Special.DEFAULT_KEYBOARD && "${P}INTERNET" in app.granted -> add(s.name, Risk.HIGH, "keyboard_internet", false)
            }
        }
        return out
    }
}

/** Findings sorted HIGH first, then by app label, then by item. */
fun audit(apps: List<AppPerms>): List<Finding> =
    apps.flatMap { RiskRules.evaluate(it) }.sortedWith(compareBy<Finding>({ it.risk.ordinal }, { it.label }, { it.item }))

fun summary(findings: List<Finding>): Map<Risk, Int> {
    val c = findings.groupingBy { it.risk }.eachCount()
    return Risk.entries.associateWith { c[it] ?: 0 }
}

object AiApps {
    private val labelWords = listOf("gpt", "gemini", "copilot", "claude", "assistant", "chatbot")
    private val aiWord = Regex("(?<![a-z])ai(?![a-z])", RegexOption.IGNORE_CASE)
    private val packageWords = listOf("openai", "anthropic", "gemini", "copilot", "deepseek", "perplexity")

    fun isLikelyAi(packageName: String, label: String): Boolean {
        val l = label.lowercase(); val p = packageName.lowercase()
        return aiWord.containsMatchIn(label) || labelWords.any { it in l } || packageWords.any { it in p }
    }
}
