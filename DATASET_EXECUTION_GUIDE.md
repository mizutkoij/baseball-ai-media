# Baseball-Dataset 実行ガイド

## 🚀 一気通貫実行手順（15分）

### 1. ディレクトリ移動
```bash
cd C:\Users\mizut\baseball-dataset
```

### 2. ツールファイルコピー

#### A. scan_forbidden.py を tools/ にコピー
```bash
mkdir tools
# Copy from: C:\Users\mizut\baseball-ai-media\tools\scan_forbidden_dataset.py
# To: C:\Users\mizut\baseball-dataset\tools\scan_forbidden.py
```

#### B. quarantine_1point02.py を tools/ にコピー  
```bash
# Copy from: C:\Users\mizut\baseball-ai-media\tools\quarantine_1point02.py
# To: C:\Users\mizut\baseball-dataset\tools\quarantine_1point02.py
```

### 3. 初回検出スキャン実行
```bash
python tools\scan_forbidden.py
```
**→ ここで出力されるヒット一覧が作業リストです**

### 4. 自動隔離実行
```bash
python tools\quarantine_1point02.py
```
**→ manifest.json の件数を確認してください**

### 5. GitHub Actions設定
```bash
mkdir -p .github\workflows
# Copy from: C:\Users\mizut\baseball-ai-media\workflows\forbidden-dataset.yml  
# To: C:\Users\mizut\baseball-dataset\.github\workflows\forbidden.yml
```

### 6. .gitignore更新
```bash
# C:\Users\mizut\baseball-ai-media\dataset-gitignore-additions.txt の内容を
# C:\Users\mizut\baseball-dataset\.gitignore に追記
```

### 7. コミット・プッシュ
```bash
git add tools/ .github/ archive/ .gitignore
git commit -m "feat: implement 1point02 quarantine and forbidden guard

- Add automated quarantine system for 1point02 references
- Implement Python-based forbidden token scanner
- Set up GitHub Actions CI for continuous protection
- Archive sensitive files with manifest tracking
- Prevent reintroduction of third-party references

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push --set-upstream origin chore/archive-1point02-20250802
```

### 8. 健全性確認
```bash
# 再スキャン（ヒット0であること）
python tools\scan_forbidden.py

# media側も確認
cd ..\baseball-ai-media
npm run lint:forbidden
npm run build
```

## 📊 期待される結果

- **quarantine実行後**: manifest.jsonに移動ファイル一覧
- **再スキャン**: "OK: no forbidden tokens"
- **CI有効化**: GitHub ActionsでPR時自動チェック
- **両リポ保護**: 1point02再流入の完全防止

## 🔧 トラブルシューティング

- **Python未インストール**: Microsoft Store からPython 3.11をインストール
- **permission denied**: 管理者権限でPowerShell実行
- **Git操作エラー**: 既存ブランチ確認、必要に応じて `git checkout main` から再開