# Baseball AI Media サーバー構築ガイド

## 1. SSH認証キー作成

### Windows (PowerShell)
```powershell
# SSH鍵ペア生成
ssh-keygen -t rsa -b 4096 -C "baseball-ai-media@example.com"

# 公開鍵の内容をクリップボードにコピー
Get-Content ~/.ssh/id_rsa.pub | Set-Clipboard

# または表示して手動コピー
cat ~/.ssh/id_rsa.pub
```

### 生成された公開鍵をVPS作成時に登録
- VPS管理画面で「ログイン用認証キー」に公開鍵の内容を貼り付け

## 2. 推奨サーバー構成

### 開発・テスト環境
- **OS**: Ubuntu Server 24.04 LTS
- **スペック**: 2コア / 2GB
- **ストレージ**: 200GB NVMe
- **月額**: 770円

### 本格運用環境（推奨）
- **OS**: Ubuntu Server 24.04 LTS  
- **スペック**: 4コア / 4GB
- **ストレージ**: 400GB NVMe
- **月額**: 1,760円

## 3. サーバー初期設定

### 接続確認
```bash
# VPS IPアドレスに接続
ssh root@YOUR_VPS_IP
```

### システム更新
```bash
apt update && apt upgrade -y
```

### 必要パッケージインストール
```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Git, SQLite, その他ツール
apt install -y git sqlite3 nginx certbot python3-certbot-nginx htop tree
```

### PM2インストール（プロセス管理）
```bash
npm install -g pm2
```

## 4. プロジェクト配置

### リポジトリクローン
```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/baseball-ai-media.git
cd baseball-ai-media
```

### 依存関係インストール
```bash
npm install
```

### 環境設定
```bash
# 本番環境用環境変数
cp .env.example .env.production

# データベースパス設定
echo "DB_PATH=/opt/baseball-ai-media/data/db_production.db" >> .env.production
echo "COMPREHENSIVE_DB_PATH=/opt/baseball-ai-media/comprehensive_baseball_database.db" >> .env.production
```

### 本番ビルド
```bash
npm run build
```

## 5. プロセス管理設定

### PM2設定ファイル作成
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'baseball-ai-media',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/opt/baseball-ai-media',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 2,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
```

### PM2でアプリ起動
```bash
# ログディレクトリ作成
mkdir logs

# アプリ起動
pm2 start ecosystem.config.js

# 自動起動設定
pm2 startup
pm2 save
```

## 6. Nginx リバースプロキシ設定

### Nginx設定
```nginx
# /etc/nginx/sites-available/baseball-ai-media
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL証明書設定
```bash
# サイト有効化
ln -s /etc/nginx/sites-available/baseball-ai-media /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Let's Encrypt SSL
certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 7. データ収集スケジュール

### Cron設定
```bash
# crontab編集
crontab -e

# NPBデータ収集（毎日1回）
0 6 * * * cd /opt/baseball-ai-media && npm run scrape:current >> /var/log/baseball-scrape.log 2>&1

# 統計更新（毎時）
0 * * * * cd /opt/baseball-ai-media && npm run update:stats >> /var/log/baseball-stats.log 2>&1
```

## 8. 監視・メンテナンス

### システム監視
```bash
# PM2ステータス確認
pm2 status

# アプリログ確認
pm2 logs

# システムリソース確認
htop
df -h
```

### バックアップスクリプト
```bash
#!/bin/bash
# /opt/backup-script.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
mkdir -p $BACKUP_DIR

# データベースバックアップ
cp /opt/baseball-ai-media/comprehensive_baseball_database.db $BACKUP_DIR/db_$DATE.db

# 古いバックアップ削除（30日以上）
find $BACKUP_DIR -name "db_*.db" -mtime +30 -delete
```

## 9. セキュリティ設定

### ファイアウォール
```bash
# UFW設定
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw --force enable
```

### SSH設定強化
```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 22
```

## 10. 推奨運用手順

1. **開発環境**: 2コア/2GB でアプリケーションテスト
2. **負荷テスト**: 想定ユーザー数での動作確認
3. **本格運用**: 必要に応じて 4コア/4GB にスケールアップ
4. **高負荷対応**: 6コア/8GB + CDN導入を検討

## 費用概算

- **開発期間**: 770円/月 × 2ヶ月 = 1,540円
- **運用開始**: 1,760円/月 × 12ヶ月 = 21,120円
- **年間総費用**: 約23,000円（ドメイン費用別途）

この構成で、月間数万PVまで対応可能な安定したサービス運用が実現できます。