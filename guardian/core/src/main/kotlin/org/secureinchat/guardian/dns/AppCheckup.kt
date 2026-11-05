// SPDX-License-Identifier: GPL-3.0-or-later
package org.secureinchat.guardian.dns

/**
 * G19 app checkup: which installed apps can watch the user, and which phone settings make that easier.
 * Pure logic (no Android types) so it is tested on the JVM; the app gathers [AppFacts] and [PhoneFacts].
 *
 * It states facts and why they matter, never "this app is malicious": Guardian cannot know whether an
 * app needs a permission. HIGH means "can watch you in a way stalkerware typically uses"; REVIEW means
 * "worth a look". Results are computed on demand and never written to storage.
 */
object AppCheckup {

    enum class Level { HIGH, REVIEW }

    enum class Signal(val level: Level) {
        /** Package name is on Echap's stalkerware list. */
        STALKERWARE(Level.HIGH),
        /** Package name is on Echap's "watchware" list (parental control / remote monitoring). */
        WATCHWARE(Level.REVIEW),
        /** An enabled accessibility service: can read the screen and act on it. */
        ACCESSIBILITY(Level.HIGH),
        /** An active device administrator: can lock or wipe the phone and resist removal. */
        DEVICE_ADMIN(Level.HIGH),
        /** Notification access: can read every notification, including messages and codes. */
        NOTIFICATION_LISTENER(Level.HIGH),
        /** No icon in the app drawer, yet holds a sensitive permission. */
        HIDDEN_WITH_SENSITIVE(Level.HIGH),
        /** Location even when the app is not in use. */
        BACKGROUND_LOCATION(Level.REVIEW),
        /** Can read or send SMS (Android reserves this for the SMS app in most cases). */
        SMS(Level.REVIEW),
        /** Can read the call log. */
        CALL_LOG(Level.REVIEW),
        /** A game holding microphone, camera, location or contacts. */
        GAME_SENSITIVE(Level.REVIEW),
        /** May draw over other apps (used to fake screens or hide what is happening). */
        OVERLAY(Level.REVIEW),
    }

    data class AppFacts(
        val packageName: String,
        val label: String,
        /** Preinstalled system app. They legitimately hold these powers, so only a list match is reported. */
        val isSystem: Boolean,
        val hasLauncher: Boolean,
        val isGame: Boolean,
        /** Granted runtime permissions, full names (android.permission.X). */
        val granted: Set<String>,
        val accessibility: Boolean = false,
        val deviceAdmin: Boolean = false,
        val notificationListener: Boolean = false,
        val overlay: Boolean = false,
    )

    data class Finding(val app: AppFacts, val level: Level, val signals: List<Signal>, val listedAs: String? = null)

    data class ListedApp(val name: String, val watchware: Boolean)

    private const val P = "android.permission."
    val LOCATION = setOf(P + "ACCESS_FINE_LOCATION", P + "ACCESS_COARSE_LOCATION")
    val BACKGROUND_LOCATION = P + "ACCESS_BACKGROUND_LOCATION"
    val MICROPHONE = setOf(P + "RECORD_AUDIO")
    val CAMERA = setOf(P + "CAMERA")
    val CONTACTS = setOf(P + "READ_CONTACTS")
    val SMS = setOf(P + "READ_SMS", P + "RECEIVE_SMS", P + "SEND_SMS")
    val CALL_LOG = setOf(P + "READ_CALL_LOG")
    val PHOTOS = setOf(P + "READ_MEDIA_IMAGES", P + "READ_MEDIA_VIDEO", P + "READ_EXTERNAL_STORAGE")

    /** Permissions that make an app able to watch a person. */
    val SENSITIVE: Set<String> = LOCATION + BACKGROUND_LOCATION + MICROPHONE + CAMERA + CONTACTS + SMS + CALL_LOG

    /**
     * Package names from a secure setting such as enabled_notification_listeners: component names
     * ("pkg/cls" or "pkg/.cls") separated by ':'. Malformed parts are skipped.
     */
    fun packagesOfComponents(value: String?): Set<String> =
        (value ?: "").split(':').mapNotNull { c ->
            val pkg = c.trim().substringBefore('/', "")
            if (pkg.isNotEmpty() && '/' in c) pkg else null
        }.toSet()

    /** Parses stalkerware-packages-echap.tsv: package TAB app TAB kind; '#' lines are comments. */
    fun parseList(text: String): Map<String, ListedApp> {
        val out = HashMap<String, ListedApp>()
        for (line in text.lineSequence()) {
            if (line.isBlank() || line.startsWith("#")) continue
            val f = line.split('\t')
            if (f.size < 3 || f[0].isBlank()) continue
            out.putIfAbsent(f[0].trim(), ListedApp(f[1].trim(), f[2].trim() == "watchware"))
        }
        return out
    }

    fun signalsFor(a: AppFacts, listed: ListedApp?): List<Signal> {
        val s = mutableListOf<Signal>()
        if (listed != null) s += if (listed.watchware) Signal.WATCHWARE else Signal.STALKERWARE
        // Preinstalled apps hold these powers by design; reporting them would bury the real signals.
        if (a.isSystem) return s
        if (a.accessibility) s += Signal.ACCESSIBILITY
        if (a.deviceAdmin) s += Signal.DEVICE_ADMIN
        if (a.notificationListener) s += Signal.NOTIFICATION_LISTENER
        if (!a.hasLauncher && a.granted.any { it in SENSITIVE }) s += Signal.HIDDEN_WITH_SENSITIVE
        if (BACKGROUND_LOCATION in a.granted) s += Signal.BACKGROUND_LOCATION
        if (a.granted.any { it in SMS }) s += Signal.SMS
        if (a.granted.any { it in CALL_LOG }) s += Signal.CALL_LOG
        if (a.isGame && a.granted.any { it in MICROPHONE + CAMERA + LOCATION + CONTACTS }) s += Signal.GAME_SENSITIVE
        if (a.overlay) s += Signal.OVERLAY
        return s
    }

    /** Findings, most serious first (HIGH before REVIEW, then by number of signals, then by name). */
    fun evaluate(apps: List<AppFacts>, list: Map<String, ListedApp>, selfPackage: String? = null): List<Finding> =
        apps.asSequence()
            .filter { it.packageName != selfPackage }
            .mapNotNull { a ->
                val listed = list[a.packageName]
                val sig = signalsFor(a, listed)
                if (sig.isEmpty()) null
                else Finding(a, if (sig.any { it.level == Level.HIGH }) Level.HIGH else Level.REVIEW, sig, listed?.name)
            }
            .sortedWith(compareBy<Finding>({ it.level.ordinal }, { -it.signals.size }, { it.app.label.lowercase() }))
            .toList()

    enum class Kind { LOCATION, BACKGROUND_LOCATION, MICROPHONE, CAMERA, CONTACTS, SMS, CALL_LOG, PHOTOS }

    /** How many non-system apps hold each kind of access (the "browse by permission" view). */
    fun counts(apps: List<AppFacts>, selfPackage: String? = null): Map<Kind, Int> {
        val user = apps.filter { !it.isSystem && it.packageName != selfPackage }
        fun n(set: Set<String>) = user.count { a -> a.granted.any { it in set } }
        return linkedMapOf(
            Kind.LOCATION to n(LOCATION),
            Kind.BACKGROUND_LOCATION to n(setOf(BACKGROUND_LOCATION)),
            Kind.MICROPHONE to n(MICROPHONE),
            Kind.CAMERA to n(CAMERA),
            Kind.CONTACTS to n(CONTACTS),
            Kind.SMS to n(SMS),
            Kind.CALL_LOG to n(CALL_LOG),
            Kind.PHOTOS to n(PHOTOS),
        )
    }

    /** Apps holding one kind of access, by name. */
    fun appsWith(kind: Kind, apps: List<AppFacts>, selfPackage: String? = null): List<AppFacts> {
        val set = when (kind) {
            Kind.LOCATION -> LOCATION
            Kind.BACKGROUND_LOCATION -> setOf(BACKGROUND_LOCATION)
            Kind.MICROPHONE -> MICROPHONE
            Kind.CAMERA -> CAMERA
            Kind.CONTACTS -> CONTACTS
            Kind.SMS -> SMS
            Kind.CALL_LOG -> CALL_LOG
            Kind.PHOTOS -> PHOTOS
        }
        return apps.filter { !it.isSystem && it.packageName != selfPackage && it.granted.any { p -> p in set } }
            .sortedBy { it.label.lowercase() }
    }

    // --- Phone settings ------------------------------------------------------------------------------

    /** null = Guardian could not find out; such checks are left out rather than guessed. */
    data class PhoneFacts(
        val screenLock: Boolean?,
        val usbDebugging: Boolean?,
        /** Build.VERSION.SECURITY_PATCH, "YYYY-MM-DD". */
        val securityPatch: String?,
        val todayYear: Int,
        val todayMonth: Int,
    )

    enum class PhoneIssue(val level: Level) {
        NO_SCREEN_LOCK(Level.HIGH),
        USB_DEBUGGING(Level.REVIEW),
        OLD_SECURITY_PATCH(Level.REVIEW),
    }

    /** Months between the security patch and today, or null if the date cannot be read. */
    fun patchAgeMonths(patch: String?, year: Int, month: Int): Int? {
        val m = Regex("""^(\d{4})-(\d{2})""").find(patch ?: return null) ?: return null
        val py = m.groupValues[1].toInt()
        val pm = m.groupValues[2].toInt()
        if (pm !in 1..12) return null
        return (year - py) * 12 + (month - pm)
    }

    /** A security patch this old (in months) or older is reported. */
    const val OLD_PATCH_MONTHS = 6

    fun phoneIssues(f: PhoneFacts): List<PhoneIssue> {
        val out = mutableListOf<PhoneIssue>()
        if (f.screenLock == false) out += PhoneIssue.NO_SCREEN_LOCK
        if (f.usbDebugging == true) out += PhoneIssue.USB_DEBUGGING
        val age = patchAgeMonths(f.securityPatch, f.todayYear, f.todayMonth)
        if (age != null && age >= OLD_PATCH_MONTHS) out += PhoneIssue.OLD_SECURITY_PATCH
        return out
    }
}
