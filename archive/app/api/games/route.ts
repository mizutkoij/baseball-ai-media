import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// NPB team information with enhanced metadata
const NPB_TEAMS = {
  'G': { code: 'G', shortName: '巨人', fullName: '読売ジャイアンツ', league: 'central', primaryColor: '#FF6600' },
  'T': { code: 'T', shortName: '阪神', fullName: '阪神タイガース', league: 'central', primaryColor: '#FFE500' },
  'C': { code: 'C', shortName: '広島', fullName: '広島東洋カープ', league: 'central', primaryColor: '#DC143C' },
  'DB': { code: 'DB', shortName: 'DeNA', fullName: '横浜DeNAベイスターズ', league: 'central', primaryColor: '#006BB0' },
  'S': { code: 'S', shortName: 'ヤクルト', fullName: '東京ヤクルトスワローズ', league: 'central', primaryColor: '#3A5FCD' },
  'D': { code: 'D', shortName: '中日', fullName: '中日ドラゴンズ', league: 'central', primaryColor: '#003DA5' },
  'H': { code: 'H', shortName: 'ソフトバンク', fullName: '福岡ソフトバンクホークス', league: 'pacific', primaryColor: '#FFD700' },
  'L': { code: 'L', shortName: '西武', fullName: '埼玉西武ライオンズ', league: 'pacific', primaryColor: '#00008B' },
  'E': { code: 'E', shortName: '楽天', fullName: '東北楽天ゴールデンイーグルス', league: 'pacific', primaryColor: '#8B0000' },
  'M': { code: 'M', shortName: 'ロッテ', fullName: '千葉ロッテマリーンズ', league: 'pacific', primaryColor: '#000080' },
  'B': { code: 'B', shortName: 'オリックス', fullName: 'オリックス・バファローズ', league: 'pacific', primaryColor: '#003DA5' },
  'F': { code: 'F', shortName: '日本ハム', fullName: '北海道日本ハムファイターズ', league: 'pacific', primaryColor: '#87CEEB' }
};

// MLB team information
const MLB_TEAMS = {
  'NYY': { code: 'NYY', shortName: 'ヤンキース', fullName: 'ニューヨーク・ヤンキース', league: 'al_east', primaryColor: '#002868' },
  'BOS': { code: 'BOS', shortName: 'レッドソックス', fullName: 'ボストン・レッドソックス', league: 'al_east', primaryColor: '#BD3039' },
  'TB': { code: 'TB', shortName: 'レイズ', fullName: 'タンパベイ・レイズ', league: 'al_east', primaryColor: '#092C5C' },
  'TOR': { code: 'TOR', shortName: 'ブルージェイズ', fullName: 'トロント・ブルージェイズ', league: 'al_east', primaryColor: '#134A8E' },
  'BAL': { code: 'BAL', shortName: 'オリオールズ', fullName: 'ボルチモア・オリオールズ', league: 'al_east', primaryColor: '#DF4601' },
  'CLE': { code: 'CLE', shortName: 'ガーディアンズ', fullName: 'クリーブランド・ガーディアンズ', league: 'al_central', primaryColor: '#E31937' },
  'MIN': { code: 'MIN', shortName: 'ツインズ', fullName: 'ミネソタ・ツインズ', league: 'al_central', primaryColor: '#002B5C' },
  'DET': { code: 'DET', shortName: 'タイガース', fullName: 'デトロイト・タイガース', league: 'al_central', primaryColor: '#0C2340' },
  'KC': { code: 'KC', shortName: 'ロイヤルズ', fullName: 'カンザスシティ・ロイヤルズ', league: 'al_central', primaryColor: '#004687' },
  'CWS': { code: 'CWS', shortName: 'ホワイトソックス', fullName: 'シカゴ・ホワイトソックス', league: 'al_central', primaryColor: '#27251F' },
  'HOU': { code: 'HOU', shortName: 'アストロズ', fullName: 'ヒューストン・アストロズ', league: 'al_west', primaryColor: '#002D62' },
  'TEX': { code: 'TEX', shortName: 'レンジャーズ', fullName: 'テキサス・レンジャーズ', league: 'al_west', primaryColor: '#003278' },
  'SEA': { code: 'SEA', shortName: 'マリナーズ', fullName: 'シアトル・マリナーズ', league: 'al_west', primaryColor: '#005C5C' },
  'LAA': { code: 'LAA', shortName: 'エンゼルス', fullName: 'ロサンゼルス・エンゼルス', league: 'al_west', primaryColor: '#BA0021' },
  'OAK': { code: 'OAK', shortName: 'アスレチックス', fullName: 'オークランド・アスレチックス', league: 'al_west', primaryColor: '#003831' },
  'NYM': { code: 'NYM', shortName: 'メッツ', fullName: 'ニューヨーク・メッツ', league: 'nl_east', primaryColor: '#002D72' },
  'ATL': { code: 'ATL', shortName: 'ブレーブス', fullName: 'アトランタ・ブレーブス', league: 'nl_east', primaryColor: '#CE1141' },
  'PHI': { code: 'PHI', shortName: 'フィリーズ', fullName: 'フィラデルフィア・フィリーズ', league: 'nl_east', primaryColor: '#E81828' },
  'MIA': { code: 'MIA', shortName: 'マーリンズ', fullName: 'マイアミ・マーリンズ', league: 'nl_east', primaryColor: '#00A3E0' },
  'WSH': { code: 'WSH', shortName: 'ナショナルズ', fullName: 'ワシントン・ナショナルズ', league: 'nl_east', primaryColor: '#AB0003' },
  'CHC': { code: 'CHC', shortName: 'カブス', fullName: 'シカゴ・カブス', league: 'nl_central', primaryColor: '#0E3386' },
  'MIL': { code: 'MIL', shortName: 'ブリュワーズ', fullName: 'ミルウォーキー・ブリュワーズ', league: 'nl_central', primaryColor: '#FFC52F' },
  'STL': { code: 'STL', shortName: 'カージナルス', fullName: 'セントルイス・カージナルス', league: 'nl_central', primaryColor: '#C41E3A' },
  'CIN': { code: 'CIN', shortName: 'レッズ', fullName: 'シンシナティ・レッズ', league: 'nl_central', primaryColor: '#C6011F' },
  'PIT': { code: 'PIT', shortName: 'パイレーツ', fullName: 'ピッツバーグ・パイレーツ', league: 'nl_central', primaryColor: '#FDB827' },
  'LAD': { code: 'LAD', shortName: 'ドジャース', fullName: 'ロサンゼルス・ドジャース', league: 'nl_west', primaryColor: '#005A9C' },
  'SD': { code: 'SD', shortName: 'パドレス', fullName: 'サンディエゴ・パドレス', league: 'nl_west', primaryColor: '#2F241D' },
  'SF': { code: 'SF', shortName: 'ジャイアンツ', fullName: 'サンフランシスコ・ジャイアンツ', league: 'nl_west', primaryColor: '#FD5A1E' },
  'COL': { code: 'COL', shortName: 'ロッキーズ', fullName: 'コロラド・ロッキーズ', league: 'nl_west', primaryColor: '#333366' },
  'ARI': { code: 'ARI', shortName: 'ダイヤモンドバックス', fullName: 'アリゾナ・ダイヤモンドバックス', league: 'nl_west', primaryColor: '#A71930' }
};

// Team name to code mapping
const TEAM_NAME_TO_CODE = {
  '読売': 'G', '巨人': 'G',
  '阪神': 'T', 'タイガース': 'T',
  '広島': 'C', 'カープ': 'C',
  'DeNA': 'DB', 'ベイスターズ': 'DB', '横浜': 'DB',
  'ヤクルト': 'S', 'スワローズ': 'S',
  '中日': 'D', 'ドラゴンズ': 'D',
  'ソフトバンク': 'H', 'ホークス': 'H',
  '西武': 'L', 'ライオンズ': 'L',
  '楽天': 'E', 'イーグルス': 'E',
  'ロッテ': 'M', 'マリーンズ': 'M',
  'オリックス': 'B', 'バファローズ': 'B',
  '日本ハム': 'F', 'ファイターズ': 'F'
};

function getTeamCode(teamName: string): string {
  for (const [name, code] of Object.entries(TEAM_NAME_TO_CODE)) {
    if (teamName.includes(name)) {
      return code;
    }
  }
  return teamName.substring(0, 2).toUpperCase();
}

function enhanceGameData(game: any) {
  // If game already has league set to 'mlb', preserve it and its team info
  if (game.league === 'mlb') {
    return {
      ...game,
      homeTeamCode: game.homeTeamCode,
      awayTeamCode: game.awayTeamCode,
      homeTeamInfo: game.homeTeamInfo,
      awayTeamInfo: game.awayTeamInfo,
      league: 'mlb'
    };
  }

  // For NPB games, use the original logic
  const homeCode = getTeamCode(game.homeTeam);
  const awayCode = getTeamCode(game.awayTeam);
  const homeTeamInfo = NPB_TEAMS[homeCode as keyof typeof NPB_TEAMS];
  const awayTeamInfo = NPB_TEAMS[awayCode as keyof typeof NPB_TEAMS];

  return {
    ...game,
    homeTeamCode: homeCode,
    awayTeamCode: awayCode,
    homeTeamInfo,
    awayTeamInfo,
    league: homeTeamInfo?.league || awayTeamInfo?.league || 'unknown'
  };
}

function getMLBGames() {
  try {
    const dbPath = path.join(process.cwd(), 'comprehensive_baseball_database.db');
    if (!fs.existsSync(dbPath)) {
      return [];
    }

    const db = new Database(dbPath, { readonly: true });
    const stmt = db.prepare(`
      SELECT 
        game_id, game_date as date, home_team as homeTeam, away_team as awayTeam,
        home_team_code as homeTeamCode, away_team_code as awayTeamCode,
        venue, game_time as time, home_score as homeScore, away_score as awayScore,
        status, attendance, home_pitcher as homePitcher, away_pitcher as awayPitcher,
        game_duration, weather_condition
      FROM mlb_games 
      ORDER BY game_date DESC
    `);
    
    const games = stmt.all();
    db.close();

    return games.map((game: any) => ({
      ...game,
      league: 'mlb',
      homeTeamInfo: MLB_TEAMS[game.homeTeamCode as keyof typeof MLB_TEAMS],
      awayTeamInfo: MLB_TEAMS[game.awayTeamCode as keyof typeof MLB_TEAMS],
      gameDate: game.date
    }));
  } catch (error) {
    console.error('Error loading MLB games:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const league = searchParams.get('league'); // 'central', 'pacific', 'mlb', or null for all
  const status = searchParams.get('status'); // 'finished', 'scheduled', 'live', or null for all
  const limit = parseInt(searchParams.get('limit') || '50');
  const team = searchParams.get('team'); // specific team code

  try {
    let allGames: any[] = [];

    // Load MLB games if requested or if no specific league filter
    if (!league || league === 'mlb') {
      const mlbGames = getMLBGames();
      allGames = allGames.concat(mlbGames);
    }

    // Load NPB games if requested or if no specific league filter
    if (!league || league === 'central' || league === 'pacific') {
      const dataPath = path.join(process.cwd(), 'data', 'npb_2025_all_games_simple.json');
      
      if (fs.existsSync(dataPath)) {
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const gamesData = JSON.parse(rawData);

        // Convert nested date structure to flat array
        for (const [gameDate, dateGames] of Object.entries(gamesData)) {
          for (const [matchup, gameInfo] of Object.entries(dateGames as any)) {
            allGames.push({
              ...(gameInfo as any),
              matchup,
              gameDate
            });
          }
        }
      }
    }

    // Apply filters
    let filteredGames = allGames;

    // Date filter
    if (date) {
      filteredGames = filteredGames.filter(game => game.date === date);
    }

    // League filter
    if (league) {
      filteredGames = filteredGames.filter(game => {
        const enhanced = enhanceGameData(game);
        return enhanced.league === league;
      });
    }

    // Status filter
    if (status) {
      filteredGames = filteredGames.filter(game => game.status === status);
    }

    // Team filter
    if (team) {
      filteredGames = filteredGames.filter(game => {
        const homeCode = getTeamCode(game.homeTeam);
        const awayCode = getTeamCode(game.awayTeam);
        return homeCode === team.toUpperCase() || awayCode === team.toUpperCase();
      });
    }

    // Sort by date (newest first)
    filteredGames.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Limit results
    if (limit > 0) {
      filteredGames = filteredGames.slice(0, limit);
    }

    // Enhance games with team metadata
    const enhancedGames = filteredGames.map(enhanceGameData);

    // Calculate summary statistics
    const summary = {
      total_games: enhancedGames.length,
      by_status: {
        finished: enhancedGames.filter(g => g.status === 'finished').length,
        scheduled: enhancedGames.filter(g => g.status === 'scheduled').length,
        live: enhancedGames.filter(g => g.status === 'live').length
      },
      by_league: {
        central: enhancedGames.filter(g => g.league === 'central').length,
        pacific: enhancedGames.filter(g => g.league === 'pacific').length,
        mlb: enhancedGames.filter(g => g.league === 'mlb').length,
        interleague: enhancedGames.filter(g => g.homeTeamInfo?.league !== g.awayTeamInfo?.league && g.league !== 'mlb').length
      },
      date_range: {
        earliest: enhancedGames.length > 0 ? enhancedGames[enhancedGames.length - 1].date : null,
        latest: enhancedGames.length > 0 ? enhancedGames[0].date : null
      }
    };

    return NextResponse.json({
      games: enhancedGames,
      summary,
      filters: {
        date,
        league,
        status,
        team,
        limit
      },
      source: 'npb_and_mlb_data',
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error loading NPB games data:', error);
    
    // Fallback mock data
    const mockGames = [
      {
        gameId: 'mock_1',
        date: '2025-08-08',
        homeTeam: '巨人',
        awayTeam: '阪神',
        homeScore: 5,
        awayScore: 3,
        venue: '東京ドーム',
        status: 'finished',
        time: '18:00',
        homeTeamCode: 'G',
        awayTeamCode: 'T',
        homeTeamInfo: NPB_TEAMS.G,
        awayTeamInfo: NPB_TEAMS.T,
        league: 'central'
      }
    ];

    return NextResponse.json({
      games: mockGames,
      summary: {
        total_games: 1,
        by_status: { finished: 1, scheduled: 0, live: 0 },
        by_league: { central: 1, pacific: 0, interleague: 0 }
      },
      source: 'fallback_mock',
      error: 'Failed to load scraped data'
    });
  }
}