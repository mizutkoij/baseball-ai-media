# 🚀 100.88.12.26 デプロイ手順

## 1. サーバー接続

```bash
ssh mizu@100.88.12.26
```

## 2. プロジェクト配置（初回のみ）

```bash
# プロジェクトディレクトリ作成
mkdir -p /home/mizu/baseball-ai-media
cd /home/mizu/baseball-ai-media

# ファイル転送（ローカルから）
# rsync -av --exclude node_modules --exclude .git . mizu@100.88.12.26:/home/mizu/baseball-ai-media/
# または
# git clone your-repo-url .
```

## 3. 環境セットアップ

```bash
# Node.js依存関係インストール
npm install

# データディレクトリ作成
mkdir -p data/timeline/yahoo_npb1 data/timeline/yahoo_npb2 data/cache logs

# 環境変数設定
cat > .env.local << 'EOF'
YAHOO_LEVELS=npb2
BACKFILL_SLEEP_MS=30000
YAHOO_STOP=
CONTACT_EMAIL=your-email@domain.com
PGURL=postgresql://username:password@localhost:5432/npb_database
DATA_DIR=/home/mizu/baseball-ai-media/data
WEBHOOK_DISCORD_URL=https://discord.com/api/webhooks/1405095686776688650/kD5MDFn9x6xscV8Gg5_vrUO8K-9-eaToPmPZtLM3un-E_acj2BNi-k9xxWka_5NPxd-M
EOF

# 環境変数読み込み
source .env.local
```

## 4. データベースセットアップ（PostgreSQL必要）

```bash
# PostgreSQL インストール（Ubuntu/Debian）
sudo apt update
sudo apt install postgresql postgresql-contrib

# データベース作成
sudo -u postgres createdb npb_database
sudo -u postgres psql -c "CREATE USER npb_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE npb_database TO npb_user;"

# スキーマ作成
psql $PGURL -f db/ddl.sql
psql $PGURL -f db/production-tuning.sql
```

## 5. システム起動

```bash
# Discord通知：システム開始
npx tsx scripts/notify-discord.ts --start

# 収集システム起動（常駐）
nohup npm run yahoo:live:today > logs/yahoo-live.log 2>&1 &
nohup npm run db:sync > logs/db-sync.log 2>&1 &

# ダッシュボード起動
nohup npm run dev > logs/nextjs.log 2>&1 &

# プロセス確認
ps aux | grep -E "(yahoo|db:sync|next)"
```

## 6. 監視設定

```bash
# crontab設定
crontab -e

# 以下を追加
*/5 * * * * cd /home/mizu/baseball-ai-media && npx tsx scripts/check-metrics.ts >> logs/metrics.log 2>&1
0 9 * * * cd /home/mizu/baseball-ai-media && npx tsx scripts/notify-discord.ts --daily-report
30 3 * * * cd /home/mizu/baseball-ai-media && npx tsx scripts/archive-old-data.ts
```

## 7. 動作確認

```bash
# ログ確認
tail -f logs/yahoo-live.log
tail -f logs/db-sync.log
tail -f logs/nextjs.log

# メトリクス確認
npx tsx scripts/check-metrics.ts

# ダッシュボードアクセス確認
curl http://localhost:3000/api/health || echo "起動中..."
```

## 8. ファイアウォール設定（必要に応じて）

```bash
# ポート3000を開放
sudo ufw allow 3000

# 現在の設定確認
sudo ufw status
```

## 9. SSL証明書設定（本格運用時）

```bash
# Let's Encrypt設定例
sudo apt install certbot
sudo certbot certonly --standalone -d 100.88.12.26

# nginx reverse proxy設定（推奨）
sudo apt install nginx
sudo nano /etc/nginx/sites-available/baseball-ai-media
```

## 10. 緊急時対応

```bash
# 全停止
export YAHOO_STOP=true
pkill -f "yahoo"
pkill -f "db:sync"  
pkill -f "next"

# または HTTP経由
curl -X POST "http://localhost:3000/api/admin?action=stop" \
  -H "Content-Type: application/json" \
  -d '{"reason":"緊急停止"}'

# 再開
unset YAHOO_STOP
# 上記手順5で再起動
```

## トラブルシューティング

### ポートが使用中の場合
```bash
# ポート使用状況確認
netstat -tlnp | grep :3000
lsof -i :3000

# プロセス強制終了
sudo kill -9 $(lsof -ti :3000)
```

### Node.js/npm問題
```bash
# Node.js バージョン確認
node --version  # v18以上推奨
npm --version

# 依存関係再インストール
rm -rf node_modules package-lock.json
npm install
```

### データベース接続問題
```bash
# PostgreSQL サービス確認
sudo systemctl status postgresql
sudo systemctl start postgresql

# 接続テスト
psql $PGURL -c "SELECT version();"
```

---

## ✅ 完了後の確認項目

- [ ] http://100.88.12.26:3000 にアクセス可能
- [ ] http://100.88.12.26:3000?filter=NPB2 でファームデータ表示
- [ ] Discordに通知が届く
- [ ] ログにエラーがない
- [ ] メトリクス監視が動作

**すべて完了したら本格的なNPBファーム収集システムが稼働開始！** 🎉