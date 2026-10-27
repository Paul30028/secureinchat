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
    for bad in ['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1', '9.9.9.9', '208.67.222.222', 'dns.google', 'cloudflare-dns']:
        if bad in s: fail.append(f'{rel}: public resolver {bad}')
    for bad in ['FileOutputStream(File(', 'openFileOutput', 'SharedPreferences', 'getSharedPreferences', 'HttpURLConnection', 'URL(']:
        if bad in s and 'VpnService' not in bad: fail.append(f'{rel}: {bad} (no disk logs, no HTTP)')
    if not s.startswith('// SPDX-License-Identifier: GPL-3.0-or-later'): fail.append(f'{rel}: missing SPDX header')
man = os.path.join(ROOT, 'app', 'src', 'main', 'AndroidManifest.xml')
if os.path.exists(man):
    m = open(man, encoding='utf-8').read()
    perms = set(re.findall(r'uses-permission[^>]*android:name="([^"]+)"', m))
    allowed = {'android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', 'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED', 'android.permission.POST_NOTIFICATIONS'}
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
