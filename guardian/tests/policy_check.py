# SPDX-License-Identifier: GPL-3.0-or-later
# Guardian policy checks: no dependencies, no public DNS fallback, no telemetry, expected permissions only.
# Usage: python3 tests/policy_check.py [path/to/app-debug.apk]
import os, re, sys, subprocess, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fail = []
src = {p: open(p, encoding='utf-8').read() for p in glob.glob(os.path.join(ROOT, '**', '*.kt'), recursive=True) if '/build/' not in p}
gradle = open(os.path.join(ROOT, 'app', 'build.gradle.kts'), encoding='utf-8').read() if os.path.exists(os.path.join(ROOT, 'app', 'build.gradle.kts')) else ''
if re.search(r'^\s*(implementation|api|kapt|ksp)\s*\(', gradle, re.M): fail.append('app has library dependencies')
for p, s in src.items():
    rel = os.path.relpath(p, ROOT)
    if '/test/' in rel or rel.startswith('tests/'): continue
    # G18: public resolvers may be named only in DotProviders.kt, and only as DNS-over-TLS endpoints
    # (port 853, certificate checked). Everywhere else they stay forbidden: no clear-text public DNS fallback.
    if not rel.endswith('/DotProviders.kt'):
        for bad in ['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1', '9.9.9.9', '149.112.112.112', '208.67.222.222', 'dns.google', 'cloudflare-dns', 'dns.quad9.net', 'one.one.one.one']:
            if bad in s: fail.append(f'{rel}: public resolver {bad}')
    else:
        if re.search(r'\b53\b', s): fail.append(f'{rel}: DotProviders must not mention port 53 (DoT only)')
    if rel.endswith('/DotClient.kt') and ('DatagramSocket' in s or ', 53' in s):
        fail.append(f'{rel}: DoT client must not use UDP or port 53')
    for bad in ['FileOutputStream(File(', 'openFileOutput', 'SharedPreferences', 'getSharedPreferences', 'HttpURLConnection', 'URL(']:
        # The user's allowlist is the one thing kept on disk, and only UserRulesStore.kt may touch storage.
        # G12: StatsStore.kt holds only per-day block counts (a date and an integer), never what was blocked.
        if bad in ('SharedPreferences', 'getSharedPreferences') and (
            rel.endswith('/UserRulesStore.kt') or rel.endswith('/StatsStore.kt')
            or rel.endswith('/DnsSettingsStore.kt')
        ): continue
        if bad in s: fail.append(f'{rel}: {bad} (no disk logs, no HTTP)')
    if not s.startswith('// SPDX-License-Identifier: GPL-3.0-or-later'): fail.append(f'{rel}: missing SPDX header')
    # G12: StatsStore must only ever hold per-day counts. Any reference to these identifiers is
    # treated as a bug to catch before it ships, so the store cannot grow to remember what was
    # blocked (only how many times). The regex uses word boundaries so it does not match, say,
    # "guidelines"; test sources are already skipped above.
    if rel.endswith('/StatsStore.kt'):
        for pat in (r'\bdomain\b', r'\bqname\b', r'\buid\b'):
            if re.search(pat, s, re.IGNORECASE):
                fail.append(f'{rel}: forbidden identifier {pat} (StatsStore must only hold per-day counts)')
    # G18: DnsSettingsStore holds one setting, the encrypted DNS provider id. Same guard as StatsStore,
    # plus: it writes only through putString of that one key, so it cannot start keeping anything else.
    if rel.endswith('/DnsSettingsStore.kt'):
        for pat in (r'\bdomain\b', r'\bqname\b', r'\buid\b', r'putStringSet', r'putLong', r'putInt'):
            if re.search(pat, s, re.IGNORECASE):
                fail.append(f'{rel}: forbidden identifier {pat} (DnsSettingsStore holds only the provider id)')
        if len(re.findall(r'const val KEY_', s)) != 1:
            fail.append(f'{rel}: DnsSettingsStore must define exactly one preference key')
# G19: the app checkup reads the list of installed apps. That list must never leave the phone or be stored:
# no network or file/preference APIs in the scanner or the core rules.
for rel in ('app/src/main/kotlin/org/secureinchat/guardian/AppScanner.kt',
            'core/src/main/kotlin/org/secureinchat/guardian/dns/AppCheckup.kt'):
    path = os.path.join(ROOT, rel)
    if os.path.exists(path):
        src = open(path, encoding='utf-8').read()
        for bad in ('java.net', 'Socket', 'URL(', 'HttpURLConnection', 'openFileOutput', 'FileOutputStream',
                    'getSharedPreferences', 'SharedPreferences', 'File(', 'Files.write', 'writeText'):
            if bad in src:
                fail.append(f'{rel}: must not use {bad} (scan results stay in memory and on the phone)')
man = os.path.join(ROOT, 'app', 'src', 'main', 'AndroidManifest.xml')
if os.path.exists(man):
    m = open(man, encoding='utf-8').read()
    perms = set(re.findall(r'uses-permission[^>]*android:name="([^"]+)"', m))
    allowed = {'android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED', 'android.permission.POST_NOTIFICATIONS',
               # G19 app checkup (read-only, in memory; Paul 2026-11-01 / 2026-11-05)
               'android.permission.QUERY_ALL_PACKAGES'}
    if perms - allowed: fail.append(f'unexpected permissions: {sorted(perms - allowed)}')
    if 'android.permission.BIND_VPN_SERVICE' not in m: fail.append('VPN service not protected by BIND_VPN_SERVICE')
if len(sys.argv) > 1:
    aapt = sorted(glob.glob(os.path.join(os.environ.get('ANDROID_HOME', ''), 'build-tools', '*', 'aapt')))
    if aapt:
        out = subprocess.run([aapt[-1], 'dump', 'permissions', sys.argv[1]], capture_output=True, text=True).stdout
        print(out)
for f in fail: print('FAIL', f)
print('policy:', 'FAIL' if fail else 'ok')
sys.exit(1 if fail else 0)
