// Blog posts. Body is HTML using the .doc styles. Keep claims verifiable and scoped.
export const POSTS = [
  {
    slug: 'bank-statement-before-ai-upload',
    title: 'Before you upload a bank statement to an AI chatbot: what to remove, and what our redactor misses',
    desc: 'We ran our text redactor on a made-up bank statement. It caught the card, email and phone number, and missed the name, address and account number. What to remove by hand before you paste or upload financial text to an AI assistant.',
    date: '2026-10-20',
    body: `
    <p>Many people ask an AI assistant to summarise a bank or card statement. Before you do, decide what the assistant needs to see. This page does not claim what any AI provider does with uploads: policies differ and change, so read the provider's current data-controls page. It covers the part you control, which is what you hand over.</p>

    <h2>What we tested</h2>
    <p>We wrote a fake statement and ran it through our <a href="/tools/text-redactor/">text redactor</a>, which works in your browser and uploads nothing. The made-up input had a name, a street address, an account number, a sort code, an IBAN, a card number, an email, a phone number and two transactions.</p>
    <ul>
      <li><strong>Found and replaced:</strong> the card number (after a checksum check), the email address and the phone number. After this test we also added IBAN detection, with the standard checksum, so a valid IBAN is now replaced too.</li>
      <li><strong>Not found:</strong> the account holder's name, the street address, the plain account number, the sort code, the employer in the payroll line and the names of people paid. These have no fixed pattern, so a pattern tool cannot know them.</li>
    </ul>
    <p>That is the honest limit of any automatic redaction: it finds formats, not meaning. Read the result yourself.</p>

    <h2>Remove by hand before you share</h2>
    <ul>
      <li>Your name and address, and the names of people you pay or receive from.</li>
      <li>Account numbers, sort codes, routing numbers and IBANs. Card numbers, even partial ones.</li>
      <li>Reference numbers, customer IDs and anything that identifies the statement or the account.</li>
      <li>Employer names in payroll lines, and unusual merchant names that point to where you live or work.</li>
    </ul>

    <h2>A safer way to ask</h2>
    <ol>
      <li>Copy only the lines you need, not the whole document. A PDF cannot be pasted into our tool as a file; copy the text out of it.</li>
      <li>Run the text through the redactor, then read the output and replace names and addresses yourself, for example with [NAME] and [ADDRESS].</li>
      <li>Ask the question about the pattern, such as "which of these are subscriptions", rather than uploading the original.</li>
    </ol>

    <h2>What this does not do</h2>
    <p>It does not make an upload safe, and it does not remove information that can be worked out from context. If a statement is truly sensitive, think twice about sharing it at all. Related: <a href="/blog/redact-text-before-you-share-it/">redact text before you share it</a>.</p>`,
  },
  {
    slug: 'photo-before-ai-upload',
    title: 'What a photo reveals when you upload it to an AI chatbot, and how to remove it first',
    desc: 'Phone photos usually carry hidden EXIF data such as GPS position, device and time. What it contains, what removal does and does not cover, and a step-by-step way to clean a photo in your browser before you upload it.',
    date: '2026-10-20',
    body: `
    <p>When you send a photo to an AI assistant, you send the picture and, unless something removed it, the hidden data stored in the file. We do not claim what a given provider keeps or ignores; that varies and changes. What you can control is what the file contains.</p>

    <h2>What is hidden in a phone photo</h2>
    <p>Phone and camera JPEGs usually carry EXIF data: the device make and model, the date and time, often GPS coordinates, and sometimes the software, lens or a serial number. You can see it with our <a href="/tools/photo-metadata-remover/">photo metadata remover</a>, which reads the file in your browser and never uploads it.</p>

    <h2>How to clean a photo before you upload it</h2>
    <ol>
      <li>Open the photo metadata remover and choose the photo. It shows the GPS location, device and dates found in a JPEG.</li>
      <li>Save the clean copy. The page redraws the image onto a blank canvas and saves that as a new file, then re-reads the new JPEG to check no EXIF is left.</li>
      <li>Upload the clean copy instead of the original.</li>
    </ol>

    <h2>What this does not remove</h2>
    <ul>
      <li>Anything visible in the picture: a street sign, a house number, a face, a landmark, a document on a desk, or a screen with text on it.</li>
      <li>Formats it cannot read: HEIC and animated images are not supported; JPEG, PNG and WebP are.</li>
      <li>A small quality loss is possible when a JPEG is re-encoded, and the colour profile is dropped.</li>
    </ul>
    <p>So before you upload, also look at the picture itself: crop or cover anything that identifies where you are or who is in it. Related: <a href="/tools/text-redactor/">text redactor</a> for the text you paste next to it.</p>`,
  },
  {
    slug: 'cv-before-ai-upload',
    title: 'Before you paste your CV into an AI tool: what to take out',
    desc: 'A CV holds your name, contact details, addresses, dates and employer history. What to remove or generalise before you ask an AI assistant to improve it, and what automatic redaction can and cannot do.',
    date: '2026-10-20',
    body: `
    <p>People paste CVs into AI assistants to get them rewritten or tailored. A CV is dense with personal data. We make no claim about what any provider does with it; check the current data-controls page of the service you use. Here is what you control.</p>

    <h2>What a CV usually contains</h2>
    <ul>
      <li>Full name, email, phone number, home address and links to profiles.</li>
      <li>Employers, job titles and dates, which together can identify you even without your name.</li>
      <li>Sometimes date of birth, nationality, photo, and references with their contact details.</li>
    </ul>

    <h2>What to take out first</h2>
    <ol>
      <li>Run the text through our <a href="/tools/text-redactor/">text redactor</a> in your browser. It replaces emails and phone numbers with placeholders. Nothing is uploaded.</li>
      <li>Replace your name and address with [NAME] and [ADDRESS] yourself. A pattern tool does not recognise names or street addresses.</li>
      <li>Generalise identifying details if the task allows it: "a mid-size UK retailer" instead of the employer's name.</li>
      <li>Leave out references' contact details and anything you would not post publicly.</li>
    </ol>

    <h2>Put the details back afterwards</h2>
    <p>The redactor gives equal values the same placeholder, such as [EMAIL_1], so the improved text keeps its structure. When the assistant returns the text, put your real details back by hand.</p>

    <h2>Limits</h2>
    <p>Redaction finds formats, not meaning, so read the result. Rewriting a CV without personal data does not stop the content itself from being yours: unusual projects or employers can still point to you.</p>`,
  },
  {
    slug: 'before-you-paste-into-ai-checklist',
    title: 'A one-minute checklist before you paste anything into an AI assistant',
    desc: 'A short checklist of what to remove before pasting text, documents or photos into an AI assistant, with the free browser tools that help and the things no tool can find for you.',
    date: '2026-10-20',
    body: `
    <p>This list is about what you hand over, not about any provider's promises, which differ and change. Spend a minute on it before you paste or upload.</p>

    <h2>The checklist</h2>
    <ol>
      <li><strong>Do you need to share the original at all?</strong> Often a few lines or a described pattern is enough.</li>
      <li><strong>Secrets:</strong> API keys, tokens, passwords in connection strings, private keys. Rotate any secret that has already been pasted somewhere.</li>
      <li><strong>Contact data:</strong> emails, phone numbers, addresses. Replace them with placeholders.</li>
      <li><strong>Financial data:</strong> card numbers, IBANs, account numbers, statements.</li>
      <li><strong>Other people's data:</strong> names, messages and details of people who did not agree to be shared.</li>
      <li><strong>Photos:</strong> hidden location, device and time data, and anything visible in the picture that gives away where you are.</li>
      <li><strong>Work material:</strong> check your employer's rules before pasting internal or client documents.</li>
    </ol>

    <h2>Tools that help (they run in your browser and upload nothing)</h2>
    <ul>
      <li><a href="/tools/text-redactor/">Text redactor</a>: emails, phone numbers, IP and MAC addresses, card numbers, IBANs, common API key formats and private key blocks.</li>
      <li><a href="/tools/photo-metadata-remover/">Photo metadata remover</a>: shows and removes EXIF data in JPEG, PNG and WebP photos.</li>
    </ul>

    <h2>What no tool can find for you</h2>
    <p>Names, street addresses, plain account numbers, employer names and anything that only makes sense in context. Read the text again before you send it. More detail: <a href="/blog/bank-statement-before-ai-upload/">bank statements</a>, <a href="/blog/cv-before-ai-upload/">CVs</a>, <a href="/blog/photo-before-ai-upload/">photos</a>.</p>`,
  },

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

    <h2>6. DNS</h2>
    <p>A DNS leak means your device asks your internet provider's resolver for domain names instead of your VPN's. A browser cannot observe which resolver answered, so the test needs a server that can. We run the authoritative DNS server for a domain used only for this. Your browser looks up six random names under it, and the server records the address of each resolver that asks. The page reads that list back and looks up whose network each resolver is on.</p>
    <p>The verdict is careful because the test cannot know who your internet provider is. A resolver on the same network as your exit address passes. A resolver on another network is a warning, since it may be your VPN provider's. If you first run the test with the VPN box unticked, the page remembers those resolvers in the tab, and a resolver that answers both times is reported as a leak. A well-known public resolver such as Google or Cloudflare is shown as information, because the test cannot tell whether you or your VPN chose it.</p>
    <p><strong>How it can be wrong:</strong> if no lookup reaches our server, because of caching, filtering or a slow path, the result is a warning, never a pass. Browsers that send DNS over HTTPS to a provider show up as that provider's resolver, which is what is actually answering. The resolver address is kept in memory for ten minutes and not logged. A small counter per resolver, used only to limit abuse of the usage count, stays in memory for up to an hour.</p>

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
  {
    slug: 'webrtc-leak-explained',
    title: 'WebRTC leaks explained: what a page can read and how to read your result',
    desc: 'What a WebRTC leak is, why a VPN can miss it, how to tell a real leak from a harmless local address, and the browser-by-browser options for closing it.',
    date: '2026-10-20',
    body: `
    <p>WebRTC is the browser feature behind video calls and some file-sharing sites. It is also the most common reason a VPN user sees a second address in a leak test. This post explains what the <a href="/tools/webrtc-leak-test/">WebRTC leak test</a> reports and what to do with each result.</p>

    <h2>What actually happens</h2>
    <p>To connect two browsers directly, each side needs to know which addresses it can be reached on. The browser gathers these candidates, including the address a STUN server sees. Any web page can start this process through JavaScript, and no permission prompt appears for the address lookup itself.</p>
    <p>A VPN client usually routes ordinary web traffic through its tunnel. If the STUN request, which is UDP, leaves through your normal connection instead, the page learns an address that is not your VPN exit.</p>

    <h2>Reading the result</h2>
    <ul>
      <li><strong>The address matches your public IP.</strong> Nothing leaks beyond what every website already sees.</li>
      <li><strong>A different public address, with the VPN box ticked.</strong> This is a leak. A page can read your real network without asking.</li>
      <li><strong>A name ending in <code>.local</code>.</strong> The browser hid your local address behind a random name. This is the intended behaviour.</li>
      <li><strong>A raw local address such as 192.168.x.x.</strong> It is not reachable from the internet, but it is one more detail a tracker can use to tell you apart from other visitors.</li>
      <li><strong>No addresses.</strong> Either WebRTC is off, or UDP to the STUN server is blocked. It means the question could not be asked, not that you are certain to be safe.</li>
    </ul>

    <h2>Closing a leak</h2>
    <p>The options differ by browser. Firefox lets you turn WebRTC off in <code>about:config</code> by setting <code>media.peerconnection.enabled</code> to false, at the cost of browser video calls. Chrome and Edge have no built-in switch, but an extension can restrict WebRTC to the default public interface. Brave has a WebRTC IP handling policy in its privacy settings. A VPN client with a kill switch that blocks all traffic outside the tunnel, UDP included, can close the leak for every browser at once.</p>
    <p>After any change, run the test again. The result is the only proof that matters, because settings and extensions change between versions.</p>

    <h2>What this test cannot tell you</h2>
    <p>It runs from one browser on one network at one moment. A different browser, or the same device on a different network, can behave differently. It does not test DNS. The <a href="/tools/ip-leak-test/">full IP leak test</a> does, using a DNS server we run. For the rest of the checks, use the <a href="/tools/ip-leak-test/">full IP leak test</a>, and read <a href="/blog/how-the-ip-leak-test-works/">how it works</a> for what each check can and cannot see.</p>
`,
  },
  {
    slug: 'ipv6-leaks-explained',
    title: 'IPv6 leaks explained: why a VPN can show one address and expose another',
    desc: 'Why a connection with both IPv4 and IPv6 can leak around a VPN that tunnels only IPv4, how the IPv6 leak test decides, and the fixes in order of preference.',
    date: '2026-10-20',
    body: `
    <p>Many people check one number, the IP address a website shows, and stop when it matches their VPN. That number can be an IPv4 address while a second, IPv6 address goes out another way. The <a href="/tools/ipv6-leak-test/">IPv6 leak test</a> checks for exactly that.</p>

    <h2>Two addresses, two routes</h2>
    <p>A device on a modern home or mobile network usually has an IPv4 address and an IPv6 address. When a website supports both, the system prefers IPv6. A VPN that creates a tunnel only for IPv4 leaves the IPv6 route untouched, so connections to IPv6-capable sites bypass it.</p>

    <h2>How the test decides</h2>
    <p>The page asks one lookup service for your IPv4 address and another for your IPv6 address. It then looks up which network owns each. If both belong to the same network, both routes share an exit. If they belong to different networks while you say you are using a VPN, IPv6 is leaving outside it.</p>
    <p>If the lookup that names the network fails, the result is a warning rather than a pass, because the test has not shown the addresses are on the same network.</p>

    <h2>Caveats</h2>
    <ul>
      <li>Network names come from IP data. Two networks run by one company can have different names, and records can be out of date, so treat a mismatch as a reason to look closer.</li>
      <li>No IPv6 address in the result means your network did not reach the internet over IPv6 during the test. For leak purposes that is a pass, because there is nothing to leak.</li>
      <li>The result is for one browser, one network and one moment.</li>
    </ul>

    <h2>Fixes, in order of preference</h2>
    <ol>
      <li>Turn on IPv6 leak protection in your VPN client, or use a VPN that tunnels IPv6.</li>
      <li>Enable the client's kill switch so nothing leaves outside the tunnel.</li>
      <li>As a last resort, disable IPv6 on your network adapter or router. This removes a working connection, so undo it when you stop using the VPN.</li>
    </ol>
    <p>Run the test again after each change. Then check <a href="/tools/webrtc-leak-test/">WebRTC</a>, which is a separate route around a tunnel.</p>
`,
  },
  {
    slug: 'how-to-test-a-vpn-yourself',
    title: 'How to test a VPN yourself without trusting the vendor',
    desc: 'A short checklist for checking what a VPN does and does not hide: public IP, WebRTC, IPv6, DNS, a dropped connection, and what no test can tell you.',
    date: '2026-10-20',
    body: `
    <p>A VPN vendor's page says what the product is meant to do. A few free checks show what it does on your device, on your network, today. None of them proves a provider's logging claims, and the last section says what they cannot cover.</p>

    <h2>1. Compare addresses with and without the VPN</h2>
    <p>Run the <a href="/tools/ip-leak-test/">IP leak test</a> with the VPN off and note the address and network. Turn the VPN on and run it again. The address and network should change. If they do not, the VPN is not carrying that traffic.</p>

    <h2>2. Check the side routes</h2>
    <p>The <a href="/tools/webrtc-leak-test/">WebRTC</a> and <a href="/tools/ipv6-leak-test/">IPv6</a> tests look for addresses that go around the tunnel. These are the two most common failures a browser can detect.</p>

    <h2>3. Check DNS</h2>
    <p>A browser cannot see which DNS resolver answers it, so a DNS test needs its own DNS server. Our <a href="/tools/ip-leak-test/">IP leak test</a> has one. Run it with the VPN off, then on, and compare the resolvers. A resolver run by your internet provider while the VPN is on is a leak. If you use a public resolver such as Google or Cloudflare, you will see that one in both runs, and the test cannot say who chose it.</p>

    <h2>4. Drop the connection</h2>
    <p>With a page loaded, turn off the network adapter for a few seconds or disconnect the VPN manually, then see whether traffic stops. A working kill switch blocks traffic when the tunnel is down. Run the tests again after you reconnect.</p>

    <h2>5. Try a second network</h2>
    <p>Repeat on mobile data or a different Wi-Fi. Leaks often depend on the network, particularly IPv6 and UDP handling.</p>

    <h2>What no test here can show</h2>
    <ul>
      <li>Whether the provider keeps logs. That depends on its servers, its policies and independent audits, not on anything a browser can measure.</li>
      <li>Whether your traffic is safe once it leaves the VPN. A VPN moves where you appear to connect from. It does not make a website you log into forget who you are.</li>
      <li>Behaviour in other apps. A browser test covers the browser. A torrent client or a game can take a different route.</li>
    </ul>
    <p>Treat the results as a snapshot. Re-run the checks after you update the VPN client, the browser or the operating system.</p>
`,
  },
  {
    slug: 'dns-leaks-explained',
    title: 'DNS leaks explained: what they are and how to read a DNS leak test',
    desc: 'What a DNS leak is, why a VPN can still send lookups to your internet provider, how our DNS check reaches its verdict, and what to do about each result.',
    date: '2026-10-20',
    body: `
    <p>Every time you open a site, your device first asks a DNS resolver to turn the name into an address. That resolver sees which sites you visit even if everything after it is encrypted. A DNS leak is when those questions go to a resolver you did not mean to use, usually your internet provider's, while you think a VPN is covering you. Our <a href="/tools/ip-leak-test/">IP leak test</a> checks for it.</p>

    <h2>How the check works</h2>
    <p>The page asks your system to look up six random names under a domain we run. We run the DNS server for that domain, so we see which resolver asks for them, and only that. The page reads that list back and looks up whose network each resolver is on. The names are unique to each run, so nothing is answered from a cache. The resolver address is kept in memory for ten minutes and is not logged. A small counter per resolver, used only to limit abuse of the usage count, stays in memory for up to an hour.</p>

    <h2>Reading the result</h2>
    <ul>
      <li><strong>Pass:</strong> every resolver is on the same network as your exit address, so lookups are answered inside your VPN or proxy network.</li>
      <li><strong>Fail:</strong> a resolver that answered when you ran the test without a VPN also answers with it on. For this the page remembers the first run in your tab, in memory only.</li>
      <li><strong>Information:</strong> a well-known public resolver, such as Google or Cloudflare, answered. That is fine if you or your VPN chose it. The test cannot tell who chose it.</li>
      <li><strong>Warning:</strong> a resolver on a different network answered, no lookups reached us, or the network of a resolver could not be identified. A different network is normal if it belongs to your VPN provider.</li>
    </ul>

    <h2>Why it is not a plain pass or fail</h2>
    <p>The test cannot know who your internet provider is. Judging a resolver as a leak only because it sits on another network than your exit would flag many VPNs that use their own resolvers elsewhere. So the clear failure case needs a comparison: the same resolver with and without the VPN.</p>

    <h2>Browsers that use DNS over HTTPS</h2>
    <p>Some browsers send lookups to a provider such as Cloudflare or Google over HTTPS, bypassing the system resolver. That is not a bug in the test. The provider's resolver is what is actually answering, and it is what you will see.</p>

    <h2>Fixing a leak</h2>
    <ol>
      <li>Turn on DNS leak protection in your VPN client and do not override the DNS servers it sets.</li>
      <li>Use the kill switch so lookups cannot leave outside the tunnel when it drops.</li>
      <li>Check the browser's secure DNS setting, which can send lookups around the VPN to a provider you did not choose.</li>
    </ol>
    <p>Run the test again after each change, with the VPN box unticked first and ticked second. For the other routes around a tunnel, see <a href="/blog/webrtc-leak-explained/">WebRTC</a> and <a href="/blog/ipv6-leaks-explained/">IPv6</a>.</p>
`,
  },
  {
    slug: 'how-password-breach-checks-work',
    title: 'How a password breach check works without sending your password',
    desc: 'How k-anonymity lets a breach check compare your password against billions of leaked ones by sending only a five-character hash prefix, what it reveals, and what it cannot tell you.',
    date: '2026-10-20',
    body: `
    <p>Checking a password against a list of leaked passwords sounds like it requires handing the password to someone. It does not have to. The method used by the Pwned Passwords service, and by our <a href="/tools/password-checker/">password checker</a>, sends only a small piece of a hash and compares the rest on your device.</p>

    <h2>The steps</h2>
    <ol>
      <li>Your browser computes the SHA-1 hash of the password. That is 40 hexadecimal characters.</li>
      <li>It sends only the first five characters to the service.</li>
      <li>The service replies with every hash suffix it holds that begins with those five characters, each with a count. A reply holds several hundred entries.</li>
      <li>Your browser looks for the remaining 35 characters in that reply. If they are there, the password is in the breach data, and the count says how often.</li>
    </ol>

    <h2>Why this is called k-anonymity</h2>
    <p>Any five-character prefix is shared by many different passwords, so the service cannot tell which one you checked. The password and the full hash never leave your browser.</p>

    <h2>What it still reveals</h2>
    <p>It is a reduction in what is disclosed, not zero. The service sees your IP address and the prefix. A network observer can see that you ran a check. Sending a request for each key press would reveal much more, so the checker only runs when you press the button. It also asks for padded replies, which adds fake entries so the size of the reply does not hint at the answer.</p>

    <h2>What a result means</h2>
    <ul>
      <li><strong>Found:</strong> this exact password has appeared in a published breach, so attackers try it early. Stop using it everywhere.</li>
      <li><strong>Not found:</strong> it is not in that list. It may still be weak, or it may have leaked in a way that was never published.</li>
    </ul>
    <p>That is why the checker shows strength and breach status as two separate results. A long random password used on one site is the goal, and a breach check is a way to catch the cases where that did not happen.</p>
`,
  },
  {
    slug: 'what-data-brokers-know-about-you',
    title: 'What data brokers know about you, and how to find out',
    desc: 'What data brokers are, how they collect information, why a VPN does not stop them, and the practical ways to check what they hold and ask for removal.',
    date: '2026-10-20',
    body: `
    <p>A data broker is a company that collects personal information from many sources, combines it into profiles and sells or licenses it. Most people never dealt with them directly, which is why it is hard to know what they hold. A VPN or a private browser does not change that, because brokers mostly work with information that was already collected elsewhere.</p>

    <h2>Where the information comes from</h2>
    <ul>
      <li><strong>Public records:</strong> property records, court records, voter files in some countries, business registrations.</li>
      <li><strong>Commercial sources:</strong> purchase and loyalty data, warranty cards, surveys and sign-up forms that were sold on.</li>
      <li><strong>Online activity:</strong> data from apps, ad networks and trackers that link a device to a person.</li>
      <li><strong>Other brokers:</strong> profiles are resold and merged, so one source feeds many sites.</li>
    </ul>

    <h2>What a profile can contain</h2>
    <p>It varies by broker and country. Typical entries are name, past and current addresses, phone numbers, email addresses, age range, relatives and sometimes estimated income or interests. The accuracy is uneven, and mistakes are common.</p>

    <h2>Why a VPN does not help</h2>
    <p>A VPN hides your network address from the sites you visit and from your internet provider. It does not remove records that already exist, and it does not stop a person who signs up with their real name and phone number. Our <a href="/tools/browser-fingerprint-test/">fingerprint test</a> shows the other half: even without an address, a browser can be recognised from its own characteristics.</p>

    <h2>How to find out what is held about you</h2>
    <ol>
      <li>Search your name, with your city, on a search engine and on the main people-search sites in your country. Note which ones list you.</li>
      <li>Look for an opt-out or removal page on each. They are usually in the footer under a name such as "Do not sell my information" or "Opt out".</li>
      <li>Where a privacy law applies to you, such as the GDPR in the EU and UK or state laws in parts of the US, you can send an access or deletion request. The right to do so depends on where you live.</li>
    </ol>

    <h2>Removal in practice</h2>
    <p>Each broker has its own process, some need an email or a form, and profiles can reappear because the underlying sources still hold the data. Doing it by hand is free but takes time. Paid removal services repeat the requests on your behalf. They can save effort, but they cannot remove data from every source, and none of them makes a person anonymous. Treat them as upkeep, not a guarantee.</p>

    <h2>What reduces the problem at the source</h2>
    <ul>
      <li>Give out a real phone number and address less often. Use an alias email for sign-ups.</li>
      <li>Remove location data from photos before you share them with our <a href="/tools/photo-metadata-remover/">photo metadata remover</a>.</li>
      <li>Use a unique password for each account and check old ones with the <a href="/tools/password-checker/">password checker</a>, so a breach in one place does not feed a profile elsewhere.</li>
    </ul>
`,
  },
  {
    slug: 'leak-test-sites-compared',
    title: 'IP and DNS leak test sites compared: ipleak.net, BrowserLeaks, dnsleaktest and SecureInChat',
    desc: 'A plain comparison of four leak test sites: what each one tests, what it says about data handling, and which to use for which job. Includes what ours cannot do.',
    date: '2026-10-20',
    body: `
    <p>Several free sites test whether a VPN or proxy leaks. They overlap, but they are not the same. This comparison is based on what each site says about itself on its own pages when we checked, and on our own tool. Sites change, so check the page if something here matters to you.</p>

    <h2>At a glance</h2>
    <table>
      <thead><tr><th>Site</th><th>Tests it lists</th><th>What it says about data</th></tr></thead>
      <tbody>
        <tr><td><a href="https://ipleak.net/" rel="noopener">ipleak.net</a></td><td>IP details, WebRTC, DNS, a torrent address test, geolocation, browser details, HTTP headers, a free API</td><td>No logging or retention policy on the page we read. The torrent test records what the client sends, by design. It says it is powered by AirVPN.</td></tr>
        <tr><td><a href="https://browserleaks.com/" rel="noopener">BrowserLeaks</a></td><td>IP, WebRTC, DNS and IPv6 checks, plus a long list of browser tests: canvas, WebGL, fonts, geolocation, TLS and more</td><td>Its privacy policy says it does not collect personal data or store fingerprints, and that some third-party services may be active.</td></tr>
        <tr><td><a href="https://www.dnsleaktest.com/" rel="noopener">dnsleaktest.com</a></td><td>A DNS leak test</td><td>The page does not say who runs it. A footer link names IVPN Limited.</td></tr>
        <tr><td>SecureInChat</td><td><a href="/tools/ip-leak-test/">IP, DNS, WebRTC and IPv6 leak tests</a>, plus a <a href="/tools/browser-fingerprint-test/">fingerprint test</a>, <a href="/tools/photo-metadata-remover/">photo metadata remover</a>, <a href="/tools/password-checker/">password checker</a> and <a href="/tools/text-redactor/">text redactor</a></td><td>Everything is listed on one <a href="/principles/">privacy principles</a> page. No cookies, no accounts, no stored results.</td></tr>
      </tbody>
    </table>

    <h2>Which to use for what</h2>
    <ul>
      <li><strong>The widest set of browser tests:</strong> BrowserLeaks. If you want to see canvas, WebGL, fonts and TLS details, it covers far more than we do.</li>
      <li><strong>A torrent address check or an API:</strong> ipleak.net. We have neither.</li>
      <li><strong>Only a DNS check:</strong> dnsleaktest.com is a single-purpose page.</li>
      <li><strong>One page that compares your resolver with your exit address and explains each verdict in plain language:</strong> that is what our <a href="/tools/ip-leak-test/">IP leak test</a> is for.</li>
    </ul>

    <h2>What ours does not do</h2>
    <p>We are new and small. We have no torrent test, no API and far fewer browser tests than BrowserLeaks. Our DNS check runs on a single server, so it tells you which resolvers answer you, not who runs them. A pass is not proof of anonymity on any of these sites.</p>

    <h2>Use more than one</h2>
    <p>Tests can disagree because they ask different questions and use different data sources for locations and networks. If two sites give different answers, that is information. <a href="/blog/how-to-test-a-vpn-yourself/">How to test a VPN yourself</a> explains the steps, and <a href="/blog/dns-leaks-explained/">DNS leaks explained</a> covers how to read a DNS result.</p>
`,
  },
  {
    slug: 'redact-text-before-you-share-it',
    title: 'Redact text before you share it: what to remove from logs, emails and configs',
    desc: 'What personal data and secrets hide in logs, emails and config files, what a redaction tool can and cannot find, and a short checklist before you paste text into a forum or an AI assistant.',
    date: '2026-10-20',
    body: `
    <p>People paste logs, emails and configuration files into bug reports, forums and AI assistants every day. Those texts often carry more than the problem: addresses, tokens and names. Once posted, they are hard to take back. This page lists what to look for and how our <a href="/tools/text-redactor/">text redactor</a> helps, including what it misses.</p>

    <h2>What hides in ordinary text</h2>
    <ul>
      <li><strong>Network details:</strong> IPv4 and IPv6 addresses, MAC addresses and internal hostnames in logs and traces.</li>
      <li><strong>Contact details:</strong> email addresses and phone numbers in headers, signatures and error reports.</li>
      <li><strong>Secrets:</strong> API keys, access tokens, JSON Web Tokens, private keys and passwords inside connection strings such as <span class="mono">postgres://user:password@host</span>.</li>
      <li><strong>Payment data:</strong> card numbers in order exports and support tickets.</li>
    </ul>

    <h2>What the redactor does</h2>
    <p>It matches common patterns and replaces each with a labelled placeholder such as <span class="mono">[EMAIL_1]</span>. The same value always receives the same placeholder, so a log stays readable: you can still see that one address appeared five times without seeing the address. It runs in your browser and nothing is uploaded.</p>

    <h2>What it cannot find</h2>
    <ul>
      <li>Names, street addresses, company names and anything without a fixed format.</li>
      <li>Secrets in a custom format that does not look like a known key.</li>
      <li>Card numbers that fail the standard checksum. A made-up number is left alone on purpose, to avoid replacing ordinary long numbers.</li>
      <li>Context that identifies you without a pattern, such as a unique error message from your own project.</li>
    </ul>
    <p>That is why a tool like this reduces the risk but does not remove it. Read the result before you share it.</p>

    <h2>A short checklist</h2>
    <ol>
      <li>Run the text through the redactor and read the output line by line.</li>
      <li>Search the result for names, paths that include your user name, and project or customer names.</li>
      <li>If a real secret was ever in the text, rotate it. Redacting a copy does not cancel a key that was already exposed.</li>
      <li>Share the smallest piece of text that shows the problem.</li>
    </ol>
    <p>For images, the same idea applies to metadata: see the <a href="/tools/photo-metadata-remover/">photo metadata remover</a>.</p>
`,
  },
];
