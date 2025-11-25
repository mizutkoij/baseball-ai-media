import { Pool } from 'pg';
import { register, Gauge, Counter, Histogram } from 'prom-client';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PGURL,
});

// Prometheus メトリクス定義
const voteMetrics = {
  // 総投票数
  totalVotes: new Gauge({
    name: 'vote_total_votes',
    help: 'Total number of votes today',
    labelNames: ['date']
  }),

  // ユニーク投票者数
  uniqueVoters: new Gauge({
    name: 'vote_unique_voters',
    help: 'Number of unique voters today',
    labelNames: ['date']
  }),

  // チーム別投票数
  votesByTeam: new Gauge({
    name: 'vote_by_team',
    help: 'Number of votes by team',
    labelNames: ['team_code', 'team_name', 'date']
  }),

  // 上位選手の投票数
  topPlayerVotes: new Gauge({
    name: 'vote_top_player_votes',
    help: 'Votes for top player',
    labelNames: ['player_name', 'team_code', 'rank', 'date']
  }),

  // 投票レート（1時間あたり）
  voteRate: new Gauge({
    name: 'vote_rate_per_hour',
    help: 'Voting rate per hour',
    labelNames: ['date']
  }),

  // APIレスポンス時間
  apiResponseTime: new Histogram({
    name: 'vote_api_response_time_seconds',
    help: 'Vote API response time in seconds',
    labelNames: ['method', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5]
  }),

  // エラーカウント
  apiErrors: new Counter({
    name: 'vote_api_errors_total',
    help: 'Total number of vote API errors',
    labelNames: ['method', 'error_type']
  }),

  // 重複投票試行
  duplicateVoteAttempts: new Counter({
    name: 'vote_duplicate_attempts_total',
    help: 'Total number of duplicate vote attempts',
    labelNames: ['date']
  })
};

// メトリクス更新関数
export async function updateVoteMetrics() {
  const client = await pool.connect();
  
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. 基本統計
    const statsResult = await client.query(`
      SELECT * FROM today_vote_stats
    `);

    if (statsResult.rows.length > 0) {
      const stats = statsResult.rows[0];
      voteMetrics.totalVotes.set({ date: today }, parseInt(stats.total_votes) || 0);
      voteMetrics.uniqueVoters.set({ date: today }, parseInt(stats.unique_voters) || 0);
    }

    // 2. チーム別投票数
    const teamStatsResult = await client.query(`
      SELECT 
        team_code,
        CASE team_code
          WHEN 'G' THEN '巨人'
          WHEN 'T' THEN '阪神'
          WHEN 'C' THEN '広島'
          WHEN 'S' THEN 'ヤクルト'
          WHEN 'D' THEN '中日'
          WHEN 'B' THEN 'オリックス'
          WHEN 'H' THEN 'ソフトバンク'
          WHEN 'L' THEN '西武'
          WHEN 'M' THEN 'ロッテ'
          WHEN 'F' THEN '日本ハム'
          WHEN 'E' THEN '楽天'
          ELSE team_code
        END as team_name,
        COUNT(*) as votes
      FROM player_votes 
      WHERE vote_date = CURRENT_DATE
      GROUP BY team_code
    `);

    // チームメトリクスをリセット
    voteMetrics.votesByTeam.reset();
    
    for (const row of teamStatsResult.rows) {
      voteMetrics.votesByTeam.set(
        { 
          team_code: row.team_code, 
          team_name: row.team_name, 
          date: today 
        }, 
        parseInt(row.votes)
      );
    }

    // 3. 上位選手の投票数
    const topPlayersResult = await client.query(`
      SELECT * FROM current_vote_ranking 
      WHERE rank_overall <= 5
      ORDER BY rank_overall
    `);

    // トップ選手メトリクスをリセット
    voteMetrics.topPlayerVotes.reset();

    for (const player of topPlayersResult.rows) {
      voteMetrics.topPlayerVotes.set(
        { 
          player_name: player.player_name,
          team_code: player.team_code,
          rank: player.rank_overall.toString(),
          date: today
        }, 
        parseInt(player.total_votes)
      );
    }

    // 4. 投票レート（過去1時間）
    const rateResult = await client.query(`
      SELECT COUNT(*) as recent_votes
      FROM player_votes 
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `);

    if (rateResult.rows.length > 0) {
      const recentVotes = parseInt(rateResult.rows[0].recent_votes) || 0;
      voteMetrics.voteRate.set({ date: today }, recentVotes);
    }

    console.log(`✅ Vote metrics updated for ${today}`);
    
  } catch (error) {
    console.error('❌ Failed to update vote metrics:', error);
    voteMetrics.apiErrors.inc({ method: 'metrics_update', error_type: 'database_error' });
  } finally {
    client.release();
  }
}

// メトリクス取得関数（API用）
export function recordVoteApiMetrics(method: string, statusCode: number, responseTime: number) {
  voteMetrics.apiResponseTime
    .labels({ method, status: statusCode.toString() })
    .observe(responseTime);
}

// エラー記録関数
export function recordVoteError(method: string, errorType: string) {
  voteMetrics.apiErrors.inc({ method, error_type: errorType });
}

// 重複投票試行記録
export function recordDuplicateVoteAttempt() {
  const today = new Date().toISOString().split('T')[0];
  voteMetrics.duplicateVoteAttempts.inc({ date: today });
}

// メトリクス詳細取得
export async function getVoteMetricsDetails() {
  const client = await pool.connect();
  
  try {
    const today = new Date().toISOString().split('T')[0];

    // 詳細統計クエリ
    const detailsResult = await client.query(`
      SELECT 
        'today' as period,
        COUNT(*) as total_votes,
        COUNT(DISTINCT ip_hash) as unique_voters,
        COUNT(DISTINCT player_id) as players_voted_for,
        COUNT(DISTINCT team_code) as teams_represented,
        MIN(created_at) as first_vote_time,
        MAX(created_at) as latest_vote_time,
        ROUND(AVG(EXTRACT(HOUR FROM created_at)), 2) as avg_vote_hour
      FROM player_votes 
      WHERE vote_date = CURRENT_DATE
      
      UNION ALL
      
      SELECT 
        'last_hour' as period,
        COUNT(*) as total_votes,
        COUNT(DISTINCT ip_hash) as unique_voters,
        COUNT(DISTINCT player_id) as players_voted_for,
        COUNT(DISTINCT team_code) as teams_represented,
        MIN(created_at) as first_vote_time,
        MAX(created_at) as latest_vote_time,
        ROUND(AVG(EXTRACT(HOUR FROM created_at)), 2) as avg_vote_hour
      FROM player_votes 
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `);

    return {
      date: today,
      details: detailsResult.rows,
      timestamp: new Date().toISOString()
    };
  } finally {
    client.release();
  }
}

// 定期実行設定（5分ごと）
export function startVoteMetricsCollection() {
  console.log('🚀 Starting vote metrics collection...');
  
  // 初回実行
  updateVoteMetrics();
  
  // 5分ごとに実行
  const interval = setInterval(updateVoteMetrics, 5 * 60 * 1000);
  
  // プロセス終了時にクリーンアップ
  process.on('SIGINT', () => {
    console.log('🛑 Stopping vote metrics collection...');
    clearInterval(interval);
    process.exit(0);
  });
  
  return interval;
}

// CLI実行
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      startVoteMetricsCollection();
      break;
    case 'update':
      updateVoteMetrics().then(() => process.exit(0));
      break;
    case 'details':
      getVoteMetricsDetails().then(details => {
        console.log(JSON.stringify(details, null, 2));
        process.exit(0);
      });
      break;
    default:
      console.log('Usage: npx tsx scripts/voting-metrics.ts [start|update|details]');
      process.exit(1);
  }
}