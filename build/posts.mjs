// Blog posts. Body is HTML using the .doc styles. Keep claims verifiable and scoped.
export const POSTS = [
  {
    slug: 'how-the-ip-leak-test-works',
    title: 'How the IP leak test works, and what it cannot see',
    desc: 'The six checks behind our IP leak test: public IP, WebRTC, IPv6, time zone, request headers and DNS. What each one measures, how it can be wrong, and which leaks a browser test can never catch.',
    date: '2026-10-20',
    body: `
    <p>A leak test is only useful if you know what it actually measures. This is a plain description of every check in our <a href="/tools/ip-leak-test/">IP leak test</a>, how it reaches its verdict, and where it can be wrong. The full source is in the <a href="https://github.com/Paul30028/secureinchat">site repository</a>.</p>

    <h2>The premise</h2>
    <p>If you use a VPN or proxy, websites should see the address of your VPN exit, not the address your internet provider gave you. A leak is any address, name or setting that still points at your real connection. The test runs entirely in your browser and compares several independent views of your connection.</p>

    <h2>1. Public IP</h2>
    <p>Our own server returns the address Cloudflare saw for your request, plus its network (ASN and organisation) and an approximate location. If you tick "I'm using a VPN or proxy", we check whether the network name looks like a hosting or VPN provider rather than a consumer internet provider.</p>
    <p><strong>How it can be wrong:</strong> that judgement is a guess based on the network's name. Residential VPN exits and some corporate VPNs look like ordinary providers and will be flagged as a warning, not a failure. Location comes from IP geolocation data and is often off by a city or more.</p>

    <h2>2. WebRTC</h2>
    <p>WebRTC lets a browser set up calls directly. To do that, the page asks a STUN server for your public address, and any web page can do this without a permission prompt. We query <code>stun.cloudflare.com</code> and read the candidate addresses the browser returns.</p>
    <ul>
      <li>A <strong>srflx</strong> candidate is the public address as seen by the STUN server. If it differs from the public IP in check 1, WebRTC is going around your VPN or proxy. That is a leak.</li>
      <li>A <strong>host</strong> candidate is a local network address. Current browsers normally replace it with a random <code>.local</code> name unless the page has camera or microphone permission, so you usually see the hidden form.</li>
    </ul>
    <p><strong>How it can be wrong:</strong> if UDP to the STUN server is blocked on your network, you will see no public candidate at all. That is not proof you are safe, only that the question could not be asked.</p>

    <h2>3. IPv6</h2>
    <p>Some VPNs tunnel IPv4 only. If your device also has IPv6, IPv6-capable sites can reach you through your provider's address, outside the tunnel. We fetch your address over IPv4 and over IPv6 separately, look up the network of the second address, and compare it with the network of your main address. Different networks mean IPv6 traffic is leaving outside your tunnel.</p>
    <p><strong>How it can be wrong:</strong> if the network lookup for the second address fails, we report a warning rather than guess.</p>

    <h2>4. Time zone</h2>
    <p>Your browser reports its system time zone no matter what your VPN does. We compare its offset with the time zone of your IP's location. A mismatch is a signal that anti-fraud systems read as "this person is hiding their location". It is a signal, not a leak in the strict sense, so it is shown as a warning.</p>

    <h2>5. Request headers</h2>
    <p>Proxies sometimes announce themselves with <code>Via</code>, <code>Forwarded</code> or <code>X-Forwarded-For</code> headers, and your <code>Accept-Language</code> may point at a different country than your IP. We list what arrived. Language mismatch is shown as information only, because it is a weak signal.</p>

    <h2>6. DNS: not tested</h2>
    <p>A DNS leak means your device asks your internet provider's resolver for domain names instead of your VPN's. A browser cannot observe which resolver answered. Testing it needs an authoritative DNS server that logs which resolver asks for a random subdomain. We do not run one yet, so the DNS row says "Not tested" rather than showing a reassuring tick. Treat any leak test that shows DNS results without such a server with suspicion.</p>

    <h2>What a browser test can never see</h2>
    <ul>
      <li>Traffic from other apps. Only your browser is tested, and a VPN can protect the browser while a torrent client or another program connects directly.</li>
      <li>What happens when the tunnel drops. Kill-switch behaviour has to be tested by disconnecting the VPN yourself.</li>
      <li>Leaks that depend on a specific site, such as a service that embeds your real address in a request.</li>
    </ul>

    <h2>What leaves your browser</h2>
    <p>When you press the button, your browser contacts our server, <code>api4.ipify.org</code> and <code>api6.ipify.org</code> for your addresses, <code>ipwho.is</code> to look up a second address's network, and <code>stun.cloudflare.com</code> for WebRTC. Each of them necessarily sees your IP address. External requests carry no cookies and no referrer. We store nothing from the test. Details are in the <a href="/privacy/">privacy policy</a>.</p>

    <h2>Reading the result</h2>
    <p>Run the test twice: once without the VPN to record your real network, and once with it on. A clean result means the checks above found nothing, not that nothing exists. If something fails, the tool page has a fix for each type of leak.</p>
    <p><a href="/tools/ip-leak-test/">Run the IP leak test</a></p>
`,
  },
  {
    slug: 'what-a-blind-relay-can-and-cannot-know',
    title: 'What a blind relay can and cannot know',
    desc: 'A blind relay forwards encrypted messages it cannot read. That still leaves metadata, and some jobs, like enforcing admin rights, cannot be done on the server. Design notes on what the trade-offs look like in practice.',
    date: '2026-10-20',
    body: `
    <p>"Zero-knowledge" is easy to say and hard to check. These are design notes on what a blind relay, the server type SecureInChat is built around, can and cannot know. They describe our current design. The clients are in development and have not been independently audited.</p>

    <h2>What a blind relay is</h2>
    <p>In a conventional chat service the server holds your messages and could read them. In a blind relay design the encryption keys stay on the devices, and the server only passes opaque encrypted payloads from one device to another. If the server is breached or compelled, it has no message content to hand over.</p>

    <h2>What it cannot know</h2>
    <ul>
      <li>The content of messages and files, because it never has the keys.</li>
      <li>Names that exist only on devices. In our design a group's display name is local to each device and is never sent to the relay.</li>
    </ul>

    <h2>What it still knows</h2>
    <p>A relay that routes traffic cannot avoid learning some metadata. Be sceptical of any product that claims otherwise.</p>
    <ul>
      <li>The network address a device connects from, as with any server.</li>
      <li>When devices connect and when messages arrive.</li>
      <li>The size of each payload, which can hint at its type.</li>
      <li>The identifiers needed to route messages, such as which group a device joins.</li>
    </ul>
    <p>Minimising this metadata, for example by not keeping connection history, is a design goal. Eliminating it is not realistic for a server that routes messages.</p>

    <h2>A job the server cannot do: enforcing admin rights</h2>
    <p>On a normal server, "only the admin may publish an announcement" is a database check. A blind relay cannot make that check without knowing who the admin is and what is being sent, which would undo the point of being blind. So the rule moves to the clients. In our design the group creator holds a signing key, announcements carry a signature, and every client rejects announcements it cannot verify. The cost is that admin rights belong to whoever holds the key, and losing it needs a recovery mechanism.</p>

    <h2>Removing a member</h2>
    <p>You cannot reach into a removed member's phone, so removal works by moving the group to new key material. The remaining members receive the new keys, the removed member does not, and later messages are unreadable to them. This has an honest limit: messages already delivered to the removed member's device stay readable there. It is also weaker than the continuous key ratcheting that Signal's protocol or MLS provide, and we do not claim equivalent security.</p>

    <h2>How to judge a "zero-knowledge" claim</h2>
    <ul>
      <li>Ask what the server can still see, and expect a specific answer about metadata.</li>
      <li>Ask who can change group membership or publish as an admin, and where that rule is enforced.</li>
      <li>Check whether the product separates design goals from independent audits and certifications.</li>
      <li>Treat words like "100%" and "unhackable" as a reason to ask more questions.</li>
    </ul>
    <p>You can see the relay's live handshake on the <a href="/#diagnostics">home page</a>. That test shows that a secure connection to the relay works; it does not prove anything about what the server does with data, and we do not present it as proof of that.</p>
`,
  },
];
