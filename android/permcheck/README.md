# Permission Checkup (Android) — work in progress

Shows which apps hold sensitive permissions and special access (accessibility, notification access, device admin, keyboard with internet, VPN, overlay, usage access), ranks them by risk, and opens each app's system settings so you can switch things off. The app itself will request **no INTERNET permission**.

Licensed GPL-3.0-or-later (see LICENSE), separate from the MIT-licensed website tools.

Status (2026-10-21): pure-Kotlin core module (`core/`) with risk rules and 19 passing tests. No Android UI yet; not released.

Test the core without Gradle:

    kotlinc core/src/main/kotlin core/src/test/kotlin -include-runtime -d /tmp/pc.jar
    java -cp /tmp/pc.jar org.secureinchat.permcheck.core.RiskRulesTestKt

Plan and sources: see the project document "app-permission-checkup-proposal".
