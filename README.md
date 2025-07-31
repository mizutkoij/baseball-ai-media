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

### データ品質
- **透明性**: 算出方法・係数・定数を全て公開
- **検証可能性**: リーグ集計値との整合性を確認
- **更新頻度**: 試合終了後24時間以内に反映

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