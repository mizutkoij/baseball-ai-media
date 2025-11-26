/**
 * Live Games API - Real-time game data
 */

import { NextResponse } from 'next/server';
import { getLeagueConnection, League } from '@/lib/db';

interface LiveGameData {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed';
  score?: {
    home: number;
    away: number;
  };
  inning?: {
    number: number;
    half: 'top' | 'bottom';
  };
  lastUpdate: string;
  highlights?: {
    type: 'homerun' | 'strikeout' | 'hit' | 'run';
    description: string;
    timestamp: string;
  }[];
  pitchingStats?: {
    homePitcher: {
      name: string;
      era: number;
      strikeouts: number;
      pitchCount: number;
    };
    awayPitcher: {
      name: string;
      era: number;
      strikeouts: number;
      pitchCount: number;
    };
  };
}

interface Game {
  game_id: string;
  date: string;
  home_team: string;
  away_team: string;
  venue: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed';
  home_score: number;
  away_score: number;
  inning: number;
  top_bottom: 'top' | 'bottom';
  updated_at: string;
}

interface Highlight {
  type: 'homerun' | 'strikeout' | 'hit' | 'run';
  description: string;
  timestamp: string;
}

interface Pitcher {
  team: string;
  player_name: string;
  era: number;
  strikeouts: number;
  pitch_count: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const league = searchParams.get('league') || 'npb';

    const db = getLeagueConnection(league as League);
    
    // Get today's games from database
    const query = `
      SELECT 
        g.game_id,
        g.date,
        g.home_team,
        g.away_team,
        g.venue,
        g.status,
        g.home_score,
        g.away_score,
        g.inning,
        g.top_bottom,
        g.updated_at
      FROM games g 
      WHERE date(g.date) = ? 
        AND g.league = ?
      ORDER BY g.scheduled_time ASC
    `;
    
    const games = db.prepare(query).all(date, league) as Game[];
    
    const liveGamesData: LiveGameData[] = games.map((game: Game) => {
      const gameData: LiveGameData = {
        gameId: game.game_id,
        date: game.date,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        venue: game.venue || '未定',
        status: game.status || 'scheduled',
        lastUpdate: game.updated_at || new Date().toISOString()
      };

      // Add scores if available
      if (game.home_score !== null && game.away_score !== null) {
        gameData.score = {
          home: game.home_score,
          away: game.away_score
        };
      }

      // Add inning info if live
      if (game.status === 'live' && game.inning && game.top_bottom) {
        gameData.inning = {
          number: game.inning,
          half: game.top_bottom
        };
      }

      // Get recent highlights
      try {
        const highlightsQuery = `
          SELECT type, description, timestamp 
          FROM game_highlights 
          WHERE game_id = ? 
          ORDER BY timestamp DESC 
          LIMIT 3
        `;
        const highlights = db.prepare(highlightsQuery).all(game.game_id) as Highlight[];
        if (highlights.length > 0) {
          gameData.highlights = highlights;
        }
      } catch (error) {
        // Highlights table might not exist
      }

      // Get pitching stats if live
      if (game.status === 'live') {
        try {
          const pitchingQuery = `
            SELECT 
              p.team,
              p.player_name,
              p.era,
              p.strikeouts,
              p.pitch_count
            FROM current_pitchers cp
            JOIN player_stats p ON cp.player_id = p.player_id
            WHERE cp.game_id = ?
          `;
          const pitchers = db.prepare(pitchingQuery).all(game.game_id) as Pitcher[];
          
          if (pitchers.length >= 2) {
            const homePitcher = pitchers.find((p: Pitcher) => p.team === game.home_team);
            const awayPitcher = pitchers.find((p: Pitcher) => p.team === game.away_team);
            
            if (homePitcher && awayPitcher) {
              gameData.pitchingStats = {
                homePitcher: {
                  name: homePitcher.player_name,
                  era: homePitcher.era || 0,
                  strikeouts: homePitcher.strikeouts || 0,
                  pitchCount: homePitcher.pitch_count || 0
                },
                awayPitcher: {
                  name: awayPitcher.player_name,
                  era: awayPitcher.era || 0,
                  strikeouts: awayPitcher.strikeouts || 0,
                  pitchCount: awayPitcher.pitch_count || 0
                }
              };
            }
          }
        } catch (error) {
          // Pitching stats might not be available
        }
      }

      return gameData;
    });

    // If no games found in database, return simulated data for demonstration
    if (liveGamesData.length === 0) {
      const simulatedGames = generateSimulatedGames(date, league);
      return NextResponse.json({
        success: true,
        data: simulatedGames,
        timestamp: new Date().toISOString(),
        source: 'simulated'
      });
    }

    return NextResponse.json({
      success: true,
      data: liveGamesData,
      timestamp: new Date().toISOString(),
      source: 'database'
    });

  } catch (error) {
    console.error('Error fetching live games:', error);
    
    // Return fallback data
    const fallbackGames = generateSimulatedGames(
      new Date().toISOString().split('T')[0], 
      'npb'
    );
    
    return NextResponse.json({
      success: false,
      data: fallbackGames,
      timestamp: new Date().toISOString(),
      error: 'Database unavailable, showing simulated data'
    });
  }
}

function generateSimulatedGames(date: string, league: string): LiveGameData[] {
  const teams = league === 'npb' ? [
    { name: '巨人', venue: '東京ドーム' },
    { name: 'ヤクルト', venue: '神宮球場' },
    { name: '阪神', venue: '甲子園' },
    { name: '広島', venue: 'マツダスタジアム' },
    { name: '中日', venue: 'バンテリンドーム' },
    { name: 'DeNA', venue: '横浜スタジアム' },
    { name: 'ソフトバンク', venue: 'PayPayドーム' },
    { name: '日本ハム', venue: 'エスコンフィールド' },
    { name: '西武', venue: 'ベルーナドーム' },
    { name: 'ロッテ', venue: 'ZOZOマリンスタジアム' },
    { name: 'オリックス', venue: '京セラドーム' },
    { name: '楽天', venue: 'rakuten生命パーク' }
  ] : [];

  const games: LiveGameData[] = [];
  const now = new Date();
  const gameStatuses: ('scheduled' | 'live' | 'finished')[] = ['scheduled', 'live', 'live', 'finished'];

  for (let i = 0; i < Math.min(6, teams.length / 2); i++) {
    const homeTeam = teams[i * 2];
    const awayTeam = teams[i * 2 + 1];
    const status = gameStatuses[Math.floor(Math.random() * gameStatuses.length)];
    
    const game: LiveGameData = {
      gameId: `${date.replace(/-/g, '')}_${homeTeam.name.slice(0, 2)}-${awayTeam.name.slice(0, 2)}_01`,
      date,
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      venue: homeTeam.venue,
      status,
      lastUpdate: new Date(now.getTime() - Math.random() * 300000).toISOString() // 0-5 minutes ago
    };

    if (status === 'live' || status === 'finished') {
      game.score = {
        home: Math.floor(Math.random() * 10),
        away: Math.floor(Math.random() * 10)
      };

      if (status === 'live') {
        game.inning = {
          number: Math.floor(Math.random() * 6) + 4, // 4-9 inning
          half: Math.random() > 0.5 ? 'top' : 'bottom'
        };

        // Add some highlights for live games
        game.highlights = [
          {
            type: 'homerun',
            description: `${awayTeam.name} 選手がソロホームラン！`,
            timestamp: new Date(now.getTime() - Math.random() * 1800000).toISOString()
          }
        ];

        // Add pitching stats for live games
        game.pitchingStats = {
          homePitcher: {
            name: '田中 将大',
            era: 2.45 + Math.random(),
            strikeouts: Math.floor(Math.random() * 8),
            pitchCount: 60 + Math.floor(Math.random() * 40)
          },
          awayPitcher: {
            name: '大谷 翔平',
            era: 2.10 + Math.random(),
            strikeouts: Math.floor(Math.random() * 10),
            pitchCount: 65 + Math.floor(Math.random() * 35)
          }
        };
      }
    }

    games.push(game);
  }

  return games;
}