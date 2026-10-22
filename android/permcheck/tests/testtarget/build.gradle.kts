// SPDX-License-Identifier: GPL-3.0-or-later
// Test-only app for tests/emulator_flow.py: no code, it only declares runtime permissions that the
// emulator test grants and revokes with adb. Never shipped; not part of the Permission Checkup APK.
plugins {
    id("com.android.application")
}

android {
    namespace = "org.secureinchat.permchecktarget"
    compileSdk = 35
    defaultConfig {
        applicationId = "org.secureinchat.permchecktarget"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "test"
    }
}
