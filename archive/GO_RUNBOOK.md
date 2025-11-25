# GO ランブック - 礼儀正しいPython 3段スクレイパー本番運用

## 🎯 **実戦投入準備完了**
✅ Playwright依存関係：インストール済み  
✅ .venv環境：準備完了  
✅ PoliteHttp：30s間隔 + robots.txt + ETagキャッシュ完備  
✅ Discord CSV通知：自動分割 + gzip圧縮対応  

---

## 0️⃣ **前提（1回だけ）**

### **環境変数設定**
```bash
export DISCORD_WEBHOOK_DATA="https://discord.com/api/webhooks/YOUR_DATA_WEBHOOK"
export DISCORD_WEBHOOK_STATUS="https://discord.com/api/webhooks/YOUR_STATUS_WEBHOOK"  
export DISCORD_WEBHOOK_ALERTS="https://discord.com/api/webhooks/YOUR_ALERTS_WEBHOOK"
```

### **ログディレクトリ作成**
```bash
cd ~/baseball-ai-media
mkdir -p logs
source .venv/bin/activate
export TZ=Asia/Tokyo
```

---

## 1️⃣ **ライブ運転（当日分）**

**⚠️ 重要**: 同時実行はPython版のみに統一（Node.jsのYahoo収集は停止推奨）

```bash
# 今日はライブ＋JST基準で礼儀運転（45–75s ジッター）
cd ~/baseball-ai-media
source .venv/bin/activate
export TZ=Asia/Tokyo

# スケジュール更新（増分）
python scripts/step_1_schedule_scraper_polite.py

# インデックス抽出（当日分）
python scripts/step_2_index_extractor_polite.py

# 投球ログ収集（当日全試合を順送り。取得ごとにCSVをDiscordへ送付）
nohup python scripts/step_3_pitchlog_fetcher_polite.py > logs/pitchlog_live.log 2>&1 &
```

---

## 2️⃣ **夜間バックフィル（過去分）**

**インターバル**: 30–60s + ジッター（アクセス制限回避）  
**失敗時**: 指数バックオフ → 自動再開

```bash
# 例：2024-03-01 以降のバックフィル（長時間ジョブ）
nohup python scripts/step_2_index_extractor_polite.py > logs/index_backfill.log 2>&1 &
nohup python scripts/step_3_pitchlog_fetcher_polite.py > logs/pitchlog_backfill.log 2>&1 &
```

---

## 3️⃣ **監視・確認コマンド**

```bash
# バックグラウンドジョブ確認
jobs -l
ps aux | grep python

# ログ監視
tail -f logs/pitchlog_live.log
tail -f logs/index_backfill.log

# Discord通知テスト
python -c "from lib.discord_csv_notifier import send_csv; import pandas as pd; df = pd.DataFrame({'test': [1,2,3]}); df.to_csv('test.csv', index=False); send_csv(None, 'test.csv', title='Test', tag='System')"
```

---

## 4️⃣ **トラブルシューティング**

### **Rate Limit対応**
- PoliteHttpが自動で429/503をハンドリング（最大5分待機）
- 手動調整：`min_interval_s`を60秒に延長

### **メモリ不足**
```bash
# 大容量CSVの分割送信確認
ls -lh data/pitch_logs_playwright/
```

### **Playwright エラー**
```bash
# ブラウザ再インストール
python -m playwright install chromium
```

---

## ✅ **成功指標**

1. **Discord通知**: CSV添付でデータ到着確認
2. **ログファイル**: ERROR無しで進行中
3. **データ蓄積**: `data/pitch_logs_playwright/` にCSVファイル生成
4. **Heatmap連携**: 投球座標データがDay 3システムで利用可能

**🚀 システム稼働開始準備完了！**