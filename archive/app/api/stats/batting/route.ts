import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

// Prevent static generation during build
export const dynamic = 'force-dynamic';

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

interface PlayerStats {
  batting_average: number;
  home_runs: number;
  rbis: number;
  ops: number;
  woba: number;
  games: number;
}

export async function GET(request: NextRequest) {
  const searchParams = new URLSearchParams(request.url.split('?')[1] || '');
  
  // Parse parameters
  const year = parseInt(searchParams.get('year') || '2024');
  const team = searchParams.get('team'); // Optional team filter
  const league = searchParams.get('league'); // 'central', 'pacific', or null for both
  const limit = parseInt(searchParams.get('limit') || '50');
  const sort = searchParams.get('sort') || 'batting_average'; // sorting column
  const order = searchParams.get('order') || 'desc'; // 'asc' or 'desc'
  const minGames = parseInt(searchParams.get('min_games') || '0');
  
  try {
    const dbPath = path.join(process.cwd(), 'data', 'db_enhanced.db');
    const db = new Database(dbPath, { readonly: true });
    
    try {
      // Build SQL query with filters
      let whereClause = 'WHERE year = ?';
      const params: any[] = [year];
      
      if (team) {
        whereClause += ' AND team_code = ?';
        params.push(team);
      }
      
      if (league) {
        whereClause += ' AND league = ?';
        params.push(league);
      }
      
      if (minGames > 0) {
        whereClause += ' AND games >= ?';
        params.push(minGames);
      }
      
      // Validate sort column for security
      const validSortColumns = [
        'batting_average', 'home_runs', 'rbis', 'hits', 'runs', 'games',
        'ops', 'on_base_percentage', 'slugging_percentage', 'stolen_bases',
        'walks', 'strikeouts', 'doubles', 'triples', 'plate_appearances',
        'woba', 'babip', 'iso', 'data_quality_score'
      ];
      
      const sortColumn = validSortColumns.includes(sort) ? sort : 'batting_average';
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      const query = `
        SELECT 
          player_id, name, team_code, team_name, league, position, year,
          games, plate_appearances, at_bats, runs, hits, doubles, triples, 
          home_runs, total_bases, rbis, stolen_bases, caught_stealing,
          sacrifice_hits, sacrifice_flies, walks, intentional_walks,
          hit_by_pitch, strikeouts, double_plays,
          batting_average, on_base_percentage, slugging_percentage, ops,
          woba, wrc_plus, babip, iso,
          data_quality_score, last_updated, data_source
        FROM enhanced_batting_stats 
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}, name ASC
        LIMIT ?
      `;
      
      params.push(limit);
      
      const players = db.prepare(query).all(...params);
      
      // Enhance player data with team metadata
      const enhancedPlayers = players.map((player: any) => {
        const teamInfo = NPB_TEAMS[player.team_code as keyof typeof NPB_TEAMS];
        return {
          ...player,
          team_full_name: teamInfo?.fullName || player.team_name,
          team_short_name: teamInfo?.shortName || player.team_code,
          team_league: teamInfo?.league || player.league,
          team_color: teamInfo?.primaryColor || '#888888',
          // Calculate additional metrics
          singles: player.hits - player.doubles - player.triples - player.home_runs,
          extra_base_hits: player.doubles + player.triples + player.home_runs,
          total_plate_appearances: player.plate_appearances || (player.at_bats + player.walks + player.hit_by_pitch + player.sacrifice_flies + player.sacrifice_hits)
        };
      });
      
      // Calculate league statistics
      const allPlayersQuery = `
        SELECT batting_average, home_runs, rbis, ops, woba, games 
        FROM enhanced_batting_stats 
        WHERE year = ? AND games >= 50
        ${league ? 'AND league = ?' : ''}
      `;
      
      const allPlayersParams: any[] = [year];
      if (league) allPlayersParams.push(league);
      
      const allPlayers = db.prepare(allPlayersQuery).all(...allPlayersParams) as PlayerStats[];
      
      const leagueAverages = {
        batting_average: allPlayers.length > 0 ? 
          Math.round((allPlayers.reduce((sum, p: PlayerStats) => sum + p.batting_average, 0) / allPlayers.length) * 1000) / 1000 : 0,
        home_runs: allPlayers.length > 0 ? 
          Math.round((allPlayers.reduce((sum, p: PlayerStats) => sum + p.home_runs, 0) / allPlayers.length) * 10) / 10 : 0,
        rbis: allPlayers.length > 0 ? 
          Math.round((allPlayers.reduce((sum, p: PlayerStats) => sum + p.rbis, 0) / allPlayers.length) * 10) / 10 : 0,
        ops: allPlayers.length > 0 ? 
          Math.round((allPlayers.reduce((sum, p: PlayerStats) => sum + p.ops, 0) / allPlayers.length) * 1000) / 1000 : 0,
        woba: allPlayers.length > 0 && allPlayers.some(p => p.woba) ? 
          Math.round((allPlayers.filter(p => p.woba).reduce((sum, p: any) => sum + p.woba, 0) / allPlayers.filter(p => p.woba).length) * 1000) / 1000 : null
      };
      
      // Find league leaders
      const leaders = {
        batting_average: allPlayers.length > 0 ? Math.max(...allPlayers.map((p: PlayerStats) => p.batting_average)) : 0,
        home_runs: allPlayers.length > 0 ? Math.max(...allPlayers.map((p: PlayerStats) => p.home_runs)) : 0,
        rbis: allPlayers.length > 0 ? Math.max(...allPlayers.map((p: PlayerStats) => p.rbis)) : 0,
        ops: allPlayers.length > 0 ? Math.max(...allPlayers.map((p: PlayerStats) => p.ops)) : 0
      };
      
      const response = {
        year,
        league,
        team,
        sort_by: sortColumn,
        sort_order: order,
        limit,
        min_games: minGames,
        players: enhancedPlayers,
        summary: {
          total_players: enhancedPlayers.length,
          total_qualified_players: allPlayers.length,
          league_averages: leagueAverages,
          leaders: leaders,
          data_quality: {
            average_score: enhancedPlayers.length > 0 ? 
              Math.round((enhancedPlayers.reduce((sum, p) => sum + p.data_quality_score, 0) / enhancedPlayers.length) * 10) / 10 : 0,
            high_quality_count: enhancedPlayers.filter(p => p.data_quality_score >= 90).length
          }
        },
        last_updated: enhancedPlayers.length > 0 ? enhancedPlayers[0].last_updated : new Date().toISOString(),
        source: 'enhanced_npb_scraper'
      };

      return NextResponse.json(response);
      
    } finally {
      db.close();
    }

  } catch (error) {
    console.error('Error in enhanced batting stats API:', error);
    
    // Fallback to basic mock data if enhanced database fails
    const mockPlayers = Array.from({ length: Math.min(limit, 10) }, (_, i) => {
      const teamCode = ['G', 'T', 'C', 'DB', 'S', 'D', 'H', 'F', 'L', 'M', 'B', 'E'][i % 12];
      const teamInfo = NPB_TEAMS[teamCode as keyof typeof NPB_TEAMS];
      
      return {
        player_id: `fallback_${i + 1}`,
        name: `選手${i + 1}`,
        team_code: teamCode,
        team_name: teamInfo.fullName,
        team_full_name: teamInfo.fullName,
        team_short_name: teamInfo.shortName,
        team_league: teamInfo.league,
        team_color: teamInfo.primaryColor,
        position: ['1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'C', 'DH'][i % 9],
        year,
        games: Math.floor(Math.random() * 50) + 100,
        plate_appearances: Math.floor(Math.random() * 200) + 500,
        at_bats: Math.floor(Math.random() * 200) + 300,
        hits: Math.floor(Math.random() * 100) + 80,
        runs: Math.floor(Math.random() * 60) + 40,
        rbis: Math.floor(Math.random() * 80) + 50,
        doubles: Math.floor(Math.random() * 25) + 15,
        triples: Math.floor(Math.random() * 5) + 1,
        home_runs: Math.floor(Math.random() * 25) + 10,
        walks: Math.floor(Math.random() * 60) + 30,
        strikeouts: Math.floor(Math.random() * 100) + 80,
        stolen_bases: Math.floor(Math.random() * 20) + 5,
        batting_average: Math.round((0.200 + Math.random() * 0.150) * 1000) / 1000,
        on_base_percentage: Math.round((0.250 + Math.random() * 0.150) * 1000) / 1000,
        slugging_percentage: Math.round((0.300 + Math.random() * 0.200) * 1000) / 1000,
        ops: Math.round((0.650 + Math.random() * 0.250) * 1000) / 1000,
        woba: Math.round((0.300 + Math.random() * 0.100) * 1000) / 1000,
        data_quality_score: 75,
        updated_at: new Date().toISOString(),
        source: 'fallback_mock'
      };
    });

    const mockResponse = {
      year,
      league,
      team,
      sort_by: sort,
      sort_order: order,
      limit,
      players: mockPlayers,
      summary: {
        total_players: mockPlayers.length,
        league_averages: {
          batting_average: 0.265,
          home_runs: 18.5,
          rbis: 72.3,
          ops: 0.735
        },
        leaders: {
          batting_average: 0.342,
          home_runs: 45,
          rbis: 125,
          ops: 1.050
        }
      },
      last_updated: new Date().toISOString(),
      source: 'fallback_mock',
      error: 'Enhanced database unavailable'
    };
    
    return NextResponse.json(mockResponse);
  }
}