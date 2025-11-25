
# NPBファーム SQL運用ランブック

## 日次実行クエリ

### 1. データ収集状況確認 (毎朝9時)
```sql
-- 前日のファーム投球データ件数
SELECT farm_league, COUNT(*) as pitch_count, COUNT(DISTINCT game_id) as games
FROM pitch_events p JOIN games g USING(game_id)
WHERE g.level = 'NPB2' AND DATE(timestamp) = CURRENT_DATE - 1
GROUP BY farm_league;
```

### 2. データ品質チェック (毎朝9:15)
```sql  
-- 欠損データ率確認
SELECT 
  'missing_pitcher' as metric,
  COUNT(*) FILTER (WHERE pitcher_name IS NULL) * 100.0 / COUNT(*) as percentage
FROM pitch_events p JOIN games g USING(game_id)
WHERE g.level = 'NPB2' AND timestamp > CURRENT_DATE - 1;
```

### 3. 昇格候補更新 (毎晩23時)
```sql
-- prospect_scores テーブル更新
INSERT INTO prospect_scores (pitcher_name, farm_league, score, updated_at)
SELECT pitcher_name, farm_league, calculated_score, NOW()
FROM (昇格候補分析クエリ) ON CONFLICT UPDATE SET score = EXCLUDED.score;
```

## 週次実行クエリ

### 1. パフォーマンストレンド分析 (月曜朝)
```sql
-- 週間投手パフォーマンス推移
WITH weekly_stats AS (
  SELECT pitcher_name, 
         DATE_TRUNC('week', timestamp) as week,
         AVG(speed_kmh) as avg_velocity
  FROM pitch_events p JOIN games g USING(game_id)
  WHERE g.level = 'NPB2' AND timestamp > CURRENT_DATE - 28
  GROUP BY pitcher_name, week
)
SELECT * FROM weekly_stats ORDER BY pitcher_name, week;
```

## アラートクエリ

### 1. データ遅延アラート
```sql
-- 2時間以上データ更新がない場合
SELECT 'DATA_DELAY' as alert_type, farm_league,
       EXTRACT(EPOCH FROM (NOW() - MAX(timestamp)))/3600 as hours_delay
FROM pitch_events p JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
GROUP BY farm_league
HAVING MAX(timestamp) < NOW() - INTERVAL '2 hours';
```

### 2. 重複データアラート
```sql
-- 重複率5%以上の場合
SELECT 'DUPLICATE_DATA' as alert_type,
       COUNT(*) FILTER (WHERE dup_count > 1) * 100.0 / COUNT(*) as duplicate_rate
FROM (SELECT row_hash, COUNT(*) as dup_count FROM pitch_events GROUP BY row_hash) t
HAVING duplicate_rate > 5;
```

## トラブルシューティング

### 遅いクエリの最適化
```sql
-- 実行計画確認
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;

-- インデックス使用状況確認
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes WHERE schemaname = 'public';
```

### データ修復
```sql
-- 重複データ削除
DELETE FROM pitch_events WHERE ctid NOT IN (
  SELECT MIN(ctid) FROM pitch_events GROUP BY game_id, idx, pitch_no
);
```
