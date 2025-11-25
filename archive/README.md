# ⚾ Baseball AI Media

NPB（日本プロ野球）の独自分析とデータ可視化を提供するメディアサイト

## 📊 データ方針

### 独自性の保証
- **当サイトの指標値は自前のNPB公式スコア等から算出。第三者データベースの複製ではありません**
- **サイト内文章は独自執筆。引用は短い範囲に限定し、出典を明記**
- **統計手法は一般理論・学術論文・FanGraphs等の概念紹介に基づく独自実装**

### 主要機能
- **選手統計**: OPS, wOBA, FIP等の現代的指標を独自算出
- **チーム分析**: ピタゴラス勝率、パークファクター等
- **試合予測**: 統計的手法による勝敗予測
- **データ可視化**: インタラクティブなチャートとテーブル

## 🏗️ Architecture

```
Frontend (Vercel)          Backend (100.88.12.26)
┌─────────────────┐       ┌──────────────────────┐
│ Next.js 14      │◄─────►│ FastAPI Server       │
│ - WAR Leaders   │       │ - DuckDB Connection  │
│ - Matchup Cards │       │ - Phase 7A/7B APIs   │
│ - AI Columns    │       │ - Discord Integration│
└─────────────────┘       └──────────────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **Deployment**: Vercel

### Backend
- **API**: FastAPI + Uvicorn
- **Database**: DuckDB (既存データ基盤)
- **Analysis**: Phase 7A/7B システム統合
- **Notifications**: Discord Webhooks

## 🚀 Quick Start

### Development

1. **Clone & Install**
```bash
git clone [repository-url]
cd baseball-ai-media
npm install
```

2. **Environment Setup**
```bash
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://100.88.12.26:8000/api
NEXT_PUBLIC_SITE_NAME="Baseball AI Media"
```

3. **Start Development Server**
```bash
npm run dev
```

### Production Deployment

1. **Backend Setup** (100.88.12.26)
```bash
# Install dependencies
pip install -r requirements_api.txt

# Start FastAPI server
uvicorn api_app:app --host 0.0.0.0 --port 8000
```

2. **Frontend Deploy** (Vercel)
```bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
NEXT_PUBLIC_API_BASE_URL=http://100.88.12.26:8000/api
```

## 📊 データソース

### 収集方針
- **NPB公式サイト**: 試合結果・選手成績（公開情報のみ）
- **独自算出**: 統計指標は一般的な式を用いて自前計算
- **プロビナンス管理**: 全データにソース・作成方法・ライセンス情報を付与

### データ品質・品質保証システム
- **透明性**: 算出方法・係数・定数を全て公開
- **検証可能性**: リーグ集計値との整合性を確認
- **更新頻度**: 試合終了後24時間以内に反映
- **品質ゲート**: 195テスト (ゴールデンサンプル174 + ゲーム不変条件12 + システム9) で完全自動検証

### ライセンス
- **収集**: robots.txt遵守・適切なレート制限
- **利用**: 公開統計情報の分析・可視化に限定
- **配布**: 独自算出値のみ。第三者データの再配布なし

## 🔄 Development Phases

- ✅ **Phase 1-4**: データ収集・ETL・基盤構築
- ✅ **Phase 5**: 本サイト公開 (MVP) **← 現在位置**
- ✅ **Phase 6**: ML予測・Discord通知
- ✅ **Phase 7A**: 球場補正・中立WAR
- ✅ **Phase 7B**: 対戦分析・プラトーン効果
- 🚧 **Phase 7C**: リアルタイム予測 (WP・RE)
- 📋 **Phase 8**: GPT生成記事・収益化
- 📋 **Phase 9**: 多言語対応・国際展開

## 🔔 Notification System

### Discord Integration
- **試合前プレビュー**: 12:00 JST 自動配信
- **WAR月次レポート**: 月初 09:00 JST
- **球場補正分析**: 月次統計・順位変動
- **リアルタイム速報**: Phase 7C で実装予定

## 📈 Performance

### Optimization
- **ISR**: 5分キャッシュ・自動再生成
- **API Cache**: DuckDB read-only + Redis (将来)
- **Image Optimization**: Next.js automatic
- **Bundle Splitting**: Route-based + Component-based

### Monitoring
- Vercel Analytics統合
- FastAPI健康状態監視
- DuckDB接続プール管理

## 🛡️ Security & Privacy

### セキュリティ対策
- CORS設定・Origin制限
- DuckDB read-only接続
- 環境変数・秘密情報分離
- Rate limiting (API側)

### プライバシー
- 個人情報非収集
- 公開統計のみ利用
- Cookie最小限使用
- GDPR・個人情報保護法遵守

## 🎯 品質保証・ベースライン更新規約

### ゴールデンサンプル管理
- **ベースライン**: `data/golden_samples.json` (Version 2.0 - 30選手 + 12チーム)
- **テスト実行**: `npm run test:golden` + `npm test -- __tests__/game-invariants.test.ts`
- **品質API**: `/api/quality` でリアルタイム監視・`/about/methodology` で公開ダッシュボード

### ベースライン更新手順

#### 1. 定期更新（月次・シーズン終了時）
```bash
# 1. 現在のテスト成功率確認
npm run test:golden
npm test -- __tests__/game-invariants.test.ts

# 2. 新データ追加（必要に応じて）
# data/golden_samples.json を編集

# 3. 設定調整（許容誤差等）
# config/invariants.config.json を編集

# 4. 検証・コミット
npm test
git add data/golden_samples.json config/invariants.config.json
git commit -m "update: ベースライン更新 v2.X - 新規選手X名/チームX追加"
```

#### 2. 緊急更新（データ異常・外れ値対応）
```bash
# 1. 問題のあるテストを特定
npm run debug:game -- --game 20240401001  # 特定ゲーム調査
npm run debug:game -- --team 巨人 --latest 5  # チーム直近試合調査

# 2. 問題箇所の一時除外（緊急時のみ）
# config/invariants.config.json の exclude セクション編集

# 3. フェイルオープン確認
# CI で自動的に最後の正常版に戻り稼働継続

# 4. 根本原因修正後にピン解除
unset CONSTANTS_PIN  # または環境変数削除
```

#### 3. 品質ゲート設定変更承認
- **CODEOWNERS**: `/config/*` → `@mizutkoij` 必須承認
- **設定変更PR**: 許容誤差・除外パターン・サンプリング設定
- **影響評価**: 変更前後のテスト成功率比較必須

#### 4. テスト追加・改善指針
```bash
# 新しい品質チェック追加例
# __tests__/game-invariants.test.ts に追加

it('should validate new metric consistency', async () => {
  const config = getInvariantConfig('new_metric')
  const stratifiedResult = await generateStratifiedSample()
  // テストロジック実装
})
```

#### 5. 運用監視・アラート
- **日次**: 品質ゲート自動実行（JST 0:15）
- **失敗時**: Discord/GitHub Issues自動作成
- **緊急**: フェイルオープンで稼働継続
- **復旧**: 手動確認・ピン解除

### バージョニング規則
```
Version Format: YYYY.MAJOR.YYYYMMDD_HHMM

2025.1          - ベースライン (年次リセット)
2025.1.20250315 - 月次更新版
2025.2          - 大幅仕様変更
```

### 品質指標・目標値
- **テスト成功率**: 95%以上（195/195テスト）
- **カバレッジ**: 75%以上（ゲーム・選手・チーム）
- **稼働継続**: 100%（フェイルオープンによる無停止保証）
- **応答時間**: データ更新24時間以内・異常検知5分以内

## 📞 Contact & Support

### Issue Reporting
- GitHub Issues (開発関連)
- /privacy ページ (プライバシー関連)
- /dmca ページ (著作権関連)

### Development Team
- **Data Pipeline**: Phase 1-7B完成システム活用
- **Frontend**: Next.js + Modern UI/UX
- **Backend**: FastAPI + DuckDB統合
- **AI Analysis**: GPT-4活用予定

---

**⚾ NPB分析の新しいスタンダードを目指して**

Phase 5 MVP → Phase 7C → Phase 8で完全な「AIメディア」を実現！