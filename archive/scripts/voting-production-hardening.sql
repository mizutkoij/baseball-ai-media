-- 投票システム本番運用硬化 (JST日付 + ユニーク制約 + MV集計)
-- 実行: psql "$PGURL" -f scripts/voting-production-hardening.sql

-- 1) テーブル構造変更: JST日付列追加 + voter_key対応
ALTER TABLE player_votes 
ADD COLUMN IF NOT EXISTS vote_day_jst DATE,
ADD COLUMN IF NOT EXISTS voter_key TEXT;

-- JST日付を既存データに設定（バックフィル）
UPDATE player_votes 
SET vote_day_jst = (created_at AT TIME ZONE 'Asia/Tokyo')::DATE 
WHERE vote_day_jst IS NULL;

-- vote_day_jst を NOT NULL に変更
ALTER TABLE player_votes 
ALTER COLUMN vote_day_jst SET NOT NULL;

-- 2) 強化されたユニーク制約
-- 既存の制約削除
DROP INDEX IF EXISTS player_votes_ip_hash_vote_date_key;

-- voter_key 有り（認証済み）の重複防止
CREATE UNIQUE INDEX IF NOT EXISTS ux_votes_voter_key_day_jst
  ON player_votes(player_id, vote_day_jst, voter_key)
  WHERE voter_key IS NOT NULL;

-- voter_key 無し（匿名）は IP ハッシュで制限
CREATE UNIQUE INDEX IF NOT EXISTS ux_votes_ip_day_jst
  ON player_votes(player_id, vote_day_jst, ip_hash)
  WHERE voter_key IS NULL;

-- 3) Materialized View: リアルタイム・リーダーボード
CREATE MATERIALIZED VIEW IF NOT EXISTS vote_leaderboard_7d_mv AS
SELECT 
    player_id,
    player_name,
    team_code,
    COUNT(*) as votes_7d,
    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MIN(created_at)) as rank_7d,
    MAX(created_at) as latest_vote_at
FROM player_votes
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY player_id, player_name, team_code;

-- MV用インデックス
CREATE INDEX IF NOT EXISTS ix_vote_lb7d_mv_votes 
  ON vote_leaderboard_7d_mv(votes_7d DESC);
CREATE INDEX IF NOT EXISTS ix_vote_lb7d_mv_team 
  ON vote_leaderboard_7d_mv(team_code, votes_7d DESC);

-- 4) 今日専用のMV（高速アクセス用）
CREATE MATERIALIZED VIEW IF NOT EXISTS vote_leaderboard_today_mv AS
SELECT 
    player_id,
    player_name,
    team_code,
    COUNT(*) as votes_today,
    ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, MIN(created_at)) as rank_today,
    COUNT(DISTINCT COALESCE(voter_key, ip_hash)) as unique_voters
FROM player_votes
WHERE vote_day_jst = (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE
GROUP BY player_id, player_name, team_code;

CREATE INDEX IF NOT EXISTS ix_vote_lb_today_mv_votes 
  ON vote_leaderboard_today_mv(votes_today DESC);

-- 5) 更新関数: 非ブロッキング MV リフレッシュ
CREATE OR REPLACE FUNCTION refresh_vote_leaderboards() 
RETURNS VOID AS $$
BEGIN
    -- 今日のMV更新（軽量）
    REFRESH MATERIALIZED VIEW CONCURRENTLY vote_leaderboard_today_mv;
    
    -- 7日間MV更新（少し重い）
    REFRESH MATERIALIZED VIEW CONCURRENTLY vote_leaderboard_7d_mv;
    
    -- ログ記録
    INSERT INTO vote_statistics (stat_date, total_votes, unique_voters)
    SELECT 
        (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE,
        (SELECT COUNT(*) FROM player_votes WHERE vote_day_jst = (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE),
        (SELECT COUNT(DISTINCT COALESCE(voter_key, ip_hash)) FROM player_votes WHERE vote_day_jst = (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE)
    ON CONFLICT (stat_date) DO UPDATE SET
        total_votes = EXCLUDED.total_votes,
        unique_voters = EXCLUDED.unique_voters;
END;
$$ LANGUAGE plpgsql;

-- 6) JST対応の投票記録関数（改良版）
CREATE OR REPLACE FUNCTION record_player_vote_jst(
    p_player_id TEXT,
    p_player_name TEXT,
    p_team_code TEXT DEFAULT NULL,
    p_voter_key TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_ip_hash TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_referrer TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    vote_id INTEGER;
    jst_date DATE;
BEGIN
    -- JST日付計算
    SELECT (NOW() AT TIME ZONE 'Asia/Tokyo')::DATE INTO jst_date;
    
    -- 投票記録（ユニーク制約で自動的に重複防止）
    INSERT INTO player_votes (
        player_id, player_name, team_code, vote_day_jst,
        voter_key, session_id, ip_hash, user_agent, referrer
    ) VALUES (
        p_player_id, p_player_name, p_team_code, jst_date,
        p_voter_key, p_session_id, p_ip_hash, p_user_agent, p_referrer
    ) RETURNING id INTO vote_id;
    
    RETURN vote_id;
    
EXCEPTION
    WHEN unique_violation THEN
        -- 既に投票済み
        RETURN -1;
END;
$$ LANGUAGE plpgsql;

-- 7) レート制限用テーブル
CREATE TABLE IF NOT EXISTS rate_limit_log (
    id SERIAL PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- レート制限インデックス
CREATE INDEX IF NOT EXISTS ix_rate_limit_ip_endpoint_window 
  ON rate_limit_log(ip_hash, endpoint, window_start);

-- 古いログ削除（1時間以上経過）
CREATE OR REPLACE FUNCTION cleanup_rate_limit_log() 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM rate_limit_log 
    WHERE created_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 8) 投票詐欺検出ビュー
CREATE OR REPLACE VIEW suspicious_voting_activity AS
SELECT 
    vote_day_jst,
    COALESCE(voter_key, 'anon_' || LEFT(ip_hash, 8)) as voter_identifier,
    ip_hash,
    COUNT(*) as vote_count,
    COUNT(DISTINCT player_id) as unique_players,
    ARRAY_AGG(DISTINCT team_code) as teams_voted,
    MIN(created_at) as first_vote,
    MAX(created_at) as last_vote,
    EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as time_span_seconds
FROM player_votes
WHERE vote_day_jst >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY vote_day_jst, COALESCE(voter_key, ip_hash), ip_hash
HAVING 
    COUNT(*) > 10 OR  -- 1日10票以上
    (COUNT(*) > 3 AND EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) < 60) -- 1分以内に複数票
ORDER BY vote_count DESC, time_span_seconds ASC;

-- 9) パフォーマンス最適化: パーティショニング準備
-- 将来的に player_votes を日付でパーティション分割する場合の準備
CREATE INDEX IF NOT EXISTS ix_player_votes_vote_day_jst 
  ON player_votes(vote_day_jst, created_at);

-- 10) 初期データ移行とMV作成
-- 既存データのJST日付設定
UPDATE player_votes 
SET vote_day_jst = (created_at AT TIME ZONE 'Asia/Tokyo')::DATE 
WHERE vote_day_jst IS NULL;

-- MV初期作成
SELECT refresh_vote_leaderboards();

-- 11) 権限設定
-- GRANT USAGE ON SCHEMA public TO app_user;
-- GRANT SELECT ON vote_leaderboard_7d_mv TO app_user;
-- GRANT SELECT ON vote_leaderboard_today_mv TO app_user;
-- GRANT SELECT ON suspicious_voting_activity TO app_user;

-- コメント追加
COMMENT ON COLUMN player_votes.vote_day_jst IS 'JST基準の投票日（日付またぎ誤判定防止）';
COMMENT ON COLUMN player_votes.voter_key IS '認証済み投票者ID（クッキー保存）';
COMMENT ON MATERIALIZED VIEW vote_leaderboard_7d_mv IS '7日間投票ランキング（高速アクセス用）';
COMMENT ON MATERIALIZED VIEW vote_leaderboard_today_mv IS '今日の投票ランキング（リアルタイム更新）';
COMMENT ON VIEW suspicious_voting_activity IS '不正投票検出ビュー（監視用）';

-- 完了ログ
DO $$ 
BEGIN 
    RAISE NOTICE '✅ 投票システム本番硬化完了: JST日付 + ユニーク制約 + MV集計';
END $$;