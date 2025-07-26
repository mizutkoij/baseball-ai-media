# ⚾ Baseball AI Media

NPB（日本プロ野球）の高度な分析とAI予測を提供するメディアサイト

## 🚀 Features

### 📊 Advanced Analytics
- **WAR Leaders**: 球場補正適用・中立化指標 (Phase 7A)
- **Matchup Analysis**: プラトーン効果・対戦相性分析 (Phase 7B)
- **Park Factors**: 12球場環境補正係数
- **Real-time Predictions**: WP・RE分析 (Phase 7C 準備中)

### 🤖 AI-Powered
- 自動生成コラム (試合前・試合後)
- リアルタイム対戦分析
- 優位性スコア計算
- Discord通知システム連携

### 📱 Modern UI
- Next.js 14 + App Router
- Tailwind CSS + Responsive Design
- Real-time データ更新
- 美しいグラデーション・アニメーション

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

## 📊 Data Sources

### Integrated Systems
- **NPB Official Data**: 7,633選手 公式統計
- **Yahoo Sports**: 詳細ゲームデータ・投球記録
- **1point02.jp**: 球詳データ・状況別成績
- **Phase 7A**: 球場補正・中立WAR計算
- **Phase 7B**: プラトーン効果・対戦相性分析

### 合法性・出典
- 全データソース合法収集
- robots.txt遵守・レート制限実装
- 出典明記・転載回避原則
- プライバシーポリシー・DMCA対応

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