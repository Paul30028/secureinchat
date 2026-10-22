// SPDX-License-Identifier: GPL-3.0-or-later
// T11-c tests. Run: `java -cp ... org.secureinchat.permcheck.core.RestoreTestKt`
package org.secureinchat.permcheck.core

private const val P = "android.permission."
private var n = 0
private fun t(name: String, block: () -> Unit) { try { block(); n++ } catch (e: Throwable) { println("FAIL $name: ${e.message}"); throw e } }
private fun eq(a: Any?, b: Any?) { check(a == b) { "expected $a, got $b" } }
private fun app(pkg: String, vararg granted: String) = AppPerms(pkg, pkg, false, granted.map { if (it.contains('.')) it else P + it }.toSet(), emptySet())

fun main() {
    t("detects a permission switched off") {
        val r = revocationsBetween(listOf(app("com.cam", "CAMERA", "RECORD_AUDIO")), listOf(app("com.cam", "RECORD_AUDIO")), 5)
        eq(listOf(Change.RuntimeRevoke("com.cam", P + "CAMERA", 5)), r)
    }
    t("nothing changed") { eq(0, revocationsBetween(listOf(app("com.a", "CAMERA")), listOf(app("com.a", "CAMERA")), 1).size) }
    t("newly granted is not a revocation") { eq(0, revocationsBetween(listOf(app("com.a")), listOf(app("com.a", "CAMERA")), 1).size) }
    t("uninstalled app ignored") { eq(0, revocationsBetween(listOf(app("com.gone", "CAMERA")), emptyList(), 1).size) }
    t("normal permissions ignored") {
        eq(0, revocationsBetween(listOf(app("com.a", "INTERNET", "VIBRATE")), listOf(app("com.a")), 1).size)
    }
    t("non-android permission ignored") { eq(0, revocationsBetween(listOf(app("com.a", "com.vendor.X")), listOf(app("com.a")), 1).size) }
    t("protected and system packages ignored") {
        val before = listOf(app("com.android.settings", "CAMERA"), app("android.foo", "CAMERA"), app("org.secureinchat.permcheck", "CAMERA"))
        val after = before.map { it.copy(granted = emptySet()) }
        eq(0, revocationsBetween(before, after, 1).size)
    }
    t("stable order") {
        val before = listOf(app("com.b", "CAMERA", "READ_SMS"), app("com.a", "RECORD_AUDIO"))
        val after = listOf(app("com.a"), app("com.b"))
        eq(listOf("com.a|${P}RECORD_AUDIO", "com.b|${P}CAMERA", "com.b|${P}READ_SMS"),
            revocationsBetween(before, after, 1).map { "${it.packageName}|${it.permission}" })
    }
    t("background location switched off but foreground kept") {
        val r = revocationsBetween(listOf(app("com.map", "ACCESS_FINE_LOCATION", "ACCESS_BACKGROUND_LOCATION")),
            listOf(app("com.map", "ACCESS_FINE_LOCATION")), 1)
        eq(listOf(P + "ACCESS_BACKGROUND_LOCATION"), r.map { it.permission })
    }
    t("every rule permission is grantable") {
        // Runtime permissions RiskRules reports on; keep in sync so the record covers what we flag.
        val ruled = listOf("ACCESS_BACKGROUND_LOCATION", "READ_SMS", "RECEIVE_SMS", "READ_CALL_LOG", "BODY_SENSORS_BACKGROUND",
            "ACCESS_FINE_LOCATION", "RECORD_AUDIO", "CAMERA", "READ_CONTACTS", "READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO",
            "READ_EXTERNAL_STORAGE", "READ_PHONE_STATE", "ACCESS_COARSE_LOCATION", "BLUETOOTH_CONNECT", "NEARBY_WIFI_DEVICES",
            "POST_NOTIFICATIONS").map { P + it }
        eq(emptyList<String>(), ruled.filter { it !in Grantable.PERMISSIONS })
        for (perm in ruled) check(audit(listOf(app("com.x", perm))).isNotEmpty()) { "rules do not flag $perm" }
    }

    val c1 = Change.RuntimeRevoke("com.a", P + "CAMERA", 10)
    val c2 = Change.RuntimeRevoke("com.b", P + "READ_SMS", 20)
    t("recordAll records each once") {
        val l = Ledger.EMPTY.recordAll(listOf(c1, c2)).recordAll(listOf(c1.copy(atMillis = 30)))
        eq(listOf(c2, c1), l.pending())
    }
    t("reconcile marks re-granted as restored") {
        val l = Ledger.EMPTY.recordAll(listOf(c1, c2)).reconcile(listOf(app("com.a", "CAMERA"), app("com.b")))
        eq(listOf(c2), l.pending())
    }
    t("reconcile leaves missing apps pending") {
        eq(2, Ledger.EMPTY.recordAll(listOf(c1, c2)).reconcile(emptyList()).pending().size)
    }
    t("reconcile survives encode/decode") {
        val l = Ledger.EMPTY.recordAll(listOf(c1, c2)).reconcile(listOf(app("com.a", "CAMERA")))
        val (d, skipped) = Ledger.decode(l.encode())
        eq(0, skipped); eq(listOf(c2), d.pending())
    }
    t("revoke again after restore is recorded again") {
        val l = Ledger.EMPTY.record(c1).reconcile(listOf(app("com.a", "CAMERA"))).record(c1.copy(atMillis = 40))
        eq(listOf(c1.copy(atMillis = 40)), l.pending())
    }

    t("adb script lines, newest first") {
        val s = RestoreScript.adb(Ledger.EMPTY.recordAll(listOf(c1, c2)), Lang.EN)
        val cmds = s.lines().filter { !it.startsWith("#") }
        eq(listOf("adb shell pm grant com.b ${P}READ_SMS", "adb shell pm grant com.a ${P}CAMERA"), cmds)
        check(s.contains("2 command(s)")) { s }
    }
    t("adb script includes app-op undo") {
        val op = Change.AppOpSet("com.c", "SYSTEM_ALERT_WINDOW", "allow", "ignore", 50)
        val s = RestoreScript.adb(Ledger.EMPTY.record(op), Lang.ZH)
        eq("adb shell appops set com.c SYSTEM_ALERT_WINDOW allow", s.lines().last())
        check(s.startsWith("# Permission Checkup 恢复命令")) { s }
    }
    t("adb script empty ledger") {
        val s = RestoreScript.adb(Ledger.EMPTY, Lang.EN)
        eq(0, s.lines().count { !it.startsWith("#") })
    }
    t("adb script never prints shell syntax") {
        // decode() validates every field, so a hostile record cannot get in; check that end to end.
        val hostile = "permcheck-ledger v1\nR\t1\t0\tcom.a;rm\t${P}CAMERA\nR\t2\t0\tcom.a\t${P}CAMERA \$(id)\nR\t3\t0\tcom.ok\t${P}CAMERA"
        val (l, skipped) = Ledger.decode(hostile)
        eq(2, skipped)
        val cmds = RestoreScript.adb(l, Lang.EN).lines().filter { !it.startsWith("#") }
        eq(listOf("adb shell pm grant com.ok ${P}CAMERA"), cmds)
        for (line in cmds) check(Regex("^[A-Za-z0-9_. ]+$").matches(line)) { line }
    }
    t("restored items leave the script") {
        val l = Ledger.EMPTY.recordAll(listOf(c1, c2)).markRestored(c2)
        eq(listOf("adb shell pm grant com.a ${P}CAMERA"), RestoreScript.adb(l, Lang.EN).lines().filter { !it.startsWith("#") })
    }
    println("RestoreTest: $n passed")
}
