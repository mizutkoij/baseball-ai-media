# 投票システム本番運用硬化 - 完全実装

## 🎯 硬化内容

### 1. JST日付固定（日付またぎ誤判定防止）
✅ `vote_day_jst` 列追加  
✅ Asia/Tokyo タイムゾーン基準の日付管理  
✅ 既存データの自動マイグレーション  

### 2. 強化されたユニーク制約  
✅ **認証済み投票者** (`voter_key` 有り): `UNIQUE(player_id, vote_day_jst, voter_key)`  
✅ **匿名投票者** (`voter_key` 無し): `UNIQUE(player_id, vote_day_jst, ip_hash)`  
✅ 同時アクセス時の重複防止保証  

### 3. Materialized View 集計（高速化）
✅ **今日のランキング**: `vote_leaderboard_today_mv`  
✅ **7日間ランキング**: `vote_leaderboard_7d_mv`  
✅ 非ブロッキング更新機能  
✅ 30秒〜1分間隔でのリフレッシュ対応  

### 4. TypeScript レート制限
✅ **投票API**: 1分間に6回まで  
✅ **ランキング取得**: 1分間に30回まで  
✅ LRU-cache ベースの軽量実装  
✅ Prometheus メトリクス統合  

## 🚀 デプロイコマンド

### データベース硬化
```bash
# 本番硬化スキーマ適用
npm run vote:harden

# 動作確認
npm run vote:test
```

### 並行性テスト
```bash
# 通常テスト（50並列）
npm run vote:test

# 高負荷テスト（100並列）
npm run vote:test:heavy
```

### メトリクス監視
```bash
# メトリクス収集開始
npm run vote:metrics:start

# 手動更新
npm run vote:metrics:update

# 詳細レポート
npm run vote:metrics:details
```

## 📊 パフォーマンス指標

### 🎯 目標性能
- **投票レスポンス**: < 200ms (95%tile)
- **ランキング取得**: < 100ms (95%tile)  
- **重複防止**: 100% (並行アクセス時)
- **可用性**: > 99.9%

### 📈 期待スループット
- **投票**: 100 req/min/IP
- **ランキング**: 1800 req/min/IP  
- **同時ユーザー**: 1000+ concurrent

## 🔒 セキュリティ強化

### 不正対策
✅ **IP ハッシュ化**: SHA-256 + ソルト  
✅ **重複検出**: `suspicious_voting_activity` ビュー  
✅ **レート制限**: 多段階制御  
✅ **監視ログ**: Prometheus メトリクス  

### プライバシー保護
✅ IP アドレスは保存せず、ハッシュ化のみ  
✅ `voter_key` による永続化（オプション）  
✅ セッション管理の適切な実装  

## 🧪 テスト・検証

### 並行性テスト結果例
```bash
📊 Phase 1: 同一voter_keyでの重複防止テスト
   ✅ 成功: 1 / 50
   🔄 重複拒否: 49
   ⚠️ レート制限: 0
   ❌ エラー: 0

📊 Phase 2: 異なるvoter_keyでの並行投票テスト  
   ✅ 成功: 20 / 20
   🔄 重複拒否: 0
   ⚠️ レート制限: 0
   ❌ エラー: 0

📊 Phase 3: データベース整合性確認
   ✅ データベース整合性: OK
   ✅ 重複防止: OK (重複なし)
```

## 🎛️ 運用コマンド

### 日次運用
```bash
# 集計更新（0時実行推奨）
npm run vote:summary

# MV手動リフレッシュ
psql "$PGURL" -c "SELECT refresh_vote_leaderboards()"

# 不正検出確認
psql "$PGURL" -c "SELECT * FROM suspicious_voting_activity WHERE vote_day_jst = CURRENT_DATE"
```

### 監視・アラート
```bash
# API健康状態
curl -s localhost:3000/api/vote | jq .rateLimitInfo

# DB接続プール状態
psql "$PGURL" -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state"

# レート制限状況
npm run vote:metrics:details | jq .rate_limiting
```

## 🔧 運用設定

### 環境変数
```bash
# 必須
DATABASE_URL="postgresql://..."
PGURL="postgresql://..."

# オプション  
IP_SALT="your-secret-salt"
NODE_ENV="production"
```

### PostgreSQL設定推奨値
```sql
-- 接続プール
max_connections = 200
shared_buffers = 256MB

-- MV更新用
work_mem = 64MB
maintenance_work_mem = 256MB

-- WAL設定
wal_buffers = 16MB
checkpoint_completion_target = 0.9
```

## 📋 チェックリスト

### デプロイ前確認
- [ ] `npm run vote:harden` 実行済み
- [ ] `npm run vote:test` 全PASS
- [ ] 環境変数設定確認
- [ ] PostgreSQL性能調整済み

### 本番監視
- [ ] メトリクス収集開始済み
- [ ] アラート設定済み
- [ ] ログ監視設定済み
- [ ] バックアップ確認済み

### 定期メンテナンス
- [ ] 日次集計cron設定
- [ ] 古いログデータ削除設定
- [ ] 不正検出レポート確認
- [ ] パフォーマンス指標確認

## 🎉 完成状態

投票システムが **本番運用レベル** まで硬化完了：

✅ **日付またぎ対応** (JST基準)  
✅ **重複防止保証** (voter_key + IP)  
✅ **高速ランキング** (MV集計)  
✅ **レート制限** (多段階)  
✅ **メトリクス監視** (Prometheus)  
✅ **並行性テスト** (50-100並列OK)  
✅ **運用コマンド** (完全自動化)

**Ready for Production! 🚀**