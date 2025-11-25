-- NPB Baseball AI Media - Database Schema
-- PostgreSQL DDL for real-time pitch data collection

-- Games table (1軍 + ファーム)
CREATE TABLE IF NOT EXISTS games (
  game_id       TEXT PRIMARY KEY,
  level         TEXT NOT NULL,             -- 'NPB1' | 'NPB2'
  farm_league   TEXT,                      -- 'EAST' | 'WEST' (NPB2のみ)
  date          DATE NOT NULL,
  home_team     TEXT,
  away_team     TEXT,
  venue         TEXT,
  venue_normalized TEXT,
  final_score_home INTEGER,
  final_score_away INTEGER,
  status        TEXT DEFAULT 'scheduled',   -- 'scheduled' | 'live' | 'finished'
  source        TEXT DEFAULT 'yahoo',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Pitch events table (個別投球イベント)
CREATE TABLE IF NOT EXISTS pitch_events (
  event_id      TEXT PRIMARY KEY,          -- game_id:index:pitch_no
  game_id       TEXT NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
  idx           INTEGER NOT NULL,          -- Yahooの ?index=
  pitch_no      INTEGER NOT NULL,          -- 打席内の投球番号
  inning        INTEGER,
  half          TEXT,                      -- 'top' | 'bottom'
  outs          INTEGER,
  balls         INTEGER,
  strikes       INTEGER,
  
  -- バッター情報
  batter_name   TEXT,
  batter_hand   TEXT,                      -- 'L' | 'R'
  
  -- ピッチャー情報  
  pitcher_name  TEXT,
  pitcher_hand  TEXT,                      -- 'L' | 'R'
  
  -- 投球詳細
  pitch_type    TEXT,                      -- 'FF' | 'SL' | 'CU' | 'SF' | 'FC' | 'SI' | 'CH' | 'SC' | 'OTHER'
  speed_kmh     NUMERIC,
  result_code   TEXT,                      -- '見逃し' | '空振り' | 'ファウル' | 'インプレー' 等
  
  -- 座標情報 (正規化済み)
  plate_x       REAL,                      -- -0.83 .. +0.83 (左右)
  plate_z       REAL,                      -- 0.5 .. 3.5 (高低)
  zone          TEXT,                      -- '内角高め' | '真ん中低め' 等
  
  -- 走者状況
  runner_1b     BOOLEAN DEFAULT FALSE,
  runner_2b     BOOLEAN DEFAULT FALSE,
  runner_3b     BOOLEAN DEFAULT FALSE,
  
  -- メタデータ
  confidence    TEXT DEFAULT 'high',       -- 'high' | 'medium' | 'low'
  source        TEXT DEFAULT 'yahoo',      -- 'yahoo' | 'baseballdata'
  ts_ingested   TIMESTAMPTZ DEFAULT now(),
  raw           JSONB                      -- 生データ（安全網）
);

-- Player aggregations (baseballdata.jp補完用)
CREATE TABLE IF NOT EXISTS player_aggregations (
  agg_id        TEXT PRIMARY KEY,          -- player_name:game_id:type
  game_id       TEXT NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
  player_name   TEXT NOT NULL,
  player_role   TEXT NOT NULL,             -- 'batter' | 'pitcher'
  agg_type      TEXT NOT NULL,             -- 'pitch_mix' | 'zone_matrix' | 'by_inning' | 'avg_velo'
  
  -- 集計データ (JSON形式)
  agg_data      JSONB NOT NULL,
  
  -- 品質情報
  confidence    TEXT DEFAULT 'medium',
  source        TEXT DEFAULT 'baseballdata',
  alignment_score REAL,                    -- Yahooとの一致率 (0.0-1.0)
  flags         TEXT[],                    -- ['mismatch_zone', 'mismatch_speed']
  
  ts_ingested   TIMESTAMPTZ DEFAULT now()
);

-- Plate appearances (打席結果集計)
CREATE TABLE IF NOT EXISTS plate_appearances (
  pa_id         TEXT PRIMARY KEY,          -- game_id:index
  game_id       TEXT NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
  idx           INTEGER NOT NULL,
  
  -- 打席詳細
  inning        INTEGER,
  half          TEXT,
  outs_start    INTEGER,
  batter_name   TEXT,
  pitcher_name  TEXT,
  
  -- 結果
  pa_result     TEXT,                      -- 'single' | 'double' | 'strikeout' | 'walk' 等
  pitch_count   INTEGER,                   -- 投球数
  final_count   TEXT,                      -- '3-2' | '1-2' 等
  
  -- 集計
  total_pitches INTEGER DEFAULT 0,
  strikes_thrown INTEGER DEFAULT 0,
  balls_thrown  INTEGER DEFAULT 0,
  fouls_hit     INTEGER DEFAULT 0,
  
  -- メタデータ
  source        TEXT DEFAULT 'yahoo',
  ts_ingested   TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS pitch_events_game_idx ON pitch_events (game_id, idx);
CREATE INDEX IF NOT EXISTS pitch_events_pitcher_idx ON pitch_events (pitcher_name, game_id);
CREATE INDEX IF NOT EXISTS pitch_events_date_idx ON pitch_events (game_id, ts_ingested);
CREATE INDEX IF NOT EXISTS pitch_events_type_idx ON pitch_events (pitch_type, speed_kmh);
CREATE INDEX IF NOT EXISTS pitch_events_zone_idx ON pitch_events (plate_x, plate_z);

CREATE INDEX IF NOT EXISTS games_date_level_idx ON games (date, level);
CREATE INDEX IF NOT EXISTS games_level_status_idx ON games (level, status);

CREATE INDEX IF NOT EXISTS player_agg_game_idx ON player_aggregations (game_id, player_name);
CREATE INDEX IF NOT EXISTS player_agg_type_idx ON player_aggregations (agg_type, player_name);

CREATE INDEX IF NOT EXISTS pa_game_idx ON plate_appearances (game_id, idx);
CREATE INDEX IF NOT EXISTS pa_pitcher_idx ON plate_appearances (pitcher_name, game_id);

-- Views for analytics
CREATE OR REPLACE VIEW pitch_summary AS
SELECT 
  game_id,
  pitcher_name,
  COUNT(*) as total_pitches,
  COUNT(*) FILTER (WHERE strikes > 0) as strikes,
  COUNT(*) FILTER (WHERE balls > 0) as balls,
  ROUND(AVG(speed_kmh), 1) as avg_speed,
  MAX(speed_kmh) as max_speed,
  MIN(speed_kmh) as min_speed,
  COUNT(DISTINCT pitch_type) as pitch_types_used,
  ROUND(AVG(CASE WHEN plate_x IS NOT NULL THEN plate_x END), 3) as avg_plate_x,
  ROUND(AVG(CASE WHEN plate_z IS NOT NULL THEN plate_z END), 3) as avg_plate_z
FROM pitch_events 
WHERE confidence IN ('high', 'medium')
GROUP BY game_id, pitcher_name;

CREATE OR REPLACE VIEW farm_prospect_summary AS
SELECT 
  g.farm_league,
  pe.pitcher_name,
  g.date,
  COUNT(*) as total_pitches,
  ROUND(AVG(pe.speed_kmh), 1) as avg_speed,
  COUNT(DISTINCT pe.pitch_type) as pitch_variety,
  COUNT(*) FILTER (WHERE pe.result_code LIKE '%空振り%') as strikeouts,
  ROUND(COUNT(*) FILTER (WHERE pe.result_code LIKE '%空振り%')::FLOAT / NULLIF(COUNT(*), 0) * 100, 1) as swinging_strike_rate
FROM pitch_events pe
JOIN games g ON pe.game_id = g.game_id
WHERE g.level = 'NPB2'
GROUP BY g.farm_league, pe.pitcher_name, g.date
ORDER BY g.date DESC, pe.pitcher_name;

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE games IS 'NPB1軍・ファーム試合基本情報';
COMMENT ON TABLE pitch_events IS 'Individual pitch data from Yahoo/baseballdata sources';
COMMENT ON TABLE player_aggregations IS 'Player performance aggregations from baseballdata.jp';
COMMENT ON TABLE plate_appearances IS 'At-bat level summaries';

COMMENT ON COLUMN pitch_events.plate_x IS 'Normalized plate coordinate: -0.83 (away) to +0.83 (home)';
COMMENT ON COLUMN pitch_events.plate_z IS 'Normalized plate coordinate: 0.5 (low) to 3.5 (high)';
COMMENT ON COLUMN player_aggregations.alignment_score IS 'Data quality score vs Yahoo (0.0-1.0)';
COMMENT ON COLUMN player_aggregations.flags IS 'Data quality flags: mismatch_zone, mismatch_speed, etc.';