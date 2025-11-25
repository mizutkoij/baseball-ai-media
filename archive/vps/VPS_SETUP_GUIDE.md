# VPS環境構築ガイド
野球データ収集 + WordPress統合システム

## 概要

このガイドでは、ConoHa VPS 2GBで野球データ収集システムとWordPressサイトを統合したシステムを構築する手順を説明します。

## 🎯 システム目標

- **月額1,070円**での高品質野球情報サイト運営
- **24時間365日**の自動データ収集
- **WordPress**での情報発信とデータ可視化
- **完全自動化**されたシステム運用

## 📋 事前準備

### 必要なもの
- ConoHa VPS 2GB (月額968円)
- ドメイン (.com 約100円/月)
- SSH接続可能な環境

### 推奨スペック
```
CPU: 3コア
メモリ: 2GB
ディスク: 50GB SSD
OS: Ubuntu 22.04 LTS
```

## 🚀 Step 1: VPS初期設定

### 1.1 VPSの作成
1. ConoHaコントロールパネルにログイン
2. VPS → サーバー追加
3. 以下を選択：
   - **メモリ**: 2GB
   - **OS**: Ubuntu 22.04 LTS
   - **SSH Key**: 設定（推奨）

### 1.2 初期セットアップ
```bash
# root権限で実行
apt update && apt upgrade -y

# 必要なパッケージインストール
apt install -y curl wget git unzip ufw

# ファイアウォール設定
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# タイムゾーン設定
timedatectl set-timezone Asia/Tokyo
```

### 1.3 一般ユーザー作成
```bash
# 新しいユーザー作成
adduser mizuto
usermod -aG sudo mizuto

# SSH鍵の設定（公開鍵認証）
mkdir -p /home/mizuto/.ssh
cp ~/.ssh/authorized_keys /home/mizuto/.ssh/
chown -R mizuto:mizuto /home/mizuto/.ssh
chmod 700 /home/mizuto/.ssh
chmod 600 /home/mizuto/.ssh/authorized_keys
```

## 🔧 Step 2: 自動デプロイの実行

### 2.1 デプロイスクリプトの取得
```bash
# ユーザーに切り替え
su - mizuto

# 作業ディレクトリ作成
mkdir -p ~/baseball-vps
cd ~/baseball-vps

# デプロイスクリプトをダウンロード
wget https://your-repo.com/vps/auto_deploy.sh
chmod +x auto_deploy.sh
```

### 2.2 設定変更
```bash
# デプロイスクリプトを編集
nano auto_deploy.sh

# 以下の設定を変更:
DOMAIN="your-baseball-site.com"          # 実際のドメイン
MYSQL_ROOT_PASSWORD="secure_root_pass"   # 強力なパスワード
WP_ADMIN_PASSWORD="secure_wp_pass"       # WordPressパスワード
WP_ADMIN_EMAIL="admin@your-domain.com"   # 管理者メール
```

### 2.3 自動デプロイ実行
```bash
# root権限で実行
sudo ./auto_deploy.sh
```

実行時間: **約15-30分**

## 🎨 Step 3: WordPress初期設定

### 3.1 WordPress管理画面へのアクセス
```
URL: https://your-domain.com/wp-admin/
ユーザー名: admin
パスワード: 設定したパスワード
```

### 3.2 基本設定
1. **設定 → 一般**
   - サイトタイトル: "野球データサイト"
   - キャッチフレーズ: "AIによる野球データ分析"

2. **設定 → パーマリンク**
   - 投稿名を選択

3. **外観 → テーマ**
   - 野球テーマのインストール（別途開発）

### 3.3 必要なプラグインインストール
```bash
# WP-CLIで一括インストール
sudo -u www-data wp plugin install --activate \
  wp-rest-api \
  application-passwords \
  wp-crontrol \
  --path=/var/www/html
```

## 📊 Step 4: データ収集システムの設定

### 4.1 Python環境の確認
```bash
# Python環境を確認
python3 --version
pip3 list | grep -E "(requests|beautifulsoup4|mysql-connector)"
```

### 4.2 データベーステーブル初期化
```bash
cd /var/www/baseball-ai
python3 ../wordpress_integration.py --setup
```

### 4.3 継続収集システムの開始
```bash
# 収集タスクを初期化
python3 scripts/continuous_collector.py --init

# システムサービス開始
sudo systemctl start baseball-collector
sudo systemctl enable baseball-collector

# WordPress統合サービス開始
sudo systemctl start baseball-wordpress
sudo systemctl enable baseball-wordpress
```

## 🌐 Step 5: ドメイン・DNS設定

### 5.1 ドメインのDNS設定
```
A レコード:
- @ → VPSのIPアドレス
- www → VPSのIPアドレス

（お名前.com、ムームードメインなどで設定）
```

### 5.2 SSL証明書の再取得（ドメイン設定後）
```bash
# Let's Encrypt証明書取得
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自動更新設定確認
sudo systemctl status certbot.timer
```

## 📈 Step 6: 動作確認

### 6.1 Webサイトの確認
```bash
# サイトへのアクセス確認
curl -I https://your-domain.com

# WordPress管理画面確認
curl -I https://your-domain.com/wp-admin/
```

### 6.2 データ収集の確認
```bash
# 収集状況確認
cd /var/www/baseball-ai
python3 scripts/collector_status.py --stats

# ログ確認
tail -f logs/continuous_collector.log
```

### 6.3 API動作確認
```bash
# データAPIの確認
curl https://your-domain.com/api/baseball/teams
curl https://your-domain.com/api/baseball/rosters
curl https://your-domain.com/api/baseball/metrics
```

## 🔧 Step 7: 追加設定・最適化

### 7.1 バックアップ設定
```bash
# 日次バックアップスクリプト
sudo crontab -e

# 以下を追加:
0 2 * * * /usr/local/bin/backup_mysql.sh
0 3 * * * /usr/local/bin/backup_wordpress.sh
```

### 7.2 監視設定
```bash
# ディスク使用量監視
df -h

# メモリ使用量監視
free -h

# プロセス監視
sudo systemctl status nginx mysql php8.1-fpm baseball-collector
```

### 7.3 パフォーマンス最適化
```bash
# Nginxキャッシュ設定
sudo nano /etc/nginx/sites-available/default

# MySQLチューニング
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf

# PHP設定最適化
sudo nano /etc/php/8.1/fpm/php.ini
```

## 🎯 Step 8: データ可視化機能の有効化

### 8.1 ダッシュボードページの作成
WordPressで以下のページを作成：

```
URL: /data/
タイトル: データダッシュボード
内容: データ可視化コンポーネントを埋め込み
```

### 8.2 メニューへの追加
WordPress管理画面 → 外観 → メニューで「データ」ページを追加

## 📊 運用開始後の確認項目

### 毎日の確認事項
```bash
# システム状態確認
sudo systemctl status baseball-collector baseball-wordpress

# データ収集確認
python3 /var/www/baseball-ai/scripts/collector_status.py --stats

# ディスク容量確認
df -h /var/www/

# メモリ使用量確認
free -h
```

### 週次の確認事項
- バックアップの動作確認
- SSL証明書の期限確認
- ログファイルのローテーション確認
- セキュリティアップデートの適用

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. データ収集が停止している
```bash
# サービス再起動
sudo systemctl restart baseball-collector

# ログ確認
tail -f /var/www/baseball-ai/logs/continuous_collector.log
```

#### 2. WordPressが表示されない
```bash
# Nginx設定確認
sudo nginx -t

# PHP-FPM確認
sudo systemctl status php8.1-fpm

# 権限確認
sudo chown -R www-data:www-data /var/www/html/
```

#### 3. SSL証明書エラー
```bash
# 証明書更新
sudo certbot renew --dry-run

# Nginx設定再読み込み
sudo systemctl reload nginx
```

#### 4. メモリ不足
```bash
# メモリ使用量確認
free -h

# 不要なプロセス終了
sudo systemctl stop 不要なサービス

# スワップファイル作成（緊急時）
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 📈 パフォーマンス監視

### 監視すべき指標
- **CPU使用率**: < 70%
- **メモリ使用率**: < 80%
- **ディスク使用率**: < 90%
- **応答時間**: < 3秒
- **データ収集成功率**: > 95%

### 監視コマンド
```bash
# リアルタイム監視
htop

# ネットワーク監視
sudo nethogs

# ディスクI/O監視
sudo iotop
```

## 🔄 更新・メンテナンス

### システム更新
```bash
# 月次システム更新
sudo apt update && sudo apt upgrade -y

# WordPressコア更新
sudo -u www-data wp core update --path=/var/www/html

# プラグイン更新
sudo -u www-data wp plugin update --all --path=/var/www/html
```

### データベースメンテナンス
```bash
# データベース最適化
sudo mysql -u root -p baseball_data -e "OPTIMIZE TABLE baseball_rosters, baseball_players, baseball_games;"

# 古いログの削除
sudo find /var/www/baseball-ai/logs/ -name "*.log" -mtime +30 -delete
```

## 🎉 完了チェックリスト

- [ ] VPS基本設定完了
- [ ] 自動デプロイ実行完了
- [ ] WordPress管理画面アクセス確認
- [ ] データ収集システム動作確認
- [ ] ドメイン・SSL設定完了
- [ ] データAPI動作確認
- [ ] バックアップ設定完了
- [ ] 監視設定完了
- [ ] データ可視化ページ作成完了

## 📞 サポート・参考資料

### 設定ファイルの場所
```
Nginx: /etc/nginx/sites-available/default
MySQL: /etc/mysql/mysql.conf.d/mysqld.cnf
PHP: /etc/php/8.1/fpm/php.ini
WordPress: /var/www/html/wp-config.php
データ収集: /var/www/baseball-ai/config/wordpress.json
```

### ログファイルの場所
```
Nginx: /var/log/nginx/
MySQL: /var/log/mysql/
データ収集: /var/www/baseball-ai/logs/
WordPress: /var/www/html/wp-content/debug.log
```

### 緊急時連絡先
- ConoHa VPSサポート: [サポートページ]
- ドメイン管理会社サポート
- システム管理者: [連絡先]

---

**🎯 このガイドに従って設定することで、月額1,070円で高品質な野球データサイトの運営が可能になります。**

**⏱️ 設定時間**: 約2-3時間  
**💰 月額コスト**: 約1,070円  
**📊 データ収集**: 24時間365日自動実行  
**🌐 Webサイト**: WordPress + データ可視化機能