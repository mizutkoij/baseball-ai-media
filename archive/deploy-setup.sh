#!/bin/bash

# Baseball AI Media デプロイスクリプト
# サーバー上で実行

echo "=== Baseball AI Media デプロイ開始 ==="

cd /opt/baseball-ai-media

# 依存関係インストール
echo "依存関係をインストール中..."
npm install --production

# 本番用環境変数設定
echo "環境変数を設定中..."
cat > .env.production << EOL
# Baseball AI Media 本番環境設定
NODE_ENV=production
PORT=3000

# データベース設定
DB_PATH=/opt/baseball-ai-media/data/db_production.db
COMPREHENSIVE_DB_PATH=/opt/baseball-ai-media/comprehensive_baseball_database.db

# 本番URL（後で設定）
NEXT_PUBLIC_API_BASE_URL=http://133.18.111.227:3000/api

# アナリティクス（後で設定）
# NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
# NEXT_PUBLIC_PLAUSIBLE_DOMAIN=your-domain.com
EOL

# データディレクトリ作成
echo "データディレクトリを作成中..."
mkdir -p data
mkdir -p logs

# 既存のデータベースがあればコピー
if [ -f "comprehensive_baseball_database.db" ]; then
    echo "既存のデータベースを検出しました"
else
    echo "新しいデータベースを初期化します"
    touch comprehensive_baseball_database.db
fi

# 本番ビルド
echo "本番ビルド実行中..."
npm run build

# PM2設定ファイル作成
echo "PM2設定ファイルを作成中..."
cat > ecosystem.config.js << EOL
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
    instances: 1, // 2GBメモリなので1インスタンス
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1500M',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    restart_delay: 4000,
    max_restarts: 5,
    min_uptime: '30s'
  }]
}
EOL

# アプリ起動
echo "アプリケーションを起動中..."
pm2 start ecosystem.config.js

# 自動起動設定
pm2 startup
pm2 save

# Nginx設定
echo "Nginx設定中..."
cat > /etc/nginx/sites-available/baseball-ai-media << EOL
server {
    listen 80;
    server_name 133.18.111.227;

    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # タイムアウト設定
        proxy_connect_timeout       60s;
        proxy_send_timeout          60s;
        proxy_read_timeout          60s;
    }
    
    # 静的ファイルの直接配信
    location /_next/static/ {
        alias /opt/baseball-ai-media/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOL

# Nginx有効化
ln -sf /etc/nginx/sites-available/baseball-ai-media /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ステータス確認
echo ""
echo "=== デプロイ完了 ==="
echo "アプリケーションステータス:"
pm2 status

echo ""
echo "Nginxステータス:"
systemctl status nginx --no-pager -l

echo ""
echo "アクセス確認:"
echo "http://133.18.111.227"
echo ""
echo "ログ確認コマンド:"
echo "pm2 logs"
echo "tail -f /var/log/nginx/access.log"
echo ""
echo "管理コマンド:"
echo "pm2 restart baseball-ai-media  # アプリ再起動"
echo "pm2 stop baseball-ai-media     # アプリ停止"
echo "pm2 start baseball-ai-media    # アプリ開始"