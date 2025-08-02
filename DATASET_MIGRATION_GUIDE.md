# baseball-dataset Migration Guide

## 1point02 Archive & Forbidden Guard Implementation

### 復元点確保
```bash
cd C:\Users\mizut\baseball-dataset
git switch -c chore/archive-1point02-20250802
git tag pre-archive-1point02-20250802
```

### Python Forbidden Scanner
Copy `tools/scan_forbidden.py` to baseball-dataset and run:
```bash
python tools/scan_forbidden.py
```

### 機微ファイル隔離
Move to archive:
- cookies.txt
- *.tar.gz backups  
- *.db temporary files

Add to .gitignore:
```
# secrets & sessions
cookies.txt
*.cookies
archive/
```

### GitHub Actions CI
Copy `.github/workflows/forbidden.yml` for automated scanning.

### 安全運用
- `ALLOW_PER_FILE` で意図的な記述を明示許可
- CI で毎回ブロック、誤検出は allow に追加
- 再流入防止の確実な運用を実現