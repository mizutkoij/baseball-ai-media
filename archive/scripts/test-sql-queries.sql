-- NPB Farm League SQL動作確認クエリ集
-- 本番投入前のデータ取得・分析クエリテスト

-- =============================================
-- 1. 直近のファーム投球件数確認
-- =============================================

-- 時間別ファーム投球件数（直近12時間）
SELECT 
  date_trunc('hour', timestamp) as hour,
  level,
  farm_league,
  COUNT(*) as pitch_count,
  COUNT(DISTINCT game_id) as game_count,
  COUNT(DISTINCT pitcher_name) as pitcher_count
FROM pitch_events p 
JOIN games g USING(game_id)
WHERE g.level = 'NPB2' 
  AND timestamp > NOW() - INTERVAL '12 hours'
GROUP BY 1, 2, 3 
ORDER BY 1 DESC;

-- 日別ファーム投球集計（直近7日）
SELECT 
  DATE(timestamp) as date,
  farm_league,
  COUNT(*) as total_pitches,
  COUNT(DISTINCT game_id) as games,
  COUNT(DISTINCT pitcher_name) as pitchers,
  ROUND(AVG(speed_kmh), 1) as avg_velocity,
  COUNT(*) FILTER (WHERE zone LIKE '%ストライク%') * 100.0 / COUNT(*) as strike_rate
FROM pitch_events p
JOIN games g USING(game_id) 
WHERE g.level = 'NPB2'
  AND timestamp > CURRENT_DATE - INTERVAL '7 days'
  AND speed_kmh > 0
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- =============================================
-- 2. 投手の直近配球分析（学習前処理用）
-- =============================================

-- 投手別配球パターン（最低30球以上の投手）
SELECT 
  pitcher_name,
  farm_league,
  pitch_type,
  COUNT(*) as pitch_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY pitcher_name, farm_league), 1) as percentage,
  ROUND(AVG(speed_kmh), 1) as avg_velocity,
  ROUND(MIN(speed_kmh), 1) as min_velocity,
  ROUND(MAX(speed_kmh), 1) as max_velocity,
  COUNT(DISTINCT game_id) as games_used
FROM pitch_events p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
  AND timestamp > CURRENT_DATE - INTERVAL '30 days'
  AND pitcher_name IS NOT NULL
  AND pitch_type IS NOT NULL
  AND speed_kmh > 0
GROUP BY pitcher_name, farm_league, pitch_type
HAVING COUNT(*) >= 5  -- 最低5球以上
ORDER BY pitcher_name, farm_league, pitch_count DESC;

-- 投手別ゾーン攻略パターン
SELECT 
  pitcher_name,
  farm_league,
  zone,
  COUNT(*) as pitch_count,
  ROUND(AVG(speed_kmh), 1) as avg_velocity,
  STRING_AGG(DISTINCT pitch_type, ', ' ORDER BY pitch_type) as pitch_types_used,
  COUNT(*) FILTER (WHERE result_code LIKE '%ストライク%') as strikes,
  COUNT(*) FILTER (WHERE result_code LIKE '%ボール%') as balls
FROM pitch_events p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
  AND timestamp > CURRENT_DATE - INTERVAL '14 days'
  AND pitcher_name IS NOT NULL
  AND zone IS NOT NULL
GROUP BY pitcher_name, farm_league, zone
HAVING COUNT(*) >= 3
ORDER BY pitcher_name, farm_league, pitch_count DESC;

-- =============================================
-- 3. チーム別分析クエリ
-- =============================================

-- ファームチーム別投手陣分析
SELECT 
  farm_league,
  COUNT(DISTINCT pitcher_name) as pitcher_count,
  COUNT(*) as total_pitches,
  ROUND(AVG(speed_kmh), 1) as team_avg_velocity,
  COUNT(*) FILTER (WHERE speed_kmh >= 140) * 100.0 / COUNT(*) as velocity_140plus_rate,
  COUNT(DISTINCT pitch_type) as pitch_variety,
  COUNT(*) FILTER (WHERE zone LIKE '%ストライク%') * 100.0 / COUNT(*) as team_strike_rate
FROM pitch_events p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
  AND timestamp > CURRENT_DATE - INTERVAL '30 days'
  AND speed_kmh > 0
GROUP BY farm_league
ORDER BY team_avg_velocity DESC;

-- =============================================
-- 4. 昇格候補分析クエリ
-- =============================================

-- 昇格候補投手リスト（高パフォーマンス投手）
WITH pitcher_performance AS (
  SELECT 
    pitcher_name,
    farm_league,
    COUNT(*) as total_pitches,
    COUNT(DISTINCT game_id) as games_pitched,
    ROUND(AVG(speed_kmh), 1) as avg_velocity,
    COUNT(*) FILTER (WHERE zone LIKE '%ストライク%') * 100.0 / COUNT(*) as strike_rate,
    COUNT(DISTINCT pitch_type) as pitch_variety,
    STDDEV(speed_kmh) as velocity_consistency,
    MAX(timestamp) as last_appearance
  FROM pitch_events p
  JOIN games g USING(game_id)
  WHERE g.level = 'NPB2'
    AND timestamp > CURRENT_DATE - INTERVAL '60 days'
    AND pitcher_name IS NOT NULL
    AND speed_kmh > 0
  GROUP BY pitcher_name, farm_league
  HAVING COUNT(*) >= 50  -- 最低50球以上
)
SELECT 
  pitcher_name,
  farm_league,
  total_pitches,
  games_pitched,
  avg_velocity,
  ROUND(strike_rate, 1) as strike_rate,
  pitch_variety,
  ROUND(velocity_consistency, 1) as velocity_consistency,
  last_appearance,
  -- 昇格スコア計算（簡易版）
  ROUND(
    (LEAST(avg_velocity / 140, 1) * 30) +  -- 球速スコア (30点満点)
    (strike_rate / 65 * 25) +             -- 制球スコア (25点満点) 
    (LEAST(pitch_variety / 4, 1) * 20) +  -- 球種スコア (20点満点)
    (GREATEST(0, 1 - velocity_consistency/10) * 25)  -- 安定性スコア (25点満点)
  , 1) as promotion_score
FROM pitcher_performance
WHERE games_pitched >= 3
ORDER BY promotion_score DESC, last_appearance DESC
LIMIT 20;

-- =============================================
-- 5. データ品質確認クエリ
-- =============================================

-- データ完整性チェック
SELECT 
  'total_records' as metric,
  COUNT(*) as value,
  'records' as unit
FROM pitch_events p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
  AND timestamp > CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT 
  'missing_pitcher_name' as metric,
  COUNT(*) as value,
  'records' as unit
FROM pitch_events p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
  AND timestamp > CURRENT_DATE - INTERVAL '7 days'
  AND pitcher_name IS NULL

UNION ALL

SELECT 
  'missing_speed_data' as metric,
  COUNT(*) as value, 
  'records' as unit
FROM pitch_events p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
  AND timestamp > CURRENT_DATE - INTERVAL '7 days'
  AND (speed_kmh IS NULL OR speed_kmh <= 0)

UNION ALL

SELECT 
  'missing_coordinates' as metric,
  COUNT(*) as value,
  'records' as unit  
FROM pitch_events p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
  AND timestamp > CURRENT_DATE - INTERVAL '7 days'
  AND (plate_x IS NULL OR plate_z IS NULL)

UNION ALL

SELECT 
  'duplicate_pitches' as metric,
  COUNT(*) as value,
  'records' as unit
FROM (
  SELECT row_hash, COUNT(*) as dup_count
  FROM pitch_events p
  JOIN games g USING(game_id) 
  WHERE g.level = 'NPB2'
    AND timestamp > CURRENT_DATE - INTERVAL '7 days'
  GROUP BY row_hash
  HAVING COUNT(*) > 1
) duplicates;

-- =============================================
-- 6. リアルタイム監視クエリ
-- =============================================

-- 最新データの鮮度確認
SELECT 
  farm_league,
  MAX(timestamp) as latest_data,
  EXTRACT(EPOCH FROM (NOW() - MAX(timestamp)))/60 as minutes_since_latest,
  COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour') as last_hour_pitches
FROM pitch_events p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
  AND timestamp > CURRENT_DATE - INTERVAL '1 day'
GROUP BY farm_league
ORDER BY latest_data DESC;

-- アクティブゲーム監視
SELECT 
  game_id,
  farm_league,
  COUNT(*) as pitch_count,
  MAX(timestamp) as latest_pitch,
  COUNT(DISTINCT pitcher_name) as pitcher_count,
  EXTRACT(EPOCH FROM (NOW() - MAX(timestamp)))/60 as minutes_since_latest
FROM pitch_events p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
  AND timestamp > CURRENT_DATE
  AND timestamp > NOW() - INTERVAL '6 hours'
GROUP BY game_id, farm_league
HAVING MAX(timestamp) > NOW() - INTERVAL '2 hours'
ORDER BY latest_pitch DESC;

-- =============================================
-- 使用例コメント
-- =============================================

/*
本番データベースでの実行例:

-- 1. 毎時実行: データ収集状況確認
SELECT * FROM pitch_events WHERE timestamp > NOW() - INTERVAL '1 hour';

-- 2. 日次実行: データ品質レポート
\copy (SELECT * FROM データ品質確認クエリ) TO 'daily_quality_report.csv' CSV HEADER;

-- 3. 週次実行: 昇格候補分析
\copy (SELECT * FROM 昇格候補投手リスト) TO 'weekly_prospect_report.csv' CSV HEADER;

-- 4. パフォーマンス確認
EXPLAIN (ANALYZE, BUFFERS) SELECT ... -- 任意のクエリでパフォーマンステスト

*/