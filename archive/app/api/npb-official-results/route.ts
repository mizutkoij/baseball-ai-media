import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface NPBGameResult {
  game_id: string;
  date: string;
  away_team: string;
  home_team: string;
  league: string;
  venue?: string;
  status: string;
  final_score: {
    away: number;
    home: number;
  };
  inning_scores: {
    away: number[];
    home: number[];
  };
  game_stats: {
    away_hits: number;
    home_hits: number;
    away_errors: number;
    home_errors: number;
  };
  away_batting: Array<{
    player_name: string;
    position: string;
    at_bats: number;
    hits: number;
    runs: number;
    rbis: number;
    home_runs: number;
    walks: number;
    strikeouts: number;
    batting_average: number;
    doubles: number;
    triples: number;
    on_base_percentage: number;
    slugging_percentage: number;
  }>;
  home_batting: Array<{
    player_name: string;
    position: string;
    at_bats: number;
    hits: number;
    runs: number;
    rbis: number;
    home_runs: number;
    walks: number;
    strikeouts: number;
    batting_average: number;
    doubles: number;
    triples: number;
    on_base_percentage: number;
    slugging_percentage: number;
  }>;
  away_pitching: Array<{
    player_name: string;
    role: string;
    innings_pitched: number;
    hits_allowed: number;
    runs_allowed: number;
    earned_runs: number;
    walks_allowed: number;
    strikeouts: number;
    home_runs_allowed: number;
    pitches_thrown: number;
    strikes: number;
    era: number;
    whip: number;
    result: string;
  }>;
  home_pitching: Array<{
    player_name: string;
    role: string;
    innings_pitched: number;
    hits_allowed: number;
    runs_allowed: number;
    earned_runs: number;
    walks_allowed: number;
    strikeouts: number;
    home_runs_allowed: number;
    pitches_thrown: number;
    strikes: number;
    era: number;
    whip: number;
    result: string;
  }>;
  winning_pitcher?: string;
  losing_pitcher?: string;
  save_pitcher?: string;
  links: {
    index: string;
    box: string;
    pbp: string;
  };
}

interface NPBResultsResponse {
  source: string;
  provider: string;
  updated_at: string;
  games: number;
  data: NPBGameResult[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    const forceRefresh = searchParams.get('refresh') === 'true';

    const outputPath = path.join(process.cwd(), 'snapshots', 'npb_today_results.json');
    const scriptPath = path.join(process.cwd(), 'scripts', 'npb_today_results.py');

    // Check if we need to refresh data
    let shouldRefresh = forceRefresh;
    
    if (!shouldRefresh) {
      try {
        const stats = await fs.stat(outputPath);
        const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
        shouldRefresh = ageMinutes > 30; // Refresh if older than 30 minutes
      } catch {
        shouldRefresh = true; // File doesn't exist
      }
    }

    // Run NPB scraper if needed
    if (shouldRefresh) {
      try {
        console.log('Running NPB official results scraper...');
        await execAsync(`python "${scriptPath}" --output "${outputPath}"`, {
          cwd: process.cwd(),
          timeout: 60000 // 60 second timeout
        });
        console.log('NPB scraper completed successfully');
      } catch (error) {
        console.error('NPB scraper failed:', error);
        // Continue with existing data if available
      }
    }

    // Read results
    let results: NPBResultsResponse;
    try {
      const fileContent = await fs.readFile(outputPath, 'utf-8');
      results = JSON.parse(fileContent);
    } catch (error) {
      console.error('Failed to read NPB results:', error);
      return NextResponse.json({
        success: false,
        error: 'NPB official results not available',
        data: null
      }, { status: 404 });
    }

    // Filter by game ID if requested
    if (gameId) {
      const game = results.data.find(g => g.game_id === gameId);
      if (!game) {
        return NextResponse.json({
          success: false,
          error: 'Game not found in NPB official results',
          data: null
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        source: 'npb_official',
        provider: 'npb.jp',
        updated_at: results.updated_at,
        data: game
      });
    }

    // Return all games
    return NextResponse.json({
      success: true,
      source: 'npb_official',
      provider: 'npb.jp',
      updated_at: results.updated_at,
      games: results.games,
      data: results.data
    });

  } catch (error) {
    console.error('NPB official results API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch NPB official results',
      data: null
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Force refresh NPB data
    const outputPath = path.join(process.cwd(), 'snapshots', 'npb_today_results.json');
    const scriptPath = path.join(process.cwd(), 'scripts', 'npb_today_results.py');

    console.log('Force refreshing NPB official results...');
    await execAsync(`python "${scriptPath}" --output "${outputPath}" --verbose`, {
      cwd: process.cwd(),
      timeout: 120000 // 2 minute timeout for manual refresh
    });

    const fileContent = await fs.readFile(outputPath, 'utf-8');
    const results = JSON.parse(fileContent);

    return NextResponse.json({
      success: true,
      message: 'NPB official results refreshed successfully',
      games: results.games,
      updated_at: results.updated_at
    });

  } catch (error) {
    console.error('NPB refresh failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to refresh NPB official results',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}