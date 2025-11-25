#!/bin/bash

# Baseball AI Media サーバーセットアップスクリプト
# Ubuntu Server 24.04 LTS 用

echo "=== Baseball AI Media サーバーセットアップ開始 ==="

# システム更新
echo "システム更新中..."
apt update && apt upgrade -y

# 必要パッケージインストール
echo "必要パッケージをインストール中..."
apt install -y curl wget git sqlite3 nginx htop tree unzip

# Node.js 20.x インストール
echo "Node.js 20.x をインストール中..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Node.js バージョン確認
echo "Node.js バージョン: $(node --version)"
echo "npm バージョン: $(npm --version)"

# PM2 インストール（プロセス管理）
echo "PM2 をインストール中..."
npm install -g pm2

# 作業用ディレクトリ作成
echo "作業用ディレクトリを作成中..."
mkdir -p /opt/baseball-ai-media
cd /opt/baseball-ai-media

# Gitリポジトリクローン準備
echo "Gitリポジトリ設定準備完了"
echo "次のコマンドでリポジトリをクローンしてください："
echo "git clone https://github.com/YOUR_USERNAME/baseball-ai-media.git ."

# ファイアウォール設定
echo "ファイアウォール設定中..."
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw --force enable

# ログディレクトリ作成
mkdir -p /var/log/baseball-ai-media
mkdir -p /opt/backups

echo "=== 基本セットアップ完了 ==="
echo ""
echo "サーバー情報:"
echo "IP: 133.18.111.227"
echo "OS: Ubuntu Server 24.04 LTS"
echo "CPU: 2コア / RAM: 2GB / Storage: 200GB"
echo ""
echo "次の手順:"
echo "1. プロジェクトファイルをアップロード"
echo "2. npm install で依存関係インストール"
echo "3. 本番ビルド実行"
echo "4. PM2でアプリ起動"
echo ""
echo "詳細は SERVER_SETUP_GUIDE.md を参照してください"