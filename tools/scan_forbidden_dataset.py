import os, re, sys

ROOT = os.getcwd()
IGNORE_DIR = re.compile(r'(archive|\.git|node_modules|__pycache__|logs)(/|\\)')
PATTERNS = [
    re.compile(r'1point02\.jp', re.I),
    re.compile(r'\b1point02\b', re.I),
    re.compile(r'(?<!scale-\[)(?<!pf > )(?:1\.02)(?![\d\]])', re.I),
]
ALLOW_PER_FILE = {
    # ツール自身の参照を許可
    'tools/scan_forbidden.py': [r'1point02', r'PATTERNS'],
    'tools/quarantine_1point02.py': [r'1point02', r'HIT_PATTERNS'],
}

def allowed(file, line):
    allow = ALLOW_PER_FILE.get(file.replace('\\','/'))
    if not allow: return False
    return any(re.search(pat, line) for pat in allow)

bad = []
for base, dirs, files in os.walk(ROOT):
    if IGNORE_DIR.search(base): 
        continue
    for f in files:
        path = os.path.join(base, f)
        rel = os.path.relpath(path, ROOT).replace('\\','/')
        if IGNORE_DIR.search(rel): 
            continue
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as fh:
                for i, line in enumerate(fh, 1):
                    if allowed(rel, line): 
                        continue
                    if any(p.search(line) for p in PATTERNS):
                        bad.append({'file': rel, 'line': i, 'text': line.strip()})
        except Exception:
            continue

if bad:
    print("Forbidden tokens found:")
    for b in bad:
        print(f"{b['file']}:{b['line']}: {b['text']}")
    sys.exit(1)
else:
    print("OK: no forbidden tokens")