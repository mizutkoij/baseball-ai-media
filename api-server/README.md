# Baseball AI Media - API Server

選手詳細データを提供するスタンドアローンAPIサーバー

## デプロイ手順（133.18.111.227サーバー）

### 1. サーバーにファイルをアップロード

```bash
# ローカルから実行
scp -r ../output root@133.18.111.227:/opt/baseball-ai-media/
scp -r . root@133.18.111.227:/opt/baseball-ai-media/api-server/
```

### 2. サーバーにSSHでログイン

```bash
ssh root@133.18.111.227
```

### 3. Node.jsのインストール（未インストールの場合）

```bash
# Node.js 18.x をインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# バージョン確認
node --version
npm --version
```

### 4. 依存関係のインストール

```bash
cd /opt/baseball-ai-media/api-server
npm install
```

### 5. 動作確認

```bash
# テスト起動
PORT=3001 OUTPUT_DIR=/opt/baseball-ai-media/output npm start
```

別のターミナルで:
```bash
curl http://localhost:3001/health
```

### 6. systemdサービスとして設定

```bash
# サービスファイルを作成
cat > /etc/systemd/system/baseball-api.service << 'EOF'
[Unit]
Description=Baseball AI Media API Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/baseball-ai-media/api-server
Environment="PORT=3001"
Environment="OUTPUT_DIR=/opt/baseball-ai-media/output"
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# サービスを有効化して起動
systemctl daemon-reload
systemctl enable baseball-api
systemctl start baseball-api

# ステータス確認
systemctl status baseball-api
```

### 7. ファイアウォール設定

```bash
# ポート3001を開放
ufw allow 3001/tcp
ufw reload
```

### 8. 動作確認

```bash
# サーバーから
curl http://localhost:3001/health

# 外部から
curl http://133.18.111.227:3001/health
```

## API エンドポイント

### ヘルスチェック
```
GET http://133.18.111.227:3001/health
```

### 選手詳細データ取得
```
GET http://133.18.111.227:3001/api/players/{id}/detailed-stats?year=2025&team=DeNA&name=戸柱恭孝
```

### チーム一覧
```
GET http://133.18.111.227:3001/api/teams?year=2025
```

### チーム内の選手一覧
```
GET http://133.18.111.227:3001/api/teams/DeNA/players?year=2025
```

## メンテナンス

### ログ確認
```bash
journalctl -u baseball-api -f
```

### サービス再起動
```bash
systemctl restart baseball-api
```

### データ更新
```bash
# 新しいデータをアップロード
scp -r ../output root@133.18.111.227:/opt/baseball-ai-media/

# サービスは自動的に新しいファイルを読み込みます（再起動不要）
```

## トラブルシューティング

### サービスが起動しない
```bash
# ログを確認
journalctl -u baseball-api -n 50

# Node.jsバージョン確認
node --version  # 18以上が必要

# ディレクトリ確認
ls -la /opt/baseball-ai-media/output/2025/
```

### ファイルが見つからない
```bash
# outputディレクトリの確認
ls -la /opt/baseball-ai-media/output/2025/DeNA/
```

### ポートが使われている
```bash
# ポート使用状況確認
netstat -tlnp | grep 3001

# 別のポートを使用する場合
systemctl stop baseball-api
# /etc/systemd/system/baseball-api.service でPORTを変更
systemctl daemon-reload
systemctl start baseball-api
```
