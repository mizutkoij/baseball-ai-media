# 🔧 Yahoo野球スクレイパー改善パッチ

## 📋 改善概要

Yahoo野球データ収集の効率化・安全化を実現：

### A. データソース優先順位
✅ **NPB公式PbPコネクタ優先** - 既存の基盤実装を活用  
✅ **Yahoo補完のみ** - 欠損時（カバレッジ<98%）のみに限定  
⇒ **発信量が桁で減少・ブロック確率激減**

### B. Yahoo側アクセス最適化
✅ **ブルートフォース廃止** - 総当たり→リンクスキャン方式  
✅ **局所巡回** - 隣接遷移のみで全打席カバー  
⇒ **Step2を丸ごと省略可能・無駄撃ちゼロ**

### C. レート制限強化
✅ **5-10秒間隔** (従来3-7秒から拡張)  
✅ **429/503対応** - Retry-After準拠 + 指数バックオフ  
✅ **Circuit Breaker** - 連続失敗で自動クールダウン

### D. 運用安全化
✅ **30日キャッシュ** - 成功HTMLを長期保持  
✅ **時間帯制御** - ライブ/バックフィル分離  
✅ **robots.txt確認** - 自動チェック・制限遵守  
✅ **善良クローラ識別** - UA固定・From ヘッダ

## 🚀 実装ファイル

### 1. 改善版 Step 2 (インデックス抽出)
```bash
# 新ファイル
step_2_index_extractor_improved.py

# 主な変更点:
- 総当たり → リンクスキャン + 隣接遷移
- robots.txt 自動確認
- Circuit Breaker実装
- HTMLキャッシュ (24時間)
- レート制限強化 (5-10秒)
```

**主要機能:**
- **リンクスキャン**: /score ページから全indexリンクを一括抽出
- **隣接遷移**: 「前/次」リンクを辿る局所巡回
- **Circuit Breaker**: 連続失敗5回で300秒クールダウン
- **キャッシュ**: 成功レスポンスを24時間保持

### 2. 改善版 Step 3 (投球ログ取得)
```bash
# 新ファイル  
step_3_pitchlog_fetcher_improved.py

# 主な変更点:
- 時間帯制御 (ライブ: 7-21時、バックフィル: 22-6時)
- 30日キャッシュ (index別)
- 適応的遅延 (失敗回数に応じて延長)
- リソース制限 (concurrent=1)
```

**主要機能:**
- **時間帯分離**: ライブ収集は日中のみ、バックフィルは夜間のみ
- **長期キャッシュ**: indexごとに30日間キャッシュ保持
- **適応的遅延**: 失敗が増えるほど遅延時間を延長
- **善良UA**: 連絡先付きUser-Agent設定

### 3. 統合データ収集システム
```bash
# 新ファイル
integrated_data_collector.py

# 主な機能:
- NPB公式データ優先使用
- Yahoo補完（品質<98%時のみ）
- 使用状況レポート
- リクエスト削減効果測定
```

**収集フロー:**
1. NPB公式PbPコネクタで取得試行
2. 品質評価（カバレッジ率計算）
3. 98%未満の場合のみYahooバックアップ実行
4. 使用状況とリクエスト削減効果をレポート

## 📊 期待効果

### リクエスト削減効果
```bash
# 従来方式 (総当たり)
推定リクエスト数: 9イニング × 18打者 × 2サイド × 2状態 = ~650リクエスト/試合

# 改善版 (リンクスキャン + 隣接遷移) 
実際リクエスト数: ~10-30リクエスト/試合

削減効果: 約95%削減
```

### データソース使用率
```bash
# NPB公式カバレッジ98%の場合
Yahoo使用率: 2%以下 (欠損補完のみ)
従来比リクエスト削減: 98%
```

## 🛠️ デプロイ手順

### 1. 改善版ファイル配置
```bash
# 既存ファイルのバックアップ
cp step_2_index_extractor.py step_2_index_extractor_original.py
cp step_3_pitchlog_fetcher.py step_3_pitchlog_fetcher_original.py

# 改善版をデプロイ
cp step_2_index_extractor_improved.py step_2_index_extractor.py
cp step_3_pitchlog_fetcher_improved.py step_3_pitchlog_fetcher.py
```

### 2. 依存関係インストール
```bash
# Pythonパッケージ
pip install requests beautifulsoup4 pandas playwright

# Playwright ブラウザ
playwright install chromium
```

### 3. 統合システム設定
```bash
# NPM scripts更新
npm run ingest:pbp:today  # NPB公式データ取得

# 統合収集実行
python integrated_data_collector.py 2025-08-13
```

### 4. 動作確認
```bash
# Step 2 改善版テスト
python step_2_index_extractor_improved.py

# 出力例:
# 📋 Scanning index links from score page: 20250813001
# ✅ Found 45 index links via scanning  
# 📊 Request reduction: 605 fewer requests vs brute-force

# Step 3 改善版テスト  
python step_3_pitchlog_fetcher_improved.py

# 出力例:
# 🕐 Processing at 14:30 (live mode)
# 📄 Cache hits: 12/45 (26.7%)
```

## 📋 運用ガイドライン

### データ収集優先順位
1. **NPB公式PbPコネクタ** (既存基盤) - 全戦で優先使用
2. **Yahoo補完** - NPB品質<98%の場合のみ
3. **手動補正** - 両方失敗時の最終手段

### 制限・制約事項
- **robots.txt遵守**: Disallow時は自動停止
- **時間帯制限**: ライブ7-21時、バックフィル22-6時のみ
- **レート制限**: 最低5秒間隔、連続失敗時は指数バックオフ
- **Circuit Breaker**: 連続5回失敗で5分間停止

### 監視項目
```bash
# 使用状況確認
cat logs/collection_log_*.json | jq '.usage_report'

# Yahoo使用率確認  
echo "Yahoo usage rate should be <5%"

# リクエスト削減効果
echo "Request reduction should be >90%"
```

## 🚨 トラブルシューティング

### Circuit Breaker作動時
```bash
# 原因確認
grep "Circuit breaker" logs/collection_log_*.json

# 対処法
1. NPB公式データ品質を確認
2. robots.txt変更をチェック
3. 必要に応じてクールダウン時間調整
```

### robots.txt制限時
```bash
# 確認
curl https://baseball.yahoo.co.jp/robots.txt

# 対処法  
1. NPB公式データのみで運用継続
2. 制限解除まで待機
3. 代替データソース検討
```

## 🎯 成功指標

- ✅ Yahoo使用率: <5% (NPB品質98%前提)
- ✅ リクエスト削減: >90% vs 従来方式
- ✅ データ品質: 全体95%以上維持
- ✅ Circuit Breaker作動: 週1回未満
- ✅ robots.txt遵守: 100%

この改善により、**"ブロック率激減・発信量桁減・品質維持"** を実現し、安定したデータ収集体制を構築できます。