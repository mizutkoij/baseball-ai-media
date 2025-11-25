#!/bin/bash
# 100.88.12.26 クイックデプロイスクリプト
set -e

echo "🚀 NPBファーム収集システム クイックデプロイ"
echo "========================================"

# 基本ディレクトリ作成
echo "📁 ディレクトリ作成中..."
mkdir -p data/{timeline/{yahoo_npb1,yahoo_npb2},cache} logs state

# 環境変数設定
echo "⚙️ 環境変数設定中..."
export YAHOO_LEVELS=npb2
export BACKFILL_SLEEP_MS=30000
export YAHOO_STOP=""
export CONTACT_EMAIL=${CONTACT_EMAIL:-"admin@example.com"}
export DATA_DIR=$(pwd)/data
export WEBHOOK_DISCORD_URL=${WEBHOOK_DISCORD_URL:-""}
export SYSTEM_START_TIME=$(date +%s)

echo "環境変数設定完了:"
echo "  YAHOO_LEVELS=$YAHOO_LEVELS"
echo "  BACKFILL_SLEEP_MS=$BACKFILL_SLEEP_MS"
echo "  CONTACT_EMAIL=$CONTACT_EMAIL"
echo "  DATA_DIR=$DATA_DIR"

# 依存関係チェック
echo "🔍 依存関係チェック中..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js が見つかりません。インストールしてください。"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm が見つかりません。インストールしてください。"
    exit 1
fi

echo "✅ Node.js $(node --version)"
echo "✅ npm $(npm --version)"

# npm依存関係インストール
if [ ! -d "node_modules" ]; then
    echo "📦 npm パッケージインストール中..."
    npm install
else
    echo "✅ node_modules 存在確認済み"
fi

# データベース接続テスト（オプション）
if [ ! -z "$PGURL" ]; then
    echo "🔍 データベース接続テスト中..."
    if command -v psql &> /dev/null; then
        if psql "$PGURL" -c "SELECT version();" &> /dev/null; then
            echo "✅ データベース接続成功"
        else
            echo "⚠️ データベース接続失敗（後で手動設定が必要）"
        fi
    else
        echo "⚠️ psql コマンドなし（PostgreSQLクライアント未インストール）"
    fi
else
    echo "⚠️ PGURL未設定（データベース同期はスキップされます）"
fi

# Discord通知テスト
if [ ! -z "$WEBHOOK_DISCORD_URL" ]; then
    echo "📱 Discord通知テスト中..."
    if npx tsx scripts/notify-discord.ts --test &> /dev/null; then
        echo "✅ Discord通知成功"
    else
        echo "⚠️ Discord通知失敗（Webhook URL要確認）"
    fi
else
    echo "⚠️ Discord通知未設定"
fi

# 最終チェック実行
echo "🔍 最終システムチェック中..."
npx tsx scripts/final-launch-check.ts > launch-check.log 2>&1
if grep -q "GO FOR LAUNCH" launch-check.log; then
    echo "✅ システムチェック合格"
else
    echo "⚠️ システムチェック警告あり（launch-check.log確認）"
fi

# 起動オプション表示
echo ""
echo "🚀 システム起動準備完了！"
echo "========================================"
echo "手動起動コマンド:"
echo ""
echo "# 1) 収集システム起動（常駐）"
echo "nohup npm run yahoo:live:today > logs/yahoo-live.log 2>&1 &"
echo "nohup npm run db:sync > logs/db-sync.log 2>&1 &"
echo ""
echo "# 2) ダッシュボード起動"  
echo "nohup npm run dev > logs/nextjs.log 2>&1 &"
echo ""
echo "# 3) 監視確認"
echo "npx tsx scripts/check-metrics.ts"
echo ""
echo "# 4) プロセス確認"
echo "ps aux | grep -E '(yahoo|db:sync|next)'"
echo ""
echo "# 5) ログ確認"
echo "tail -f logs/yahoo-live.log"
echo "tail -f logs/nextjs.log"
echo ""

# 自動起動オプション
read -p "🤖 自動起動しますか？ (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 システム自動起動中..."
    
    # Discord開始通知
    if [ ! -z "$WEBHOOK_DISCORD_URL" ]; then
        npx tsx scripts/notify-discord.ts --start &
    fi
    
    # 収集システム起動
    echo "📊 収集システム起動中..."
    nohup npm run yahoo:live:today > logs/yahoo-live.log 2>&1 &
    YAHOO_PID=$!
    
    # DB同期起動（PGURL設定時のみ）
    if [ ! -z "$PGURL" ]; then
        echo "🗄️ DB同期システム起動中..."
        nohup npm run db:sync > logs/db-sync.log 2>&1 &
        DB_PID=$!
    fi
    
    # Next.jsダッシュボード起動
    echo "🖥️ ダッシュボード起動中..."
    nohup npm run dev > logs/nextjs.log 2>&1 &
    NEXTJS_PID=$!
    
    # 起動待機
    sleep 5
    
    # プロセス確認
    echo "✅ 起動完了！プロセス一覧:"
    ps aux | grep -E "(yahoo|db:sync|next)" | grep -v grep || echo "⚠️ プロセスが見つかりません"
    
    echo ""
    echo "🌐 アクセスURL:"
    echo "  http://$(hostname -I | awk '{print $1}'):3000"
    echo "  http://localhost:3000"
    echo ""
    echo "📊 監視コマンド:"
    echo "  watch -n 30 npx tsx scripts/check-metrics.ts"
    echo ""
    echo "🛑 停止コマンド:"
    echo "  export YAHOO_STOP=true"
    echo "  pkill -f 'yahoo|db:sync|next'"
    
else
    echo "📝 手動起動してください（上記コマンド参照）"
fi

echo ""
echo "🎉 デプロイ完了！"
echo "ログファイル: logs/*.log で動作確認してください"