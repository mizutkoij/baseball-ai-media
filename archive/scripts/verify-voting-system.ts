#!/usr/bin/env npx tsx

// Day 2投票システム - ワンライン検証コマンド
// 使用法: npx tsx scripts/verify-voting-system.ts

import { Pool } from 'pg';
import { performance } from 'perf_hooks';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PGURL,
});

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BLUE = '\x1b[34m';

function log(color: string, message: string) {
  console.log(`${color}${message}${RESET}`);
}

async function verifyVotingSystem() {
  log(BLUE, '🚀 Day 2: 投票システム検証開始...\n');
  
  const client = await pool.connect();
  let allPassed = true;

  try {
    const checks = [
      // 1. テーブル存在確認
      {
        name: 'PostgreSQL投票テーブル存在確認',
        query: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('player_votes', 'daily_vote_summary', 'vote_statistics')
          ORDER BY table_name
        `,
        expected: 3
      },
      
      // 2. ビュー確認
      {
        name: 'ビュー存在確認',
        query: `
          SELECT table_name 
          FROM information_schema.views 
          WHERE table_schema = 'public' 
          AND table_name IN ('current_vote_ranking', 'today_vote_stats')
          ORDER BY table_name
        `,
        expected: 2
      },
      
      // 3. 関数確認
      {
        name: '関数存在確認',
        query: `
          SELECT routine_name 
          FROM information_schema.routines 
          WHERE routine_schema = 'public' 
          AND routine_name IN ('record_player_vote', 'update_daily_vote_summary')
          ORDER BY routine_name
        `,
        expected: 2
      },
      
      // 4. サンプルデータ確認
      {
        name: 'サンプル投票データ確認',
        query: `SELECT COUNT(*) as count FROM player_votes WHERE vote_date = CURRENT_DATE`,
        expected: 5
      },
      
      // 5. ランキングビュー動作確認
      {
        name: 'ランキング機能確認',
        query: `SELECT COUNT(*) as count FROM current_vote_ranking`,
        expectedMin: 1
      },
      
      // 6. 統計ビュー動作確認
      {
        name: '統計機能確認',
        query: `
          SELECT 
            total_votes, unique_voters, teams_represented 
          FROM today_vote_stats
        `,
        expectedMin: 1
      },
      
      // 7. 制約確認（重複投票防止）
      {
        name: '重複投票制約確認',
        query: `
          SELECT conname 
          FROM pg_constraint 
          WHERE conrelid = 'player_votes'::regclass 
          AND contype = 'u'
        `,
        expected: 1
      }
    ];

    for (const check of checks) {
      const start = performance.now();
      
      try {
        const result = await client.query(check.query);
        const end = performance.now();
        const duration = Math.round(end - start);
        
        let passed = false;
        let resultValue = '';

        if ('expected' in check) {
          const count = Array.isArray(result.rows) ? result.rows.length : parseInt(result.rows[0]?.count || '0');
          passed = count === check.expected;
          resultValue = `${count}/${check.expected}`;
        } else if ('expectedMin' in check) {
          const count = Array.isArray(result.rows) ? result.rows.length : parseInt(result.rows[0]?.count || '0');
          passed = count >= check.expectedMin;
          resultValue = `${count} (>= ${check.expectedMin})`;
        }

        if (passed) {
          log(GREEN, `✅ ${check.name}: ${resultValue} (${duration}ms)`);
        } else {
          log(RED, `❌ ${check.name}: ${resultValue} (${duration}ms)`);
          allPassed = false;
        }
      } catch (error) {
        log(RED, `❌ ${check.name}: エラー - ${error}`);
        allPassed = false;
      }
    }

    // ボーナス: API エンドポイントの存在確認（ファイルシステム）
    console.log();
    const fs = require('fs');
    const path = require('path');
    
    const apiFiles = [
      'app/api/vote/route.ts',
      'app/players/favorite-vote/page.tsx',
      'app/players/favorite-vote/VotingInterface.tsx'
    ];

    for (const file of apiFiles) {
      if (fs.existsSync(path.join(process.cwd(), file))) {
        log(GREEN, `✅ API/UI ファイル: ${file}`);
      } else {
        log(RED, `❌ API/UI ファイル: ${file} が見つかりません`);
        allPassed = false;
      }
    }

    // パフォーマンステスト
    console.log();
    log(BLUE, '⚡ パフォーマンステスト:');
    
    const perfStart = performance.now();
    await client.query(`
      SELECT player_name, total_votes, rank_overall 
      FROM current_vote_ranking 
      ORDER BY rank_overall 
      LIMIT 10
    `);
    const perfEnd = performance.now();
    const perfDuration = Math.round(perfEnd - perfStart);
    
    if (perfDuration < 100) {
      log(GREEN, `✅ ランキング取得: ${perfDuration}ms (高速)`);
    } else if (perfDuration < 500) {
      log(YELLOW, `⚠️ ランキング取得: ${perfDuration}ms (普通)`);
    } else {
      log(RED, `❌ ランキング取得: ${perfDuration}ms (遅い)`);
    }

  } finally {
    client.release();
    await pool.end();
  }

  console.log();
  if (allPassed) {
    log(GREEN, '🎉 Day 2: 投票システム - 全チェック PASSED');
    log(BLUE, '📝 次のステップ:');
    console.log('   1. npm run vote:setup     # 本番DB反映');
    console.log('   2. npm run vote:metrics:start # メトリクス開始'); 
    console.log('   3. 投票ページ確認: /players/favorite-vote');
    console.log('   4. API確認: /api/vote');
    process.exit(0);
  } else {
    log(RED, '❌ 一部のチェックが失敗しました');
    process.exit(1);
  }
}

if (require.main === module) {
  verifyVotingSystem().catch(console.error);
}