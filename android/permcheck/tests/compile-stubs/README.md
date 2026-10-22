Compile-only stubs of the handful of Android framework classes the app uses.
They let `tests/compile_app.sh` type-check `app/` with plain `kotlinc` when the Android SDK
is not available. They only prove our Kotlin compiles against *these* signatures;
they do not prove the signatures match the real SDK. A real Gradle build is still required.
