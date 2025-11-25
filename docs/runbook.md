# NPB Baseball AI - 障害対応 RUNBOOK 🚨

**目的**: アラート発生時の迅速な原因特定・復旧手順書

## 🔥 緊急対応フロー

### 1. 初動確認 (3分以内)
```bash
# サービス全体状況確認
curl -s https://baseball-ai-media.vercel.app/health | jq
curl -s http://localhost:9090/metrics | grep -E "npb_scraper|scheduler"

# 直近ログ確認  
tail -100 logs/$(date +%Y-%m-%d).jsonl | jq -r 'select(.level >= 40)'
```

### 2. トリアージ判定
- 🚨 **PAGE**: 即座対応必要（ユーザー影響あり）
- ⚠️ **WARN**: 監視継続（30分以内対応）  
- 📊 **INFO**: 正常範囲内のゆらぎ

---

## 🚨 ScrapeFailureSpike

**症状**: 過去15分で3回以上のスクレーピング失敗

### 原因特定
```bash
# 1. 失敗パターン分析
grep -A5 "scrape_error" logs/$(date +%Y-%m-%d).jsonl | jq -r '
  select(.msg == "scrape_error") | 
  {time: .time, source: .source, error: .error, http_status: .http_status}'

# 2. NPB公式サイト直接確認
curl -I https://npb.jp/games/$(date +%Y%m%d)/
curl -I https://npb.jp/bis/2025/stats/

# 3. レート制限チェック
grep "429\|rate.limit" logs/$(date +%Y-%m-%d).jsonl | tail -10
```

### 復旧手順

#### A) NPBサイト障害の場合
```bash
# フェイルオーバー先に切り替え
export SCRAPE_SOURCE_PRIORITY="baseballdata,npb_official"
npm run scrape:current -- --source baseballdata

# 復旧確認までbaseballdata優先で継続
```

#### B) レート制限の場合  
```bash
# QPS を半減
export SCRAPER_QPS=0.5
export SCRAPER_DELAY_MS=2000

# バックオフ期間を設定 (30分)
npm run schedule:pause -- --duration 30m
```

#### C) 証明書エラーの場合
```bash
# TLS検証スキップ（一時的）
export NODE_TLS_REJECT_UNAUTHORIZED=0
npm run scrape:current

# 正式修正: SSL証明書更新を依頼
```

#### D) 完全復旧確認
```bash
# 正常スクレーピング1回実行
npm run scrape:test -- --verbose

# アラート解除確認
curl -s http://localhost:9093/api/v1/alerts | jq '.data[] | select(.labels.alertname == "ScrapeFailureSpike")'
```

---

## ⏰ NoStartersWritten

**症状**: 予告先発情報が1時間以上更新されていない

### 原因特定
```bash
# 1. スケジューラー状態確認
ps aux | grep smart-scheduler
systemctl status baseball-scheduler  # systemd使用時

# 2. 最新実行ログ確認
grep "scheduler_execution" logs/$(date +%Y-%m-%d).jsonl | tail -10 | jq

# 3. データファイル確認
ls -la data/starters/date=$(date +%Y-%m-%d)/
stat data/starters/date=$(date +%Y-%m-%d)/latest.json
```

### 復旧手順

#### A) スケジューラー停止の場合
```bash
# プロセス確認・再起動
pkill -f smart-scheduler
npm run schedule:start -- --daemon

# 即座に手動実行
npm run schedule:run-now -- --job starters
```

#### B) データソース問題の場合
```bash
# 先発情報を手動で取得
npm run scrape:afternoon-starters -- --force --verbose

# 取得できない場合はフォールバック
npm run fetch:baseballdata -- --type starters --date $(date +%Y-%m-%d)
```

#### C) ファイルシステム問題の場合
```bash
# ディスク容量確認
df -h data/
ls -la data/starters/

# 権限問題修復
chown -R app:app data/starters/
chmod -R 755 data/starters/
```

---

## 📊 DQErrorRateHigh  

**症状**: データ検証エラー率が5%超過

### 原因特定
```bash
# 1. エラー内容分析
grep "validation_error" logs/$(date +%Y-%m-%d).jsonl | jq -r '.details' | sort | uniq -c

# 2. スキーマ変更確認
diff data/schemas/previous/starters.json data/schemas/current/starters.json

# 3. データサンプル確認  
head -5 data/starters/date=$(date +%Y-%m-%d)/latest.json | jq
```

### 復旧手順

#### A) NPBサイト構造変更の場合
```bash
# 既存スクレーパーを緊急停止
npm run schedule:pause -- --duration 2h

# スキーマ更新＆再デプロイ待機
echo "⚠️ NPBサイト構造変更検出。開発チームに緊急連絡要"

# 一時的にbaseballdataのみ使用
export SCRAPE_SOURCE="baseballdata_only"
npm run scrape:current -- --source baseballdata
```

#### B) データ形式エラーの場合
```bash
# 正規化処理の強制適用
npm run validate:starters -- --fix --verbose

# エラーレコードの隔離
mkdir -p data/quarantine/$(date +%Y%m%d)
mv data/starters/date=$(date +%Y-%m-%d)/error_records.json data/quarantine/$(date +%Y%m%d)/
```

---

## 💾 DataDiskSpaceLow

**症状**: データディスクの空き容量が10%未満

### 即座実行
```bash
# 1. 緊急クリーンアップ
npm run cleanup:old-logs -- --days 3
rm -rf data/*/date=2024-*/  # 2024年データの削除

# 2. 一時ファイル削除
rm -rf tmp_*/ 
rm -rf data/snapshots/debug_*
```

### 恒久対策
```bash
# 3. アーカイブ化
npm run archive:compress -- --before 30days
npm run archive:upload -- --target s3://your-backup-bucket/

# 4. 容量監視強化
echo "DATA_RETENTION_DAYS=60" >> .env.production
```

---

## 🔄 MetricsServerDown

**症状**: Prometheusメトリクスサーバーが応答なし

### 復旧手順
```bash
# 1. プロセス確認・再起動
ps aux | grep metrics-server
pkill -f metrics-server

# 2. ポート競合確認
netstat -an | grep :9090
lsof -i :9090

# 3. サーバー再起動
export METRICS_PORT=9091  # ポート変更して起動
npm run metrics -- --port 9091

# 4. Prometheus設定更新
sed -i 's/:9090/:9091/g' prometheus.yml
systemctl reload prometheus
```

---

## 🛠️ 緊急時ユーティリティ

### 全体ヘルスチェック
```bash
#!/bin/bash
# health-check-all.sh

echo "🔍 NPB Baseball AI - 全体ヘルスチェック"
echo "================================================"

# Web サービス
echo "🌐 Web Service:"
curl -s -w "%{http_code}\n" https://baseball-ai-media.vercel.app/health || echo "❌ Web service down"

# メトリクス
echo "📊 Metrics Server:"  
curl -s -w "%{http_code}\n" http://localhost:9090/metrics > /dev/null || echo "❌ Metrics down"

# データ更新状況
echo "📅 Last Data Update:"
find data/starters/date=$(date +%Y-%m-%d)/ -name "*.json" -exec stat -c "%Y %n" {} \; 2>/dev/null | 
  sort -n | tail -1 | awk '{print strftime("%Y-%m-%d %H:%M:%S", $1), $2}'

# ディスク使用量
echo "💾 Disk Usage:"
df -h data/ | tail -1

echo "✅ ヘルスチェック完了"
```

### 緊急データリカバリー
```bash
#!/bin/bash  
# emergency-recovery.sh <date>

DATE=${1:-$(date +%Y-%m-%d)}

echo "🚑 緊急データリカバリー: $DATE"

# 1. バックアップから復元
if [ -f "backups/$DATE.tar.gz" ]; then
  tar -xzf "backups/$DATE.tar.gz" -C data/
  echo "✅ バックアップから復元完了"
fi

# 2. 手動再スクレーピング
npm run scrape:current -- --date $DATE --force --all-sources

# 3. 整合性チェック
npm run validate:all -- --date $DATE --fix

echo "✅ リカバリー完了"
```

### アラート一時停止
```bash
#!/bin/bash
# mute-alerts.sh <duration>

DURATION=${1:-1h}

echo "🔇 アラート一時停止: $DURATION"

# Alertmanager経由で全アラート停止
curl -X POST http://localhost:9093/api/v1/silences \
  -d '{
    "matchers": [{"name": "alertname", "value": ".*", "isRegex": true}],
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "endsAt": "'$(date -u -d "+$DURATION" +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "comment": "Emergency maintenance",
    "createdBy": "runbook-script"
  }'

echo "✅ $DURATION 間アラート停止"
```

---

## 📞 エスカレーション連絡先

### 🚨 緊急時（PAGE レベル）
- **Discord**: `#baseball-alerts` 
- **開発チーム**: @dev-team
- **インフラ担当**: @infra-team

### ⚠️ 業務時間内（WARN レベル）  
- **Discord**: `#baseball-monitoring`
- **担当者**: @on-call-engineer

### 📊 外部依存
- **NPB公式**: https://npb.jp/ (構造変更時)
- **Baseball Data**: https://baseballdata.jp/ (API障害時)
- **Vercel**: https://vercel.com/status (デプロイ問題時)

---

**最終更新**: 2025-08-11  
**版数**: v1.0  
**レビュー周期**: 月次