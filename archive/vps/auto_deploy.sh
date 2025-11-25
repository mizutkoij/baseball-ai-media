#!/bin/bash
# VPS自動デプロイメントスクリプト
# ConoHa VPS 2GB での野球データ収集 + WordPress統合システム

set -e  # エラー時に停止

# 設定変数
DOMAIN="your-domain.com"
MYSQL_ROOT_PASSWORD="secure_root_password"
BASEBALL_DB_PASSWORD="secure_baseball_password"
WP_DB_PASSWORD="secure_wp_password"
WP_ADMIN_USER="admin"
WP_ADMIN_PASSWORD="secure_wp_password"
WP_ADMIN_EMAIL="admin@${DOMAIN}"

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 管理者権限チェック
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "このスクリプトはroot権限で実行してください"
        exit 1
    fi
}

# システム更新
update_system() {
    log_step "システム更新中..."
    apt update && apt upgrade -y
    apt install -y curl wget git unzip software-properties-common
    log_info "システム更新完了"
}

# Nginx インストール・設定
install_nginx() {
    log_step "Nginx インストール中..."
    apt install -y nginx
    
    # 基本設定
    cat > /etc/nginx/sites-available/default << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root /var/www/html;
    index index.php index.html index.htm;

    # WordPress permalinks
    location / {
        try_files \$uri \$uri/ /index.php?\$args;
    }

    # PHP processing
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    # データAPI
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # セキュリティ設定
    location ~ /\.ht {
        deny all;
    }

    # 静的ファイルキャッシュ
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
EOF

    systemctl enable nginx
    systemctl start nginx
    log_info "Nginx インストール完了"
}

# PHP インストール・設定
install_php() {
    log_step "PHP インストール中..."
    apt install -y php8.1 php8.1-fpm php8.1-mysql php8.1-curl php8.1-gd php8.1-xml php8.1-zip php8.1-mbstring

    # PHP設定最適化
    sed -i 's/memory_limit = .*/memory_limit = 256M/' /etc/php/8.1/fpm/php.ini
    sed -i 's/upload_max_filesize = .*/upload_max_filesize = 64M/' /etc/php/8.1/fpm/php.ini
    sed -i 's/post_max_size = .*/post_max_size = 64M/' /etc/php/8.1/fpm/php.ini

    systemctl enable php8.1-fpm
    systemctl start php8.1-fpm
    log_info "PHP インストール完了"
}

# MySQL インストール・設定
install_mysql() {
    log_step "MySQL インストール中..."
    
    # 自動インストール用の設定
    debconf-set-selections <<< "mysql-server mysql-server/root_password password ${MYSQL_ROOT_PASSWORD}"
    debconf-set-selections <<< "mysql-server mysql-server/root_password_again password ${MYSQL_ROOT_PASSWORD}"
    
    apt install -y mysql-server

    # セキュア設定
    mysql -u root -p${MYSQL_ROOT_PASSWORD} << EOF
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';

-- WordPress用データベース
CREATE DATABASE wordpress DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'wp_user'@'localhost' IDENTIFIED BY '${WP_DB_PASSWORD}';
GRANT ALL ON wordpress.* TO 'wp_user'@'localhost';

-- 野球データ用データベース
CREATE DATABASE baseball_data DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'baseball_user'@'localhost' IDENTIFIED BY '${BASEBALL_DB_PASSWORD}';
GRANT ALL ON baseball_data.* TO 'baseball_user'@'localhost';

FLUSH PRIVILEGES;
EOF

    # MySQL設定最適化
    cat >> /etc/mysql/mysql.conf.d/mysqld.cnf << EOF

# パフォーマンス最適化
innodb_buffer_pool_size = 300M
query_cache_size = 50M
max_connections = 100
innodb_log_file_size = 50M
EOF

    systemctl restart mysql
    log_info "MySQL インストール完了"
}

# Python環境セットアップ
install_python() {
    log_step "Python環境セットアップ中..."
    apt install -y python3 python3-pip python3-venv

    # 野球データ収集用ディレクトリ
    mkdir -p /var/www/baseball-ai/{scripts,data,logs,config}
    
    # Python依存関係
    pip3 install requests beautifulsoup4 schedule mysql-connector-python flask

    log_info "Python環境セットアップ完了"
}

# WordPress インストール
install_wordpress() {
    log_step "WordPress インストール中..."
    
    cd /tmp
    wget https://wordpress.org/latest.tar.gz
    tar xzvf latest.tar.gz
    
    # WordPressファイル配置
    cp -R wordpress/* /var/www/html/
    chown -R www-data:www-data /var/www/html/
    chmod -R 755 /var/www/html/

    # wp-config.php 作成
    cat > /var/www/html/wp-config.php << EOF
<?php
define( 'DB_NAME', 'wordpress' );
define( 'DB_USER', 'wp_user' );
define( 'DB_PASSWORD', '${WP_DB_PASSWORD}' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

$(curl -s https://api.wordpress.org/secret-key/1.1/salt/)

\$table_prefix = 'wp_';
define( 'WP_DEBUG', false );

if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
EOF

    chown www-data:www-data /var/www/html/wp-config.php
    log_info "WordPress インストール完了"
}

# SSL証明書設定 (Let's Encrypt)
setup_ssl() {
    log_step "SSL証明書設定中..."
    
    apt install -y certbot python3-certbot-nginx
    
    # 証明書取得（ドメインが有効な場合のみ）
    if ping -c 1 ${DOMAIN} &> /dev/null; then
        certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email ${WP_ADMIN_EMAIL}
        
        # 自動更新設定
        echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
        log_info "SSL証明書設定完了"
    else
        log_warn "ドメイン ${DOMAIN} が解決できません。SSL設定をスキップ"
    fi
}

# ファイアウォール設定
setup_firewall() {
    log_step "ファイアウォール設定中..."
    
    ufw --force enable
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 'Nginx Full'
    
    log_info "ファイアウォール設定完了"
}

# データ収集システム設定
setup_data_collector() {
    log_step "データ収集システム設定中..."
    
    # 設定ファイル作成
    cat > /var/www/baseball-ai/config/wordpress.json << EOF
{
    "mysql": {
        "host": "localhost",
        "user": "baseball_user",
        "password": "${BASEBALL_DB_PASSWORD}",
        "database": "baseball_data"
    },
    "wordpress": {
        "url": "https://${DOMAIN}",
        "username": "${WP_ADMIN_USER}",
        "password": "${WP_ADMIN_PASSWORD}",
        "auto_post": true
    }
}
EOF

    # systemdサービス作成
    cat > /etc/systemd/system/baseball-collector.service << EOF
[Unit]
Description=Baseball Data Collector
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/baseball-ai
ExecStart=/usr/bin/python3 scripts/continuous_collector.py --daemon
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

    # WordPress統合サービス
    cat > /etc/systemd/system/baseball-wordpress.service << EOF
[Unit]
Description=Baseball WordPress Integration
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/baseball-ai
ExecStart=/usr/bin/python3 ../wordpress_integration.py --process-data
Restart=always
RestartSec=300

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable baseball-collector
    systemctl enable baseball-wordpress
    
    log_info "データ収集システム設定完了"
}

# 監視・ログ設定
setup_monitoring() {
    log_step "監視・ログ設定中..."
    
    # ログローテーション設定
    cat > /etc/logrotate.d/baseball-ai << EOF
/var/www/baseball-ai/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 644 www-data www-data
}
EOF

    # 日次レポート用cron
    echo "0 6 * * * www-data cd /var/www/baseball-ai && python3 ../wordpress_integration.py --daily-report" >> /etc/crontab
    
    log_info "監視・ログ設定完了"
}

# WordPressの初期設定
setup_wordpress_initial() {
    log_step "WordPress初期設定中..."
    
    # WP-CLI インストール
    curl -O https://raw.githubusercontent.com/wp-cli/wp-cli/master/cli/installer.php
    php installer.php
    mv wp-cli.phar /usr/local/bin/wp
    chmod +x /usr/local/bin/wp
    
    # WordPress初期設定
    cd /var/www/html
    sudo -u www-data wp core install \
        --url="https://${DOMAIN}" \
        --title="野球データサイト" \
        --admin_user="${WP_ADMIN_USER}" \
        --admin_password="${WP_ADMIN_PASSWORD}" \
        --admin_email="${WP_ADMIN_EMAIL}"
    
    # 必要なプラグインインストール
    sudo -u www-data wp plugin install \
        wp-rest-api \
        application-passwords \
        --activate
    
    log_info "WordPress初期設定完了"
}

# メイン実行
main() {
    log_info "野球データ収集 + WordPress統合システム デプロイ開始"
    
    check_root
    update_system
    install_nginx
    install_php
    install_mysql
    install_python
    install_wordpress
    setup_ssl
    setup_firewall
    setup_data_collector
    setup_monitoring
    setup_wordpress_initial
    
    log_info "デプロイ完了！"
    echo -e "${GREEN}=== デプロイ完了 ===${NC}"
    echo -e "WordPress管理画面: https://${DOMAIN}/wp-admin/"
    echo -e "ユーザー名: ${WP_ADMIN_USER}"
    echo -e "パスワード: ${WP_ADMIN_PASSWORD}"
    echo -e ""
    echo -e "次のステップ:"
    echo -e "1. ドメインのDNS設定を確認"
    echo -e "2. データ収集システムの起動: systemctl start baseball-collector"
    echo -e "3. WordPress統合システムの起動: systemctl start baseball-wordpress"
    echo -e "4. データベーステーブル初期化: cd /var/www/baseball-ai && python3 ../wordpress_integration.py --setup"
}

# スクリプト実行
main "$@"