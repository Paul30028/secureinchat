# Security policy

SecureInChat has not been independently audited yet. Please read the "Known gaps" section of [README.en.md](README.en.md) before relying on it.

## Reporting a vulnerability

Email **x@secureinchat.com** with "SECURITY" in the subject. Please include:

- what you found and which component (app, relay, protocol, crypto)
- steps to reproduce, or a proof of concept
- the commit or app version you tested

Please do not open a public GitHub issue for a vulnerability that could put users at risk before it is fixed.

We will acknowledge your report within 7 days, tell you what we plan to do, and credit you in the release notes unless you prefer not to be named.

## Scope

In scope: `apps/`, `packages/`, `server/relay/`, and the protocol documents in `docs/`.

Out of scope: the website code in other branches, and attacks that require an already compromised device.
