#!/bin/bash

# NPB自動スクレイピング Cronスクリプト
# Usage: ./run-cron-scraper.sh [morning|afternoon|evening|night]

set -e

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/data/logs"
LOCKFILE="$PROJECT_DIR/data/scraper.lock"

# ログディレクトリ作成
mkdir -p "$LOG_DIR"

# タスク名の決定
TASK_NAME=${1:-"auto"}
CURRENT_HOUR=$(date +%H)

if [ "$TASK_NAME" = "auto" ]; then
    if [ "$CURRENT_HOUR" -ge 6 ] && [ "$CURRENT_HOUR" -lt 12 ]; then
        TASK_NAME="morning"
    elif [ "$CURRENT_HOUR" -ge 12 ] && [ "$CURRENT_HOUR" -lt 18 ]; then
        TASK_NAME="afternoon"
    elif [ "$CURRENT_HOUR" -ge 18 ] && [ "$CURRENT_HOUR" -lt 23 ]; then
        TASK_NAME="evening"
    else
        TASK_NAME="night"
    fi
fi

# ログファイル設定
LOG_FILE="$LOG_DIR/scraper-$(date +%Y-%m-%d).log"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting scraper task: $TASK_NAME" >> "$LOG_FILE"

# Flockによる強いプロセス排他制御
FLOCK_FILE="/tmp/npb-scrape.lock"

# 既存のロックファイルチェック（後方互換性）
if [ -f "$LOCKFILE" ]; then
    # ロックファイルが1時間以上古い場合は削除
    if test "$(find "$LOCKFILE" -mmin +60 2>/dev/null)"; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Removing stale lock file" >> "$LOG_FILE"
        rm -f "$LOCKFILE"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Legacy lock file exists, checking with flock" >> "$LOG_FILE"
    fi
fi

# flock で排他制御（即座に失敗させる -n オプション）
if ! flock -n 200; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Another scraper instance is running (flock), exiting" >> "$LOG_FILE"
    exit 0
fi 200>"$FLOCK_FILE"

# 従来のロックファイル作成（モニタリング用）
echo "$$" > "$LOCKFILE"

# プロジェクトディレクトリに移動
cd "$PROJECT_DIR"

# タスク実行
case "$TASK_NAME" in
    smart)
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Running smart scheduler (Phase 5)" >> "$LOG_FILE"
        npx tsx scripts/smart-scheduler.ts >> "$LOG_FILE" 2>&1
        ;;
    morning)
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Running morning update (schedule + starters)" >> "$LOG_FILE"
        npm run scrape:morning-update >> "$LOG_FILE" 2>&1
        ;;
    afternoon)
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Running afternoon starters update" >> "$LOG_FILE"
        npm run scrape:afternoon-starters >> "$LOG_FILE" 2>&1
        ;;
    evening)
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Running evening results check" >> "$LOG_FILE"
        npm run scrape:evening-results >> "$LOG_FILE" 2>&1
        ;;
    night)
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Running night detailed update" >> "$LOG_FILE"
        npm run scrape:night-detailed >> "$LOG_FILE" 2>&1
        ;;
    backfill)
        DAYS="${2:-7}"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Running backfill for $DAYS days" >> "$LOG_FILE"
        npx tsx scripts/smart-scheduler.ts --backfill "$DAYS" >> "$LOG_FILE" 2>&1
        ;;
    *)
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Unknown task: $TASK_NAME" >> "$LOG_FILE"
        echo "Available tasks: smart, morning, afternoon, evening, night, backfill" >> "$LOG_FILE"
        rm -f "$LOCKFILE"
        exit 1
        ;;
esac

RESULT=$?

# ロックファイル削除
rm -f "$LOCKFILE"
# flock は自動的に解放される（プロセス終了時）

if [ $RESULT -eq 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Scraper task completed successfully: $TASK_NAME" >> "$LOG_FILE"
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Scraper task failed: $TASK_NAME (exit code: $RESULT)" >> "$LOG_FILE"
fi

exit $RESULT