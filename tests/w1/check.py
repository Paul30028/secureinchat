# Independent check of the cleaned files: exiftool must find no marker, GPS, camera make/model, author;
# the files must still open (Pillow decodes images with the same size; pypdf and python-docx open documents).
# Usage: python3 tests/w1/check.py INDIR OUTDIR
import json, subprocess, sys, zipfile, io
from PIL import Image
try:
    import pillow_heif; pillow_heif.register_heif_opener()
except ImportError:
    pass
from pypdf import PdfReader
import docx
src, out = sys.argv[1], sys.argv[2]
MARK = 'W1MARKER-Paul-Test'
rep = json.load(open(f'{out}/report.json'))
fails = []
def exif(path):
    r = subprocess.run(['exiftool', '-a', '-G1', '-s', path], capture_output=True, text=True)
    return r.stdout
for name, r in rep.items():
    if not r.get('ok'):
        fails.append(f'{name}: tool error {r.get("error")}'); continue
    before, after = exif(f'{src}/{name}'), exif(f'{out}/{name}')
    if MARK not in before and 'GPS' not in before: fails.append(f'{name}: fixture has no marker (test bug)')
    for bad in [MARK, 'GPSLatitude', 'GPSLongitude', 'GPSCoordinates', 'TestMake', 'TestModel', 'W1Creator', 'W1Soft', '+31.2304']:
        if bad in after: fails.append(f'{name}: still contains {bad}')
    if name.endswith(('.jpg', '.png', '.webp', '.heic')):
        a, b = Image.open(f'{src}/{name}'), Image.open(f'{out}/{name}')
        b.load()
        if a.size != b.size: fails.append(f'{name}: size changed {a.size} -> {b.size}')
    if name.endswith('.mp4'):
        r2 = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'csv=p=0', f'{out}/{name}'], capture_output=True, text=True)
        if 'video' not in r2.stdout: fails.append(f'{name}: cleaned video does not decode: {r2.stderr[:200]}')
    if name.endswith('.pdf'):
        rd = PdfReader(f'{out}/{name}')
        if len(rd.pages) != 1: fails.append(f'{name}: page count changed')
        if rd.metadata and any(MARK in str(v) for v in rd.metadata.values()): fails.append(f'{name}: pypdf still sees marker')
    if name.endswith('.docx'):
        d = docx.Document(f'{out}/{name}')
        if MARK in (d.core_properties.author or '') + (d.core_properties.title or ''): fails.append(f'{name}: core properties kept')
        with zipfile.ZipFile(f'{out}/{name}') as z:
            for n in z.namelist():
                blob = z.read(n)
                if MARK.encode() in blob: fails.append(f'{name}: {n} still contains marker')
                if n.lower().endswith(('.jpg', '.jpeg')) and b'GPS' in blob[:4096]:
                    e = subprocess.run(['exiftool', '-GPSLatitude', '-'], input=blob, capture_output=True).stdout
                    if e.strip(): fails.append(f'{name}: embedded {n} still has GPS')
    print(f"{'ok  ' if not any(f.startswith(name) for f in fails) else 'FAIL'} {name}: {r}")
if 'photo-rotated.jpg' in rep and rep['photo-rotated.jpg'].get('ok'):
    # Removing Orientation without rotating the pixels would show the photo sideways.
    o = subprocess.run(['exiftool', '-Orientation', '-n', '-s3', f'{out}/photo-rotated.jpg'], capture_output=True, text=True).stdout.strip()
    print('rotated photo: Orientation after cleaning =', o or '(removed)')
for f in fails: print('FAIL', f)
print('W1 CHECK', 'FAILED' if fails else 'PASSED', f'({len(rep)} files)')
sys.exit(1 if fails else 0)
