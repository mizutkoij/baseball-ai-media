-- PostgreSQL Production Tuning for NPB Data Collection
-- 高負荷時のインデックス、ビュー、アラート設定

-- パフォーマンス最適化インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitch_events_game_date 
  ON pitch_events(game_id, DATE(timestamp));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitch_events_pitcher_type 
  ON pitch_events(pitcher_name, pitch_type) WHERE pitcher_name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitch_events_zone_coords 
  ON pitch_events(zone, plate_x, plate_z) WHERE plate_x IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_level_date 
  ON games(level, date) INCLUDE (game_id, farm_league);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_agg_recent
  ON player_aggregations(player_name, date) WHERE date > CURRENT_DATE - INTERVAL '30 days';

-- 複合インデックス（バックフィル時の重複チェック最適化）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pitch_events_dedup
  ON pitch_events(game_id, idx, pitch_no) INCLUDE (row_hash);

-- ファーム専用インデックス
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_farm_league_date
  ON games(farm_league, date) WHERE level = 'NPB2';

-- ====================================
-- リアルタイム監視ビュー
-- ====================================

-- 直近の収集活動サマリー
CREATE OR REPLACE VIEW v_recent_ingestion_summary AS
SELECT 
  level,
  farm_league,
  COUNT(DISTINCT game_id) as games_count,
  COUNT(*) as pitch_count,
  MIN(timestamp) as earliest_pitch,
  MAX(timestamp) as latest_pitch,
  AVG(CASE WHEN confidence = 'high' THEN 3 
           WHEN confidence = 'medium' THEN 2 
           ELSE 1 END) as avg_confidence_score
FROM pitch_events 
WHERE timestamp > NOW() - INTERVAL '6 hours'
GROUP BY level, farm_league
ORDER BY latest_pitch DESC;

-- ファーム投手の最新配球分析
CREATE OR REPLACE VIEW v_farm_pitcher_recent AS
SELECT 
  p.pitcher_name,
  g.farm_league,
  COUNT(*) as pitch_count,
  COUNT(DISTINCT p.game_id) as games_count,
  ROUND(AVG(p.speed_kmh), 1) as avg_velocity,
  STRING_AGG(DISTINCT p.pitch_type, ', ' ORDER BY p.pitch_type) as pitch_types,
  COUNT(*) FILTER (WHERE p.zone LIKE '%ストライク%') * 100.0 / COUNT(*) as strike_rate,
  MAX(p.timestamp) as last_seen
FROM pitch_events p
JOIN games g ON p.game_id = g.game_id
WHERE g.level = 'NPB2' 
  AND p.timestamp > CURRENT_DATE - INTERVAL '7 days'
  AND p.pitcher_name IS NOT NULL
GROUP BY p.pitcher_name, g.farm_league
HAVING COUNT(*) >= 10
ORDER BY last_seen DESC, pitch_count DESC;

-- システムヘルス監視
CREATE OR REPLACE VIEW v_system_health AS
SELECT 
  'ingestion_rate' as metric,
  COUNT(*) as value,
  'pitches_per_hour' as unit,
  CASE WHEN COUNT(*) > 100 THEN 'good'
       WHEN COUNT(*) > 20 THEN 'warning'
       ELSE 'poor' END as status
FROM pitch_events 
WHERE timestamp > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
  'data_freshness' as metric,
  EXTRACT(EPOCH FROM (NOW() - MAX(timestamp)))/60 as value,
  'minutes_since_last' as unit,
  CASE WHEN MAX(timestamp) > NOW() - INTERVAL '30 minutes' THEN 'good'
       WHEN MAX(timestamp) > NOW() - INTERVAL '2 hours' THEN 'warning'
       ELSE 'stale' END as status
FROM pitch_events
UNION ALL
SELECT 
  'duplicate_rate' as metric,
  COUNT(*) FILTER (WHERE row_hash IN (
    SELECT row_hash FROM pitch_events 
    GROUP BY row_hash HAVING COUNT(*) > 1
  )) * 100.0 / COUNT(*) as value,
  'percentage' as unit,
  CASE WHEN COUNT(*) FILTER (WHERE row_hash IN (
    SELECT row_hash FROM pitch_events 
    GROUP BY row_hash HAVING COUNT(*) > 1
  )) * 100.0 / COUNT(*) < 1 THEN 'good'
       WHEN COUNT(*) FILTER (WHERE row_hash IN (
    SELECT row_hash FROM pitch_events 
    GROUP BY row_hash HAVING COUNT(*) > 1
  )) * 100.0 / COUNT(*) < 5 THEN 'warning'
       ELSE 'high' END as status
FROM pitch_events
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- ====================================
-- アラート設定（PostgreSQL関数）
-- ====================================

-- アラート条件チェック関数
CREATE OR REPLACE FUNCTION check_ingestion_alerts()
RETURNS TABLE(alert_type text, message text, severity text) AS $$
BEGIN
  -- データの鮮度アラート
  RETURN QUERY
  SELECT 
    'data_freshness'::text,
    'データが ' || ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(timestamp)))/60) || ' 分間更新されていません'::text,
    CASE WHEN MAX(timestamp) < NOW() - INTERVAL '2 hours' THEN 'critical'
         WHEN MAX(timestamp) < NOW() - INTERVAL '1 hour' THEN 'warning'
         ELSE 'info' END::text
  FROM pitch_events
  WHERE timestamp > NOW() - INTERVAL '1 day'
  HAVING MAX(timestamp) < NOW() - INTERVAL '30 minutes';
  
  -- 重複率アラート
  RETURN QUERY
  SELECT 
    'duplicate_rate'::text,
    '重複率が ' || ROUND(duplicate_rate, 2) || '% です'::text,
    CASE WHEN duplicate_rate > 10 THEN 'critical'
         WHEN duplicate_rate > 5 THEN 'warning'
         ELSE 'info' END::text
  FROM (
    SELECT COUNT(*) FILTER (WHERE dup_count > 1) * 100.0 / COUNT(*) as duplicate_rate
    FROM (
      SELECT row_hash, COUNT(*) as dup_count
      FROM pitch_events 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY row_hash
    ) sub
  ) dup_stats
  WHERE duplicate_rate > 1;
  
  -- 収集レートアラート
  RETURN QUERY
  SELECT 
    'ingestion_rate'::text,
    '過去1時間の収集レートが ' || hourly_rate || ' 件/時です'::text,
    CASE WHEN hourly_rate < 10 THEN 'critical'
         WHEN hourly_rate < 50 THEN 'warning'
         ELSE 'info' END::text
  FROM (
    SELECT COUNT(*) as hourly_rate
    FROM pitch_events 
    WHERE timestamp > NOW() - INTERVAL '1 hour'
  ) rate_stats
  WHERE hourly_rate < 100;
  
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- 自動メンテナンス設定
-- ====================================

-- 古いデータのアーカイブ（月次実行想定）
CREATE OR REPLACE FUNCTION archive_old_pitch_data(cutoff_date date DEFAULT CURRENT_DATE - INTERVAL '2 years')
RETURNS integer AS $$
DECLARE
  archived_count integer;
BEGIN
  -- アーカイブテーブルに移動（なければ作成）
  CREATE TABLE IF NOT EXISTS pitch_events_archive (LIKE pitch_events INCLUDING ALL);
  
  -- データ移動
  WITH archived_data AS (
    DELETE FROM pitch_events 
    WHERE timestamp < cutoff_date
    RETURNING *
  )
  INSERT INTO pitch_events_archive SELECT * FROM archived_data;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  -- 統計情報更新
  ANALYZE pitch_events;
  ANALYZE pitch_events_archive;
  
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- バキューム・統計情報更新（日次実行想定）
CREATE OR REPLACE FUNCTION daily_maintenance()
RETURNS text AS $$
BEGIN
  -- インデックスの無効化チェック
  REINDEX TABLE CONCURRENTLY pitch_events;
  
  -- 統計情報更新
  ANALYZE pitch_events;
  ANALYZE games;
  ANALYZE player_aggregations;
  
  -- 重複データクリーンアップ
  DELETE FROM pitch_events 
  WHERE ctid NOT IN (
    SELECT MIN(ctid) 
    FROM pitch_events 
    GROUP BY game_id, idx, pitch_no
  );
  
  RETURN 'Daily maintenance completed at ' || NOW();
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- 使用例とコメント
-- ====================================

/*
-- アラートチェック実行
SELECT * FROM check_ingestion_alerts();

-- システムヘルス確認
SELECT * FROM v_system_health;

-- ファーム投手活動確認
SELECT * FROM v_farm_pitcher_recent LIMIT 10;

-- 直近収集サマリー
SELECT * FROM v_recent_ingestion_summary;

-- 日次メンテナンス実行
SELECT daily_maintenance();

-- 古いデータアーカイブ（2年前以前）
SELECT archive_old_pitch_data();

-- パフォーマンス問題調査
EXPLAIN (ANALYZE, BUFFERS) 
SELECT pitcher_name, COUNT(*) 
FROM pitch_events 
WHERE timestamp > NOW() - INTERVAL '1 day' 
GROUP BY pitcher_name;
*/

-- 権限設定例（読み取り専用ユーザー）
-- CREATE ROLE npb_readonly;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO npb_readonly;
-- GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO npb_readonly;
-- GRANT USAGE ON SCHEMA public TO npb_readonly;