import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * Yahoo スクレイピングデータ API
 * 収集済みの一球速報データを提供
 */

interface PitchData {
  id: number;
  game_id: string;
  index_code: string;
  pitcher_name: string;
  batter_name: string;
  pitch_sequence: number;
  pitch_type: string;
  velocity: string;
  result: string;
  count: string;
  zone: string;
  runners: string;
  scraped_at: string;
}

interface YahooDataResponse {
  success: boolean;
  source: string;
  total_pitches?: number;
  games?: string[];
  data?: PitchData[];
  error?: string;
}

async function queryYahooDatabase(query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const serverDbPath = '/home/ubuntu/baseball-ai-media/data/yahoo_continuous/yahoo_games.db';
    
    const process = spawn('ssh', [
      '-i', '/home/ubuntu/.ssh/kagoya_key',
      'ubuntu@133.18.111.227',
      `sqlite3 "${serverDbPath}" "${query}"`
    ]);

    let output = '';
    let error = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      error += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(error || `Process exited with code ${code}`));
      }
    });
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    const indexCode = searchParams.get('indexCode');
    const type = searchParams.get('type') || 'summary';

    let query: string;
    let responseData: YahooDataResponse;

    switch (type) {
      case 'summary':
        // 全体統計
        query = `
          SELECT 
            COUNT(*) as total_pitches,
            COUNT(DISTINCT game_id) as total_games,
            COUNT(DISTINCT pitch_type) as pitch_types
          FROM pitch_data;
        `;
        
        const summaryResult = await queryYahooDatabase(query);
        const [totalPitches, totalGames, pitchTypes] = summaryResult.split('|');
        
        // ゲームリスト取得
        const gameQuery = 'SELECT DISTINCT game_id FROM pitch_data ORDER BY game_id;';
        const gameResults = await queryYahooDatabase(gameQuery);
        const games = gameResults.split('\n').filter(g => g.trim());

        responseData = {
          success: true,
          source: 'yahoo_scraping',
          total_pitches: parseInt(totalPitches),
          games: games
        };
        break;

      case 'game':
        if (!gameId) {
          return NextResponse.json({ 
            success: false, 
            error: 'gameId parameter required for game data' 
          }, { status: 400 });
        }

        // 特定試合の全投球データ
        query = `
          SELECT 
            game_id, index_code, pitch_sequence, pitch_type, velocity, result, count, zone
          FROM pitch_data 
          WHERE game_id = '${gameId}' 
          ORDER BY index_code, pitch_sequence;
        `;
        
        const gameResult = await queryYahooDatabase(query);
        const gameRows = gameResult.split('\n').filter(row => row.trim());
        
        const gameData = gameRows.map(row => {
          const [game_id, index_code, pitch_sequence, pitch_type, velocity, result, count, zone] = row.split('|');
          return {
            game_id,
            index_code, 
            pitch_sequence: parseInt(pitch_sequence),
            pitch_type,
            velocity,
            result,
            count,
            zone: zone || ''
          };
        });

        responseData = {
          success: true,
          source: 'yahoo_scraping',
          total_pitches: gameData.length,
          data: gameData as any
        };
        break;

      case 'batter':
        if (!gameId || !indexCode) {
          return NextResponse.json({
            success: false,
            error: 'gameId and indexCode parameters required for batter data'
          }, { status: 400 });
        }

        // 特定打席の投球データ
        query = `
          SELECT 
            game_id, index_code, pitch_sequence, pitch_type, velocity, result, count, zone, scraped_at
          FROM pitch_data 
          WHERE game_id = '${gameId}' AND index_code = '${indexCode}'
          ORDER BY pitch_sequence;
        `;

        const batterResult = await queryYahooDatabase(query);
        const batterRows = batterResult.split('\n').filter(row => row.trim());

        const batterData = batterRows.map(row => {
          const [game_id, index_code, pitch_sequence, pitch_type, velocity, result, count, zone, scraped_at] = row.split('|');
          return {
            game_id,
            index_code,
            pitch_sequence: parseInt(pitch_sequence),
            pitch_type,
            velocity,
            result,
            count,
            zone: zone || '',
            scraped_at
          };
        });

        responseData = {
          success: true,
          source: 'yahoo_scraping',
          total_pitches: batterData.length,
          data: batterData as any
        };
        break;

      case 'live':
        // 最新の収集データ
        query = `
          SELECT 
            game_id, index_code, pitch_sequence, pitch_type, velocity, result, count, scraped_at
          FROM pitch_data 
          ORDER BY scraped_at DESC 
          LIMIT 10;
        `;

        const liveResult = await queryYahooDatabase(query);
        const liveRows = liveResult.split('\n').filter(row => row.trim());

        const liveData = liveRows.map(row => {
          const [game_id, index_code, pitch_sequence, pitch_type, velocity, result, count, scraped_at] = row.split('|');
          return {
            game_id,
            index_code,
            pitch_sequence: parseInt(pitch_sequence),
            pitch_type,
            velocity, 
            result,
            count,
            scraped_at
          };
        });

        responseData = {
          success: true,
          source: 'yahoo_scraping',
          total_pitches: liveData.length,
          data: liveData as any
        };
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid type parameter. Use: summary, game, batter, or live'
        }, { status: 400 });
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Yahoo pitch data API error:', error);
    return NextResponse.json({
      success: false,
      source: 'yahoo_scraping',
      error: 'Failed to fetch Yahoo pitch data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: 'POST method not supported'
  }, { status: 405 });
}