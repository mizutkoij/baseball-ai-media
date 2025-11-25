# 🎯 初ゲーム日（ファーム）ミニ・ランブック

**本番連続運転対応 - 貼ってそのまま使える**

## T-60分（事前確認）

### 1) 事前準備確認
```bash
# game-initialization が空雛形 + timeline を先置きしていることを確認
ls -la data/timeline/yahoo_npb2/*/
ls -la data/timeline/yahoo_npb2/*/pitches/latest.json

# 監視のしきい値を有効化（休養日静音 → 通常モードへ自動復帰）
npx tsx scripts/first-game-check.ts --dry-run
```

### 2) システム状態確認
```bash
# プロセス確認
ps aux | grep "npx tsx" | grep -v grep

# 最新ログ確認
tail -10 logs/npb2-daemon.log

# ダッシュボード疎通確認
curl -s http://localhost:3000/api/health
```

---

## キックオフ時

### 自動動作確認
- ✅ **5分間隔のスキャナがゲーム検出** → 自動で 30s→8-45s 可変ポーリングへ移行
- ✅ **`/dash?filter=NPB2`** の Prospect Watch が直近投球で更新されることを目視

### 手動確認コマンド
```bash
# ゲーム検出状況
tail -20 logs/npb2-daemon.log | grep "games"

# ダッシュボード確認
curl -s "http://localhost:3000/api/prospects?filter=NPB2" | jq '.prospects | length'
```

---

## T+5分（品質ゲート）

### 主要SLOチェック（自動でも手動でも）
```bash
# 品質ゲート実行
npx tsx scripts/first-game-check.ts --assert \
  --min304 0.60 --max429 0.01 --maxLagP95 15 --minCoverage 0.98
```

### 合格ライン
- ✅ **yahoo_304_ratio ≥ 0.60** (キャッシュ効率)
- ✅ **yahoo_429_total ≤ 1%** (レート制限違反)
- ✅ **pbp_lag_p95 ≤ 15s** (データ遅延)
- ✅ **coverage ≥ 0.98** (データ完全性)
- ✅ **Prospect Watch 更新済み** (UI反映)

### 追加オプション（DB同期）
```bash
# データベース同期開始（PostgreSQL使用時）
nohup npm run db:sync > logs/db-sync.log 2>&1 &
```

---

## これだけ追加でやると"さらに安心"

### 1) 夜間ジョブ設定
```bash
# crontab編集
crontab -e

# 以下を追加
10 3 * * * cd /home/mizu/baseball-ai-media && npx tsx scripts/db-maintenance.ts daily >> logs/maintenance.log 2>&1
30 3 * * * cd /home/mizu/baseball-ai-media && npm run ops:rotate >> logs/rotate.log 2>&1
```

### 2) 静音ポリシー確認
```bash
# 休養日モードが自動OFFに戻るか確認
npx tsx -e "
import { AlertSuppressionManager } from './lib/alert-suppression';
const mgr = new AlertSuppressionManager();
console.log('Alert Status:', mgr.getSuppressionStatus());
"
```

### 3) 事前ヒント（当日 expected_games_total）
```bash
# Yahoo日程ヘッダーをキャッシュ → 404最小化
curl -s "https://baseball.yahoo.co.jp/npb/schedule/farm?date=$(date +%Y-%m-%d)" \
  -H "User-Agent: NPB-ResearchBot/1.0 (+admin@baseball-ai-media.com)" \
  | grep -o "試合.*件" || echo "No games expected"
```

### 4) Discord通知（オプション）
```bash
# first-game-check.ts --assert の結果を ✔/⚠ の1行で送る
npx tsx scripts/first-game-check.ts --assert --discord || \
  echo "品質ゲート結果をDiscordに送信"
```

---

## 🏁 結論

**修正は不要。すでに"回す→見張る→増やす"の理想形です。**

次のNPB2試合が来た瞬間に、以下がすべて自動で効きます：

- ✅ **初期遅延削減**（空雛形事前生成）
- ✅ **静音アラート**（休養日404抑制）  
- ✅ **自動DBメンテ**（日次VACUUM, 週次パーティション）
- ✅ **品質ゲート**（SLO自動チェック）

**引き続きダッシュボードとメトリクスだけ見ていればOK！**

---

## 🔧 トラブルシューティング

### プロセス停止時の復旧
```bash
# デーモン再起動
export YAHOO_LEVELS=npb2 && export DATA_DIR=./data && export CONTACT_EMAIL=admin@baseball-ai-media.com
nohup bash -c 'while true; do 
  echo "[$(date)] NPB2 Collection Cycle Start" >> logs/npb2-daemon.log
  npx tsx scripts/ingest_yahoo_integrated.ts --mode live --levels npb2 --no-baseballdata --no-db >> logs/npb2-daemon.log 2>&1
  echo "[$(date)] Cycle complete, sleeping 300s" >> logs/npb2-daemon.log
  sleep 300
done' &
```

### ログ監視
```bash
# リアルタイム監視
tail -f logs/npb2-daemon.log

# エラーのみ抽出
grep -i "error\|failed" logs/npb2-daemon.log | tail -10
```

### 緊急停止
```bash
# 全停止
export YAHOO_STOP=true
pkill -f "npx tsx"

# 再開
unset YAHOO_STOP
# 上記デーモン再起動コマンドを実行
```

**🎉 システム稼働開始！**