# 🚨 Baseball AI Media - インシデント・クイックカード

## Severity分類

### S1: 全配信停止 / 重大遅延
- **条件**: SSE接続=0 or Age p95>60s or 全API応答なし
- **アクション**: 直ちにロールバック → 前世代切り戻し
- **コマンド**: `./deploy/production-ops.sh rollback vPREV vPREV`
- **通知**: 即座 (Slack/PagerDuty)

### S2: 部分停止 / 予測のみ低下  
- **条件**: guardrail発火 or rolling_logloss悪化
- **アクション**: 機能段階OFF → 前世代自動ロールバック確認
- **コマンド**: `npm run rollback:status` → 自動対応済みか確認
- **通知**: 15分以内

### S3: 軽微な劣化
- **条件**: Coverage<98% or Lag p95>15s
- **アクション**: セカンダリ切替 / 再取得強化
- **コマンド**: `npm run ingest:pbp:today --force`
- **通知**: 30分以内

## 一次切り分け

### 1) 配信問題 (SSE接続=0)
```bash
# nginx確認
sudo tail -f /var/log/nginx/error.log | grep -E "(proxy|upstream)"

# 設定確認  
nginx -T | grep -A 5 "proxy_buffering off"

# タイムアウト確認
nginx -T | grep "proxy_read_timeout"
```

### 2) 鮮度問題 (pbp_event_lag_seconds_p95>15)
```bash
# PbP取り込みログ確認
journalctl -u baseball-live-api -f | grep -E "(pbp|ingest)"

# 二次ソース状況確認
curl -s localhost:8787/metrics | grep "data_consistency_errors"

# 強制再取得
npm run ingest:pbp:today --force
```

### 3) 予測問題 (rolling_logloss悪化)
```bash
# ガードレール状況確認
curl -s localhost:8787/metrics | grep "guardrail_actions_total"

# 自動ロールバック確認
npm run rollback:status

# モデル健全性確認
curl -s localhost:3000/api/model-health | jq '.'
```

## 標準アクション

### 即時対応
```bash
# 緊急ロールバック（30秒）
./deploy/production-ops.sh rollback vPREV vPREV

# 状況確認
./deploy/production-ops.sh status
```

### 無停止反映
```bash
# 設定リロード
curl -fsS -XPOST http://127.0.0.1:8787/admin/reload-params

# 反映確認
curl -s http://127.0.0.1:8787/admin/status | jq '.version'
```

### 監視強化
```bash
# 壁打ちモニター起動
bash deploy/wall.sh

# 別画面でメトリクス監視
watch -n 5 'curl -s localhost:8787/metrics | grep -E "(sse|lag|coverage)"'
```

## 復旧確認チェックリスト

- [ ] SSE接続数正常 (>0, <1000)
- [ ] カバレッジ率≥98%
- [ ] PbP遅延 p95≤15s
- [ ] 予測レイテンシ p95≤80ms
- [ ] メモリー圧迫=GREEN(0)
- [ ] ガードレール作動=0
- [ ] 全API正常応答
- [ ] ログにERROR無し

## エスカレーション

### Level 1 (運用チーム)
- S3事象の対応
- 標準アクション実行
- 復旧確認

### Level 2 (開発チーム)  
- S2事象でアクション無効時
- 新規事象パターン
- 設定変更が必要な場合

### Level 3 (アーキテクト)
- S1事象でロールバック無効時
- インフラ障害
- 根本原因分析

## 連絡先・URL

- **ダッシュボード**: http://100.88.12.26:3000/dash
- **メトリクス**: http://100.88.12.26/metrics
- **ヘルスチェック**: http://100.88.12.26/health
- **ログ**: `journalctl -u baseball-live-api -f`
- **壁打ちモニター**: `bash deploy/wall.sh`

---
*Baseball AI Media - "止まらない・戻せる・見える・伸ばせる" 運用体制*