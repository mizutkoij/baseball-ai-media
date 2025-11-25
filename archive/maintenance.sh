#!/bin/bash

# Baseball AI Media 監視・メンテナンススクリプト

case "$1" in
  status)
    echo "=== システム状態 ==="
    echo "サーバー: $(hostname) ($(date))"
    echo "アップタイム: $(uptime)"
    echo ""
    echo "=== PM2 アプリ状態 ==="
    pm2 status
    echo ""
    echo "=== メモリ使用量 ==="
    free -h
    echo ""
    echo "=== ディスク使用量 ==="
    df -h
    echo ""
    echo "=== CPU使用率 (過去1分) ==="
    top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}'
    ;;
    
  logs)
    echo "=== 最新ログ (最新50行) ==="
    pm2 logs baseball-ai-media --lines 50 --nostream
    ;;
    
  restart)
    echo "アプリケーションを再起動します..."
    pm2 restart baseball-ai-media
    echo "再起動完了"
    ;;
    
  backup)
    echo "データベースバックアップを作成中..."
    DATE=$(date +%Y%m%d_%H%M%S)
    cp /opt/baseball-ai-media/comprehensive_baseball_database.db /opt/backups/db_backup_$DATE.db
    echo "バックアップ完了: /opt/backups/db_backup_$DATE.db"
    
    # 7日以上古いバックアップを削除
    find /opt/backups -name "db_backup_*.db" -mtime +7 -delete
    echo "古いバックアップを削除しました"
    ;;
    
  update)
    echo "アプリケーション更新中..."
    cd /opt/baseball-ai-media
    
    # Git pull (Gitを使用している場合)
    if [ -d ".git" ]; then
        git pull origin main
    else
        echo "Gitリポジトリではありません。手動でファイルを更新してください。"
        exit 1
    fi
    
    # 依存関係更新
    npm install --production
    
    # 再ビルド
    npm run build
    
    # アプリ再起動
    pm2 restart baseball-ai-media
    
    echo "更新完了"
    ;;
    
  performance)
    echo "=== パフォーマンス情報 ==="
    echo "Load Average: $(cat /proc/loadavg)"
    echo ""
    echo "=== Top プロセス ==="
    ps aux --sort=-%cpu | head -10
    echo ""
    echo "=== ネットワーク接続 ==="
    ss -tuln | grep :3000
    ss -tuln | grep :80
    echo ""
    echo "=== アプリケーション応答テスト ==="
    curl -s -o /dev/null -w "HTTP状態: %{http_code}\n応答時間: %{time_total}秒\n" http://localhost:3000/ || echo "アプリケーションに接続できません"
    ;;
    
  *)
    echo "Baseball AI Media 管理コマンド"
    echo ""
    echo "使用方法: $0 {status|logs|restart|backup|update|performance}"
    echo ""
    echo "  status      - システム状態表示"
    echo "  logs        - アプリケーションログ表示"
    echo "  restart     - アプリケーション再起動"
    echo "  backup      - データベースバックアップ作成"
    echo "  update      - アプリケーション更新"
    echo "  performance - パフォーマンス情報表示"
    echo ""
    exit 1
    ;;
esac