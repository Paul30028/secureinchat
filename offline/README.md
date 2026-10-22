# Offline messaging protocol core (prototype)

Pure Kotlin, no crypto implementation (behind the Aead interface). Envelope format, associated data, duplicate cache, replay guard, expiry, relay hop limit.
Drafted by DeepSeek (T12), reviewed by Claude: senders can now build the associated data; unknown senders are BadAuth; damaged persisted state is skipped; the test AEAD now binds key, nonce and AD. 38 tests pass.

Known limitation: the replay guard accepts only strictly increasing counters per sender, so out-of-order delivery on a mesh drops older messages. A sliding window is the next step.

Run: kotlinc offline/core/src -include-runtime -d /tmp/o.jar && java -cp /tmp/o.jar org.secureinchat.offline.core.OfflineTestKt

See docs/offline-mode-feasibility-2026-10-22.md in the project.
