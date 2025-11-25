# NPB スクレイピングシステム

## 🎯 アクティブなスクレイピングプログラム

### 1. **npb-official-scraper.ts** - メインスクレイピング
- NPB公式サイトからの正式なデータ取得
- 用途: 実際の試合データを取得
- URL: https://npb.jp/games/2025/, https://npb.jp/games/2025/schedule_MM_detail.html

### 2. **npb-offline-scraper.ts** - オフライン対応版  
- 既知データベースを使用したオフライン動作
- 用途: ネットワーク障害時のフォールバック
- 特徴: 即座にデータを返す

### 3. **automated-scraper.ts** - 自動スケジューラー
- 定期実行とスケジューリング機能
- 用途: cron jobや定期データ更新

## 📂 アーカイブされたファイル (scripts/archive/scrapers/)

- `comprehensive_game_detail_scraper.ts` - 詳細ゲームデータ取得（旧版）
- `comprehensive-npb-scraper.ts` - 包括的NPBスクレイピング（重複）
- `enhanced-npb-scraper.ts` - 拡張NPBスクレイピング（重複）
- `npb-real-scraper.ts` - リアルスクレイピング（タイムアウト問題）
- `test-automated-scraper.ts` - テスト用（不要）

## 🛠️ 使用方法

```bash
# メインスクレイピング（推奨）
npx tsx scripts/npb-official-scraper.ts 2025-08-21 --save

# オフライン版（高速）
npx tsx scripts/npb-offline-scraper.ts 2025-08-21 --save

# 自動化版
npx tsx scripts/automated-scraper.ts
```

## ❌ 現在の問題

1. **試合数の不正確さ**: 実際の6試合を正確に取得できていない
2. **HTMLパースの問題**: NPB公式サイトの構造解析が不完全
3. **固定データ依存**: 手動データに頼りすぎている

## 🔄 次のステップ

1. NPB公式サイトの実際のHTML構造を解析
2. 正確な試合数（6試合）を取得するパース処理の改善
3. データの検証と品質管理の強化