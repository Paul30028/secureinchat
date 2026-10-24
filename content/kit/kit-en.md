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
