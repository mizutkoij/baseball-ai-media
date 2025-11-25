#!/bin/bash
# NPB2 深夜バックフィル（履歴の安全回収）
# 礼儀モードでレジューム付き回収

set -euo pipefail

# 設定値
BACKFILL_SLEEP_MS=${BACKFILL_SLEEP_MS:-30000}  # 30秒間隔（デフォルト）
FROM_DATE=${FROM_DATE:-2024-03-01}               # 開始日
LOG_FILE=${LOG_FILE:-~/logs/nightly-backfill.log}
LOCK_FILE=/tmp/nightly-backfill.lock

# ログディレクトリ作成
mkdir -p ~/logs

# 重複実行防止
if [ -f "$LOCK_FILE" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Another backfill process is running (lock file exists)" >> "$LOG_FILE"
    exit 1
fi

trap 'rm -f "$LOCK_FILE"' EXIT
echo $$ > "$LOCK_FILE"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [BACKFILL] $1" | tee -a "$LOG_FILE"
}

log "=== Starting NPB2 nightly backfill ==="
log "From date: $FROM_DATE"
log "Sleep interval: ${BACKFILL_SLEEP_MS}ms"

# 停止チェック関数
check_stop_signal() {
    if [ "${YAHOO_STOP:-}" = "true" ]; then
        log "Stop signal detected (YAHOO_STOP=true), exiting gracefully"
        exit 0
    fi
}

# バックフィル実行
log "Starting backfill process..."

cd ~/baseball-ai-media

# 停止信号チェック
check_stop_signal

# バックフィル実行（レジューム付き）
npx tsx scripts/ingest_yahoo_integrated.ts \
    --mode backfill \
    --from "$FROM_DATE" \
    --sleep "$BACKFILL_SLEEP_MS" \
    --resume \
    --levels npb2 \
    2>&1 | while read line; do
        echo "$(date '+%Y-%m-%d %H:%M:%S') $line" >> "$LOG_FILE"
        
        # 429/503エラー時は自動クールダウン
        if echo "$line" | grep -q "429\|503\|rate.limit"; then
            log "Rate limit detected, cooling down for 2 minutes..."
            sleep 120
        fi
        
        # 定期的な停止チェック
        if (( RANDOM % 100 == 0 )); then
            check_stop_signal
        fi
    done

BACKFILL_EXIT_CODE=$?

if [ $BACKFILL_EXIT_CODE -eq 0 ]; then
    log "Backfill completed successfully ✅"
else
    log "Backfill failed with exit code: $BACKFILL_EXIT_CODE ❌"
fi

# 実行統計
log "=== Backfill Statistics ==="
cd ~/baseball-ai-media
npx tsx -e "
import { q } from './app/lib/db';

async function getStats() {
  const today = new Date().toISOString().slice(0, 10);
  
  // 今日追加されたレコード数
  const newPitches = await q(\`
    SELECT COUNT(*) as count 
    FROM pitches 
    WHERE DATE(created_at) = \$1
  \`, [today]);
  
  // 全期間のNPB2データ
  const totalPitches = await q(\`
    SELECT COUNT(*) as count 
    FROM pitches p
    JOIN games g ON p.game_id = g.game_id
    WHERE g.level = 'NPB2'
  \`);
  
  // 最新データの日付
  const latestData = await q(\`
    SELECT MAX(DATE(event_timestamp)) as latest_date
    FROM pitches p
    JOIN games g ON p.game_id = g.game_id
    WHERE g.level = 'NPB2'
  \`);
  
  console.log(\`New pitches today: \${newPitches[0]?.count || 0}\`);
  console.log(\`Total NPB2 pitches: \${totalPitches[0]?.count || 0}\`);
  console.log(\`Latest data date: \${latestData[0]?.latest_date || 'N/A'}\`);
}

getStats().catch(console.error);
" 2>&1 | tee -a "$LOG_FILE"

log "=== Nightly backfill completed ==="

# レポート送信（Discord通知）
if [ "${DISCORD_WEBHOOK_URL:-}" ]; then
    STATS=$(tail -10 "$LOG_FILE" | tr '\n' '\\n')
    curl -s -H "Content-Type: application/json" \
         -d "{\"content\": \"🌙 NPB2 Nightly Backfill Report\\n\`\`\`\\n${STATS}\\n\`\`\`\"}" \
         "$DISCORD_WEBHOOK_URL" || true
fi

exit $BACKFILL_EXIT_CODE