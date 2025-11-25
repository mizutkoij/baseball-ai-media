#!/bin/bash
# Yahoo野球スクレイピングシステム サーバーセットアップスクリプト

echo "🚀 Yahoo野球スクレイピングシステム セットアップ開始"

# Python環境確認
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3がインストールされていません"
    exit 1
fi

echo "✅ Python3確認完了: $(python3 --version)"

# 仮想環境作成
if [ ! -d "venv_yahoo" ]; then
    echo "📦 Python仮想環境作成中..."
    python3 -m venv venv_yahoo
fi

# 仮想環境アクティベート
source venv_yahoo/bin/activate

# パッケージインストール
echo "📥 必要パッケージインストール中..."
pip install --upgrade pip
pip install -r requirements_yahoo.txt

# ディレクトリ作成
echo "📁 データディレクトリ作成中..."
mkdir -p data/yahoo_scraping/{schedules,indexes,pitches,logs,database}

# 権限設定
chmod +x run_yahoo_scraper.py
chmod +x yahoo_continuous_scraper.py

# systemdサービスファイル作成
echo "⚙️ systemdサービス作成中..."
cat > /tmp/yahoo-scraper.service << EOF
[Unit]
Description=Yahoo Baseball Scraping Service
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv_yahoo/bin
ExecStart=$(pwd)/venv_yahoo/bin/python $(pwd)/run_yahoo_scraper.py --mode continuous
Restart=always
RestartSec=30
StandardOutput=append:$(pwd)/data/yahoo_scraping/logs/service.log
StandardError=append:$(pwd)/data/yahoo_scraping/logs/service_error.log

[Install]
WantedBy=multi-user.target
EOF

# systemdサービス配置（sudo権限が必要）
echo "🔧 systemdサービス配置中... (sudo権限が必要)"
sudo cp /tmp/yahoo-scraper.service /etc/systemd/system/
sudo systemctl daemon-reload

echo "✅ セットアップ完了!"
echo ""
echo "🎯 使用方法:"
echo "   手動実行:     python run_yahoo_scraper.py --mode continuous"
echo "   サービス開始: sudo systemctl start yahoo-scraper"
echo "   サービス有効: sudo systemctl enable yahoo-scraper"
echo "   ログ確認:     tail -f data/yahoo_scraping/logs/scraper.log"
echo "   統計確認:     python run_yahoo_scraper.py --maintenance"
echo ""
echo "📊 期待性能:"
echo "   処理レート: 1.33試合/時間 (45分/試合)"
echo "   24時間で: 約32試合処理"
echo "   メモリ使用: 50-100MB (軽量設計)"