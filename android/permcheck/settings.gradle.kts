// SPDX-License-Identifier: GPL-3.0-or-later
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "permcheck"
include(":app")
// Test-only target app for the emulator flow test (tests/emulator_flow.py); not shipped.
include(":testtarget")
project(":testtarget").projectDir = file("tests/testtarget")
