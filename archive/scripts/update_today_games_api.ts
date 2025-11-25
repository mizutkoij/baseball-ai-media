#!/usr/bin/env tsx
/**
 * update_today_games_api.ts - 今日の試合APIを実データベース対応に更新
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const apiPath = join(process.cwd(), 'app', 'api', 'today-games', 'route.ts');

const newApiContent = `import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(request: NextRequest) {
  const searchParams = new URLSearchParams(request.url.split('?')[1] || '');
  const league = searchParams.get('league') || 'first';
  const provider = searchParams.get('provider') || 'auto';

  try {
    // データベースから今日の試合を取得
    const dbPath = join(process.cwd(), 'data', 'db_current.db');
    
    if (!existsSync(dbPath)) {
      console.warn('Database not found, returning empty data');
      return NextResponse.json({
        source: "no_database",
        provider: "filesystem",
        league: league,
        games: 0,
        data: [],
        ts: new Date().toISOString()
      });
    }

    const db = new Database(dbPath);
    const today = new Date().toISOString().split('T')[0];
    
    // 今日の試合を取得
    const todayGames = db.prepare(\`
      SELECT 
        game_id,
        date,
        start_time_jst,
        status,
        venue,
        away_team,
        home_team,
        away_score,
        home_score,
        attendance,
        league
      FROM games 
      WHERE date = ?
      ORDER BY start_time_jst
    \`).all(today);

    // データ整形
    const formattedGames = todayGames.map((game: any) => {
      // ステータス判定
      let status = 'scheduled';
      let inning = null;
      
      if (game.status === 'final' || game.status === 'finished') {
        status = 'final';
        inning = '試合終了';
      } else if (game.away_score !== null && game.home_score !== null) {
        status = 'final'; // スコアがあれば終了とみなす
        inning = '試合終了';
      }

      return {
        game_id: game.game_id,
        date: game.date,
        start_time_jst: game.start_time_jst || '18:00',
        status: status,
        inning: inning,
        venue: game.venue,
        away_team: game.away_team,
        home_team: game.home_team,
        away_score: game.away_score,
        home_score: game.home_score,
        attendance: game.attendance,
        weather: null, // データベースにない場合はnull
        temperature: null,
        league: game.league,
        links: {
          index: \`/games/\${game.game_id}\`,
          box: \`/games/\${game.game_id}/box\`,
          pbp: \`/games/\${game.game_id}/pbp\`
        }
      };
    });

    db.close();

    const response = {
      source: "database",
      provider: "sqlite",
      league: league,
      games: formattedGames.length,
      ts: new Date().toISOString(),
      wpa_threshold: 0.08,
      data: formattedGames
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in today-games API:', error);
    
    return NextResponse.json({
      source: "error",
      provider: provider,
      league: league,
      games: 0,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      ts: new Date().toISOString()
    }, { status: 500 });
  }
}`;

console.log('📋 Updating today-games API...');

// 現在のファイルをバックアップ
const currentContent = readFileSync(apiPath, 'utf-8');
writeFileSync(apiPath + '.backup', currentContent);
console.log('✅ Backed up existing API');

// 新しいAPIを書き込み
writeFileSync(apiPath, newApiContent);
console.log('✅ Updated today-games API with database integration');

console.log('🎯 API updated successfully!');