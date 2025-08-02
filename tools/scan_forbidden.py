import os, re, sys, hashlib, json

ROOT = os.getcwd()
IGNORE_DIR = re.compile(r'(archive|\.git|node_modules|__pycache__|logs|\.next|public)(/|\\)')
SCAN_DIRS = ['app', 'components', 'lib', 'scripts', 'tools', 'data']  # Limit to source code directories
PATTERNS = [
    re.compile(r'1point02\.jp', re.I),
    re.compile(r'\b1point02\b', re.I),
    re.compile(r'(?<!scale-\[)(?<!pf > )(?:1\.02)(?![\d\]])', re.I),
]
ALLOW_PER_FILE = {
    # provenanceのブロックリストなど「意図的な記述」を明示許可
    'lib/provenance.ts': [r'"1point02"', r'blockedSources'],
}

def allowed(file, line):
    allow = ALLOW_PER_FILE.get(file.replace('\\','/'))
    if not allow: return False
    return any(re.search(pat, line) for pat in allow)

bad = []
# Scan only specific source directories
for scan_dir in SCAN_DIRS:
    scan_path = os.path.join(ROOT, scan_dir)
    if not os.path.exists(scan_path):
        continue
    for base, dirs, files in os.walk(scan_path):
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