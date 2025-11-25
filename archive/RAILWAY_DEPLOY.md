# Railway デプロイメント手順

## 前提条件
- GitHub リポジトリが公開されている
- データベースファイル (db_current.db, db_history.db) を準備

## デプロイ手順

### 1. Railway アカウント作成
```bash
# Railway サイトでアカウント作成
# https://railway.app/
```

### 2. プロジェクト作成
1. Railway ダッシュボードで "New Project" クリック
2. "Deploy from GitHub repo" 選択
3. `baseball-ai-media` リポジトリを選択

### 3. 環境変数設定
```
NODE_ENV=production
DB_CURRENT=/app/data/db_current.db
DB_HISTORY=/app/data/db_history.db
PORT=3000
```

### 4. データベースアップロード
```bash
# Railway CLI 使用
railway login
railway environment
railway volume create data
railway volume mount data /app/data

# データベースファイルをアップロード
railway run 'mkdir -p /app/data'
# ファイルをvolume にコピー (Railway ダッシュボードから)
```

### 5. ドメイン設定
- Railway ダッシュボードで "Settings" → "Domains"
- カスタムドメインまたは Railway 提供ドメインを使用

## 期待される結果
- ✅ 即座にデプロイ完了
- ✅ SQLite データベース動作
- ✅ ファイルシステム操作正常
- ✅ 全 API routes 機能
- ✅ コスト: $5/月程度

## トラブルシューティング
```bash
# ログ確認
railway logs

# リデプロイ
railway redeploy
```