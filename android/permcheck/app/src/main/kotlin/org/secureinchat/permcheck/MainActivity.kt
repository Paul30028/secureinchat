// SPDX-License-Identifier: GPL-3.0-or-later
// T7-b: the one screen. Plain framework views, no libraries.
// Flow: scan -> ranked list -> "Open settings" -> user switches it off -> back here -> automatic recheck.
// Status: not yet compiled against the Android SDK or run on a device (see README).
package org.secureinchat.permcheck

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Intent
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PersistableBundle
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import org.secureinchat.permcheck.core.Finding
import org.secureinchat.permcheck.core.Lang
import org.secureinchat.permcheck.core.Reasons
import org.secureinchat.permcheck.core.Recheck
import org.secureinchat.permcheck.core.Risk
import org.secureinchat.permcheck.core.Target
import org.secureinchat.permcheck.core.audit
import org.secureinchat.permcheck.core.collect
import org.secureinchat.permcheck.core.recheck
import org.secureinchat.permcheck.core.report
import org.secureinchat.permcheck.core.summary
import org.secureinchat.permcheck.core.targetFor
import java.util.Locale

class MainActivity : Activity() {
    private lateinit var list: LinearLayout
    private lateinit var status: TextView
    private val lang = if (Locale.getDefault().language == "zh") Lang.ZH else Lang.EN
    private var findings: List<Finding> = emptyList()
    private var awaitingReturn = false
    @Volatile private var scanning = false

    private fun tr(en: String, zh: String) = if (lang == Lang.ZH) zh else en

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = dp(16)
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        root.addView(TextView(this).apply {
            text = tr("Permission Checkup", "权限体检"); textSize = 22f; setTypeface(typeface, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = tr(
                "This app has no internet permission. It only reads settings and opens system pages; you switch things off yourself.",
                "本 App 没有联网权限。它只读取设置并打开系统页面,关闭由你自己操作。",
            )
        })
        status = TextView(this).apply { textSize = 16f; setPadding(0, pad, 0, pad / 2) }
        root.addView(status)
        val actions = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        actions.addView(Button(this).apply { text = tr("Scan again", "重新检查"); setOnClickListener { startScan(null) } })
        actions.addView(Button(this).apply { text = tr("Copy report", "复制报告"); setOnClickListener { copyReport() } })
        root.addView(actions)
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(list)
        setContentView(ScrollView(this).apply { addView(root) })
        startScan(null)
    }

    override fun onResume() {
        super.onResume()
        if (awaitingReturn) {
            awaitingReturn = false
            startScan(findings) // came back from Settings: recheck against what we showed before
        }
    }

    private fun startScan(before: List<Finding>?) {
        if (scanning) return
        scanning = true
        status.text = tr("Checking…", "检查中…")
        Thread {
            val result = try {
                val s = SystemReader(applicationContext).scan()
                audit(collect(s.apps, s.special, packageName))
            } catch (e: RuntimeException) {
                null
            }
            runOnUiThread {
                scanning = false
                if (result == null) {
                    status.text = tr("Could not read app settings on this phone.", "无法读取本机的 App 设置。")
                } else {
                    findings = result
                    render(if (before != null) recheck(before, result) else null)
                }
            }
        }.start()
    }

    private fun render(rc: Recheck?) {
        val s = summary(findings)
        val counts = tr(
            "High ${s[Risk.HIGH]} · Medium ${s[Risk.MEDIUM]} · Low ${s[Risk.LOW]}",
            "高 ${s[Risk.HIGH]} · 中 ${s[Risk.MEDIUM]} · 低 ${s[Risk.LOW]}",
        )
        status.text = if (rc == null) counts else counts + "\n" + recheckLine(rc)
        list.removeAllViews()
        if (findings.isEmpty()) {
            list.addView(TextView(this).apply { text = tr("Nothing on our list was found.", "没有发现清单中的项目。") })
            return
        }
        for (f in findings) list.addView(row(f))
    }

    private fun recheckLine(rc: Recheck): String = when {
        rc.fixed.isNotEmpty() -> tr("Switched off: ", "已关闭:") + rc.fixed.joinToString { "${it.label} · ${title(it)}" }
        else -> tr("No change yet. Some settings only apply after you leave the page.", "暂无变化。有些设置要离开页面后才生效。")
    } + if (rc.added.isNotEmpty()) tr("\nNew: ", "\n新出现:") + rc.added.joinToString { "${it.label} · ${title(it)}" } else ""

    private fun title(f: Finding) = Reasons.get(f.reasonKey, lang)?.title ?: f.item

    private fun row(f: Finding): View {
        val r = Reasons.get(f.reasonKey, lang)
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(12), 0, dp(4)) }
        val tag = when (f.risk) { Risk.HIGH -> tr("HIGH", "高"); Risk.MEDIUM -> tr("MEDIUM", "中"); Risk.LOW -> tr("LOW", "低") }
        box.addView(TextView(this).apply {
            text = "[$tag] ${f.label} — ${r?.title ?: f.item}"; textSize = 16f; setTypeface(typeface, Typeface.BOLD)
        })
        if (r != null) box.addView(TextView(this).apply { text = r.allows })
        box.addView(TextView(this).apply { text = f.packageName; textSize = 12f })
        box.addView(Button(this).apply { text = tr("Open settings", "打开设置"); setOnClickListener { open(f) } })
        return box
    }

    private fun open(f: Finding) {
        val t = targetFor(f)
        val action = when (t) {
            Target.APP_DETAILS -> Settings.ACTION_APPLICATION_DETAILS_SETTINGS
            Target.ACCESSIBILITY -> Settings.ACTION_ACCESSIBILITY_SETTINGS
            Target.NOTIFICATION_LISTENER -> Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
            Target.SECURITY -> Settings.ACTION_SECURITY_SETTINGS
            Target.INPUT_METHOD -> Settings.ACTION_INPUT_METHOD_SETTINGS
            Target.VPN -> Settings.ACTION_VPN_SETTINGS
            Target.OVERLAY -> Settings.ACTION_MANAGE_OVERLAY_PERMISSION
            Target.USAGE_ACCESS -> Settings.ACTION_USAGE_ACCESS_SETTINGS
        }
        val pkgUri = Uri.fromParts("package", f.packageName, null)
        val tries = listOf(
            Intent(action).apply { if (t.withPackage) data = pkgUri },
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri), // vendor builds sometimes lack a page
            Intent(Settings.ACTION_SETTINGS),
        )
        for (i in tries) {
            try {
                startActivity(i)
                awaitingReturn = true
                return
            } catch (e: ActivityNotFoundException) {
                // try the next, more general page
            }
        }
        Toast.makeText(this, tr("Could not open Settings.", "无法打开设置。"), Toast.LENGTH_SHORT).show()
    }

    private fun copyReport() {
        val cm = getSystemService(ClipboardManager::class.java) ?: return
        val clip = ClipData.newPlainText("Permission Checkup", report(findings, lang))
        if (Build.VERSION.SDK_INT >= 33) {
            // Hide the clipboard preview: the report lists your apps.
            clip.description.extras = PersistableBundle().apply { putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true) }
        }
        cm.setPrimaryClip(clip)
        Toast.makeText(this, tr("Report copied. Nothing was sent.", "报告已复制,没有发送任何数据。"), Toast.LENGTH_SHORT).show()
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
