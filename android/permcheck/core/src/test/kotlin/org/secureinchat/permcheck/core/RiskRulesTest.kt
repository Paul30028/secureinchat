// SPDX-License-Identifier: GPL-3.0-or-later
// Runs without JUnit: `kotlinc ... -include-runtime` then `java -cp ... RiskRulesTestKt`.
package org.secureinchat.permcheck.core

private const val P = "android.permission."
private fun app(pkg: String = "com.test", label: String = "Test App", system: Boolean = false, granted: Set<String> = emptySet(), special: Set<Special> = emptySet()) =
    AppPerms(pkg, label, system, granted, special)
private var n = 0
private fun t(name: String, block: () -> Unit) { try { block(); n++ } catch (e: Throwable) { println("FAIL $name: ${e.message}"); throw e } }
private fun eq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }

fun main() {
    t("empty") { eq(0, audit(emptyList()).size); eq(mapOf(Risk.HIGH to 0, Risk.MEDIUM to 0, Risk.LOW to 0), summary(emptyList())) }
    t("high perm") { val f = audit(listOf(app(granted = setOf("${P}READ_SMS")))); eq(1, f.size); eq(Risk.HIGH, f[0].risk); eq("read_sms", f[0].reasonKey) }
    t("medium perm") { eq(Risk.MEDIUM, audit(listOf(app(granted = setOf("${P}CAMERA"))))[0].risk) }
    t("low perm") { eq(Risk.LOW, audit(listOf(app(granted = setOf("${P}POST_NOTIFICATIONS"))))[0].risk) }
    t("unlisted ignored") { eq(0, audit(listOf(app(granted = setOf("${P}VIBRATE", "${P}INTERNET")))).size) }
    t("system only high") { val f = audit(listOf(app(system = true, granted = setOf("${P}READ_SMS", "${P}CAMERA", "${P}POST_NOTIFICATIONS")))); eq(1, f.size); eq(Risk.HIGH, f[0].risk) }
    t("keyboard + internet") { val f = audit(listOf(app(granted = setOf("${P}INTERNET"), special = setOf(Special.DEFAULT_KEYBOARD)))); eq(1, f.size); eq("keyboard_internet", f[0].reasonKey); eq(Risk.HIGH, f[0].risk) }
    t("keyboard offline") { eq(0, audit(listOf(app(special = setOf(Special.DEFAULT_KEYBOARD)))).size) }
    t("accessibility") { eq("accessibility", audit(listOf(app(special = setOf(Special.ACCESSIBILITY))))[0].reasonKey) }
    t("notification listener") { eq(Risk.HIGH, audit(listOf(app(special = setOf(Special.NOTIFICATION_LISTENER))))[0].risk) }
    t("device admin") { eq(Risk.HIGH, audit(listOf(app(special = setOf(Special.DEVICE_ADMIN))))[0].risk) }
    t("vpn medium") { eq(Risk.MEDIUM, audit(listOf(app(special = setOf(Special.VPN))))[0].risk) }
    t("ai camera upgraded") { val f = audit(listOf(app(pkg = "com.openai.chatgpt", label = "ChatGPT", granted = setOf("${P}CAMERA")))); eq(Risk.HIGH, f[0].risk); eq("camera_ai", f[0].reasonKey) }
    t("ai overlay upgraded") { eq("overlay_ai", audit(listOf(app(pkg = "com.deepseek.chat", special = setOf(Special.OVERLAY))))[0].reasonKey) }
    t("ai fine location stays medium") { eq(Risk.MEDIUM, audit(listOf(app(pkg = "com.openai.chatgpt", granted = setOf("${P}ACCESS_FINE_LOCATION"))))[0].risk) }
    t("ai upgrade survives system filter") { eq(1, audit(listOf(app(pkg = "com.google.android.apps.bard", label = "Gemini", system = true, granted = setOf("${P}RECORD_AUDIO")))).size) }
    t("non-ai camera medium") { eq(Risk.MEDIUM, audit(listOf(app(label = "Simple Notes", granted = setOf("${P}CAMERA"))))[0].risk) }
    t("sort risk then label") {
        val f = audit(listOf(app("z", "Zebra", granted = setOf("${P}POST_NOTIFICATIONS")), app("a", "Apple", granted = setOf("${P}READ_SMS")), app("b", "Banana", granted = setOf("${P}CAMERA"))))
        eq(listOf("Apple", "Banana", "Zebra"), f.map { it.label })
    }
    t("ai word detection") {
        check(AiApps.isLikelyAi("x", "AI Assistant")); check(AiApps.isLikelyAi("x", "Notes AI")); check(AiApps.isLikelyAi("com.anthropic.claude", "Claude"))
        check(!AiApps.isLikelyAi("com.example", "Email")); check(!AiApps.isLikelyAi("com.example", "Daily Planner")); check(!AiApps.isLikelyAi("com.example", "Rain Radar"))
    }
    println("$n permcheck core tests passed")
}
