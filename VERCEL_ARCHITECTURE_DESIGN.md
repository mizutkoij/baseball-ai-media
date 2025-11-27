# Vercel完結型アーキテクチャ - 詳細設計

## 🎯 設計目標

- **シンプル**: 1つのプラットフォーム (Vercel) で完結
- **安定**: マネージドサービス、自動スケーリング
- **高速**: エッジ配信、最適化されたクエリ
- **低コスト**: サーバーレス、従量課金

## 🏗️ 新アーキテクチャ

```
┌─────────────────────────────────────────────┐
│           Vercel Platform                    │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │   Next.js 14 App Router              │   │
│  │   ├─ SSR/SSG Pages                   │   │
│  │   ├─ Client Components               │   │
│  │   └─ Edge Runtime (Optional)         │   │
│  └──────────────────────────────────────┘   │
│                ↓                             │
│  ┌──────────────────────────────────────┐   │
│  │   API Routes (Serverless Functions)  │   │
│  │   ├─ /api/players/*                  │   │
│  │   ├─ /api/games/*                    │   │
│  │   ├─ /api/stats/*                    │   │
│  │   └─ /api/cron/* (Internal)          │   │
│  └──────────────────────────────────────┘   │
│                ↓                             │
│  ┌──────────────────────────────────────┐   │
│  │   Data Layer                         │   │
│  │   ├─ Vercel Postgres (Primary DB)    │   │
│  │   ├─ Vercel Blob (Large files)       │   │
│  │   └─ Vercel KV (Cache)               │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │   Scheduled Jobs                     │   │
│  │   ├─ Vercel Cron (スクレイピング)    │   │
│  │   └─ Vercel Cron (データ更新)        │   │
│  └──────────────────────────────────────┘   │
│                                              │
└─────────────────────────────────────────────┘
         ↓ External
    Yahoo Baseball (スクレイピング対象)
```

## 📦 データ移行戦略

### 1. JSONファイル (1.4GB, 95,364 files)

**現状の問題:**
- 95,364個の個別JSONファイル
- ファイルシステムI/O遅延
- 検索・集計が困難

**解決策A: Vercel Postgres に正規化して格納**
```sql
-- 選手マスタ
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(50) UNIQUE,
  name VARCHAR(100),
  team VARCHAR(50),
  year INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 選手統計 (正規化)
CREATE TABLE player_stats (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(50) REFERENCES players(player_id),
  stat_type VARCHAR(50), -- 'basic_info', 'day_night', 'monthly', etc.
  stat_key VARCHAR(100),
  stat_value JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_player_stat (player_id, stat_type)
);
```

**利点:**
- ✅ 高速検索・集計
- ✅ トランザクション保証
- ✅ インデックス活用
- ✅ 自動バックアップ

**欠点:**
- ❌ 移行に時間がかかる (95,364 files → DB insert)
- ❌ JSONB のクエリが複雑になる可能性

**解決策B: Vercel Blob Storage に格納**
```typescript
// 選手統計をBlob Storageに保存
import { put, list } from '@vercel/blob';

// アップロード
await put(`players/2025/広島/44_林晃汰/basic_info.json`,
  JSON.stringify(data),
  { access: 'public' }
);

// 読み込み
const url = `https://[blob-storage-url]/players/2025/広島/44_林晃汰/basic_info.json`;
const response = await fetch(url);
const data = await response.json();
```

**利点:**
- ✅ 移行が簡単 (ファイルをそのままアップロード)
- ✅ CDN配信で高速
- ✅ 大容量に対応

**欠点:**
- ❌ 検索・集計が困難
- ❌ トランザクションなし

**推奨: ハイブリッド方式**
```
- 頻繁にアクセスするデータ → Postgres (player_id, name, team, 基本統計)
- 詳細統計JSON → Blob Storage (そのまま保存)
- キャッシュ → Vercel KV (Redis)
```

### 2. SQLiteデータベース (~10MB)

**移行方法:**
```bash
# 1. VPSからSQLiteをエクスポート
sqlite3 comprehensive_baseball_database.db .dump > dump.sql

# 2. PostgreSQL形式に変換
sed -i 's/AUTOINCREMENT/SERIAL/g' dump.sql

# 3. Vercel Postgresにインポート
psql $POSTGRES_URL < dump.sql
```

### 3. Yahooスクレイピング (Python)

**現状:**
```python
# yahoo_scraper_production_ready.py
- BeautifulSoup でHTMLパース
- SQLiteに保存
- PM2で継続実行
```

**Vercel版の実装:**

**Option A: TypeScript + Cheerio**
```typescript
// app/api/cron/scrape-yahoo/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request: Request) {
  // Vercel Cron Jobsから呼ばれる
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = 'https://baseball.yahoo.co.jp/npb/game/...';
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  // データ抽出
  const pitches = [];
  $('table.bb-splitsTable tbody tr').each((i, row) => {
    // ...
  });

  // Vercel Postgresに保存
  await saveToDB(pitches);

  return NextResponse.json({ success: true, count: pitches.length });
}
```

**vercel.json**
```json
{
  "crons": [{
    "path": "/api/cron/scrape-yahoo",
    "schedule": "*/30 * * * *"  // 30分ごと
  }]
}
```

**Option B: Upstash Workflow (推奨)**
```typescript
import { serve } from "@upstash/workflow/nextjs"

export const { POST } = serve(async (context) => {
  // 長時間実行可能 (最大1時間)
  // 自動リトライ
  // 進捗トラッキング

  const games = await context.run("fetch-games", async () => {
    return await fetchGames();
  });

  for (const game of games) {
    await context.run(`scrape-${game.id}`, async () => {
      return await scrapeGame(game);
    });
  }
});
```

## 🚀 Vercel機能の活用

### 1. Vercel Postgres
- **容量**: 256MB (Free) → 512GB (Pro)
- **接続**: Pooling サポート
- **バックアップ**: 自動
- **価格**: $0.10/GB/月 + $0.10/1M reads

### 2. Vercel Blob Storage
- **容量**: 無制限
- **CDN**: グローバル配信
- **価格**: $0.15/GB/月 + $2/1K writes

### 3. Vercel KV (Redis)
- **容量**: 256MB (Hobby) → 1GB+ (Pro)
- **用途**: キャッシュ、セッション
- **価格**: $0.20/100K commands

### 4. Vercel Cron Jobs
- **実行間隔**: 1分 〜 月次
- **タイムアウト**: 15秒 (Hobby) → 5分 (Pro)
- **価格**: 無料 (Pro planに含まれる)

## 💰 コスト見積もり

### 現在のコスト (VPS)
```
VPS (133.18.115.175)
- サーバー代: 不明
- メンテナンス工数: 月10時間? × 人件費
```

### Vercel移行後のコスト

**Pro Plan ($20/月) 含まれるもの:**
- 100GB Bandwidth
- Serverless Function実行
- Preview Deployments
- Cron Jobs

**追加コスト (データ量による):**
```
Vercel Postgres:
- ストレージ: 1GB × $0.10 = $0.10/月
- Read: 1M reads × $0.10 = $0.10/月

Vercel Blob:
- ストレージ: 2GB × $0.15 = $0.30/月
- Writes: 10K × $2 = $0.02/月

Vercel KV:
- Commands: 1M × $0.20 = $2.00/月

合計: $20 + $2.52 = 約 $22.52/月 (約3,200円)
```

**削減できるコスト:**
- ✅ VPS月額費用
- ✅ メンテナンス工数
- ✅ SSL証明書更新
- ✅ サーバー監視

## 📅 移行タイムライン

### Phase 1: 準備 (1日)
- [ ] Vercel Pro Planにアップグレード
- [ ] Vercel Postgresセットアップ
- [ ] Vercel Blob Storageセットアップ
- [ ] 環境変数設定

### Phase 2: データ移行 (2-3日)
- [ ] SQLiteデータをPostgresに移行
- [ ] JSON filesをBlob Storageに移行
- [ ] データ整合性チェック

### Phase 3: API実装 (2-3日)
- [ ] `/api/players/*` をPostgres接続に書き換え
- [ ] Yahoo scraperをTypeScriptに移植
- [ ] Cron Jobs設定

### Phase 4: テスト (1-2日)
- [ ] 全APIエンドポイントテスト
- [ ] スクレイピング動作確認
- [ ] パフォーマンステスト

### Phase 5: 本番移行 (1日)
- [ ] Vercel本番デプロイ
- [ ] DNS切り替え (必要な場合)
- [ ] VPSサービス停止

### Phase 6: VPS廃止 (1日)
- [ ] 2週間監視
- [ ] VPS完全シャットダウン
- [ ] ドキュメント更新

**合計: 7-10日**

## ✅ 次のアクション

まず緊急の問題を解決:
1. **Vercel Root Directory を修正** (5分)
   - Settings → General → Root Directory を `.` に変更

その後、移行を開始:
2. **Vercel Pro Planにアップグレード**
3. **Phase 1 から順次実施**
