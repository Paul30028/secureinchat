# SecureInChat

An invite-only, end-to-end encrypted group messenger for small closed groups. It needs no phone number, no email address and no account. A group forms from an invite card shared in person (QR code or text). The relay server is blind: it forwards encrypted envelopes and never sees message content, file names, group names, or who the admin is.

Status: private trial. Not yet independently audited. Do not rely on it where a compromise would put people in danger until the audit and the work listed under "Known gaps" are done.

## What works today

- Text, images, voice messages, files; replies, @mentions, search
- One-to-one voice and video calls; group voice calls (mesh, up to about 8 people)
- Several groups at once; automatic reconnect; queued messages re-sent after reconnect
- Admin-signed announcement channels: the group creator's public key travels in the invite, and clients reject announcements without a valid signature, so the relay cannot forge them
- Member removal by key rotation: new key material and a new epoch, with a new invite sent only to those who stay; older invites are ignored
- Replay protection for messages and invites
- Local message history encrypted on the device; app lock with PIN or biometrics; screenshot protection; disappearing messages
- Connection diagnostics; per-group list of devices seen

## Known gaps

- No MLS. Groups use a shared group key with epoch rotation, so forward secrecy covers only messages after a member is removed, and there is no post-compromise security.
- The relay does not yet check that a device holds a valid invite for the group it joins.
- The app lock protects the screen; stored messages are encrypted with the device master key, not with the PIN.
- Key rotation cannot recall messages already delivered to a removed member.
- Admin rights are bound to the creating device; the recovery code is the only way back.

The full list is in `docs/PROJECT_HANDBOOK.md` section 7 (Chinese). The threat model is in `docs/security/THREAT_MODEL.md`.

## Repository layout

| Path | What it is |
| --- | --- |
| `apps/android-client/` | Android app (React 19, TypeScript, Vite, Capacitor 7) |
| `packages/protocol/` | Invite code encoding (SIC1/SIC2) |
| `packages/crypto-core/` | AEAD, HKDF, epochs, device keys, admin signatures (Web Crypto) |
| `packages/secure-storage/` | Encrypted key-value storage bound with AAD |
| `packages/chat-core/` | Relay client, envelopes, chunked files, offline queue, stores |
| `packages/webrtc/` | Call state machine and ICE configuration |
| `packages/ui/` | UI components and design tokens |
| `server/relay/` | Python websockets blind relay |
| `docs/` | Protocol, architecture, threat model, deployment |

## Tests

CI runs more than 700 automated tests: the TypeScript packages, the Python relay, cross-language integration tests that start a real relay process, and an APK build check.

## How it is built

Most of the code was written by AI systems to written specifications. Every change is compiled, tested and reviewed before it is merged. We say this so that reviewers judge the code on its merits; an independent audit is the next step.

## License

AGPL-3.0-or-later. See [LICENSE](LICENSE).

## Reporting a security problem

See [SECURITY.md](SECURITY.md).
