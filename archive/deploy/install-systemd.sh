#!/bin/bash
# Baseball AI Media - systemd 設定インストールスクリプト

set -e

echo "🔧 Installing Baseball AI Media systemd services..."

# ユーザー・グループ作成
sudo useradd -r -s /bin/false baseball || echo "User baseball already exists"

# アプリケーションディレクトリの所有権設定
sudo chown -R baseball:baseball /opt/baseball-ai-media
sudo chmod -R 755 /opt/baseball-ai-media

# systemd unit files をコピー
sudo cp deploy/baseball-nextjs.service /etc/systemd/system/
sudo cp deploy/baseball-live-api.service /etc/systemd/system/

# systemd reload
sudo systemctl daemon-reload

# サービス有効化
sudo systemctl enable baseball-nextjs.service
sudo systemctl enable baseball-live-api.service

# ulimit 設定（/etc/security/limits.conf）
echo "baseball soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "baseball hard nofile 65536" | sudo tee -a /etc/security/limits.conf

echo "✅ systemd services installed successfully"
echo ""
echo "🚀 To start services:"
echo "  sudo systemctl start baseball-nextjs"
echo "  sudo systemctl start baseball-live-api"
echo ""
echo "📊 To check status:"
echo "  sudo systemctl status baseball-nextjs"
echo "  sudo systemctl status baseball-live-api"
echo ""
echo "📝 To view logs:"
echo "  sudo journalctl -u baseball-nextjs -f"
echo "  sudo journalctl -u baseball-live-api -f"