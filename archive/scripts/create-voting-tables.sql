-- 推し投票機能用テーブル作成
-- 実行: psql "$PGURL" -f scripts/create-voting-tables.sql

-- 1) 投票テーブル（1日1回制限）
CREATE TABLE IF NOT EXISTS player_votes (
    id SERIAL PRIMARY KEY,
    player_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    team_code TEXT,
    vote_date DATE NOT NULL DEFAULT CURRENT_DATE,
    session_id TEXT,
    ip_hash TEXT, -- プライバシー保護のためハッシュ化
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 投票分析用
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    
    -- 1日1回制約
    UNIQUE(ip_hash, vote_date)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_player_votes_player_id ON player_votes(player_id);
CREATE INDEX IF NOT EXISTS idx_player_votes_vote_date ON player_votes(vote_date);
CREATE INDEX IF NOT EXISTS idx_player_votes_team_code ON player_votes(team_code);
CREATE INDEX IF NOT EXISTS idx_player_votes_session_ip ON player_votes(session_id, ip_hash);

-- 2) 投票集計テーブル（日次更新）
CREATE TABLE IF NOT EXISTS daily_vote_summary (
    vote_date DATE NOT NULL,
    player_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    team_code TEXT,
    total_votes INTEGER NOT NULL DEFAULT 0,
    rank_overall INTEGER,
    rank_by_team INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (vote_date, player_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_daily_vote_summary_date_rank ON daily_vote_summary(vote_date, rank_overall);
CREATE INDEX IF NOT EXISTS idx_daily_vote_summary_team_rank ON daily_vote_summary(vote_date, team_code, rank_by_team);

-- 3) 投票統計テーブル（システム全体）
CREATE TABLE IF NOT EXISTS vote_statistics (
    stat_date DATE PRIMARY KEY,
    total_votes INTEGER NOT NULL DEFAULT 0,
    unique_voters INTEGER NOT NULL DEFAULT 0,
    top_player_id TEXT,
    top_player_votes INTEGER,
    teams_represented INTEGER,
    avg_votes_per_player DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4) ビュー: 投票ランキング（リアルタイム）
CREATE OR REPLACE VIEW current_vote_ranking AS
SELECT 
    player_id,
    player_name,
    team_code,
    COUNT(*) as total_votes,
    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MIN(created_at)) as rank_overall,
    ROW_NUMBER() OVER (PARTITION BY team_code ORDER BY COUNT(*) DESC, MIN(created_at)) as rank_by_team,
    MIN(created_at) as first_vote_at,
    MAX(created_at) as latest_vote_at
FROM player_votes 
WHERE vote_date = CURRENT_DATE
GROUP BY player_id, player_name, team_code;

-- 5) ビュー: 本日の投票統計
CREATE OR REPLACE VIEW today_vote_stats AS
SELECT 
    CURRENT_DATE as vote_date,
    COUNT(*) as total_votes,
    COUNT(DISTINCT ip_hash) as unique_voters,
    COUNT(DISTINCT team_code) as teams_represented,
    ROUND(COUNT(*)::DECIMAL / NULLIF(COUNT(DISTINCT player_id), 0), 2) as avg_votes_per_player,
    (
        SELECT player_name 
        FROM current_vote_ranking 
        WHERE rank_overall = 1 
        LIMIT 1
    ) as top_player_name,
    (
        SELECT total_votes 
        FROM current_vote_ranking 
        WHERE rank_overall = 1 
        LIMIT 1
    ) as top_player_votes
FROM player_votes 
WHERE vote_date = CURRENT_DATE;

-- 6) 関数: 投票記録
CREATE OR REPLACE FUNCTION record_player_vote(
    p_player_id TEXT,
    p_player_name TEXT,
    p_team_code TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_ip_hash TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_referrer TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    vote_id INTEGER;
    existing_vote_count INTEGER;
BEGIN
    -- 既存投票チェック（同日・同IP）
    SELECT COUNT(*) INTO existing_vote_count
    FROM player_votes 
    WHERE ip_hash = p_ip_hash 
    AND vote_date = CURRENT_DATE;
    
    IF existing_vote_count > 0 THEN
        -- 既に投票済み
        RETURN -1;
    END IF;
    
    -- 投票記録
    INSERT INTO player_votes (
        player_id, player_name, team_code, 
        session_id, ip_hash, user_agent, referrer
    ) VALUES (
        p_player_id, p_player_name, p_team_code,
        p_session_id, p_ip_hash, p_user_agent, p_referrer
    ) RETURNING id INTO vote_id;
    
    RETURN vote_id;
END;
$$ LANGUAGE plpgsql;

-- 7) 関数: 日次集計更新
CREATE OR REPLACE FUNCTION update_daily_vote_summary(target_date DATE DEFAULT CURRENT_DATE) 
RETURNS INTEGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- 既存データ削除
    DELETE FROM daily_vote_summary WHERE vote_date = target_date;
    
    -- 集計データ挿入
    INSERT INTO daily_vote_summary (
        vote_date, player_id, player_name, team_code, 
        total_votes, rank_overall, rank_by_team
    )
    SELECT 
        target_date,
        player_id,
        player_name,
        team_code,
        COUNT(*) as total_votes,
        ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MIN(created_at)) as rank_overall,
        ROW_NUMBER() OVER (PARTITION BY team_code ORDER BY COUNT(*) DESC, MIN(created_at)) as rank_by_team
    FROM player_votes 
    WHERE vote_date = target_date
    GROUP BY player_id, player_name, team_code;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    -- 統計テーブル更新
    INSERT INTO vote_statistics (
        stat_date, total_votes, unique_voters, 
        top_player_id, top_player_votes, teams_represented, avg_votes_per_player
    )
    SELECT 
        target_date,
        (SELECT total_votes FROM today_vote_stats),
        (SELECT unique_voters FROM today_vote_stats),
        (SELECT player_id FROM daily_vote_summary WHERE vote_date = target_date AND rank_overall = 1 LIMIT 1),
        (SELECT total_votes FROM daily_vote_summary WHERE vote_date = target_date AND rank_overall = 1 LIMIT 1),
        (SELECT teams_represented FROM today_vote_stats),
        (SELECT avg_votes_per_player FROM today_vote_stats)
    ON CONFLICT (stat_date) DO UPDATE SET
        total_votes = EXCLUDED.total_votes,
        unique_voters = EXCLUDED.unique_voters,
        top_player_id = EXCLUDED.top_player_id,
        top_player_votes = EXCLUDED.top_player_votes,
        teams_represented = EXCLUDED.teams_represented,
        avg_votes_per_player = EXCLUDED.avg_votes_per_player;
    
    RETURN affected_rows;
END;
$$ LANGUAGE plpgsql;

-- 8) サンプルデータ挿入（テスト用）
INSERT INTO player_votes (
    player_id, player_name, team_code, ip_hash, vote_date
) VALUES 
('munetaka_murakami', '村上宗隆', 'S', 'hash_001', CURRENT_DATE),
('seiya_suzuki', '鈴木誠也', 'C', 'hash_002', CURRENT_DATE),
('masataka_yoshida', '吉田正尚', 'B', 'hash_003', CURRENT_DATE),
('hotaka_yamakawa', '山川穂高', 'L', 'hash_004', CURRENT_DATE),
('yuki_yanagita', '柳田悠岐', 'H', 'hash_005', CURRENT_DATE)
ON CONFLICT (ip_hash, vote_date) DO NOTHING;

-- 初回集計実行
SELECT update_daily_vote_summary();

-- コメント追加
COMMENT ON TABLE player_votes IS '選手推し投票テーブル（1日1回制限）';
COMMENT ON TABLE daily_vote_summary IS '日次投票集計テーブル';
COMMENT ON TABLE vote_statistics IS '投票統計テーブル（システム全体）';
COMMENT ON VIEW current_vote_ranking IS 'リアルタイム投票ランキング';
COMMENT ON VIEW today_vote_stats IS '本日の投票統計';

-- 権限設定（必要に応じて）
-- GRANT SELECT, INSERT ON player_votes TO app_user;
-- GRANT SELECT ON daily_vote_summary TO app_user;
-- GRANT SELECT ON vote_statistics TO app_user;
-- GRANT SELECT ON current_vote_ranking TO app_user;
-- GRANT SELECT ON today_vote_stats TO app_user;