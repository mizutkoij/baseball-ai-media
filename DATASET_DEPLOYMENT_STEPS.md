# Baseball-Dataset 移植手順

## 1. 復元点確保
```bash
cd C:\Users\mizut\baseball-dataset
git switch -c chore/archive-1point02-20250802
git tag pre-archive-1point02-20250802
```

## 2. ツールコピー
以下のファイルを手動コピー：

### From: `C:\Users\mizut\baseball-ai-media\tools\scan_forbidden.py`
### To: `C:\Users\mizut\baseball-dataset\tools\scan_forbidden.py`

```python
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
```

## 3. 初回スキャン実行
```bash
cd C:\Users\mizut\baseball-dataset
python tools\scan_forbidden.py
```

## 4. GitHub Actions CI
### Create: `C:\Users\mizut\baseball-dataset\.github\workflows\forbidden.yml`

```yaml
name: Forbidden Scan
on: 
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: 
          python-version: '3.11'
      - name: Run forbidden token scan
        run: python tools/scan_forbidden.py
```

## 5. .gitignore 追加
```
# secrets & sessions
cookies.txt
*.cookies
archive/
*.tar.gz
*.db
```

## 6. コミット
```bash
git add tools/scan_forbidden.py .github/workflows/forbidden.yml .gitignore
git commit -m "feat: implement 1point02 forbidden guard and archive system

- Add Python-based forbidden token scanner
- Create GitHub Actions CI for automated scanning  
- Set up archive directory for isolated files
- Prevent 1point02 reference reintroduction

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push --set-upstream origin chore/archive-1point02-20250802
```