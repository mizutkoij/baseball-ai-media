# tools/quarantine_1point02.py
import os, re, json, shutil, hashlib, datetime

ROOT = os.getcwd()
OUTDIR = os.path.join(ROOT, "archive", f"1point02-{datetime.date.today():%Y%m%d}")
os.makedirs(OUTDIR, exist_ok=True)

HIT_PATTERNS = [
    re.compile(r'1point02\.jp', re.I),
    re.compile(r'\b1point02\b', re.I),
    re.compile(r'(?<!scale-\[)(?<!pf > )1\.02(?![\d\]])', re.I),
]
IGNORE_DIRS = re.compile(r'(archive|\.git|node_modules|__pycache__|logs)(/|\\)')
IGNORE_FILES = [
    'tools/quarantine_1point02.py',
    'tools/scan_forbidden.py'
]
ALSO_QUARANTINE = [
    r'.*cookies\.txt$', 
    r'.*\.db$', 
    r'.*\.db-(wal|shm)$', 
    r'.*\.tar\.gz$'
]

def is_hit_line(line: str) -> bool:
    return any(p.search(line) for p in HIT_PATTERNS)

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1<<20), b''): 
            h.update(chunk)
    return h.hexdigest()

hits = set()
for base, _, files in os.walk(ROOT):
    if IGNORE_DIRS.search(base): 
        continue
    for f in files:
        path = os.path.join(base, f)
        rel = os.path.relpath(path, ROOT).replace('\\', '/')
        if IGNORE_DIRS.search(rel): 
            continue
        if rel in IGNORE_FILES:
            continue
        
        # 明示隔離パターン
        if any(re.match(p, rel) for p in ALSO_QUARANTINE):
            hits.add(rel)
            continue
            
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as fh:
                if any(is_hit_line(line) for line in fh):
                    hits.add(rel)
        except Exception:
            # バイナリなどはスキップ
            continue

manifest = []
for rel in sorted(hits):
    src = os.path.join(ROOT, rel)
    if not os.path.exists(src):
        continue  # Already moved or deleted
    dst = os.path.join(OUTDIR, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.move(src, dst)
    manifest.append({
        "rel": rel,
        "size": os.path.getsize(dst),
        "sha256": sha256_file(dst)
    })

with open(os.path.join(OUTDIR, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump({
        "moved": manifest, 
        "count": len(manifest),
        "date": datetime.date.today().isoformat()
    }, f, ensure_ascii=False, indent=2)

print(f"Quarantined {len(manifest)} files to {OUTDIR}")
if manifest:
    print("Quarantined files:")
    for item in manifest[:10]:  # Show first 10
        print(f"  {item['rel']}")
    if len(manifest) > 10:
        print(f"  ... and {len(manifest) - 10} more")
else:
    print("No files found for quarantine")