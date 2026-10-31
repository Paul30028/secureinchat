**Phone & Account Takeover Kit**

Draft chapters 0–3, sources checked by Claude on 24 October 2026. This is an educational workbook. It does not guarantee that any account will be safe from takeover.

---

## Chapter 0 — How to use this kit

This kit is a set of checklists. You do not need to read it from beginning to end. Each chapter covers one layer of protection. Each chapter ends with a table where you record only **whether** a protection is in place, or **where** you keep the information. Do not write passwords, PINs, or full account numbers in this kit.

**Before you start, print or copy the tables at the end of chapters 2, 3, and 8.** Chapter 8 is the full recovery information table. If you only print one page, print chapter 8.

**A note on menu paths.** Phone menus change with operating system versions and with phone manufacturers. The paths in this kit are based on the official pages listed next to each step. If your phone does not match, the official page is the source to trust. Where a path is not confirmed for a specific version, it is marked **[verify]** .

**A note on protection.** No single step prevents every takeover. A SIM PIN, a carrier lock, and a strong second factor work together. Skipping one layer leaves a gap that the other layers do not fill.

**Progress overview.**

| Chapter | Topic | Done | Not applicable | Later |
|---|---|---|---|---|
| 1 | Why your phone number is a takeover target | ☐ | ☐ | ☐ |
| 2 | SIM card PIN | ☐ | ☐ | ☐ |
| 3 | Carrier port-out protection | ☐ | ☐ | ☐ |
| 4 | Replacing SMS codes with an authenticator or passkey | ☐ | ☐ | ☐ |
| 5 | Phone number visibility on social accounts | ☐ | ☐ | ☐ |
| 6 | Signal and WhatsApp extra locks | ☐ | ☐ | ☐ |
| 7 | The first hour after a suspected takeover | ☐ | ☐ | ☐ |
| 8 | Printable recovery information table | ☐ | ☐ | ☐ |

---

## Chapter 1 — Why your phone number is a takeover target

Your phone number is not just a way to call you. Many companies use it as proof of who you are. When you click “forgot password,” the reset code often goes to your phone number by SMS. When you call a bank, the automated system may text you a code before it lets you speak to a person.

A SIM swap attack moves your number to a SIM card that the attacker controls. Once the attacker has your number, SMS codes go to the attacker, not to you. The attacker can then reset passwords for email, banking, and social accounts that still rely on SMS.

The U.S. Federal Trade Commission describes this pattern as a scam in which someone gets your personal information, persuades or tricks your carrier into moving your number, and then uses the number to take over other accounts:

- FTC, “SIM Swap Scams: How to Protect Yourself”: https://consumer.ftc.gov/consumer-alerts/2019/10/sim-swap-scams-how-protect-yourself

The U.S. National Institute of Standards and Technology (NIST) classifies SMS and PSTN-based out-of-band authentication as a **restricted authenticator**. This does not mean SMS is banned. It means the organisation that accepts SMS codes must assess the risk and accept that the risk will likely increase over time:

- NIST SP 800-63B-4, Digital Identity Guidelines: Authentication and Authenticator Management (July 2025), DOI: https://doi.org/10.6028/NIST.SP.800-63B-4
- NIST SP 800-63B-4 PDF: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-63b-4.pdf

The practical consequence is simple. **Your phone number is a recovery channel that other people can redirect.** The rest of this kit is about making that redirection harder, and about reducing how much depends on the number in the first place.

**What you are protecting against, in one sentence:** someone who has some of your personal information convincing your mobile carrier to move your number to a SIM they control, so that SMS codes and account-recovery messages go to them.

---

## Chapter 2 — SIM card PIN

### What it does

A SIM PIN is a code that the SIM card or eSIM asks for when the phone restarts or when the SIM is moved to another device. Without the PIN, the SIM does not work for calls or cellular data. This does not stop a determined attacker who can convince your carrier to issue a new eSIM, but it does stop someone who has physical access to your SIM and tries to use it in another phone.

Apple states that the SIM or eSIM locks automatically after a restart or after the SIM is removed, and that “Locked SIM” appears in the status bar:

- Apple, “Use a SIM PIN for your iPhone or iPad”: https://support.apple.com/en-ge/118228

### iPhone steps

These steps follow the current Apple support page. Apple labels the section “Turn your SIM PIN on or off” without naming a specific iOS version; the page shows a published date of 14 January 2026 and applies to current iOS releases:

1. Open the **Settings** app.
2. Tap **Cellular**.
3. If your iPhone has a single SIM or eSIM, tap **SIM PIN**. If your iPhone has Dual SIM or Dual eSIM, first tap the number you want to modify, then tap **SIM PIN**.
4. Turn the SIM PIN switch on.
5. If asked, enter your SIM PIN. If you have never used one, enter the default SIM PIN from your carrier.
6. Tap **Done**.

Source for the full path: https://support.apple.com/en-ge/118228

**Do not guess the PIN.** Apple’s page states that a wrong guess can permanently lock the SIM or eSIM, and that you would then need a new SIM or eSIM. If you do not know the default PIN, contact your carrier. The same page explains that if you enter the wrong PIN too many times, your carrier may be able to give you a PUK code:

- https://support.apple.com/en-ge/118228

### Android steps

Android menu names differ by manufacturer and by Android version. Google’s official Pixel support page lists **SIM card lock** under **Advanced security settings**, described as “Require a PIN to use your device”:

- Google Pixel support, “Manage security & privacy settings on your Pixel phone”: https://support.google.com/pixelphone/answer/2824802

A path confirmed for Android 15 on Google phones is:

1. Open **Settings**.
2. Tap **Security & privacy**.
3. Tap **More security & privacy**.
4. Tap **SIM card lock**.
5. Turn on **Lock SIM card**.
6. Enter the PIN and tap **OK**.

This path is documented for Android 15 on Google devices by Orange’s support page: https://assistance.orange.fr/mobile-tablette/tous-les-mobiles-et-tablettes/installer-et-utiliser/utiliser-les-applications-et-fonctionnalites/android-15/comment-activer-la-demande-du-code-pin-sur-votre-mobile-google-sous-android-15

On Samsung and other manufacturers, the path may be **Settings → Lock screen & security → SIM card lock** or **Settings → Security → SIM card lock** **[verify]** . Use the search function in Settings and search for “SIM card lock” or “SIM PIN” if the path differs.

**Danger — do not guess.** The same lockout risk that Apple describes applies to Android SIM PINs. If you do not know the default PIN, stop and contact your carrier. A PUK code is required after too many wrong attempts, and PUK codes also have a limited number of attempts.

### What to record

Record only whether the PIN is set, and where you keep the default PIN if your carrier gave you one. Do not write the PIN itself in this kit.

| Item | Status | Where the information is kept (do not write the PIN) |
|---|---|---|
| SIM PIN is set on my phone | ☐ Yes ☐ No ☐ Not sure | |
| I have confirmed the default SIM PIN with my carrier | ☐ Yes ☐ No | Carrier document / carrier app / other: |
| I know where the PUK code is | ☐ Yes ☐ No | Carrier document / carrier app / other: |
| Date of this check | | |

---

## Chapter 3 — Carrier port-out protection

A SIM PIN protects the physical SIM. Carrier port-out protection protects your **number** at the account level. The exact feature names differ by carrier. This chapter covers the three large U.S. carriers and the UK system. It does not claim that every carrier offers the same feature under the same name.

### 3.1 Verizon (U.S.)

Verizon offers **Number Lock**. Verizon’s support page describes it as a free feature that prevents your number from being moved to another line or carrier without your permission. The same page also notes a limit: Number Lock does not prevent SIM card changes or equipment changes to your device.

- Verizon, “Move your mobile number to another carrier FAQs,” Number Lock section: https://www.verizon.com/support/port-out-faqs/

**How to set it up:**

1. Dial `*611` from your Verizon phone, **or** sign in to My Verizon and go to the **Number Lock** section on the **Security** page.
2. Select **On** next to the number or numbers you want to protect.
3. Tap or click **Save Changes**.

Source for this path: https://www.verizon.com/support/port-out-faqs/

Verizon also uses a **Number Transfer PIN (NTP)** . Verizon describes the NTP as a temporary PIN that a customer must obtain for each line and give to the new carrier when porting the number away from Verizon. If Number Lock is on, the number cannot generate a Number Transfer PIN until the lock is turned off.

- Verizon port-out FAQ, Number Transfer PIN description: https://www.verizon.com/support/port-out-faqs/

**What to record for Verizon:**

| Item | Status |
|---|---|
| Number Lock is on | ☐ Yes ☐ No ☐ Not sure |
| I know how to turn Number Lock off if I choose to port my number | ☐ Yes ☐ No |
| Date of this check | |

Do not record the Number Transfer PIN in this kit. It is temporary and should be requested only when you are actually moving the number.

### 3.2 T-Mobile (U.S.)

T-Mobile offers **Port Validation** (also described as Port Out Protection). T-Mobile’s page states that if someone tries to move your number to another carrier, the new carrier must validate the request with T-Mobile using your passcode. T-Mobile describes this passcode as an extra numeric PIN, separate from your My T-Mobile password, required for anyone who calls Care or visits a retail store.

- T-Mobile, “Port-out scam protection”: https://www.t-mobile.com/customers/port-validation-notice

**How to set it up:**

1. Call `611` from your T-Mobile phone, **or** dial `1-877-575-7420` from any phone.
2. Ask the customer care representative to add **port validation** to your account.
3. The representative will ask you to create a **6-to-15-digit passcode**.

Source for this path and the passcode length: https://www.t-mobile.com/customers/port-validation-notice

T-Mobile also offers **SIM Protection** as a separate feature. T-Mobile’s privacy centre lists SIM Protection and Port Out Protection as separate items, which means turning on one does not automatically turn on the other **[verify]** the exact interaction between the two on your account:

- T-Mobile Privacy Center, Online Safety Resources: https://www.t-mobile.com/company/privacy-resources/account-security/account-verification.html

**What to record for T-Mobile:**

| Item | Status |
|---|---|
| Port Validation passcode is set | ☐ Yes ☐ No ☐ Not sure |
| SIM Protection is on | ☐ Yes ☐ No ☐ Not sure |
| Date of this check | |

Do not write the 6-to-15-digit passcode in this kit.

### 3.3 AT&T (U.S.)

AT&T uses **Wireless Account Lock** and **Number Transfer PIN**. AT&T states that if Wireless Account Lock is turned on, you cannot transfer your number, and that the Number Transfer PIN expires **4 days** after you request it (14 days for business accounts).

- AT&T, “Get a PIN to transfer your wireless number”: https://www.att.com/support/article/wireless/KM1447526/

**How to request a Number Transfer PIN:**

**Option A — myAT&T app:**

1. Sign in to the AT&T app.
2. Choose your profile icon, then tap **Settings**.
3. Select **Manage or remove account** to open your account profile.
4. Tap **Settings** and scroll to **Transfer phone number**.
5. Select **Request new PIN**. The PIN displays on the screen.

**Option B — Online account:**

1. Go to your account profile and sign in.
2. Select **Settings**.
3. Scroll to **Transfer phone number** and select **Request new PIN**.

**Option C — From your AT&T phone:**

1. Call `*PORT`.
2. Follow the prompts. You need your account passcode to generate the Number Transfer PIN.

Sources for these paths: https://www.att.com/support/article/wireless/KM1447526/

**How to turn Wireless Account Lock on or off:** the toggle is in the **myAT&T app** for postpaid consumer wireless accounts **[verify]**. The Number Transfer PIN page notes that the lock blocks transfers, and that only users with primary online access can request a Number Transfer PIN.

- AT&T Number Transfer PIN page, account-lock note: https://www.att.com/support/article/wireless/KM1447526/

**What to record for AT&T:**

| Item | Status |
|---|---|
| Wireless Account Lock is on | ☐ Yes ☐ No ☐ Not sure |
| I know where to request a Number Transfer PIN when I need one | ☐ Yes ☐ No |
| Date of this check | |

Do not record the Number Transfer PIN. It expires in 4 days and should be requested only when needed.

### 3.4 United Kingdom — PAC (Porting Authorisation Code)

The UK system works differently from the U.S. carrier-lock model. Your current provider must give you a **PAC** when you ask for one, and the PAC must be given to your new provider before the number can be ported. The PAC is valid for **30 days**.

- Ofcom, “Switching — mobile”: https://www.ofcom.org.uk/phones-and-broadband/switching-provider/switching-mobile-phone-provider

**How to request a PAC for one number:**

- Text **PAC** to **65075** from the number you want to keep. Ofcom states that your provider replies by text within a minute.
- You can also request a PAC through your current provider’s online account, where it must be given within one minute, or by phoning your current provider. If you have more than one number on the account, you must use the online account or phone.

Source for the 65075 short code, the one-minute replies and the 30-day validity: https://www.ofcom.org.uk/phones-and-broadband/switching-provider/switching-mobile-phone-provider

**Important difference from the U.S. model:** a PAC is not a permanent “lock.” It is a transfer authorisation code that you request when you want to leave. The protective effect comes from the fact that someone who does not have the PAC cannot port your number through the normal process. Keep the PAC private, and request it only when you actually intend to switch.

**What to record for the UK:**

| Item | Status |
|---|---|
| I know how to request a PAC (text PAC to 65075) | ☐ Yes ☐ No |
| I know that a PAC is valid for 30 days | ☐ Yes ☐ No |
| Date of this check | |

### 3.5 What the carrier may ask you, and why the order matters

When you call your carrier to add port-out protection, the representative may ask you to verify your identity. This is expected. The representative may also offer to send a verification code by SMS to your number. If your number is already being targeted, an SMS code may go to the attacker. Ask the representative whether there is another verification method available, and say that you are calling to prevent a port-out, not to perform a port-out.

This order is important: **set port-out protection before you need it.** If you wait until you suspect a swap, the attacker may already have control of the number, and the carrier may not be able to verify you through the number.

### 3.6 Carrier protection status table

Fill this in for your own carrier. If your carrier is not listed in this chapter, use the carrier’s own support page and mark the source.

| Carrier | Name of protection feature | On? | How to turn it on | Source URL | Date checked |
|---|---|---|---|---|---|
| Verizon | Number Lock | ☐ Yes ☐ No | `*611` or My Verizon → Security → Number Lock | https://www.verizon.com/support/port-out-faqs/ | |
| T-Mobile | Port Validation | ☐ Yes ☐ No | Call `611` or `1-877-575-7420`; ask for port validation | https://www.t-mobile.com/customers/port-validation-notice | |
| AT&T | Wireless Account Lock | ☐ Yes ☐ No | myAT&T app → account lock toggle | https://www.att.com/support/article/wireless/KM1447526/ | |
| UK (any carrier) | PAC request by text | ☐ N/A | Text **PAC** to **65075** when switching | https://www.ofcom.org.uk/phones-and-broadband/switching-provider/switching-mobile-phone-provider | |
| Other: | | ☐ Yes ☐ No | | | |

**Do not write your carrier account PIN, port-validation passcode, Number Transfer PIN, or PAC in this table.** Record only whether the protection is on and where the official instructions are.

---

## Chapter 4 — Replacing SMS codes with an authenticator or passkey

### What this chapter changes

The first three chapters make it harder for someone to move your number. This chapter reduces how much depends on the number at all. An authenticator app generates a code on your device. A passkey replaces the password with a cryptographic key that stays on your device. Neither one depends on your carrier delivering an SMS.

NIST SP 800-63B classifies SMS and PSTN-based out-of-band authentication as a **restricted authenticator**. SMS is not banned. It is a method whose known risks must be assessed and reduced over time:

- NIST SP 800-63B-4 (final, 2025), section on authentication using the public telephone network: https://pages.nist.gov/800-63-4/sp800-63b.html
- Publication record: https://csrc.nist.gov/pubs/sp/800/63/b/4/final

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

### 4.2 Apple Account — passkeys and a recovery key

Apple stores passkeys in iCloud Keychain, encrypted, and they work on your devices signed in to the same Apple Account. Apple states that **iCloud Keychain and two-factor authentication must be turned on** to use passkeys:

- Apple, “Use passkeys to sign in to websites and apps on iPhone”: https://support.apple.com/guide/iphone/iphf538ea8d0/ios

The general steps on iPhone are:

1. Open the sign-in screen of a supported website or app.
2. Tap the account name field, or tap **Sign in with a passkey** if the button is shown.
3. Use Face ID or Touch ID to confirm.

**Recovery key.** Your Apple Account itself is protected by two-factor authentication and your device passcode. To keep a way back in that does not depend on your phone number, set up a **recovery key** (or a recovery contact). On iPhone:

1. Open **Settings**, then tap **[your name]**.
2. Tap **Sign-In & Security**, then tap **Recovery Key**.
3. Tap **Continue** and follow the steps. Write the key down and confirm it.

Source: Apple, “Set up a recovery key for your Apple Account”: https://support.apple.com/109345

Keep the written key somewhere physical and safe. Do not write it in this kit. If you lose both the key and access to your trusted devices, Apple may not be able to restore your account.

### 4.3 Microsoft account — add a passkey

Microsoft supports passkeys for personal Microsoft accounts and for work or school accounts. The setup entry point is the Advanced Security Options page.

1. Go to **account.live.com/proofs/manage** and sign in.
2. Under **Advanced Security Options**, select **Add a new way to sign in or verify**.
3. Choose **Face, fingerprint, PIN, or security key**.
4. Follow the prompts on the device where the passkey will be created.
5. Choose whether to save the passkey on this device or another location.

Source: Microsoft Support, “Create and save a passkey”: https://support.microsoft.com/en-us/accounts-billing/security/create-save-passkey

### 4.4 A common bank account — the Chase example

Banks move more slowly than platform accounts. Chase describes its 2-step verification setting on its security page:

1. Sign in to chase.com and open the **Security & Privacy** tab.
2. Under **My Account**, find **Enhance your Security**.
3. Select **enable 2-step verification for extra security at sign-in**.
4. Turn on **Use 2-step verification every time you sign in on a browser**, then save.

Depending on your account type, the options may be under **Security → Manage security & privacy** instead.

Source: Chase, “How you can protect yourself”: https://www.chase.com/digital/resources/privacy-security/security/how-you-can-protect

The same Chase page describes passkeys (sign in with your face, fingerprint or device passcode) and links to passkey setup, but it does not publish step-by-step instructions. Look for a passkey option in the Chase app or on chase.com after you sign in.

**A practical note.** Not every bank offers passkeys or an authenticator app. If yours does not, the strongest option may be the bank's own app-based approval. Record what your bank actually offers rather than what you wish it offered.

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

Source, including the statement that the number is not publicly displayed: https://help.x.com/safety-and-security/email-and-phone-discoverability-settings

### 5.2 Facebook

Facebook has a setting that controls who Facebook may suggest your profile to, based on your phone number or email address (for example, people who uploaded contacts that include your number). The options are **Possible connections**, **Friends of friends**, **Friends**, and **No one**. Email and phone have separate settings.

1. Click your profile picture in the top right of Facebook.
2. Select **Settings & privacy**, then **Settings**.
3. Under **Audience and visibility**, click **How people find and contact you**.
4. Next to **People with your phone number**, click **View** and choose **No one** (or the most restrictive option your account shows).
5. Repeat for **People with your email address** if you want.

Source: Facebook Help Centre, “Control who Facebook can suggest your profile to based on your email address or phone number”: https://www.facebook.com/help/131297846947406

Separately, on your profile, open **About → Contact and basic info** and set the audience for your phone number to **Only me**, or remove the number. Facebook's Privacy Checkup also walks through these settings: https://www.facebook.com/privacy/checkup

### 5.3 Instagram

Instagram's contact settings are managed through Meta's Accounts Center, and the menus change often. Check two things:

1. **Which numbers are attached to the account.** Open **Settings and privacy → Accounts Center → Personal details → Contact info**. Remove numbers you no longer use. Keep at least one email address or phone number you control, or you may lose a way to recover the account.
2. **Whether a number is shown publicly.** If you have a professional (business or creator) account, open **Edit profile → Contact options** and remove a public phone number if you do not want it visible.

Source: Instagram Help Centre (search for “contact info” and “contact options”): https://help.instagram.com/

The exact labels on your account may differ. Record what your account actually shows.

### 5.4 LinkedIn

LinkedIn allows others to find your profile by phone number if **Discoverability by phone number** is enabled. The setting is separate from whether your phone number appears in your profile’s Contact info section.

1. Click the **Me** icon.
2. Select **Settings & Privacy**.
3. Click **Visibility**.
4. Under **Visibility of your profile & network**, click **Discoverability by phone number**.
5. Select **No one** (or the most restrictive option your account shows).
6. Changes save automatically.

Source: https://www.linkedin.com/help/linkedin/answer/a548106

**LinkedIn’s own caveat.** LinkedIn states that turning off discoverability by email or phone number does not stop permitted services off LinkedIn from discovering your profile based on your name and organisation. That is a separate setting (visibility off LinkedIn):

- https://www.linkedin.com/help/linkedin/answer/a548106

### What to record

| Platform | Profile number hidden or removed? | Lookup by phone number disabled? | Date checked |
|---|---|---|---|
| X | ☐ Yes ☐ No ☐ N/A | ☐ Yes ☐ No | |
| Facebook | ☐ Yes ☐ No | ☐ Most restrictive option set ☐ Not available on my account | |
| Instagram | ☐ No public number ☐ Removed ☐ Professional contact button removed | ☐ Old numbers removed from Contact info | |
| LinkedIn | ☐ Removed from Contact info ☐ Not added | ☐ No one ☐ Other: | |

---

## Chapter 6 — Signal registration lock and WhatsApp two-step verification

### 6.1 Signal — PIN and registration lock

Signal’s PIN can do two jobs. It can help recover your profile, settings, contacts, and block list. It can also act as a **registration lock**: without the PIN, someone who can receive your SMS cannot register your number on a new device. Signal states that if you forget the PIN and have the registration lock enabled, you may be locked out of your account for up to **7 days**. Signal also states that it does not know your PIN and cannot reset or recover it:

- Signal Support, “Signal PIN”: https://support.signal.org/hc/en-us/articles/360007059792

**To enable the registration lock:**

1. Open Signal.
2. Go to **Settings → Account**.
3. Set or confirm your **Signal PIN**.
4. Turn on **Registration Lock**.

Source for the Settings → Account path and the registration lock behavior: https://support.signal.org/hc/en-us/articles/360007059792

**A critical warning.** The PIN is not a chat backup. Signal states clearly that your message history is not linked to the PIN and cannot be recovered with it. If you enable the registration lock and forget the PIN, you wait out the 7-day timer. Store the PIN in a password manager, not in this kit.

### 6.2 WhatsApp — two-step verification

WhatsApp's two-step verification adds a secret of your own on top of the SMS registration code, so someone who receives your SMS code still cannot register your number without it. WhatsApp is upgrading this from a 6-digit PIN to a **password**; if you already use a PIN, the help page explains how to update it.

**To turn it on or review it:**

1. Open WhatsApp.
2. Go to **Settings → Account → Two-step verification**.
3. Turn it on, or choose to change the PIN or password.
4. Add a **recovery email address** when asked. WhatsApp uses it to send a reset link if you forget the PIN or password.

Sources:
- WhatsApp Help Center, “How to manage two-step verification settings”: https://faq.whatsapp.com/1920866721452534
- WhatsApp Help Center, “About two-step verification”: https://whatsapp.com/faq/general/26000021

If you forget it and have no recovery email, WhatsApp may make you wait before you can register again. Store the PIN or password in a password manager, not in this kit.

### What to record

| App | Lock enabled? | Recovery method set? | Where the PIN is stored (do not write the PIN) |
|---|---|---|---|
| Signal | ☐ Registration lock on ☐ PIN set ☐ Neither | ☐ PIN in password manager ☐ Not stored | |
| WhatsApp | ☐ Two-step verification on (☐ PIN ☐ password) | ☐ Recovery email added ☐ No recovery email | |
| Date of this check | | | |

---

## Chapter 7 — The first hour after a suspected SIM swap

The order matters. If your number is still under the attacker’s control, changing passwords can be useless because the attacker may intercept the reset messages. The FTC’s guidance puts the carrier first: contact your cellular provider immediately to take back control of your phone number, and change account passwords **after** you regain access to the number:

- FTC, “SIM Swap Scams: How to Protect Yourself”: https://consumer.ftc.gov/consumer-alerts/2019/10/sim-swap-scams-how-protect-yourself

### Step 1 — Call your carrier from a different phone

Use a phone that is not the affected number. The numbers below are the ones each carrier publishes on the page linked.

**Verizon:** Dial `*611` from a Verizon phone, or `1-800-922-0204` from any phone. Verizon’s SIM-swapping page lists these numbers for reporting an unauthorized SIM change:

- https://www.verizon.com/about/account-security/sim-swapping

**T-Mobile:** Call `611` from a T-Mobile phone, or `1-877-575-7420` from any phone. T-Mobile's port-validation page lists these numbers for its port-out protection; its Customer Care number on the same page is `1-844-492-0330`:

- https://www.t-mobile.com/customers/port-validation-notice

**AT&T:** AT&T's fraud page does not publish a single SIM-swap number. Use the customer-service number on your bill or in the myAT&T app, and say you are reporting an unauthorized SIM change. AT&T's fraud guidance:

- https://www.att.com/support/article/my-account/KM1159567/

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

3. **It cannot guarantee that a passkey is recoverable.** A passkey stored only on one device can be lost with that device. Signal states that it cannot reset your PIN, and Apple may not be able to restore an account if you lose both your recovery key and your trusted devices. Recovery depends on the backup and recovery methods you set up separately.

4. **It cannot override a platform’s available settings.** A platform may change or remove a setting. A bank may not offer passkeys or an authenticator app. A carrier may not offer a lock with the name used in this kit. The kit tells you what to look for and where the official page is. It cannot make a feature exist.

5. **It cannot replace the official pages.** Menu paths, feature names, and phone numbers change. Every chapter links to the official source. If this kit and the official page disagree, the official page is the source to follow.

6. **It cannot protect accounts you have not inventoried.** The recovery table is only useful if you fill it in. A protection you have not enabled, or an account you have forgotten, is outside the scope of this kit.

7. **It cannot provide legal or financial advice.** The reporting steps point to official channels. They do not tell you what to say to a bank, a lawyer, or a regulator in a specific country. For legal advice, consult a qualified professional.
