const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

let pgPool = null;
try {
  const { Pool } = require('pg');
  pgPool = new Pool({
    host: process.env.SCOUTING_DB_HOST || 'localhost',
    port: parseInt(process.env.SCOUTING_DB_PORT || '5432', 10),
    database: process.env.SCOUTING_DB_NAME || 'baseball_ai_v2',
    user: process.env.SCOUTING_DB_USER || 'baseball_user',
    password: process.env.SCOUTING_DB_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30000,
  });
} catch (err) {
  console.warn('[scouting] pg pool init skipped (install "pg" to enable):', err.message);
}

const app = express();
const PORT = process.env.PORT || 3001;
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '..', 'output');

// Middleware
app.use(cors({
  origin: [
    'https://baseball-ai-media.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    /^https:\/\/baseball-ai-media.*\.vercel\.app$/
  ],
  credentials: true
}));
app.use(compression());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    outputDir: OUTPUT_DIR,
    outputDirExists: fs.existsSync(OUTPUT_DIR)
  });
});

// Player detailed stats endpoint
app.get('/api/players/:id/detailed-stats', (req, res) => {
  try {
    const { id } = req.params;
    const { year = '2025', team, name } = req.query;

    if (!team || !name) {
      return res.status(400).json({
        error: 'team and name parameters are required'
      });
    }

    const basePath = path.join(OUTPUT_DIR, year, team);

    if (!fs.existsSync(basePath)) {
      console.warn(`Team directory not found: ${basePath}`);
      return res.status(404).json({
        error: 'Team directory not found'
      });
    }

    // Find player directory (with or without jersey number)
    const teamDirs = fs.readdirSync(basePath);
    const playerDir = teamDirs.find(dir =>
      dir.includes(name) || dir.endsWith(`_${name}`)
    );

    if (!playerDir) {
      console.warn(`Player directory not found for: ${name} in ${team}`);
      return res.status(404).json({
        error: 'Player stats not found'
      });
    }

    const playerPath = path.join(basePath, playerDir);
    const stats = {};

    // Define all stat files to load
    const statFiles = {
      'basic_info.json': 'basic_info',
      'farm_stats.json': 'farm_stats',
      'Day_Nighter別成績.json': 'day_night',
      'Home_Visitor別成績.json': 'home_visitor',
      'カウント別成績.json': 'count_based',
      'ランナ−別成績.json': 'runner_situation',
      '月別成績.json': 'monthly',
      '週間成績.json': 'weekly',
      '球場別成績.json': 'ballpark',
      '対チーム別成績(リーグ).json': 'opponent_team_league',
      '対チーム別成績(交流戦).json': 'opponent_team_interleague',
      '対左右別成績.json': 'vs_leftright',
      '打順別成績(先発時).json': 'batting_order',
      '球種一覧 (※参照データ：Sportsnavi・四球に故意四球はカウントせず).json': 'pitch_types',
      '打球方向(安打・本塁・凡打はそれぞれに対する割合).json': 'hit_direction',
      '打撃内容一覧(フライはライナー・犠飛含む).json': 'hit_content',
      '盗塁状況別マトリクス - 二塁盗塁 -.json': 'stolen_base_2nd',
      '盗塁状況別マトリクス - 三塁盗塁 -.json': 'stolen_base_3rd',
      '盗塁状況別マトリクス - 本塁盗塁 -.json': 'stolen_base_home',
      '本塁打の種別一覧.json': 'homerun_types',
      '通算成績(各種指標).json': 'career_stats',
      '登録状況.json': 'registration_status',
      '登録履歴.json': 'registration_history'
    };

    // Load all available stat files
    for (const [filename, key] of Object.entries(statFiles)) {
      const filePath = path.join(playerPath, filename);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          stats[key] = JSON.parse(content);
        } catch (error) {
          console.error(`Error reading ${filename}:`, error.message);
        }
      }
    }

    if (Object.keys(stats).length === 0) {
      return res.status(404).json({
        error: 'No stats found for player'
      });
    }

    res.json(stats);
  } catch (error) {
    console.error('Error loading player detailed stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// List available teams endpoint
app.get('/api/teams', (req, res) => {
  try {
    const { year = '2025' } = req.query;
    const basePath = path.join(OUTPUT_DIR, year);

    if (!fs.existsSync(basePath)) {
      return res.status(404).json({
        error: 'Year directory not found',
        year
      });
    }

    const teams = fs.readdirSync(basePath)
      .filter(item => {
        const itemPath = path.join(basePath, item);
        return fs.statSync(itemPath).isDirectory();
      });

    res.json({ year, teams });
  } catch (error) {
    console.error('Error listing teams:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// List players in a team endpoint
app.get('/api/teams/:team/players', (req, res) => {
  try {
    const { team } = req.params;
    const { year = '2025' } = req.query;
    const basePath = path.join(OUTPUT_DIR, year, team);

    if (!fs.existsSync(basePath)) {
      return res.status(404).json({
        error: 'Team directory not found',
        team,
        year
      });
    }

    const players = fs.readdirSync(basePath)
      .filter(item => {
        const itemPath = path.join(basePath, item);
        return fs.statSync(itemPath).isDirectory();
      })
      .map(dir => {
        // Extract player name from "00_林琢真" format
        const match = dir.match(/_(.+)$/);
        return {
          directory: dir,
          name: match ? match[1] : dir
        };
      });

    res.json({ year, team, players });
  } catch (error) {
    console.error('Error listing players:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// ============================================================
// Scouting Reports endpoints (Phase 6 of pitcher-probability-engine)
// Data source: PostgreSQL scouting_reports table
// ============================================================

const SCOUTING_FIELDS = `
    pitcher_id_npbplus, opponent_team_id,
    to_char(game_date, 'YYYY-MM-DD') AS game_date,
    pitcher_slug, team_slug, pitcher_name_ja, team_name_ja,
    schema_version, season_year, generated_at, confidence,
    payload, og_image_url, headline, finding_count,
    meta_title, meta_description
`;

function ensurePool(res) {
  if (!pgPool) {
    res.status(503).json({ error: 'Database not configured' });
    return false;
  }
  return true;
}

// Detail: one scouting report by slug + date
app.get('/api/scouting/:pitcherSlug/:teamSlug/:date', async (req, res) => {
  if (!ensurePool(res)) return;
  const { pitcherSlug, teamSlug, date } = req.params;
  try {
    const sql = `
      SELECT ${SCOUTING_FIELDS}
      FROM scouting_reports
      WHERE pitcher_slug = $1 AND team_slug = $2 AND game_date = $3
      LIMIT 1
    `;
    const { rows } = await pgPool.query(sql, [pitcherSlug, teamSlug, date]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    res.json(rows[0]);
  } catch (err) {
    console.error('[scouting] detail error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

// Latest report per pitcher-team slug pair (for /scouting/[pitcher]/vs/[team] without date)
app.get('/api/scouting/:pitcherSlug/:teamSlug/latest', async (req, res) => {
  if (!ensurePool(res)) return;
  const { pitcherSlug, teamSlug } = req.params;
  try {
    const sql = `
      SELECT ${SCOUTING_FIELDS}
      FROM scouting_reports
      WHERE pitcher_slug = $1 AND team_slug = $2
      ORDER BY game_date DESC, generated_at DESC
      LIMIT 1
    `;
    const { rows } = await pgPool.query(sql, [pitcherSlug, teamSlug]);
    if (!rows.length) {
      return res.status(404).json({ error: 'No report for this pairing' });
    }
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    res.json(rows[0]);
  } catch (err) {
    console.error('[scouting] latest error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

// Index: recent reports across all matchups (for /scouting landing page)
app.get('/api/scouting', async (req, res) => {
  if (!ensurePool(res)) return;
  const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
  try {
    const sql = `
      SELECT pitcher_slug, team_slug, pitcher_name_ja, team_name_ja,
             to_char(game_date, 'YYYY-MM-DD') AS game_date,
             headline, confidence, finding_count,
             og_image_url, generated_at
      FROM scouting_reports
      WHERE game_date >= CURRENT_DATE - INTERVAL '14 days'
      ORDER BY game_date DESC, generated_at DESC
      LIMIT $1
    `;
    const { rows } = await pgPool.query(sql, [limit]);
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    res.json({ reports: rows });
  } catch (err) {
    console.error('[scouting] index error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

// Static params helper for Next.js generateStaticParams
app.get('/api/scouting-slugs', async (req, res) => {
  if (!ensurePool(res)) return;
  try {
    const sql = `
      SELECT pitcher_slug, team_slug,
             to_char(game_date, 'YYYY-MM-DD') AS game_date
      FROM scouting_reports
      WHERE game_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    const { rows } = await pgPool.query(sql);
    res.set('Cache-Control', 'public, max-age=600');
    res.json({ slugs: rows });
  } catch (err) {
    console.error('[scouting] slugs error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Baseball AI Media API Server running on port ${PORT}`);
  console.log(`📂 Output directory: ${OUTPUT_DIR}`);
  console.log(`🌐 CORS enabled for Vercel deployments`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
});
