// SPDX-License-Identifier: GPL-3.0-or-later
// T7-b tests. Run: `java -cp ... org.secureinchat.permcheck.core.CollectTestKt`
package org.secureinchat.permcheck.core

private const val P = "android.permission."
private var n = 0
private fun t(name: String, block: () -> Unit) { try { block(); n++ } catch (e: Throwable) { println("FAIL $name: ${e.message}"); throw e } }
private fun eq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }
private fun raw(pkg: String, label: String = pkg, granted: Set<String> = emptySet(), vpn: Boolean = false, system: Boolean = false) =
    RawApp(pkg, label, system, granted, vpn)

fun main() {
    t("packageOf short") { eq("com.foo", Components.packageOf("com.foo/.Svc")) }
    t("packageOf full") { eq("com.foo.bar", Components.packageOf(" com.foo.bar/com.foo.bar.Ime ")) }
    t("packageOf blank") { eq(null, Components.packageOf("")); eq(null, Components.packageOf(null)); eq(null, Components.packageOf("/x")) }
    t("packageOf junk") { eq(null, Components.packageOf("com foo/.X")) }
    t("packagesOf list") { eq(setOf("a.b", "c.d"), Components.packagesOf("a.b/.X:c.d/c.d.Y::a.b/.Z")) }
    t("packagesOf null") { eq(emptySet<String>(), Components.packagesOf(null)) }

    val snap = SpecialSnapshot(
        accessibility = setOf("acc.app"), notificationListeners = setOf("notif.app"), deviceAdmins = setOf("admin.app"),
        defaultKeyboard = "kb.app", overlay = setOf("ov.app"), usageStats = setOf("use.app"),
    )
    t("special mapping") {
        eq(setOf(Special.ACCESSIBILITY), snap.specialFor(raw("acc.app")))
        eq(setOf(Special.NOTIFICATION_LISTENER), snap.specialFor(raw("notif.app")))
        eq(setOf(Special.DEVICE_ADMIN), snap.specialFor(raw("admin.app")))
        eq(setOf(Special.DEFAULT_KEYBOARD), snap.specialFor(raw("kb.app")))
        eq(setOf(Special.VPN), snap.specialFor(raw("x", vpn = true)))
        eq(setOf(Special.OVERLAY), snap.specialFor(raw("ov.app")))
        eq(setOf(Special.USAGE_STATS), snap.specialFor(raw("use.app")))
        eq(emptySet<Special>(), snap.specialFor(raw("plain")))
    }
    t("collect skips self") { eq(listOf("other"), collect(listOf(raw("org.secureinchat.permcheck"), raw("other")), snap, "org.secureinchat.permcheck").map { it.packageName }) }
    t("collect end to end") {
        val apps = collect(listOf(raw("kb.app", "Keyboard", setOf("${P}INTERNET")), raw("acc.app", "Helper"), raw("cam", "Cam", setOf("${P}CAMERA"))), snap, "self")
        val f = audit(apps)
        eq(listOf("Helper", "Keyboard", "Cam"), f.map { it.label })
        eq(listOf(Risk.HIGH, Risk.HIGH, Risk.MEDIUM), f.map { it.risk })
    }

    t("every reason key has EN and ZH text") {
        val keys = RiskRules.reasonKeys()
        check(keys.size >= 25) { "only ${keys.size} keys" }
        for (k in keys) { checkNotNull(Reasons.get(k, Lang.EN)) { "EN missing $k" }; checkNotNull(Reasons.get(k, Lang.ZH)) { "ZH missing $k" } }
        eq(Reasons.keys(Lang.EN), Reasons.keys(Lang.ZH))
        eq(keys, Reasons.keys(Lang.EN))
    }
    t("emitted keys are known") {
        val all = RiskRules.reasonKeys()
        val apps = listOf(
            AppPerms("com.openai.chatgpt", "ChatGPT", false, setOf("${P}CAMERA", "${P}RECORD_AUDIO", "${P}READ_MEDIA_IMAGES", "${P}INTERNET"), Special.entries.toSet()),
            AppPerms("x", "Plain", false, setOf("${P}READ_SMS", "${P}ACCESS_FINE_LOCATION", "${P}POST_NOTIFICATIONS"), setOf(Special.OVERLAY, Special.VPN)),
        )
        for (f in audit(apps)) check(f.reasonKey in all) { "unknown ${f.reasonKey}" }
    }

    t("targets") {
        fun tf(item: String) = targetFor(Finding("p", "l", item, Risk.HIGH, "k"))
        eq(Target.ACCESSIBILITY, tf("ACCESSIBILITY")); eq(Target.NOTIFICATION_LISTENER, tf("NOTIFICATION_LISTENER"))
        eq(Target.SECURITY, tf("DEVICE_ADMIN")); eq(Target.INPUT_METHOD, tf("DEFAULT_KEYBOARD")); eq(Target.VPN, tf("VPN"))
        eq(Target.OVERLAY, tf("OVERLAY")); eq(Target.USAGE_ACCESS, tf("USAGE_STATS")); eq(Target.APP_DETAILS, tf("${P}CAMERA"))
        check(Target.APP_DETAILS.withPackage && Target.OVERLAY.withPackage && !Target.VPN.withPackage)
    }

    val a = Finding("a", "A", "${P}CAMERA", Risk.MEDIUM, "camera")
    val b = Finding("b", "B", "ACCESSIBILITY", Risk.HIGH, "accessibility")
    val c = Finding("c", "C", "${P}READ_SMS", Risk.HIGH, "read_sms")
    t("recheck") {
        val r = recheck(listOf(a, b), listOf(b, c))
        eq(listOf(a), r.fixed); eq(listOf(b), r.remaining); eq(listOf(c), r.added)
    }
    t("recheck nothing changed") { val r = recheck(listOf(a), listOf(a)); eq(0, r.fixed.size); eq(0, r.added.size); eq(1, r.remaining.size) }

    t("report EN") {
        val text = report(audit(listOf(AppPerms("c", "C", false, setOf("${P}READ_SMS", "${P}CAMERA"), emptySet()))), Lang.EN)
        check("High 1 · Medium 1 · Low 0" in text) { text }
        check("== High ==" in text && "== Medium ==" in text && "== Low ==" !in text) { text }
        check("- C (c): Read text messages" in text) { text }
        check(text.indexOf("Read text messages") < text.indexOf("Camera")) { "order" }
        check("no internet permission" in text)
    }
    t("report ZH") {
        val text = report(emptyList(), Lang.ZH)
        check("高 0 · 中 0 · 低 0" in text) { text }
        check("没有联网权限" in text)
    }
    println("$n permcheck collect tests passed")
}
