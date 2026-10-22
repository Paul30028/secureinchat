// SPDX-License-Identifier: GPL-3.0-or-later
// T7-b: plain-language text for each finding, English and Simplified Chinese.
// Wording describes what the access allows, not what any given app does with it.
package org.secureinchat.permcheck.core

enum class Lang { EN, ZH }

data class Reason(val title: String, val allows: String)

object Reasons {
    private val en = mapOf(
        "background_location" to Reason("Location all the time", "Can read where you are even when you are not using the app."),
        "read_sms" to Reason("Read text messages", "Can read your SMS, including one-time login codes."),
        "receive_sms" to Reason("Receive text messages", "Is told about incoming SMS, including one-time login codes."),
        "read_call_log" to Reason("Read call history", "Can see who you called, who called you, and when."),
        "body_sensors_background" to Reason("Body sensors in background", "Can read heart rate and other body sensors when not in use."),
        "fine_location" to Reason("Precise location", "Can read your exact location while you use the app."),
        "record_audio" to Reason("Microphone", "Can record audio while you use the app."),
        "camera" to Reason("Camera", "Can take photos and video while you use the app."),
        "read_contacts" to Reason("Contacts", "Can read names, numbers and emails of everyone in your contacts."),
        "read_media_images" to Reason("Photos", "Can read the photos on this phone."),
        "read_media_video" to Reason("Videos", "Can read the videos on this phone."),
        "read_external_storage" to Reason("Shared storage", "Can read files in shared storage (older Android versions)."),
        "read_phone_state" to Reason("Phone status", "Can read phone number details, network and call state."),
        "coarse_location" to Reason("Approximate location", "Can read your rough location while you use the app."),
        "bluetooth_connect" to Reason("Nearby Bluetooth devices", "Can connect to paired Bluetooth devices."),
        "nearby_wifi_devices" to Reason("Nearby Wi-Fi devices", "Can find and connect to nearby Wi-Fi devices."),
        "post_notifications" to Reason("Notifications", "Can show you notifications."),
        "record_audio_ai" to Reason("Microphone (AI app)", "An AI app with microphone access may send what it hears to its servers for processing."),
        "camera_ai" to Reason("Camera (AI app)", "An AI app with camera access may send images to its servers for processing."),
        "read_media_images_ai" to Reason("Photos (AI app)", "An AI app that can read your photos may upload them for processing."),
        "accessibility" to Reason("Accessibility service", "Can read everything on screen and tap or type for you in other apps."),
        "notification_listener" to Reason("Notification access", "Can read every notification, including message previews and login codes."),
        "device_admin" to Reason("Device admin", "Can lock the phone, enforce screen-lock rules, or erase it, and is harder to uninstall."),
        "vpn" to Reason("Can act as a VPN", "Can route your internet traffic through itself when you turn its VPN on."),
        "overlay" to Reason("Display over other apps", "Can draw on top of other apps, which can be used to imitate them."),
        "overlay_ai" to Reason("Display over other apps (AI app)", "An AI app that draws over other apps can sit on top of what you are doing."),
        "usage_stats" to Reason("Usage access", "Can see which apps you use and for how long."),
        "keyboard_internet" to Reason("Keyboard with internet", "Your current keyboard can see everything you type and is allowed to go online."),
    )
    private val zh = mapOf(
        "background_location" to Reason("始终允许定位", "不在使用这个 App 时也能读取你的位置。"),
        "read_sms" to Reason("读取短信", "能读取你的短信,包括登录验证码。"),
        "receive_sms" to Reason("接收短信", "收到短信时会被通知,包括登录验证码。"),
        "read_call_log" to Reason("读取通话记录", "能看到你给谁打过电话、谁打给你、什么时间。"),
        "body_sensors_background" to Reason("后台身体传感器", "不使用时也能读取心率等身体传感器。"),
        "fine_location" to Reason("精确位置", "使用 App 时能读取你的精确位置。"),
        "record_audio" to Reason("麦克风", "使用 App 时能录音。"),
        "camera" to Reason("相机", "使用 App 时能拍照和录像。"),
        "read_contacts" to Reason("通讯录", "能读取通讯录里所有人的姓名、号码和邮箱。"),
        "read_media_images" to Reason("照片", "能读取手机里的照片。"),
        "read_media_video" to Reason("视频", "能读取手机里的视频。"),
        "read_external_storage" to Reason("共享存储", "能读取共享存储中的文件(旧版安卓)。"),
        "read_phone_state" to Reason("电话状态", "能读取手机号码相关信息、网络和通话状态。"),
        "coarse_location" to Reason("大致位置", "使用 App 时能读取你的大致位置。"),
        "bluetooth_connect" to Reason("附近蓝牙设备", "能连接已配对的蓝牙设备。"),
        "nearby_wifi_devices" to Reason("附近 Wi-Fi 设备", "能发现并连接附近的 Wi-Fi 设备。"),
        "post_notifications" to Reason("通知", "能给你发通知。"),
        "record_audio_ai" to Reason("麦克风(AI 应用)", "有麦克风权限的 AI 应用可能把听到的内容发到服务器处理。"),
        "camera_ai" to Reason("相机(AI 应用)", "有相机权限的 AI 应用可能把画面发到服务器处理。"),
        "read_media_images_ai" to Reason("照片(AI 应用)", "能读照片的 AI 应用可能上传照片进行处理。"),
        "accessibility" to Reason("无障碍服务", "能读取屏幕上的一切内容,并在其他 App 里替你点击和输入。"),
        "notification_listener" to Reason("通知读取", "能读取所有通知,包括消息预览和验证码。"),
        "device_admin" to Reason("设备管理员", "能锁定手机、强制锁屏规则或清除数据,而且更难卸载。"),
        "vpn" to Reason("可以作为 VPN", "你打开它的 VPN 后,上网流量会经过它。"),
        "overlay" to Reason("显示在其他应用上层", "能在其他 App 上面绘制内容,可被用来伪装成其他 App。"),
        "overlay_ai" to Reason("显示在其他应用上层(AI 应用)", "能悬浮在其他 App 上的 AI 应用可以覆盖你正在做的事。"),
        "usage_stats" to Reason("使用情况访问", "能看到你用了哪些 App、用了多久。"),
        "keyboard_internet" to Reason("可联网的输入法", "你当前的输入法能看到你输入的一切,而且被允许联网。"),
    )

    fun get(key: String, lang: Lang): Reason? = (if (lang == Lang.ZH) zh else en)[key]
    fun keys(lang: Lang): Set<String> = (if (lang == Lang.ZH) zh else en).keys
}

/** Where to send the user to switch a finding off. The Android layer maps each to a Settings action. */
enum class Target(val withPackage: Boolean) {
    APP_DETAILS(true), ACCESSIBILITY(false), NOTIFICATION_LISTENER(false), SECURITY(false),
    INPUT_METHOD(false), VPN(false), OVERLAY(true), USAGE_ACCESS(false),
}

fun targetFor(f: Finding): Target = when (f.item) {
    Special.ACCESSIBILITY.name -> Target.ACCESSIBILITY
    Special.NOTIFICATION_LISTENER.name -> Target.NOTIFICATION_LISTENER
    Special.DEVICE_ADMIN.name -> Target.SECURITY
    Special.DEFAULT_KEYBOARD.name -> Target.INPUT_METHOD
    Special.VPN.name -> Target.VPN
    Special.OVERLAY.name -> Target.OVERLAY
    Special.USAGE_STATS.name -> Target.USAGE_ACCESS
    else -> Target.APP_DETAILS
}

/** Result of re-scanning after the user came back from Settings. */
data class Recheck(val fixed: List<Finding>, val remaining: List<Finding>, val added: List<Finding>)

private fun Finding.id() = "$packageName|$item"

fun recheck(before: List<Finding>, after: List<Finding>): Recheck {
    val afterIds = after.map { it.id() }.toSet()
    val beforeIds = before.map { it.id() }.toSet()
    return Recheck(
        fixed = before.filter { it.id() !in afterIds },
        remaining = after.filter { it.id() in beforeIds },
        added = after.filter { it.id() !in beforeIds },
    )
}

/** Plain-text report the user can copy. Nothing leaves the phone unless the user pastes it somewhere. */
fun report(findings: List<Finding>, lang: Lang): String {
    val s = summary(findings)
    val zh = lang == Lang.ZH
    val sb = StringBuilder()
    sb.appendLine(if (zh) "Permission Checkup 本地报告" else "Permission Checkup local report")
    sb.appendLine(
        if (zh) "高 ${s[Risk.HIGH]} · 中 ${s[Risk.MEDIUM]} · 低 ${s[Risk.LOW]}"
        else "High ${s[Risk.HIGH]} · Medium ${s[Risk.MEDIUM]} · Low ${s[Risk.LOW]}"
    )
    var current: Risk? = null
    for (f in findings) {
        if (f.risk != current) {
            current = f.risk
            sb.appendLine()
            sb.appendLine(
                when (f.risk) {
                    Risk.HIGH -> if (zh) "== 高风险 ==" else "== High =="
                    Risk.MEDIUM -> if (zh) "== 中风险 ==" else "== Medium =="
                    Risk.LOW -> if (zh) "== 低风险 ==" else "== Low =="
                }
            )
        }
        val r = Reasons.get(f.reasonKey, lang)
        sb.appendLine("- ${f.label} (${f.packageName}): ${r?.title ?: f.item}")
    }
    sb.appendLine()
    sb.append(
        if (zh) "本 App 没有联网权限,报告只在你的手机上生成。"
        else "This app has no internet permission; the report was made on your phone."
    )
    return sb.toString()
}
