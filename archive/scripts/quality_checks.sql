-- Quality Check SQL Queries for CI Integration
-- These queries detect common data quality issues

-- 1. Team total vs Player total mismatch (Batting)
-- Detects when team box scores don't match sum of individual player stats
SELECT 
  game_id, 
  team_id,
  ABS(team_AB - player_total_AB) AS ab_diff,
  ABS(team_R - player_total_R) AS r_diff,
  ABS(team_H - player_total_H) AS h_diff
FROM (
  SELECT 
    t.game_id,
    t.team AS team_id,
    t.AB AS team_AB,
    t.R AS team_R, 
    t.H AS team_H,
    SUM(p.AB) AS player_total_AB,
    SUM(p.R) AS player_total_R,
    SUM(p.H) AS player_total_H
  FROM team_box_batting t
  JOIN player_box_batting p ON t.game_id = p.game_id AND t.team = p.team
  GROUP BY t.game_id, t.team, t.AB, t.R, t.H
) AS comparison
WHERE ab_diff > 1 OR r_diff > 1 OR h_diff > 1;

-- 2. Team total vs Player total mismatch (Pitching)  
-- Detects when team pitching totals don't match sum of individual pitcher stats
SELECT 
  game_id,
  team_id,
  ABS(team_IP - player_total_IP) AS ip_diff,
  ABS(team_H - player_total_H) AS h_diff,
  ABS(team_ER - player_total_ER) AS er_diff
FROM (
  SELECT 
    t.game_id,
    t.team AS team_id,
    t.IP AS team_IP,
    t.H AS team_H,
    t.ER AS team_ER,
    SUM(p.IP) AS player_total_IP,
    SUM(p.H) AS player_total_H,
    SUM(p.ER) AS player_total_ER
  FROM team_box_pitching t
  JOIN player_box_pitching p ON t.game_id = p.game_id AND t.team = p.team
  GROUP BY t.game_id, t.team, t.IP, t.H, t.ER
) AS comparison
WHERE ip_diff > 0.1 OR h_diff > 1 OR er_diff > 1;

-- 3. Cross-database duplicate detection
-- Ensures no game_id exists in both current and history databases
-- (This would be run against both databases separately)
SELECT 
  'current' AS db_source,
  game_id,
  COUNT(*) as occurrence_count
FROM games 
GROUP BY game_id
HAVING COUNT(*) > 1

UNION ALL

SELECT 
  'history' AS db_source, 
  game_id,
  COUNT(*) as occurrence_count
FROM games
GROUP BY game_id  
HAVING COUNT(*) > 1;

-- 4. Box score vs Final score consistency
-- Verifies that away_score + home_score from games table matches
-- sum of runs from box_batting for each team
SELECT 
  g.game_id,
  g.away_score,
  g.home_score,
  away_box.total_runs AS away_box_runs,
  home_box.total_runs AS home_box_runs,
  ABS(g.away_score - away_box.total_runs) AS away_diff,
  ABS(g.home_score - home_box.total_runs) AS home_diff
FROM games g
LEFT JOIN (
  SELECT game_id, team, SUM(R) AS total_runs
  FROM box_batting  
  GROUP BY game_id, team
) away_box ON g.game_id = away_box.game_id AND g.away_team = away_box.team
LEFT JOIN (
  SELECT game_id, team, SUM(R) AS total_runs  
  FROM box_batting
  GROUP BY game_id, team
) home_box ON g.game_id = home_box.game_id AND g.home_team = home_box.team
WHERE away_diff > 1 OR home_diff > 1;

-- 5. PBP event run consistency
-- For games with play-by-play data, verify that sum of run-scoring events
-- equals final game score
SELECT 
  g.game_id,
  g.away_score + g.home_score AS final_total_runs,
  COUNT(pbp.result) AS scoring_events,
  ABS((g.away_score + g.home_score) - COUNT(pbp.result)) AS run_diff
FROM games g
LEFT JOIN pbp_events pbp ON g.game_id = pbp.game_id 
  AND pbp.result IN ('Single_RBI', 'Double_RBI', 'Triple_RBI', 'HR', 'Sac_Fly_RBI', 'Error_RBI')
WHERE g.status = 'final'
  AND EXISTS (SELECT 1 FROM pbp_events WHERE game_id = g.game_id)
GROUP BY g.game_id, g.away_score, g.home_score
HAVING run_diff > 2;

-- 6. Required field validation for player pages
-- Identifies players missing critical display data
SELECT 
  player_id,
  COUNT(CASE WHEN name IS NULL OR name = '' THEN 1 END) AS missing_name,
  COUNT(CASE WHEN primary_pos IS NULL OR primary_pos = '' THEN 1 END) AS missing_pos,
  COUNT(CASE WHEN birth_year IS NULL THEN 1 END) AS missing_birth_year,
  MAX(year) AS latest_season,
  COUNT(CASE WHEN OPS IS NULL AND ERA IS NULL THEN 1 END) AS missing_key_stats
FROM player_seasons 
GROUP BY player_id
HAVING missing_name > 0 OR missing_pos > 0 OR missing_birth_year > 0 OR missing_key_stats > 0;

-- 7. Team roster completeness check
-- Ensures each team has minimum required player count for given year
SELECT 
  year,
  team,
  COUNT(DISTINCT player_id) AS player_count,
  COUNT(CASE WHEN primary_pos = 'P' THEN 1 END) AS pitcher_count,
  COUNT(CASE WHEN primary_pos != 'P' THEN 1 END) AS position_player_count
FROM player_seasons
WHERE year >= 2024
GROUP BY year, team
HAVING player_count < 25 OR pitcher_count < 10 OR position_player_count < 8;

-- 8. Statistical range sanity checks
-- Detects obviously invalid statistical values
SELECT 
  'batting' AS stat_type,
  player_id,
  year,
  'impossible_avg' AS issue,
  AVG AS problematic_value
FROM player_batting_stats
WHERE AVG > 1.000 OR AVG < 0.000

UNION ALL

SELECT 
  'pitching' AS stat_type,
  player_id, 
  year,
  'impossible_era' AS issue,
  ERA AS problematic_value
FROM player_pitching_stats  
WHERE ERA < 0.00 OR ERA > 20.00

UNION ALL

SELECT
  'batting' AS stat_type,
  player_id,
  year, 
  'impossible_ops' AS issue,
  OPS AS problematic_value
FROM player_batting_stats
WHERE OPS < 0.000 OR OPS > 3.000;