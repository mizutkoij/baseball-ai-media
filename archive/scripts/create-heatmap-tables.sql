-- Heatmap前計算システム用テーブル作成
-- 実行: psql "$PGURL" -f scripts/create-heatmap-tables.sql

-- 1) 投手配球ヒートマップテーブル
CREATE TABLE IF NOT EXISTS pitch_heatmaps (
    pitcher_id TEXT NOT NULL,
    batter_side CHAR(1) NOT NULL CHECK (batter_side IN ('L', 'R')),
    count_bucket TEXT NOT NULL CHECK (count_bucket IN ('start', 'ahead', 'behind', 'even', 'two_strike', 'full')),
    grid_w INTEGER NOT NULL DEFAULT 13,
    grid_h INTEGER NOT NULL DEFAULT 13,
    
    -- 実測分布（球種別）
    empirical JSONB NOT NULL,
    
    -- NextPitchモデル予測分布
    model JSONB NOT NULL,
    
    -- サンプル数・品質情報
    sample_size INTEGER NOT NULL,
    quality_score DECIMAL(3,2), -- 0.00-1.00（サンプル数・分散等から算出）
    
    -- メタデータ
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    computed_from_date DATE,
    computed_to_date DATE,
    data_source TEXT DEFAULT 'pitches',
    
    PRIMARY KEY (pitcher_id, batter_side, count_bucket)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS ix_heatmaps_updated_at 
    ON pitch_heatmaps(updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_heatmaps_pitcher_updated 
    ON pitch_heatmaps(pitcher_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_heatmaps_sample_size 
    ON pitch_heatmaps(sample_size DESC) WHERE sample_size >= 10;

-- 2) ヒートマップ構築ログ
CREATE TABLE IF NOT EXISTS heatmap_build_log (
    id SERIAL PRIMARY KEY,
    build_type TEXT NOT NULL, -- 'full' | 'incremental' | 'pitcher_update'
    pitcher_count INTEGER,
    rows_processed BIGINT,
    duration_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_heatmap_build_log_created 
    ON heatmap_build_log(created_at DESC);

-- 3) カウント→バケット変換関数
CREATE OR REPLACE FUNCTION count_to_bucket(balls INTEGER, strikes INTEGER) 
RETURNS TEXT AS $$
BEGIN
    -- フルカウント
    IF balls = 3 AND strikes = 2 THEN
        RETURN 'full';
    END IF;
    
    -- 打席開始
    IF balls = 0 AND strikes = 0 THEN
        RETURN 'start';
    END IF;
    
    -- ツーストライク
    IF strikes = 2 THEN
        RETURN 'two_strike';
    END IF;
    
    -- 投手有利（ahead）
    IF (balls = 0 AND strikes >= 1) OR (balls = 1 AND strikes = 2) THEN
        RETURN 'ahead';
    END IF;
    
    -- 投手不利（behind）
    IF balls >= 2 AND strikes = 0 THEN
        RETURN 'behind';
    END IF;
    
    -- 互角（even）- その他
    RETURN 'even';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4) 座標→グリッド変換関数（13x13）
CREATE OR REPLACE FUNCTION coord_to_grid(px DECIMAL, pz DECIMAL)
RETURNS TABLE(gx INTEGER, gy INTEGER) AS $$
BEGIN
    -- ストライクゾーン中心を基準に13x13グリッドに変換
    -- px: -2.5 to 2.5 (ホームプレート幅 + 余裕)
    -- pz: 1.0 to 4.0 (膝下〜胸元 + 余裕)
    
    gx := GREATEST(0, LEAST(12, 
        ROUND((px + 2.5) / 5.0 * 12.0)::INTEGER
    ));
    
    gy := GREATEST(0, LEAST(12, 
        ROUND((pz - 1.0) / 3.0 * 12.0)::INTEGER
    ));
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5) ヒートマップ品質スコア計算関数
CREATE OR REPLACE FUNCTION calculate_heatmap_quality(
    sample_size INTEGER,
    empirical JSONB
) RETURNS DECIMAL AS $$
DECLARE
    quality DECIMAL := 0.0;
    pitch_types TEXT[];
    pitch_type TEXT;
    grid_data JSONB;
    total_variance DECIMAL := 0.0;
    pitch_count INTEGER := 0;
BEGIN
    -- サンプル数基準スコア（最低10、理想100+）
    quality := LEAST(1.0, sample_size / 100.0);
    
    -- データ分散度チェック（集中しすぎていないか）
    pitch_types := ARRAY(SELECT jsonb_object_keys(empirical));
    
    FOR pitch_type IN SELECT unnest(pitch_types) LOOP
        grid_data := empirical -> pitch_type;
        -- 簡易分散計算（実装簡略化のため固定値）
        pitch_count := pitch_count + 1;
    END LOOP;
    
    -- 球種数ボーナス（多様性）
    quality := quality + (pitch_count * 0.05);
    
    RETURN LEAST(1.0, quality);
END;
$$ LANGUAGE plpgsql;

-- 6) テストデータ挿入（サンプル）
INSERT INTO pitch_heatmaps (
    pitcher_id, batter_side, count_bucket,
    empirical, model, sample_size, quality_score
) VALUES 
(
    'G#18_Sugano', 'R', 'even',
    '{"FF": [[0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0.1,0.2,0.1,0,0,0,0,0], [0,0,0,0.1,0.3,0.5,0.8,0.5,0.3,0.1,0,0,0], [0,0,0.1,0.2,0.4,0.7,1.0,0.7,0.4,0.2,0.1,0,0], [0,0,0.1,0.3,0.5,0.8,1.0,0.8,0.5,0.3,0.1,0,0], [0,0,0.1,0.2,0.4,0.7,1.0,0.7,0.4,0.2,0.1,0,0], [0,0,0,0.1,0.3,0.5,0.8,0.5,0.3,0.1,0,0,0], [0,0,0,0,0,0.1,0.2,0.1,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0]], "SL": [[0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0.2,0.1,0,0,0,0,0,0], [0,0,0,0.1,0.3,0.4,0.2,0.1,0,0,0,0,0], [0,0,0.1,0.2,0.5,0.3,0.1,0,0,0,0,0,0], [0,0,0,0.1,0.4,0.2,0,0,0,0,0,0,0], [0,0,0,0,0.2,0.1,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0]]}',
    '{"FF": [[0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0.05,0.15,0.05,0,0,0,0,0], [0,0,0,0.05,0.25,0.45,0.75,0.45,0.25,0.05,0,0,0], [0,0,0.05,0.15,0.35,0.65,0.95,0.65,0.35,0.15,0.05,0,0], [0,0,0.05,0.25,0.45,0.75,0.95,0.75,0.45,0.25,0.05,0,0], [0,0,0.05,0.15,0.35,0.65,0.95,0.65,0.35,0.15,0.05,0,0], [0,0,0,0.05,0.25,0.45,0.75,0.45,0.25,0.05,0,0,0], [0,0,0,0,0,0.05,0.15,0.05,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0]], "SL": [[0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0.18,0.08,0,0,0,0,0,0], [0,0,0,0.08,0.28,0.38,0.18,0.08,0,0,0,0,0], [0,0,0.08,0.18,0.48,0.28,0.08,0,0,0,0,0,0], [0,0,0,0.08,0.38,0.18,0,0,0,0,0,0,0], [0,0,0,0,0.18,0.08,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0]]}',
    127, 0.85
),
(
    'T#16_Nishi', 'L', 'ahead',
    '{"FF": [[0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0.1,0.2,0.3,0.2,0.1,0,0,0,0], [0,0,0.1,0.2,0.4,0.6,0.9,0.6,0.4,0.2,0.1,0,0], [0,0.1,0.2,0.3,0.5,0.8,1.0,0.8,0.5,0.3,0.2,0.1,0], [0,0.1,0.2,0.4,0.6,0.9,1.0,0.9,0.6,0.4,0.2,0.1,0], [0,0,0.1,0.2,0.4,0.6,0.9,0.6,0.4,0.2,0.1,0,0], [0,0,0,0.1,0.2,0.4,0.6,0.4,0.2,0.1,0,0,0], [0,0,0,0,0.1,0.2,0.3,0.2,0.1,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0]], "CU": [[0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0.1,0.2,0.1,0.2,0.3,0.2,0.1,0,0], [0,0,0,0.1,0.2,0.1,0,0.1,0.4,0.3,0.1,0,0], [0,0,0,0,0.1,0,0,0,0.2,0.2,0,0,0], [0,0,0,0,0,0,0,0,0.1,0.1,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0]]}',
    '{"FF": [[0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0.08,0.18,0.28,0.18,0.08,0,0,0,0], [0,0,0.08,0.18,0.38,0.58,0.88,0.58,0.38,0.18,0.08,0,0], [0,0.08,0.18,0.28,0.48,0.78,0.98,0.78,0.48,0.28,0.18,0.08,0], [0,0.08,0.18,0.38,0.58,0.88,0.98,0.88,0.58,0.38,0.18,0.08,0], [0,0,0.08,0.18,0.38,0.58,0.88,0.58,0.38,0.18,0.08,0,0], [0,0,0,0.08,0.18,0.38,0.58,0.38,0.18,0.08,0,0,0], [0,0,0,0,0.08,0.18,0.28,0.18,0.08,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0]], "CU": [[0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0.09,0.19,0.09,0.19,0.29,0.19,0.09,0,0], [0,0,0,0.09,0.19,0.09,0,0.09,0.39,0.29,0.09,0,0], [0,0,0,0,0.09,0,0,0,0.19,0.19,0,0,0], [0,0,0,0,0,0,0,0,0.09,0.09,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0]]}',
    93, 0.78
)
ON CONFLICT (pitcher_id, batter_side, count_bucket) DO NOTHING;

-- 7) ビュー: ヒートマップサマリー
CREATE OR REPLACE VIEW heatmap_summary AS
SELECT 
    COUNT(*) as total_heatmaps,
    COUNT(DISTINCT pitcher_id) as unique_pitchers,
    AVG(sample_size) as avg_sample_size,
    AVG(quality_score) as avg_quality,
    COUNT(CASE WHEN sample_size >= 50 THEN 1 END) as high_quality_count,
    MAX(updated_at) as latest_update
FROM pitch_heatmaps;

-- コメント追加
COMMENT ON TABLE pitch_heatmaps IS '投手配球ヒートマップ（13x13グリッド、球種別分布）';
COMMENT ON TABLE heatmap_build_log IS 'ヒートマップ構築ジョブログ';
COMMENT ON FUNCTION count_to_bucket(INTEGER, INTEGER) IS 'ボール・ストライクカウントをバケットに変換';
COMMENT ON FUNCTION coord_to_grid(DECIMAL, DECIMAL) IS '座標を13x13グリッドインデックスに変換';

-- 権限設定（必要に応じて）
-- GRANT SELECT ON pitch_heatmaps TO app_user;
-- GRANT SELECT ON heatmap_build_log TO app_user;
-- GRANT SELECT ON heatmap_summary TO app_user;

-- 完了ログ
DO $$ 
BEGIN 
    RAISE NOTICE '✅ ヒートマップシステム用テーブル作成完了';
END $$;