// Trust pages: vulnerability reporting, how we test, messenger threat model (2026-10-23).
// Every statement here describes what exists in the repository or what other pages already say.

export const SECURITY_TXT = `Contact: mailto:x@secureinchat.com
Expires: 2027-10-22T00:00:00.000Z
Preferred-Languages: en, zh
Canonical: https://secureinchat.com/.well-known/security.txt
Policy: https://secureinchat.com/security/
`;

export const SECURITY = `    <h1>Report a security problem</h1>
    <p class="meta">Last updated: 2026-10-23</p>
    <p class="lead">If you find a way that a SecureInChat tool, page or service could expose someone's data, please tell us. We would rather hear it from you than from an attacker.</p>
    <h2>How to report</h2>
    <ul>
      <li>Email <a href="mailto:x@secureinchat.com">x@secureinchat.com</a> with a short description, the page or service, and the steps that show the problem.</li>
      <li>Do not include other people's personal data. Test with your own accounts, devices and files.</li>
      <li>If the problem is serious, please do not publish it until we have had a reasonable chance to fix it.</li>
    </ul>
    <p>The same contact details are in our <a href="/.well-known/security.txt">security.txt</a> file.</p>
    <h2>What is in scope</h2>
    <ul>
      <li>This website and its tools under /tools/.</li>
      <li>The tool lookup services we run: /tools/api/, dnsapi.secureinchat.com and the lk.secureinchat.com DNS test.</li>
      <li>The messaging relay at wss://ws.secureinchat.com.</li>
      <li>The Permission Checkup app for Android.</li>
    </ul>
    <p>Outside services our tools contact, such as ipify, ipwho.is and Pwned Passwords, are run by others. Please report problems with them to their operators.</p>
    <h2>Good-faith research</h2>
    <p>We will not take action against research that follows these rules:</p>
    <ul>
      <li>No denial-of-service testing and no automated scanning that loads the services heavily.</li>
      <li>No access to, change of, or deletion of anyone else's data.</li>
      <li>No social engineering of people and no physical attacks.</li>
      <li>Stop and tell us as soon as you reach data that is not yours.</li>
    </ul>
    <h2>What happens next</h2>
    <p>We read every report and reply by email. When a report leads to a fix, we can credit you on this page if you want, under the name you choose.</p>
    <p>We do not run a paid bug bounty at present.</p>
`;

export const TESTING = `    <h1>How we test</h1>
    <p class="meta">Last updated: 2026-10-23</p>
    <p class="lead">Every release of this site runs 20 groups of automated tests before it goes live. This page says what they check, and what they do not.</p>
    <h2>The website and tools</h2>
    <ul>
      <li>Tool pages are opened in a real Chromium browser, served with the same Content Security Policy headers the live site uses.</li>
      <li>For tools that say they run on your device (photo metadata, text redaction, link checker, fingerprint test, account and phone checklists), the tests record every network request and fail if anything leaves the page.</li>
      <li>Tools that use outside lookups are tested with those services mocked, so the tests check how results are judged without sending real addresses anywhere.</li>
      <li>The photo metadata remover is tested with JPEG, PNG and WebP files, rotated photos, photos with no metadata, a 35-megapixel photo, corrupt files and formats it does not support.</li>
      <li>The logic of the password, redaction, link and account tools has its own unit tests.</li>
      <li>Every internal link on every page must point to a page that exists, and the main pages are checked for missing files, console and CSP errors, and horizontal overflow on a phone-sized screen.</li>
      <li>The Chinese pages are checked for rules we set for them, such as which tools they link to.</li>
    </ul>
    <h2>The Android app</h2>
    <p>Permission Checkup is built on GitHub Actions on every change:</p>
    <ul>
      <li>Core logic tests in plain Kotlin.</li>
      <li>A policy check that the app requests no INTERNET permission and has no third-party dependencies, plus an inspection of the built APK's permissions.</li>
      <li>Android lint.</li>
      <li>Launch tests on Android 10 and Android 14 emulators, and a flow test that revokes a permission, records it, restarts the app and restores it.</li>
    </ul>
    <h2>What these tests do not prove</h2>
    <ul>
      <li>They are our own tests. Nothing on this site has had an independent security audit.</li>
      <li>The website tests use Chromium. Firefox and Safari are checked by hand at most.</li>
      <li>The Android app has not yet been tested on a physical phone.</li>
      <li>A passing test means the code does what we wrote down. It does not prove the design is right.</li>
    </ul>
    <p>The status labels on each page say what was tested and what was only documented. See <a href="/principles/">what each tool sends</a>, and <a href="/security/">report a problem</a> if you find one.</p>
`;

export const THREAT_MODEL = `    <h1>Messenger threat model</h1>
    <p class="meta">Last updated: 2026-10-23</p>
    <p class="lead">What the SecureInChat messenger is designed to protect, from whom, and what it cannot hide. The apps are in development and have not been independently audited, so this describes the design, not verified behaviour.</p>
    <h2>What it is designed to protect</h2>
    <ul>
      <li>The content of messages and files. Keys stay on the devices, and the relay only forwards encrypted payloads it cannot decrypt.</li>
      <li>Group names. In the design a group's display name exists only on each device and is never sent to the relay.</li>
      <li>Announcements from the group admin. They carry a signature from the creator's key, and every client rejects announcements it cannot verify.</li>
    </ul>
    <h2>Who it is designed to resist</h2>
    <ul>
      <li>Someone who breaches the relay, or compels its operator to hand over data. The relay has no message content and is designed without persistent storage of message content.</li>
      <li>Someone watching the network between a device and the relay. Connections use TLS, and the payload inside is encrypted again end to end.</li>
    </ul>
    <h2>What the relay can still see</h2>
    <p>A relay that routes messages cannot avoid some metadata. In the current design it sees:</p>
    <ul>
      <li>The network address each device connects from.</li>
      <li>When devices connect and when messages arrive.</li>
      <li>The size of each payload, which can hint at its type.</li>
      <li>The identifiers needed to route messages, such as which group a device joins.</li>
    </ul>
    <p>Not keeping connection history is a design goal. Removing this metadata entirely is not realistic for a server that routes messages.</p>
    <h2>What it does not protect against</h2>
    <ul>
      <li>A compromised phone. Malware, or someone holding your unlocked device, can read what you can read.</li>
      <li>People in the group. Anyone who receives a message can copy it, screenshot it or forward it.</li>
      <li>Removed members keeping old messages. Removal moves the group to new keys, so later messages are unreadable to them, but messages already delivered stay on their device.</li>
      <li>Losing the admin key. Admin rights belong to whoever holds the creator's signing key, so losing it needs a recovery step.</li>
    </ul>
    <h2>How it compares</h2>
    <p>Group key changes on removal are weaker than the continuous key ratcheting that the Signal protocol or MLS provide. We do not claim equivalent security.</p>
    <h2>Building blocks</h2>
    <ul>
      <li>Curve25519 for key agreement.</li>
      <li>AES-256-GCM for authenticated encryption of each message.</li>
      <li>HKDF for context-separated derivation of session and message keys.</li>
    </ul>
    <p>These name the primitives in the design. They are not a certification. More detail: <a href="/blog/what-a-blind-relay-can-and-cannot-know/">what a blind relay can and cannot know</a>. You can <a href="/messaging/">check the live relay connection</a> from your browser.</p>
`;
