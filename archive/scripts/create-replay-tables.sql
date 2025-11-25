-- リプレイ機能用テーブル作成
-- 実行: psql "$PGURL" -f scripts/create-replay-tables.sql

-- 1) リプレイインデックステーブル
CREATE TABLE IF NOT EXISTS replay_index (
    game_id TEXT PRIMARY KEY,
    frames INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    data_source TEXT NOT NULL DEFAULT 'timeline.jsonl',
    file_path TEXT,
    file_size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- メタデータ
    game_date DATE,
    status TEXT,
    total_events INTEGER,
    has_predictions BOOLEAN DEFAULT FALSE,
    has_win_probability BOOLEAN DEFAULT FALSE,
    
    -- キャッシュ制御
    cache_version INTEGER DEFAULT 1,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_replay_index_game_date ON replay_index(game_date);
CREATE INDEX IF NOT EXISTS idx_replay_index_status ON replay_index(status);
CREATE INDEX IF NOT EXISTS idx_replay_index_updated_at ON replay_index(updated_at);
CREATE INDEX IF NOT EXISTS idx_replay_index_access_count ON replay_index(access_count);

-- 2) リプレイアクセスログ（メトリクス用）
CREATE TABLE IF NOT EXISTS replay_access_log (
    id SERIAL PRIMARY KEY,
    game_id TEXT NOT NULL,
    session_id TEXT,
    user_agent TEXT,
    ip_hash TEXT, -- プライバシー保護のためハッシュ化
    speed INTEGER DEFAULT 1,
    from_frame INTEGER DEFAULT 0,
    frames_watched INTEGER,
    duration_seconds INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 参照元追跡
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_replay_access_log_game_id ON replay_access_log(game_id);
CREATE INDEX IF NOT EXISTS idx_replay_access_log_created_at ON replay_access_log(created_at);
CREATE INDEX IF NOT EXISTS idx_replay_access_log_completed ON replay_access_log(completed);

-- 3) リプレイ品質メトリクス
CREATE TABLE IF NOT EXISTS replay_quality_metrics (
    game_id TEXT PRIMARY KEY,
    data_completeness_ratio DECIMAL(5,4), -- 0.0000-1.0000
    prediction_coverage_ratio DECIMAL(5,4),
    win_probability_coverage_ratio DECIMAL(5,4),
    event_sequence_integrity BOOLEAN DEFAULT TRUE,
    timestamp_consistency_score DECIMAL(5,4),
    
    -- 品質スコア (総合)
    overall_quality_score DECIMAL(5,4),
    quality_grade TEXT CHECK (quality_grade IN ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D')),
    
    -- 計算メタデータ
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calculation_version INTEGER DEFAULT 1
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_replay_quality_metrics_quality_grade ON replay_quality_metrics(quality_grade);
CREATE INDEX IF NOT EXISTS idx_replay_quality_metrics_overall_score ON replay_quality_metrics(overall_quality_score);

-- 4) ビュー: リプレイ統合情報
CREATE OR REPLACE VIEW replay_dashboard AS
SELECT 
    ri.game_id,
    ri.game_date,
    ri.frames,
    ri.duration_ms,
    ri.status,
    ri.access_count,
    ri.last_accessed_at,
    
    -- 品質情報
    rqm.overall_quality_score,
    rqm.quality_grade,
    rqm.data_completeness_ratio,
    
    -- アクセス統計 (直近7日)
    COALESCE(recent_access.total_views, 0) as views_last_7_days,
    COALESCE(recent_access.unique_sessions, 0) as unique_sessions_last_7_days,
    COALESCE(recent_access.avg_completion_rate, 0) as avg_completion_rate,
    COALESCE(recent_access.avg_watch_duration, 0) as avg_watch_duration_seconds,
    
    -- ファイル情報
    ri.file_size_bytes,
    ri.created_at,
    ri.updated_at
    
FROM replay_index ri
LEFT JOIN replay_quality_metrics rqm ON ri.game_id = rqm.game_id
LEFT JOIN (
    SELECT 
        game_id,
        COUNT(*) as total_views,
        COUNT(DISTINCT session_id) as unique_sessions,
        AVG(CASE WHEN completed THEN 1.0 ELSE 0.0 END) as avg_completion_rate,
        AVG(duration_seconds) as avg_watch_duration
    FROM replay_access_log 
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY game_id
) recent_access ON ri.game_id = recent_access.game_id;

-- 5) 関数: リプレイアクセス記録
CREATE OR REPLACE FUNCTION record_replay_access(
    p_game_id TEXT,
    p_session_id TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_hash TEXT DEFAULT NULL,
    p_speed INTEGER DEFAULT 1,
    p_from_frame INTEGER DEFAULT 0,
    p_referrer TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    access_id INTEGER;
BEGIN
    -- アクセスログ挿入
    INSERT INTO replay_access_log (
        game_id, session_id, user_agent, ip_hash, 
        speed, from_frame, referrer
    ) VALUES (
        p_game_id, p_session_id, p_user_agent, p_ip_hash,
        p_speed, p_from_frame, p_referrer
    ) RETURNING id INTO access_id;
    
    -- リプレイインデックスのアクセス情報更新
    UPDATE replay_index 
    SET 
        access_count = access_count + 1,
        last_accessed_at = NOW()
    WHERE game_id = p_game_id;
    
    RETURN access_id;
END;
$$ LANGUAGE plpgsql;

-- 6) 関数: リプレイ完了記録
CREATE OR REPLACE FUNCTION complete_replay_access(
    p_access_id INTEGER,
    p_frames_watched INTEGER,
    p_duration_seconds INTEGER
) RETURNS VOID AS $$
BEGIN
    UPDATE replay_access_log 
    SET 
        frames_watched = p_frames_watched,
        duration_seconds = p_duration_seconds,
        completed = CASE WHEN p_frames_watched > 0 THEN TRUE ELSE FALSE END
    WHERE id = p_access_id;
END;
$$ LANGUAGE plpgsql;

-- 7) サンプルデータ挿入（テスト用）
INSERT INTO replay_index (
    game_id, frames, duration_ms, game_date, status, 
    total_events, has_predictions, has_win_probability
) VALUES 
(
    '20250813_G-T_01', 1247, 185500, '2025-08-13', 'FINISHED',
    1247, TRUE, TRUE
),
(
    '20250813_C-Y_01', 891, 142300, '2025-08-13', 'FINISHED', 
    891, TRUE, FALSE
)
ON CONFLICT (game_id) DO NOTHING;

-- 品質サンプルデータ
INSERT INTO replay_quality_metrics (
    game_id, data_completeness_ratio, prediction_coverage_ratio,
    win_probability_coverage_ratio, overall_quality_score, quality_grade
) VALUES 
(
    '20250813_G-T_01', 0.9841, 0.9523, 0.8934, 0.9433, 'A+'
),
(
    '20250813_C-Y_01', 0.9234, 0.8891, 0.0000, 0.8042, 'B+'
)
ON CONFLICT (game_id) DO NOTHING;

-- コメント追加
COMMENT ON TABLE replay_index IS 'リプレイデータのインデックステーブル';
COMMENT ON TABLE replay_access_log IS 'リプレイアクセスログ（メトリクス・分析用）';
COMMENT ON TABLE replay_quality_metrics IS 'リプレイデータ品質メトリクス';
COMMENT ON VIEW replay_dashboard IS 'リプレイ統合ダッシュボード用ビュー';

-- 権限設定（必要に応じて）
-- GRANT SELECT, INSERT, UPDATE ON replay_index TO app_user;
-- GRANT SELECT, INSERT, UPDATE ON replay_access_log TO app_user;
-- GRANT SELECT ON replay_quality_metrics TO app_user;
-- GRANT SELECT ON replay_dashboard TO app_user;