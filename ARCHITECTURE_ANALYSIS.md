# 野球AI Media - 現在のアーキテクチャ分析

## 🔍 調査日時
2025-11-27

## 📊 現在のシステム構成

### 1. データ層

#### VPS Server (133.18.115.175)
```
データストレージ:
├─ /opt/baseball-ai-media/output/     1.4GB (JSON files - 95,364 files)
│  └─ 選手詳細統計JSON (output/2025/チーム名/選手名/*.json)
│
├─ SQLiteデータベース (合計 ~10MB)
│  ├─ comprehensive_baseball_database.db  5.4MB
│  ├─ data/npb.db                         3.1M
│  ├─ data/db_history.db                  384K
│  ├─ data/db_current.db                  336K
│  ├─ kbo_complete_data.db                256K
│  └─ その他KBO関連DB
│
└─ Yahoo連続スクレイピングデータ
   └─ data/yahoo_continuous/yahoo_games.db
```

#### Vercel版の制限
```typescript
// lib/db.ts
// Database functionality disabled for Vercel compatibility
// All database operations now return mock data
```

**重要**: Vercelではデータベースが完全に無効化されており、モックデータを返している。

### 2. サービス層

#### VPS上のサービス

**systemd services:**
```
baseball-api.service     - Node.js API Server (Port 3001)
  ├─ 役割: 選手詳細統計の提供
  ├─ データソース: /opt/baseball-ai-media/output/*.json
  └─ エンドポイント: /api/players/:id/detailed-stats

yahoo-scraper.service    - Yahoo野球スクレイピング
nginx.service            - リバースプロキシ
```

**PM2プロセス:**
```
baseball-ai-media          - Next.js dev server (Port 3000)
baseball-data-collector    - データ収集
ecosystem.ingest           - データインジェスト
smart-scheduler           - スケジューリング (5分間隔 cron)
yahoo-scraper             - Yahoo連続スクレイピング
```

### 3. APIルート (Vercel Serverless Functions)

現在のAPI Routes（19個）:
```
/api/backfill-status
/api/compare/players
/api/compare/teams
/api/constants
/api/export/csv
/api/export/player
/api/game-of-the-day
/api/games/[gameId]/detailed
/api/games/[gameId]
/api/player-density/[id]
/api/players/[id]/similar
/api/players/[id]/detailed-stats  ← VPS APIへプロキシ
/api/quality
/api/schedule
/api/standings
/api/stats/batting
/api/stats/pitching
/api/teams/[year]/[team]
/api/today-games
```

### 4. データフロー

```
Yahoo Baseball
   ↓ (スクレイピング)
VPS: yahoo-scraper
   ↓
SQLite DB
   ↓
VPS: baseball-api
   ↓ (HTTP API)
Vercel: /api/players/[id]/detailed-stats (プロキシ)
   ↓
Next.js App (フロントエンド)
   ↓
ユーザー
```

## 🔴 問題点

### 1. 複雑な構成
- **3層アーキテクチャ**: ローカル + VPS + Vercel
- **データの分散**: SQLite (VPS) + JSON files (VPS) + Mock data (Vercel)
- **重複サービス**: PM2でNext.js devサーバーが動いているが、Vercelでも動いている

### 2. デプロイの不安定性
- Vercel Root Directory設定ミス → デプロイ失敗
- ビルドタイムアウト（型チェックで2分以上）
- VPSとVercelの同期が必要

### 3. スケーラビリティの問題
- SQLite (単一ファイル、並行書き込み制限)
- JSON files 95,364個 (1.4GB) → 検索・集計が遅い
- VPSの単一障害点

### 4. メンテナンスの負担
- 複数の技術スタック (Python + TypeScript + Node.js)
- VPSの管理 (systemd, PM2, nginx設定)
- 依存関係の複雑さ

## 💡 シンプル化の方向性

### 目標: Vercel完結型アーキテクチャ

すべての機能をVercelのみで実現:
- ✅ Next.js App (フロントエンド)
- ✅ Vercel Serverless Functions (API)
- ✅ Vercel Postgres (データベース)
- ✅ Vercel Cron Jobs (スケジューリング)
- ✅ Vercel Blob Storage (大容量ファイル)

---

## 次のステップ

1. ✅ 現在のアーキテクチャ分析（完了）
2. 📋 データスキーマの設計
3. 🏗️ Vercel完結型の詳細設計
4. 📅 段階的な移行計画
5. 💰 コスト見積もり
