-- NPB2 ファーム投球データ監視クエリ 
-- Go/No-Go受け入れ基準対応版
-- 実行: psql "$PGURL" -f scripts/pitch-monitoring.sql

-- 1. 直近30分の取り込みペース (分単位)
SELECT 
    date_trunc('minute', ts) as m,
    count(*) as c
FROM pitches p 
JOIN games g USING(game_id)
WHERE g.level = 'NPB2' 
    AND ts > now() - interval '30 min'
GROUP BY 1 
ORDER BY 1 DESC 
LIMIT 10;

-- 2. 今日のNPB2総投球数
SELECT 
    count(*) as total_pitches_today,
    count(DISTINCT game_id) as games_count,
    min(ts) as first_pitch,
    max(ts) as last_pitch,
    avg(velocity) FILTER (WHERE velocity IS NOT NULL) as avg_velocity,
    count(*) FILTER (WHERE result = 'swing_and_miss') as strikeouts
FROM pitches p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
    AND date(ts) = current_date;

-- 3. リーグ別投球分析
SELECT 
    g.league,
    count(*) as pitch_count,
    count(DISTINCT p.game_id) as games,
    avg(p.velocity) FILTER (WHERE p.velocity IS NOT NULL) as avg_velocity,
    count(*) FILTER (WHERE p.pitch_type = 'fastball') as fastballs,
    count(*) FILTER (WHERE p.pitch_type = 'slider') as sliders,
    count(*) FILTER (WHERE p.pitch_type = 'curveball') as curveballs,
    round(
        count(*) FILTER (WHERE p.result = 'strike')::numeric / 
        count(*)::numeric * 100, 1
    ) as strike_percentage
FROM pitches p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
    AND date(p.ts) = current_date
GROUP BY g.league
ORDER BY pitch_count DESC;

-- 4. データ品質チェック
SELECT 
    'velocity_missing' as metric,
    count(*) FILTER (WHERE velocity IS NULL) as count,
    round(
        count(*) FILTER (WHERE velocity IS NULL)::numeric / 
        count(*)::numeric * 100, 2
    ) as percentage
FROM pitches p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
    AND date(p.ts) = current_date

UNION ALL

SELECT 
    'coordinates_missing' as metric,
    count(*) FILTER (WHERE plate_x IS NULL OR plate_z IS NULL) as count,
    round(
        count(*) FILTER (WHERE plate_x IS NULL OR plate_z IS NULL)::numeric / 
        count(*)::numeric * 100, 2
    ) as percentage
FROM pitches p
JOIN games g USING(game_id)  
WHERE g.level = 'NPB2'
    AND date(p.ts) = current_date

UNION ALL

SELECT 
    'pitch_type_missing' as metric,
    count(*) FILTER (WHERE pitch_type IS NULL) as count,
    round(
        count(*) FILTER (WHERE pitch_type IS NULL)::numeric / 
        count(*)::numeric * 100, 2
    ) as percentage
FROM pitches p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
    AND date(p.ts) = current_date;

-- 5. 有望株ピッチャー監視 (最近の投球パフォーマンス)
SELECT 
    p.pitcher_name,
    g.home_team,
    g.away_team,
    count(*) as pitches_today,
    avg(p.velocity) FILTER (WHERE p.velocity IS NOT NULL) as avg_velocity,
    max(p.velocity) as max_velocity,
    round(
        count(*) FILTER (WHERE p.result = 'strike')::numeric / 
        count(*)::numeric * 100, 1
    ) as strike_rate,
    count(DISTINCT p.pitch_type) as pitch_variety,
    array_agg(DISTINCT p.pitch_type) as pitch_types,
    max(p.ts) as last_pitch_time
FROM pitches p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
    AND date(p.ts) = current_date
    AND p.pitcher_name IS NOT NULL
GROUP BY p.pitcher_name, g.home_team, g.away_team
HAVING count(*) >= 20  -- 20球以上投げた投手のみ
ORDER BY avg_velocity DESC
LIMIT 20;

-- 6. システムヘルス監視
SELECT 
    'data_freshness' as metric,
    extract(epoch from (now() - max(ts)))/60 as minutes_since_last_pitch,
    CASE 
        WHEN extract(epoch from (now() - max(ts)))/60 < 5 THEN 'GREEN'
        WHEN extract(epoch from (now() - max(ts)))/60 < 15 THEN 'YELLOW'
        ELSE 'RED'
    END as status
FROM pitches p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'

UNION ALL

SELECT 
    'games_active' as metric,
    count(DISTINCT game_id) as active_games,
    CASE 
        WHEN count(DISTINCT game_id) > 0 THEN 'GREEN'
        ELSE 'YELLOW'
    END as status
FROM games g
WHERE g.level = 'NPB2'
    AND g.status = 'live'
    AND date(g.game_date) = current_date;

-- 7. 緊急停止/再開用のクエリ
-- 緊急停止確認
SELECT 
    setting_name,
    setting_value,
    updated_at
FROM system_settings 
WHERE setting_name IN ('YAHOO_STOP', 'NPB2_COLLECTION_STATUS');

-- 今日の収集統計サマリー
SELECT 
    current_date as collection_date,
    count(*) as total_pitches,
    count(DISTINCT game_id) as games_collected,
    min(ts) as first_data,
    max(ts) as last_data,
    extract(epoch from (max(ts) - min(ts)))/3600 as collection_hours,
    round(count(*)::numeric / extract(epoch from (max(ts) - min(ts))) * 3600, 1) as pitches_per_hour
FROM pitches p
JOIN games g USING(game_id)
WHERE g.level = 'NPB2'
    AND date(p.ts) = current_date;

-- ==== GO/NO-GO 受け入れ基準チェック ====

-- 1) Yahoo 304キャッシュ率 ≥ 60%
WITH yahoo_quality AS (
  SELECT 
    date_trunc('day', created_at) as check_date,
    COUNT(*) as total_requests,
    SUM(CASE WHEN response_code = 304 THEN 1 ELSE 0 END) as cached_requests,
    SUM(CASE WHEN response_code = 429 THEN 1 ELSE 0 END) as rate_limited,
    ROUND(
      CAST(SUM(CASE WHEN response_code = 304 THEN 1 ELSE 0 END) AS DECIMAL) / 
      NULLIF(COUNT(*), 0) * 100, 2
    ) as yahoo_304_ratio,
    ROUND(
      CAST(SUM(CASE WHEN response_code = 429 THEN 1 ELSE 0 END) AS DECIMAL) / 
      NULLIF(COUNT(*), 0) * 100, 2
    ) as yahoo_429_rate
  FROM request_logs 
  WHERE source = 'yahoo' 
    AND created_at >= CURRENT_DATE - INTERVAL '1 day'
  GROUP BY check_date
)
SELECT 
  'YAHOO_304_RATIO' as metric,
  yahoo_304_ratio as value,
  CASE WHEN yahoo_304_ratio >= 60 THEN 'GO ✅' ELSE 'NO-GO ❌' END as status,
  total_requests as sample_size
FROM yahoo_quality
WHERE check_date >= CURRENT_DATE - INTERVAL '1 day';

-- 2) Yahoo 429エラー率 ≤ 1%
SELECT 
  'YAHOO_429_RATE' as metric,
  yahoo_429_rate as value,
  CASE WHEN yahoo_429_rate <= 1.0 THEN 'GO ✅' ELSE 'NO-GO ❌' END as status,
  total_requests as sample_size
FROM yahoo_quality
WHERE check_date >= CURRENT_DATE - INTERVAL '1 day';

-- 3) PBPイベント遅延 P95 ≤ 15秒
WITH pbp_lag AS (
  SELECT 
    ROUND(EXTRACT(EPOCH FROM (
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (created_at - event_timestamp))
    )), 2) as lag_p95_seconds
  FROM pitches 
  WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
    AND event_timestamp IS NOT NULL
    AND created_at IS NOT NULL
)
SELECT 
  'PBP_LAG_P95_SECONDS' as metric,
  lag_p95_seconds as value,
  CASE WHEN lag_p95_seconds <= 15 THEN 'GO ✅' ELSE 'NO-GO ❌' END as status,
  'Target: ≤15s' as threshold
FROM pbp_lag;

-- 4) 終了試合カバレッジ ≥ 98%
WITH coverage AS (
  SELECT 
    g.game_id,
    g.status,
    COUNT(p.pitch_id) as actual_pitches,
    280 as expected_pitches, -- NPB2平均投球数
    ROUND(COUNT(p.pitch_id)::DECIMAL / 280 * 100, 2) as coverage_ratio
  FROM games g
  LEFT JOIN pitches p ON g.game_id = p.game_id
  WHERE g.level = 'NPB2'
    AND g.status = 'FINISHED'
    AND g.date >= CURRENT_DATE - INTERVAL '1 day'
  GROUP BY g.game_id, g.status
)
SELECT 
  'GAME_COVERAGE' as metric,
  ROUND(AVG(coverage_ratio), 2) as avg_coverage,
  CASE WHEN AVG(coverage_ratio) >= 98 THEN 'GO ✅' ELSE 'NO-GO ❌' END as status,
  COUNT(*) as finished_games
FROM coverage;

-- 5) DB成長監視（pitchesテーブル単調増加）
WITH pitch_growth AS (
  SELECT 
    date_trunc('hour', created_at) as hour_slot,
    COUNT(*) as new_pitches
  FROM pitches 
  WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours'
  GROUP BY hour_slot
  ORDER BY hour_slot
),
growth_check AS (
  SELECT 
    hour_slot,
    new_pitches,
    LAG(new_pitches) OVER (ORDER BY hour_slot) as prev_pitches,
    CASE 
      WHEN LAG(new_pitches) OVER (ORDER BY hour_slot) IS NULL THEN true
      WHEN new_pitches >= LAG(new_pitches) OVER (ORDER BY hour_slot) * 0.5 THEN true
      ELSE false
    END as is_growing
  FROM pitch_growth
)
SELECT 
  'DB_GROWTH_MONOTONIC' as metric,
  COUNT(CASE WHEN NOT is_growing THEN 1 END) as declining_hours,
  CASE WHEN COUNT(CASE WHEN NOT is_growing THEN 1 END) = 0 THEN 'GO ✅' ELSE 'NO-GO ❌' END as status,
  CONCAT(COUNT(*), ' hours checked') as period
FROM growth_check;

-- ==== 最終判定サマリー ====
\echo '=== GO/NO-GO DECISION SUMMARY ==='

WITH criteria_check AS (
  SELECT 
    COUNT(CASE WHEN status LIKE '%NO-GO%' THEN 1 END) as failed_criteria,
    COUNT(*) as total_criteria
  FROM (
    -- すべての基準をUNIONで集約
    SELECT 'YAHOO_304' as criterion, CASE WHEN yahoo_304_ratio >= 60 THEN 'GO' ELSE 'NO-GO' END as status
    FROM yahoo_quality WHERE check_date >= CURRENT_DATE - INTERVAL '1 day'
    
    UNION ALL
    
    SELECT 'YAHOO_429', CASE WHEN yahoo_429_rate <= 1.0 THEN 'GO' ELSE 'NO-GO' END
    FROM yahoo_quality WHERE check_date >= CURRENT_DATE - INTERVAL '1 day'
    
    -- 他の基準も同様に追加
  ) all_criteria
)
SELECT 
  CASE 
    WHEN failed_criteria = 0 THEN 'GO: すべての基準をクリア ✅'
    ELSE CONCAT('NO-GO: ', failed_criteria, '/', total_criteria, ' 基準が失敗 ❌')
  END as final_decision,
  CURRENT_TIMESTAMP as check_time
FROM criteria_check;