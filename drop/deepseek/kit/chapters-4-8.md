## Chapter 4 — Replacing SMS codes with an authenticator or passkey

### What this chapter changes

The first three chapters make it harder for someone to move your number. This chapter reduces how much depends on the number at all. An authenticator app generates a code on your device. A passkey replaces the password with a cryptographic key that stays on your device. Neither one depends on your carrier delivering an SMS.

NIST SP 800-63B classifies SMS and PSTN-based out-of-band authentication as a **restricted authenticator**. SMS is not banned. It is a method whose known risks must be assessed and reduced over time:

- NIST SP 800-63B-4, section on restricted authenticators: https://pages.nist.gov/800-63-4/sp800-63b.html

This chapter walks through four account types. Do them in this order: email first, then the bank, then the other accounts. Email is first because most password resets go through email.

### 4.1 Google Account — add a passkey

Google supports passkeys on Android 9+, iOS 16+, and on computers running Windows 10, macOS Ventura, or ChromeOS 109 or later. You need a screen lock on your phone. On iPhone, iCloud Keychain must be on.

1. Sign in to your Google Account.
2. Go to **myaccount.google.com/signinoptions/passkeys**.
3. Tap or click **Create a passkey**.
4. Unlock your device with your fingerprint, face, or screen lock.
5. Follow the prompts. Google may ask you to confirm the passkey was created.

Source: https://support.google.com/accounts/answer/13548313

**What a passkey does and does not replace.** Google states that adding a passkey does not remove your existing authentication or recovery factors. It also states that if your account has 2-Step Verification or is in the Advanced Protection Program, the passkey bypasses the second step because the passkey already proves you own the device:

- https://support.google.com/accounts/answer/13548313

### 4.2 Apple Account — set up a passkey and a recovery key

Apple stores passkeys in iCloud Keychain. They are available on devices signed in with the same Apple Account, on iOS 16, iPadOS 16, macOS Ventura, or tvOS 16 and later. The private key never leaves your devices.

- Apple, “Use passkeys to sign in to websites and apps on iPhone”: https://support.apple.com/guide/iphone/iphf538ea8d0/ios

The general steps on iPhone are:

1. Open the sign-in screen of a supported website or app.
2. Tap the account name field, or tap **Sign in with a passkey** if the button is shown.
3. Use Face ID or Touch ID to confirm.
4. If you are creating a passkey for an Apple Account itself, iCloud Keychain must be turned on first.

**Important limitation.** Apple’s developer documentation states that a passkey for an Apple Account itself is only available in the iCloud Keychain of the Apple Account it is tied to, and that you can currently have only one Apple Account passkey on a device at a time:

- Apple Developer, “Using Passkeys on Apple sites”: https://developer.apple.com/documentation/authenticationservices/using-passkeys-on-apple-sites

Because the passkey is tied to one device and one iCloud Keychain, Apple also expects you to keep a second form of recovery. Apple’s passkey pages state that two-factor authentication must be turned on for your Apple Account before passkeys are used:

- https://support.apple.com/guide/iphone/iphf538ea8d0/ios

For recovery, Apple lets you set up a **recovery key** and **account recovery contacts**. These are separate from passkeys. The exact menu path for recovery key setup changes with iOS versions. On current iOS, it is under **Settings → [your name] → Sign-In & Security → Account Recovery** **[verify]** the exact label on your version:

- Apple Account recovery overview: https://support.apple.com/en-us/102606

### 4.3 Microsoft account — add a passkey

Microsoft supports passkeys for personal Microsoft accounts and for work or school accounts. The setup entry point is the Advanced Security Options page.

1. Go to **account.live.com/proofs/manage** and sign in.
2. Under **Advanced Security Options**, select **Add a new way to sign in or verify**.
3. Choose **Face, fingerprint, PIN, or security key**.
4. Follow the prompts on the device where the passkey will be created.
5. Choose whether to save the passkey on this device or another location.

Sources: https://support.microsoft.com/en-us/account-billing/create-and-save-a-passkey-for-your-microsoft-account and https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-enable-passkey-fido2

### 4.4 A common bank account — the Chase example

Banks move more slowly than platform accounts. Chase supports passkeys on chase.com and in the Chase Mobile app, and separately offers 2-step verification. Chase’s own Security Center page describes the 2-step verification toggle:

1. Sign in to chase.com.
2. In **My Account**, find the **Enhance your Security** section.
3. Select **Enable 2-step verification for extra security at sign-in**.
4. Toggle **Use 2-step verification every time you sign in on a browser**.

Source: https://www.chase.com/digital/resources/privacy-security/security-center

For passkeys specifically, Chase has been rolling out passkey sign-in for chase.com. The exact menu label depends on whether your account has the feature enabled yet. The general path is **Profile & Settings → Security → Passkey** or **Sign-in settings** **[verify]** the label shown on your account, because Chase does not publish a single step-by-step page for every account type:

- Chase Security Center: https://www.chase.com/digital/resources/privacy-security/security-center

**A practical note.** If your bank does not offer passkeys or an authenticator app, the strongest available option may still be a hardware security key or the bank’s own app-based approval. Do not assume that every bank supports TOTP. Chase, for example, has historically not offered standard TOTP as a general 2FA option. Record what your bank actually offers rather than what you wish it offered.

### What to record

| Account | Passkey or authenticator added? | Where the recovery method is kept (do not write the code) |
|---|---|---|
| Google Account | ☐ Passkey ☐ Authenticator ☐ Both ☐ Neither | |
| Apple Account | ☐ Passkey ☐ Recovery key ☐ Recovery contact ☐ None | |
| Microsoft account | ☐ Passkey ☐ Authenticator ☐ Neither | |
| Bank (name: ) | ☐ Passkey ☐ App approval ☐ Hardware key ☐ SMS only | |
| Date of this check | | |

---

## Chapter 5 — Phone number visibility on social accounts

This chapter separates two different questions. The first question is: **is my phone number shown on my profile?** The second question is: **can someone who already has my number use it to find my account?** Fixing only one of the two leaves the other path open.

### 5.1 X (formerly Twitter)

X does not publicly display your phone number, even when the discoverability setting is on. But if discoverability is on, someone who uploads their contacts to X and has your number saved can find your account. Turning the setting off also stops X from using your uploaded address book to suggest your account to others.

**On iOS:**

1. Tap the navigation menu icon.
2. Tap **Settings and privacy**, then **Privacy and safety**.
3. Under **Discoverability and contacts**, adjust **Let others find you by your email** and **Let others find you by your phone**.

**On Android:**

1. Tap the navigation menu icon or your profile icon.
2. Go to **Settings and privacy → Privacy and safety**.
3. Under **Discoverability and contacts**, adjust the same two settings.

**On desktop:**

1. Go to **Privacy and safety** settings.
2. Next to **Discoverability**, uncheck **Let people who have your email address find you on X** and **Let people who have your phone number find you on X**.
3. Changes save automatically.

Source, including the statement that the number is not publicly displayed: https://help.x.com/en/safety-and-security/email-and-phone-discoverability-settings

### 5.2 Facebook

Facebook’s “Who can look me up” setting controls whether people who have your phone number can match it to your profile when they upload their contacts. Facebook’s own historical clarification states that this setting applies to all phone numbers added to the account and defaults to **Everyone**. It also states that the minimum audience you can choose is **Friends**, not “Nobody,” in the version documented at that time:

- Privacy International’s published correspondence with Facebook, quoting Facebook’s help centre: https://privacyinternational.org/sites/default/files/2019-06/Letter%20FB%20PI%203%20May%202019.pdf
- Facebook Help Centre article referenced by Facebook in that correspondence: https://www.facebook.com/help/131297846947406

**Current path in the Facebook app or web:**

1. Go to **Settings & Privacy → Settings**.
2. Open **Audience and visibility**.
3. Select **How people find and contact you**.
4. Set **Who can look you up using the phone number you provided?** to the most restrictive option available.
5. Separately, on your profile, open **About → Contact and basic info** and set the audience for your phone number to **Only me**, or remove the number.

Source for the privacy checkup path: https://www.facebook.com/privacy/checkup

**Important nuance.** Facebook has changed the available audience options over time. If your account no longer shows a “Nobody” option for phone lookup, this is a platform limitation, not a mistake in this kit. Record the most restrictive option your account actually offers **[verify]** on your account.

### 5.3 Instagram

Instagram states that phone numbers and email addresses on an Instagram account are **always private**. They are not shown on your profile. Instagram also states that you can remove a verified phone number at any time, as long as the account still has at least one other verified phone number or email address:

- Instagram Help Centre, “Why Instagram asks for your email or phone number”: https://help.instagram.com/ and search for the article title

**Path to review or remove the number:**

1. Open **Settings and privacy**.
2. Go to **Accounts Center → Personal details → Contact info**.
3. Select the phone number and choose **Remove**, or verify a replacement first.

Source for the Accounts Center path: https://help.instagram.com/ and the Accounts Center contact-info article

**Professional accounts are different.** If you have a professional account, you may have added a public **Contact** button that shows a phone number. Instagram states that this contact information is displayed on the profile and can be edited at any time. Check **Edit profile → Contact options** and remove the public phone number if you do not want it visible:

- Instagram Help Centre, “About professional accounts on Instagram”: https://help.instagram.com/

### 5.4 LinkedIn

LinkedIn allows others to find your profile by phone number if **Discoverability by phone number** is enabled. The setting is separate from whether your phone number appears in your profile’s Contact info section.

1. Click the **Me** icon.
2. Select **Settings & Privacy**.
3. Click **Visibility**.
4. Under **Visibility of your profile & network**, click **Discoverability by phone number**.
5. Select **Nobody** (or the most restrictive option available).
6. Changes save automatically.

Source: https://www.linkedin.com/help/linkedin/answer/a548106

**LinkedIn’s own caveat.** LinkedIn states that disabling discoverability by phone number does not prevent permitted services off LinkedIn from discovering your profile based on your name. It also states that your phone number will not appear on your profile unless you add it to the Contact Info section:

- https://www.linkedin.com/help/linkedin/answer/a548106

### What to record

| Platform | Profile number hidden or removed? | Lookup by phone number disabled? | Date checked |
|---|---|---|---|
| X | ☐ Yes ☐ No ☐ N/A | ☐ Yes ☐ No | |
| Facebook | ☐ Yes ☐ No | ☐ Most restrictive option set ☐ Not available on my account | |
| Instagram | ☐ No public number ☐ Removed ☐ Professional contact button removed | N/A (number is private by default) | |
| LinkedIn | ☐ Removed from Contact info ☐ Not added | ☐ Nobody ☐ Other: | |

---

## Chapter 6 — Signal registration lock and WhatsApp two-step verification

### 6.1 Signal — PIN and registration lock

Signal’s PIN can do two jobs. It can help recover your profile, settings, contacts, and block list. It can also act as a **registration lock**: without the PIN, someone who can receive your SMS cannot register your number on a new device. Signal states that if you forget the PIN and have the registration lock enabled, you may be locked out of your account for up to **7 days**. Signal also states that it does not know your PIN and cannot reset or recover it:

- Signal Support, “Signal PIN”: https://support.signal.org/hc/en-us/articles/360007059792-Signal-PIN

**To enable the registration lock:**

1. Open Signal.
2. Go to **Settings → Account**.
3. Set or confirm your **Signal PIN**.
4. Turn on **Registration Lock**.

Source for the Settings → Account path and the registration lock behavior: https://support.signal.org/hc/en-us/articles/360007059792-Signal-PIN

**A critical warning.** The PIN is not a chat backup. Signal states clearly that your message history is not linked to the PIN and cannot be recovered with it. If you enable the registration lock and forget the PIN, you wait out the 7-day timer. Store the PIN in a password manager, not in this kit.

### 6.2 WhatsApp — two-step verification

WhatsApp’s two-step verification adds a six-digit PIN on top of the SMS registration code. If someone has your SMS but not your PIN, they cannot complete registration. WhatsApp recommends adding a recovery email so that you can reset the PIN if you forget it. Without a recovery email, WhatsApp requires you to wait **7 days** before you can reset the PIN:

- WhatsApp FAQ, “How to manage two-step verification settings”: https://faq.whatsapp.com/1920866721452534

**To enable it:**

1. Open WhatsApp.
2. Go to **Settings → Account → Two-step verification**.
3. Tap **Enable** or **Set up PIN**.
4. Enter a six-digit PIN and confirm it.
5. Add a recovery email address, or tap **Skip** if you do not want one. WhatsApp recommends adding one.
6. Confirm the email address and tap **Save** or **Done**.
7. Enter the six-digit code sent to that email and tap **Verify**.

Source for the full sequence, including the recovery email step and the 7-day wait: https://faq.whatsapp.com/1920866721452534

### What to record

| App | Lock enabled? | Recovery method set? | Where the PIN is stored (do not write the PIN) |
|---|---|---|---|
| Signal | ☐ Registration lock on ☐ PIN set ☐ Neither | ☐ PIN in password manager ☐ Not stored | |
| WhatsApp | ☐ Two-step verification on | ☐ Recovery email added ☐ No recovery email | |
| Date of this check | | | |

---

## Chapter 7 — The first hour after a suspected SIM swap

The order matters. If your number is still under the attacker’s control, changing passwords can be useless because the attacker may intercept the reset messages. The FTC’s guidance puts the carrier first: contact your cellular provider immediately to take back control of your phone number, and change account passwords **after** you regain access to the number:

- FTC, “SIM Swap Scams: How to Protect Yourself”: https://consumer.ftc.gov/consumer-alerts/2019/10/sim-swap-scams-how-protect-yourself

### Step 1 — Call your carrier from a different phone

Use a phone that is not the affected number. If your carrier is one of the three large U.S. carriers, the numbers below are published by the carriers themselves.

**Verizon:** Dial `*611` from a Verizon phone, or `1-800-922-0204` from any phone. Verizon’s account-security page lists these numbers for reporting SIM swap fraud:

- https://www.verizon.com/support/account-security/

**T-Mobile:** Call `611` from a T-Mobile phone, or `1-877-575-7420` for port-validation support. T-Mobile’s port-validation page lists the 611 and 1-877-575-7420 numbers:

- https://www.t-mobile.com/customers/port-validation-notice

**AT&T:** Call `1-800-331-0500`. AT&T’s general customer-service number is listed on its contact page **[verify]** the fraud-specific routing on your account:

- https://www.att.com/support/contact-us/

If your carrier is not listed, use the number printed on your bill or in the carrier’s app. Do not search for a number while the suspected attacker may still control your number.

### Step 2 — What to say on the call

Say these things in this order:

1. “I suspect my number has been transferred to a SIM I do not control.”
2. “I am calling to regain control of my number and to freeze further changes.”
3. Ask the representative to reverse the unauthorized SIM change and to add or re-enable port-out protection.
4. Ask whether there is a verification method that does **not** use SMS to the affected number. If the representative offers to text a code to the affected number, explain that the number may be under the attacker’s control.

The FTC’s guidance is consistent with this: contact the provider to take back control of the number, then change passwords:

- https://consumer.ftc.gov/consumer-alerts/2019/10/sim-swap-scams-how-protect-yourself

### Step 3 — After you regain the number

1. Change the password for your **main email account** first. Most other resets route through email.
2. Change passwords for financial accounts.
3. Change passwords for social and messaging accounts.
4. Check for unauthorized password resets and login alerts.
5. Revoke active sessions on accounts that allow it.

The FTC’s page states that after you regain access to your number, you should change your account passwords:

- https://consumer.ftc.gov/consumer-alerts/2019/10/sim-swap-scams-how-protect-yourself

### Step 4 — Report

In the United States, report identity theft at **IdentityTheft.gov**. The FTC’s SIM-swap page links to reporting resources:

- https://www.identitytheft.gov/
- https://consumer.ftc.gov/consumer-alerts/2019/10/sim-swap-scams-how-protect-yourself

If you are outside the United States, use your national consumer-protection or police reporting channel. This kit does not claim that one reporting route works in every country.

### What to record

| Step | Done | Notes (do not write account passwords or PINs) |
|---|---|---|
| Called carrier from a different phone | ☐ | Carrier: / number called: |
| Asked to reverse the SIM change and freeze changes | ☐ | Reference or ticket number: |
| Regained control of the number | ☐ | Time: |
| Changed email password | ☐ | |
| Changed financial passwords | ☐ | |
| Changed social and messaging passwords | ☐ | |
| Reported to identity-theft or police channel | ☐ | Report number: |

---

## Chapter 8 — Printable recovery information table

**How to use this table.** Fill it in by hand or in a local document. Then print it, or copy it onto paper and keep it somewhere physical that you can reach without your phone. Do not store this table in the same place as your passwords. Do not write passwords, PINs, recovery codes, or full account numbers in this table. Record only **whether** a protection is set and **where** the related information is kept.

**Print settings.** A4 or Letter, portrait, one page if possible. If it does not fit on one page, print the four tables on two pages and staple them together.

### Table A — Phone and carrier

| Item | Status | Where the information is kept (describe the place, not the secret) |
|---|---|---|
| My mobile number | | |
| Carrier name | | |
| Carrier fraud or account-security number | | |
| SIM PIN is set | ☐ Yes ☐ No ☐ Not sure | |
| I know where the default SIM PIN is | ☐ Yes ☐ No | |
| I know where the PUK code is | ☐ Yes ☐ No | |
| Port-out protection is on | ☐ Yes ☐ No ☐ Not sure | |
| Name of the port-out protection feature | | |
| Date of this check | | |

### Table B — Recovery channels

| Item | Status | Where the information is kept |
|---|---|---|
| Main email address | | |
| Main email recovery method (type only: backup email / phone / recovery code) | | |
| Backup email address | | |
| Passkey is set on the main email account | ☐ Yes ☐ No | |
| Recovery codes have been printed or saved | ☐ Yes ☐ No | Where (do not write the codes): |
| Date of this check | | |

### Table C — High-value accounts, in priority order

| Priority | Account type | Current second factor (SMS / authenticator / passkey / hardware key / none) | Target second factor | Done? |
|---|---|---|---|---|
| 1 | Main email | | Passkey or authenticator | ☐ |
| 2 | Bank or payment | | Passkey or app approval | ☐ |
| 3 | Main social account | | Authenticator or passkey | ☐ |
| 4 | Signal / WhatsApp | | Registration lock / two-step verification | ☐ |
| 5 | Other: | | | ☐ |

### Table D — First-hour card (cut along the line and keep with you)

| Order | Action | What to have ready |
|---|---|---|
| 1 | Call the carrier from a different phone | Carrier name, account verification information |
| 2 | Ask to reverse the SIM change and freeze further changes | A sentence describing what happened |
| 3 | Change the main email password | Main email address, recovery method |
| 4 | Change financial passwords | Account list |
| 5 | Check for unauthorized resets | Login alerts |
| 6 | Report to the identity-theft or police channel | Timeline of events |

**A note on what this table is not.** This table is not a password manager and not a backup of your accounts. If you lose the table, you have lost a checklist, not your credentials. If someone else finds the table, they should not be able to log in to anything, because it contains no passwords, no PINs, and no recovery codes.

---

## Limits — What this kit cannot do

This kit is a set of checklists and explanations. It is not a security product, and it does not guarantee that an account will not be taken over. The following limits are stated plainly.

1. **It cannot stop a carrier employee who is tricked or bribed.** Carrier port-out protections reduce the risk. They do not eliminate the possibility that someone inside the carrier process is fooled or acts improperly. The FTC describes SIM swap as a scam that often involves persuading the carrier, not breaking into the network.

2. **It cannot make SMS secure.** NIST classifies SMS and PSTN authentication as a restricted authenticator. Replacing SMS with a passkey or authenticator reduces the risk. It does not make the SMS channel itself private or reliable.

3. **It cannot guarantee that a passkey is recoverable.** A passkey stored only on one device can be lost with that device. Apple’s own documentation notes that an Apple Account passkey is tied to one iCloud Keychain, and Signal states that it cannot reset your PIN. Recovery depends on the backup and recovery methods you set up separately.

4. **It cannot override a platform’s available settings.** Facebook’s phone-lookup setting may not offer a “Nobody” option on every account. A bank may not offer TOTP. A carrier may not offer a lock with the name used in this kit. The kit tells you what to look for and where the official page is. It cannot make a feature exist.

5. **It cannot replace the official pages.** Menu paths, feature names, and phone numbers change. Every chapter links to the official source. If this kit and the official page disagree, the official page is the source to follow.

6. **It cannot protect accounts you have not inventoried.** The recovery table is only useful if you fill it in. A protection you have not enabled, or an account you have forgotten, is outside the scope of this kit.

7. **It cannot provide legal or financial advice.** The reporting steps point to official channels. They do not tell you what to say to a bank, a lawyer, or a regulator in a specific country. For legal advice, consult a qualified professional.
