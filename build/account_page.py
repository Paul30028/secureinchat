"""Writes public/tools/account-checkup/index.html. Run: python3 build/account_page.py
Every claim about a provider is taken from the linked official page (checked 2026-10-21)."""
import json, html, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'tools', 'account-checkup', 'index.html')
URL = 'https://secureinchat.com/tools/account-checkup/'
TITLE = 'Account Security Checkup: 8 Checks for Your Most Important Account'
DESC = 'Free account security checklist: two-step verification, password reuse, recovery details, backup codes, signed-in devices and app access, with official Google, Apple and Microsoft links. Runs in your browser; nothing is saved or sent.'
H = lambda s: html.escape(s, quote=True)

def src(links):
    return 'Sources: ' + ', '.join(f'<a href="{H(u)}" rel="noopener">{H(t)}</a>' for t, u in links)

# id, question, why (html), how (html), sources
ITEMS = [
 ('mfa', 'Is two-step verification turned on?',
  'With it, a stolen password alone is not enough to sign in: a new device also needs a code or a prompt from something you have.',
  'Google: run <a href="https://myaccount.google.com/security-checkup" rel="noopener">Security Checkup</a>, or turn it on under <a href="https://myaccount.google.com/signinoptions/two-step-verification" rel="noopener">2-Step Verification</a>. '
  'Apple: a new device needs your password plus a six-digit code shown on your trusted devices or sent to your trusted phone number. '
  'Microsoft: <a href="https://account.microsoft.com/security" rel="noopener">account.microsoft.com/security</a>, then Manage how I sign in, then Two-step verification, Turn on.',
  [('Google Account Help', 'https://support.google.com/accounts/answer/46526?hl=en'), ('Apple Support', 'https://support.apple.com/102660'), ('Microsoft Support', 'https://support.microsoft.com/help/4028586')]),
 ('unique', 'Is this password used only for this account?',
  'If any site where you used the same password leaks it, whoever holds the leak can try it here.',
  'Use a password manager and give this account a password of its own, or a passkey. Google Password Checkup lists weak, exposed and reused passwords saved in your Google Account. Our <a href="/tools/password-checker/">password checker</a> checks a password against known breaches without sending it.',
  [('Google Account Help', 'https://support.google.com/accounts/answer/46526?hl=en'), ('Google Password Checkup', 'https://support.google.com/accounts/answer/9457609')]),
 ('recovery', 'Are the recovery email and phone current, and both yours?',
  'They are how you get back in if you are locked out, and Google uses them to alert you to suspicious activity. Microsoft says you can reset a forgotten password with two-step verification on only if it has two ways to contact you, and recommends three.',
  'Google: <a href="https://myaccount.google.com/signinoptions/rescuephone?edit" rel="noopener">recovery phone</a> and <a href="https://myaccount.google.com/recovery/email?edit" rel="noopener">recovery email</a>. Microsoft: <a href="https://account.microsoft.com/security" rel="noopener">security dashboard</a>. Remove numbers and addresses you no longer control.',
  [('Google Account Help', 'https://support.google.com/accounts/answer/46526?hl=en'), ('Microsoft Support', 'https://support.microsoft.com/help/4028586')]),
 ('codes', 'Are backup codes or a recovery key kept somewhere offline?',
  'If you lose your phone, a code you wrote down is often the fastest way back in.',
  'Microsoft: generate a recovery code under <a href="https://account.live.com/proofs/manage/additional" rel="noopener">Manage how I sign in</a>, print it and keep it off the devices you sign in with. A new code makes the old one stop working. '
  'Apple: a recovery key is optional, 28 characters long, and turns off Apple\'s standard account recovery. Apple warns that if you lose it you can be locked out permanently, and says to keep a written copy, not one in Notes or iCloud. Only turn it on if you are sure you can keep it safe.',
  [('Microsoft Support', 'https://support.microsoft.com/en-us/accounts-billing/manage/how-to-get-a-microsoft-account-recovery-code'), ('Apple Support', 'https://support.apple.com/109345')]),
 ('sessions', 'Have you checked which devices are signed in?',
  'A device you do not recognise is the clearest sign that someone else has access.',
  'Google: <a href="https://support.google.com/accounts/answer/3067630" rel="noopener">See devices with account access</a>. Apple: on iPhone open Settings, tap your name and scroll to the device list, or sign in at account.apple.com and choose Devices; Remove from Account signs a device out. If you find a device you do not know, remove it and change the password.',
  [('Google Account Help', 'https://support.google.com/accounts/answer/3067630'), ('Apple Support', 'https://support.apple.com/en-us/ht205064')]),
 ('strong', 'Is the second step a passkey, security key or app prompt rather than only text messages?',
  'Google recommends security keys or Google prompts over text message codes, which are more exposed to phishing. Passkeys cannot be typed into a fake page, so they resist phishing better.',
  'Google: <a href="https://support.google.com/accounts/answer/13548313" rel="noopener">set up a passkey</a> or a <a href="https://support.google.com/accounts/answer/6103523" rel="noopener">security key</a>. If text messages are the only option a service offers, they are still better than a password alone.',
  [('Google Account Help', 'https://support.google.com/accounts/answer/46526?hl=en'), ('Google passkeys', 'https://support.google.com/accounts/answer/13548313')]),
 ('apps', 'Have you reviewed which other apps can access this account?',
  'Apps you once signed in to with this account may still be able to read some of its data.',
  'Google: <a href="https://myaccount.google.com/linkedapps" rel="noopener">your linked apps</a>. Remove the ones you no longer use.',
  [('Google Account Help', 'https://support.google.com/accounts/answer/3466521')]),
 ('breach', 'Have you checked whether this email address appears in known breaches?',
  'A breach tells you which sites leaked data with your address, so you know which passwords to change first.',
  'Check on <a href="https://haveibeenpwned.com/" rel="noopener">Have I Been Pwned</a>. That opens their site and your address goes to them, not to us. If it appears, change the password on that site and anywhere you reused it.',
  [('Have I Been Pwned', 'https://haveibeenpwned.com/')]),
]

FAQ = [
 ('Is anything I tick saved or sent?', 'No. The answers exist only in this page. Nothing is sent to us or anyone else, the page sets no cookies and loads no analytics, and reloading the page clears every answer.'),
 ('Which account should I check first?', 'Your main email account. Password reset links for most of your other accounts go there, so whoever controls it can usually take over the rest.'),
 ('Why is there no field for my email address?', 'The checkup does not need it. To check an address against known breaches, the page links to Have I Been Pwned, so you decide whether to send your address to them.'),
 ('Does a full score mean my account is safe?', 'No. It means the common basics are in place. Phishing, malware on your device and mistakes by the service itself can still lead to a takeover.'),
]

opts = lambda i: ''.join(
    f'<label class="ac-opt"><input type="radio" name="{i}" value="{v}" autocomplete="off"> <span>{t}</span></label>'
    for v, t in [('yes', 'Done'), ('no', 'Not yet'), ('unsure', 'Not sure')])

items_html = '\n'.join(f'''      <fieldset class="ac-item" id="ac-{i}" data-state="open">
        <legend><span class="ac-n">{n}</span> {H(q)}</legend>
        <div class="ac-opts">{opts(i)}</div>
        <p class="ac-why">{why}</p>
        <p class="ac-how">{how}</p>
        <p class="ac-src">{src(s)}</p>
      </fieldset>''' for n, (i, q, why, how, s) in enumerate(ITEMS, 1))

ld = {"@context": "https://schema.org", "@graph": [
    {"@type": "WebApplication", "name": "Account security checkup", "url": URL, "applicationCategory": "SecurityApplication", "operatingSystem": "Any",
     "browserRequirements": "Requires JavaScript.", "description": DESC, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}, "dateModified": "2026-10-21"},
    {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}]}
faq_html = '\n'.join(f'    <h3>{H(q)}</h3>\n    <p>{H(a)}</p>' for q, a in FAQ)

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{H(TITLE)}</title>
<meta name="description" content="{H(DESC)}">
<link rel="canonical" href="{URL}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="website">
<meta property="og:title" content="{H(TITLE)}">
<meta property="og:description" content="{H(DESC)}">
<meta property="og:url" content="{URL}">
<meta name="theme-color" content="#F5F4EF">
<link rel="preload" href="/tools/fonts/atkinson-hyperlegible-next-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/tools/assets/style.css">
<script type="application/ld+json">
{json.dumps(ld, indent=2)}
</script>
</head>
<body>
<a class="skip" href="#results">Skip to results</a>
<header class="top">
  <div class="wrap top__in">
    <a class="brand" href="/">SecureInChat</a>
    <nav aria-label="Main"><a href="/protect/">Protect</a><a href="/tools/" aria-current="page">Tools</a><a href="/blog/">Guides</a><a href="/messaging/">Messaging</a><a href="/about/">About</a></nav>
  </div>
</header>
<main>
  <section class="hero wrap" aria-labelledby="h1">
    <h1 id="h1">Account security checkup</h1>
    <p class="lede">Eight checks for one account, in the order we suggest fixing them. Start with your main email: password resets for most of your other accounts go there.</p>
    <p class="hint">Your answers stay in this page. Nothing is sent or saved, and reloading clears them. <a href="#method">How this works</a></p>
  </section>
  <section class="wrap" aria-labelledby="checks-h">
    <h2 id="checks-h" class="sr">The checks</h2>
    <form id="ac-form" class="ac-list" autocomplete="off">
{items_html}
    </form>
  </section>
  <section class="wrap" id="results" aria-labelledby="results-h">
    <div class="results-head">
      <h2 id="results-h">Your result</h2>
      <p id="summary" class="summary" role="status" aria-live="polite" data-tone="idle">Answer the questions to see what to do first.</p>
    </div>
    <div class="fix" id="ac-next" hidden>
      <h3 class="fix__t">Do these next</h3>
      <ol class="fix__l" id="ac-next-list"></ol>
    </div>
    <div class="rd-actions">
      <button id="ac-copy" class="btn btn--quiet" type="button" hidden>Copy the list</button>
      <button id="ac-reset" class="btn btn--quiet" type="button">Clear answers</button>
      <span id="ac-copied" class="hint" role="status"></span>
    </div>
  </section>
  <section class="wrap prose" id="method" aria-labelledby="method-h">
    <h2 id="method-h">How this works</h2>
    <p>The checkup is a list in this page. It does not sign in to anything, look anything up or ask for your email address or password. The copied list contains only the names of the checks, never account details. The page sets no cookies and loads no analytics. See <a href="/principles/">what each tool sends</a>.</p>
    <p>The steps for Google, Apple and Microsoft come from their own help pages, linked under each check and read on October 21, 2026. Menus change; if a step does not match what you see, follow the linked page. Other services usually have the same settings under Security or Sign-in.</p>
    <h2>What it does not cover</h2>
    <p>It does not check your device for malware, your phone number's protection against SIM swaps, or whether a message asking you to sign in is genuine. For links, use the <a href="/tools/link-checker/">link checker</a>.</p>
  </section>
  <section class="wrap prose" aria-labelledby="faq-h">
    <h2 id="faq-h">Frequently asked questions</h2>
{faq_html}
  </section>
</main>
<footer class="foot">
  <div class="wrap foot__in">
    <p>SecureInChat</p>
    <nav aria-label="Footer"><a href="/tools/">Tools</a><a href="/about/">About</a><a href="/privacy/">Privacy policy</a><a href="/blog/">Blog</a></nav>
  </div>
</footer>
<script src="/tools/assets/account.js" defer></script>
<script src="/tools/assets/account-app.js" defer></script>
</body>
</html>'''

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w').write(page)
print('wrote', OUT)
