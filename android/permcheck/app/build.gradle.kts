// SPDX-License-Identifier: GPL-3.0-or-later
// No library dependencies on purpose: only the Android framework and the Kotlin stdlib.
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "org.secureinchat.permcheck"
    compileSdk = 35
    defaultConfig {
        applicationId = "org.secureinchat.permcheck"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
    sourceSets["main"].java.srcDirs("src/main/kotlin", "../core/src/main/kotlin")
    buildTypes {
        release { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
