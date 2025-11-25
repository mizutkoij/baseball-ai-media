# VPS統合システム アーキテクチャ設計

## システム概要

ConoHa VPS 2GBでの統合システム：
- **野球データ継続収集**（75分間隔、30MB）
- **WordPress野球情報サイト**（800MB）
- **データ可視化機能**（収集データ → Web表示）

## アーキテクチャ構成

### サーバー構成
```
ConoHa VPS 2GB
├── OS: Ubuntu 22.04 LTS
├── Web Server: Nginx
├── Database: MySQL 8.0
├── PHP: 8.1 (WordPress用)
├── Python: 3.10 (データ収集用)
└── SSL: Let's Encrypt (自動更新)
```

### ディレクトリ構造
```
/var/www/
├── html/                          # WordPress サイト
│   ├── wp-content/
│   │   ├── themes/baseball-theme/  # カスタムテーマ
│   │   └── plugins/baseball-data/  # データ統合プラグイン
│   └── wp-config.php
├── baseball-ai/                   # データ収集システム
│   ├── scripts/
│   │   ├── continuous_collector.py
│   │   ├── data_to_wordpress.py    # WordPress連携
│   │   └── api_server.py           # データAPI
│   ├── data/
│   │   └── continuous_collection/
│   └── logs/
└── api/                           # データAPI（JSON出力）
    ├── games/
    ├── players/
    └── stats/
```

### ポート・サービス構成
```
Port 80:   HTTP → HTTPS リダイレクト
Port 443:  HTTPS (WordPress + API)
Port 3306: MySQL (ローカルのみ)

Services:
├── nginx.service          # Web server
├── mysql.service          # Database
├── php8.1-fpm.service     # PHP processor
├── baseball-collector.service  # データ収集
└── baseball-api.service   # データAPI
```

## データフロー

### 収集 → 蓄積 → 表示
```
1. データ収集 (75分間隔)
   BaseballData.jp → CSV → SQLite

2. データ変換・統合
   SQLite → MySQL (WordPress DB)

3. Web表示
   WordPress → データクエリ → 可視化
```

### リアルタイム更新
```
continuous_collector.py
    ↓ (新データ検出)
data_to_wordpress.py
    ↓ (MySQL更新)
WordPress キャッシュクリア
    ↓
サイト自動更新
```

## メモリ・リソース配分

### メモリ配分 (2GB)
```
OS + System:        400MB
MySQL:              300MB
PHP-FPM:            400MB
Nginx:              100MB
データ収集:         30MB
キャッシュ:         300MB
余裕:               500MB
```

### CPU使用率目標
```
通常時:    < 20%
収集時:    < 30%
高負荷時:  < 70%
```

### ディスク使用量
```
OS:                20GB
WordPress:         5GB
データ収集:        10GB
ログ・バックアップ: 10GB
余裕:              5GB
```

## セキュリティ設計

### ファイアウォール設定
```bash
ufw allow 22      # SSH
ufw allow 80      # HTTP
ufw allow 443     # HTTPS
ufw deny 3306     # MySQL (外部アクセス禁止)
```

### アクセス制御
```
WordPress Admin: /wp-admin/ (IP制限可能)
データAPI: /api/ (レート制限)
SSH: 公開鍵認証のみ
```

### バックアップ戦略
```
MySQL: 日次自動バックアップ
データ収集: 週次バックアップ
WordPress: 日次バックアップ
```

## パフォーマンス最適化

### WordPress最適化
```php
// wp-config.php 最適化設定
define('WP_CACHE', true);
define('COMPRESS_CSS', true);
define('COMPRESS_SCRIPTS', true);
define('WP_MEMORY_LIMIT', '256M');
```

### MySQL最適化
```sql
-- my.cnf 設定
innodb_buffer_pool_size = 200M
query_cache_size = 50M
max_connections = 100
```

### Nginx最適化
```nginx
# gzip圧縮
gzip on;
gzip_vary on;
gzip_min_length 1024;

# キャッシュ設定
expires 1y;
add_header Cache-Control "public, immutable";
```

## 監視・ログ設計

### システム監視
```bash
# リソース監視
htop, iotop, nethogs

# ログ監視
/var/log/nginx/access.log
/var/log/mysql/error.log
/var/www/baseball-ai/logs/collector.log
```

### アラート設定
```python
# メモリ使用率 > 80%
# ディスク使用率 > 90%
# データ収集エラー連続3回
# WordPress応答時間 > 5秒
```

## 災害復旧計画

### バックアップからの復旧
```bash
1. VPS再構築
2. 自動セットアップスクリプト実行
3. バックアップデータ復元
4. DNS設定確認
5. SSL証明書再取得
```

### 緊急時対応
```
サービス停止: systemctl restart
データベース復旧: mysql dump restore
WordPress復旧: ファイル・DB復元
データ収集復旧: SQLite復元
```

## スケーラビリティ

### 垂直スケーリング
```
2GB → 4GB: 高トラフィック対応
4GB → 8GB: 商用レベル対応
```

### 水平スケーリング
```
DB専用サーバー分離
CDN導入 (CloudFlare)
ロードバランサー導入
```

## 開発・デプロイフロー

### 開発環境
```
Local: Docker compose
Staging: 同VPS内別ディレクトリ
Production: メインディレクトリ
```

### デプロイ手順
```bash
1. git push
2. ./deploy.sh
3. バックアップ作成
4. コード更新
5. サービス再起動
6. 動作確認
```

## コスト効率

### 月額運用コスト
```
ConoHa VPS 2GB:    968円
ドメイン (.com):   約100円/月
SSL証明書:         0円 (Let's Encrypt)
----------------------
合計:              約1,070円/月
```

### 年間コスト
```
VPS:              11,616円
ドメイン:         1,200円
----------------------
合計:             12,816円/年
```

## 次のステップ

1. ✅ アーキテクチャ設計完了
2. 🔄 統合システム実装
3. 📋 自動セットアップスクリプト
4. 🎨 WordPress統合機能
5. 📊 データ可視化機能

---

**設計目標**: 月額1,000円で高品質な野球情報サイト + 自動データ収集システムの実現