#!/bin/bash

# NPB自動スクレイピング Cron設定スクリプト
# Usage: ./setup-cron.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CRON_SCRIPT="$SCRIPT_DIR/run-cron-scraper.sh"

echo "NPB自動スクレイピング Cron設定"
echo "================================"
echo "プロジェクトディレクトリ: $PROJECT_DIR"
echo "実行スクリプト: $CRON_SCRIPT"
echo ""

# スクリプトに実行権限を付与
chmod +x "$CRON_SCRIPT"

# 現在のcrontab取得
TEMP_CRON=$(mktemp)
crontab -l > "$TEMP_CRON" 2>/dev/null || echo "" > "$TEMP_CRON"

# 既存のNPBスクレイピングジョブを削除
grep -v "NPB自動スクレイピング" "$TEMP_CRON" > "${TEMP_CRON}.clean" || echo "" > "${TEMP_CRON}.clean"
mv "${TEMP_CRON}.clean" "$TEMP_CRON"

# 新しいcronジョブを追加
cat << EOF >> "$TEMP_CRON"

# NPB自動スクレイピング ジョブ
0 7 * * *   $CRON_SCRIPT morning   # 朝7時：日程・先発更新
0 12 * * *  $CRON_SCRIPT afternoon # 正午：先発更新
0 18 * * *  $CRON_SCRIPT evening   # 夕方6時：試合前チェック
0 23 * * *  $CRON_SCRIPT night     # 深夜23時：試合結果更新
*/30 * * * * $CRON_SCRIPT evening  # 30分毎：シーズン中の頻繁更新（3-11月のみ手動で有効化）

EOF

# crontabに設定
crontab "$TEMP_CRON"

# 一時ファイル削除
rm -f "$TEMP_CRON"

echo "✅ Cron設定完了！"
echo ""
echo "設定されたスケジュール:"
echo "  07:00 - 朝の定期更新（日程・先発予告）"
echo "  12:00 - 午後の先発予告更新"
echo "  18:00 - 夕方の試合前チェック"
echo "  23:00 - 深夜の試合結果・詳細データ更新"
echo ""
echo "現在のcrontab:"
crontab -l | grep "NPB自動スクレイピング" -A 10
echo ""
echo "ログファイル: $PROJECT_DIR/data/logs/scraper-YYYY-MM-DD.log"
echo ""
echo "手動実行例:"
echo "  $CRON_SCRIPT morning   # 朝の更新を今すぐ実行"
echo "  $CRON_SCRIPT test      # テスト実行"