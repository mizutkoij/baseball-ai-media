# Baseball AI Media - Production Operations Guide

## ✅ SYSTEM STATUS: OPERATIONAL

本番環境が正常稼働中。Discord監視システム完全稼働、NPB1データ収集中。

---

## 🔍 即座にチェックする5つのコマンド

### 1) 収集→予測→配信の健全性
```bash
curl -s http://127.0.0.1:8787/metrics | egrep 'yahoo_304_ratio|yahoo_429_total|pitch_rows_ingested_total'
```

### 2) 監視ダッシュボード（今日のNPB1）
```bash
curl -s http://127.0.0.1:8787/live/summary | jq .
```

### 3) 進捗が増えているか（NPB1の該当 gameId）
```bash
egrep '2021029682' -n data/predictions/live/date=*/**/timeline.jsonl | tail
```

### 4) Discord 正常系（受信できていればOK）
- **#status**: 収集/差分/予測のステータス更新
- **#data**: 1秒バッチで pitch イベントのJSON添付
- **#alerts**: @here 付きの異常通知（なければ尚良し）

### 5) ログのエラー密度（5分で何件？）
```bash
grep -E 'ERROR|429|503' -c logs/yahoo-live.log
```

**⚠️ 途中で止まる場合**: link-scan の step_2 を リンクスキャン版へ切替済みか確認
（未適用なら差し替え推奨：enumeration→scan の方が壊れに強い）

---

## ⚡ 本番運用の3つのボタン

### 一時停止（即座に止めたい）
```bash
export YAHOO_STOP=true && pkill -f 'npm run yahoo:live'
```

### 再開（環境維持したまま）
```bash
unset YAHOO_STOP && nohup npm run yahoo:live:today > logs/yahoo-live.log 2>&1 &
```

### NPB1+NPB2 同時監視に拡張
```bash
export YAHOO_LEVELS="npb1,npb2"
pkill -f 'npm run yahoo:live' || true
nohup npm run yahoo:live:today > logs/yahoo-live.log 2>&1 &
```

---

## 📅 24時間ロールアウト（今日はここまでで十分）

### 昼
NPB1の1試合が #data/#status できれいに流れ続けるかを見る

### 夕
yahoo_304_ratio と 429_total を再確認（しきい値内）

### 深夜
軽いバックフィルを礼儀モードで1日だけ回す
```bash
YAHOO_LEVELS=npb1 \
npx tsx scripts/ingest_yahoo_integrated.ts --mode backfill --from 2025-08-01 \
  --sleep ${BACKFILL_SLEEP_MS:-30000} --resume
```

---

## 🏆 現在の稼働状況

- **Discord Integration**: ✅ 3-channel monitoring active
- **NPB1 Collection**: ✅ 1 game monitoring (ID: 2021029682)
- **NPB2 Collection**: ⚠️ Auto-start when farm games scheduled
- **Web Interface**: ✅ Port 3000 operational
- **Data Pipeline**: ✅ Real-time notifications flowing

---

## 🔄 次のステップ

この状態なら、実データ収集はもう **"走り続けてOK"** です。

NPB2（ファーム）は試合が入った瞬間に自動で立ち上がります。

必要ならこの後、**Heatmap 前計算（Day 3）**を有効化して /prediction/heatmap を埋めていきましょう。

---

## 🚨 緊急時の連絡先

- Discord STATUS channel で即座にステータス確認
- Discord ALERTS channel で @here 通知が重要な問題を知らせる
- ログファイル: `logs/yahoo-live.log`

**システムは完全に OPERATIONAL です。**