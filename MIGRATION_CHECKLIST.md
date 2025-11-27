# Vercel完結型への移行チェックリスト

## ✅ Phase 0: 緊急修正
- [ ] Vercel Root Directory を `.` に変更
- [ ] 再デプロイして成功を確認

## ✅ Phase 1: Vercel準備 (所要時間: 1時間)

### 1.1 Vercel Pro Planにアップグレード
- [ ] https://vercel.com/account/billing にアクセス
- [ ] Pro Plan ($20/月) を選択
- [ ] 支払い情報を入力

### 1.2 Vercel Postgresをセットアップ
- [ ] Vercel Dashboard → Storage → Create Database
- [ ] "Postgres" を選択
- [ ] データベース名: `baseball-ai-media-db`
- [ ] リージョン: Washington, D.C. (iad1) - 既存と同じ
- [ ] 接続情報をコピー (.env.local に追加)

```bash
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."
```

### 1.3 Vercel Blob Storageをセットアップ
- [ ] Vercel Dashboard → Storage → Create Store
- [ ] "Blob" を選択
- [ ] ストア名: `baseball-ai-media-blob`
- [ ] トークンをコピー (.env.local に追加)

```bash
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

### 1.4 Vercel KV (Redis)をセットアップ
- [ ] Vercel Dashboard → Storage → Create Database
- [ ] "KV" を選択
- [ ] データベース名: `baseball-ai-media-cache`
- [ ] トークンをコピー (.env.local に追加)

```bash
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."
```

## ✅ Phase 2: データ移行準備 (所要時間: 2-3時間)

### 2.1 データベーススキーマ設計
- [ ] スキーマファイル作成 (`prisma/schema.prisma`)
- [ ] マイグレーションファイル生成

### 2.2 VPSからデータエクスポート
```bash
# SSH接続
ssh -i sever/BSaitest1.key ubuntu@133.18.115.175

# SQLiteエクスポート
cd /opt/baseball-ai-media
sqlite3 comprehensive_baseball_database.db .dump > dump.sql
sqlite3 data/npb.db .dump > npb_dump.sql

# ローカルにダウンロード
scp -i sever/BSaitest1.key ubuntu@133.18.115.175:/opt/baseball-ai-media/*.sql ./migration/
```

### 2.3 JSONファイルのサンプリング
- [ ] 代表的なJSONファイルを分析
- [ ] スキーマ設計に反映

## ✅ Phase 3: 実装 (所要時間: 3-4日)

### 3.1 データベース接続の実装
- [ ] `lib/db.ts` を書き換え（Postgres接続）
- [ ] Prisma Clientセットアップ
- [ ] 接続プーリング設定

### 3.2 API Routesの書き換え
各APIを順次Postgres対応に：
- [ ] `/api/players/[id]/detailed-stats/route.ts`
- [ ] `/api/games/[gameId]/route.ts`
- [ ] `/api/stats/batting/route.ts`
- [ ] `/api/stats/pitching/route.ts`
- [ ] その他15個のAPI

### 3.3 Yahoo scraperの移植
- [ ] `app/api/cron/scrape-yahoo/route.ts` 作成
- [ ] TypeScript + Cheerio で実装
- [ ] Cron Job設定 (vercel.json)
- [ ] エラーハンドリング・リトライ実装

### 3.4 Blob Storageへのアップロード
```bash
# 移行スクリプト作成
npx tsx scripts/migrate-to-blob.ts

# 実行
npm run migrate:blob
```

## ✅ Phase 4: テスト (所要時間: 1-2日)

### 4.1 ローカルテスト
- [ ] `.env.local` に全ての環境変数を設定
- [ ] `npm run dev` でローカル起動
- [ ] 各APIエンドポイントをテスト

### 4.2 Vercel Preview環境テスト
- [ ] ブランチ作成: `feat/vercel-migration`
- [ ] Push してPreview Deploymentを生成
- [ ] 全機能をテスト

### 4.3 パフォーマンステスト
- [ ] ページ読み込み速度
- [ ] API レスポンスタイム
- [ ] Cron Job実行確認

## ✅ Phase 5: 本番移行 (所要時間: 4時間)

### 5.1 データ移行実行
```bash
# Postgresにインポート
psql $POSTGRES_URL < migration/dump.sql

# Blob Storageにアップロード
npm run migrate:blob:production
```

### 5.2 本番デプロイ
- [ ] `main` ブランチにマージ
- [ ] 自動デプロイ完了を確認
- [ ] 環境変数が正しく設定されているか確認

### 5.3 動作確認
- [ ] 全ページが正しく表示されるか
- [ ] API が正常に動作するか
- [ ] Cron Jobが実行されているか

### 5.4 モニタリング設定
- [ ] Vercel Analytics有効化
- [ ] エラー通知設定
- [ ] ログ確認

## ✅ Phase 6: VPS廃止 (所要時間: 2週間監視 + 1日)

### 6.1 2週間監視期間
- [ ] 毎日エラーログを確認
- [ ] パフォーマンスをモニタリング
- [ ] 問題があればロールバック可能

### 6.2 VPS段階的停止
```bash
# PM2プロセス停止
ssh -i sever/BSaitest1.key ubuntu@133.18.115.175
pm2 stop all
pm2 delete all

# systemdサービス停止
sudo systemctl stop baseball-api.service
sudo systemctl stop yahoo-scraper.service
sudo systemctl disable baseball-api.service
sudo systemctl disable yahoo-scraper.service

# nginxは一旦残す（リダイレクト用）
```

### 6.3 最終バックアップ
```bash
# 全データをローカルにバックアップ
scp -r -i sever/BSaitest1.key ubuntu@133.18.115.175:/opt/baseball-ai-media ./backup/vps-final-backup/
```

### 6.4 VPS完全停止
- [ ] 1ヶ月後、問題なければVPS解約
- [ ] ドキュメント更新

## 📊 進捗トラッキング

- [ ] Phase 0: 緊急修正 (完了: 0%)
- [ ] Phase 1: Vercel準備 (完了: 0%)
- [ ] Phase 2: データ移行準備 (完了: 0%)
- [ ] Phase 3: 実装 (完了: 0%)
- [ ] Phase 4: テスト (完了: 0%)
- [ ] Phase 5: 本番移行 (完了: 0%)
- [ ] Phase 6: VPS廃止 (完了: 0%)

**全体進捗: 0%**

---

## 🆘 トラブルシューティング

### デプロイ失敗
→ ビルドログを確認、環境変数をチェック

### データベース接続エラー
→ 接続文字列を確認、IPホワイトリスト設定

### Cron Job動作しない
→ vercel.json の設定確認、ログ確認

### パフォーマンス低下
→ クエリ最適化、インデックス追加、キャッシュ活用
