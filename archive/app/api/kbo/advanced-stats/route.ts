import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// Database connection helper
function getDatabase() {
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(process.cwd(), 'comprehensive_baseball_database.db');
    return new Database(dbPath, { readonly: true });
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Failed to connect to database');
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('player_id');
  const season = searchParams.get('season');
  const stat = searchParams.get('stat'); // woba, war, fip, etc.
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  try {
    const db = getDatabase();
    
    if (playerId) {
      // Get advanced stats for specific player
      const playerStatsQuery = `
        SELECT 
          a.*,
          p.full_name, p.current_team, p.primary_position, p.nationality,
          y.games_played, y.at_bats, y.hits, y.home_runs, y.batting_avg,
          y.innings_pitched, y.era, y.wins, y.losses
        FROM kbo_advanced_stats a
        JOIN detailed_players_master p ON a.player_id = p.player_id
        JOIN yearly_performance y ON a.player_id = y.player_id AND a.season = y.season
        WHERE a.player_id = ?
        ORDER BY a.season DESC
      `;
      
      const playerStats = db.prepare(playerStatsQuery).all(playerId);
      
      return NextResponse.json({
        player_stats: playerStats,
        meta: {
          player_id: playerId,
          data_source: 'kbo_advanced_stats'
        }
      });
    }
    
    // Get league leaders or general advanced stats
    let baseQuery = `
      SELECT 
        a.player_id, a.season, a.woba, a.wrc_plus, a.babip, a.batting_war,
        a.fip, a.k_per_9, a.bb_per_9, a.k_bb_ratio, a.pitching_war,
        p.full_name, p.current_team, p.primary_position, p.nationality,
        y.games_played, y.at_bats, y.batting_avg, y.innings_pitched, y.era
      FROM kbo_advanced_stats a
      JOIN detailed_players_master p ON a.player_id = p.player_id
      JOIN yearly_performance y ON a.player_id = y.player_id AND a.season = y.season
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (season) {
      baseQuery += ' AND a.season = ?';
      params.push(parseInt(season));
    }
    
    // Add ordering based on requested stat
    let orderBy = 'a.batting_war DESC NULLS LAST';
    if (stat) {
      switch (stat.toLowerCase()) {
        case 'woba':
          orderBy = 'a.woba DESC NULLS LAST';
          break;
        case 'wrc_plus':
          orderBy = 'a.wrc_plus DESC NULLS LAST';
          break;
        case 'batting_war':
          orderBy = 'a.batting_war DESC NULLS LAST';
          break;
        case 'fip':
          orderBy = 'a.fip ASC NULLS LAST';
          break;
        case 'pitching_war':
          orderBy = 'a.pitching_war DESC NULLS LAST';
          break;
        case 'k_per_9':
          orderBy = 'a.k_per_9 DESC NULLS LAST';
          break;
        default:
          orderBy = 'a.batting_war DESC NULLS LAST';
      }
    }
    
    baseQuery += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const advancedStats = db.prepare(baseQuery).all(...params);
    
    // Get league averages for context
    const leagueAvgsQuery = `
      SELECT 
        AVG(woba) as avg_woba,
        AVG(wrc_plus) as avg_wrc_plus,
        AVG(batting_war) as avg_batting_war,
        AVG(fip) as avg_fip,
        AVG(pitching_war) as avg_pitching_war,
        COUNT(*) as total_records
      FROM kbo_advanced_stats
      WHERE ${season ? 'season = ?' : '1=1'}
    `;
    
    const leagueAvgs = season 
      ? db.prepare(leagueAvgsQuery).get(parseInt(season))
      : db.prepare(leagueAvgsQuery).get();
    
    // Get top performers by category
    const topBattersQuery = `
      SELECT p.full_name, p.current_team, a.season, a.batting_war
      FROM kbo_advanced_stats a
      JOIN detailed_players_master p ON a.player_id = p.player_id
      WHERE a.batting_war IS NOT NULL ${season ? 'AND a.season = ?' : ''}
      ORDER BY a.batting_war DESC
      LIMIT 5
    `;
    
    const topPitchersQuery = `
      SELECT p.full_name, p.current_team, a.season, a.pitching_war
      FROM kbo_advanced_stats a
      JOIN detailed_players_master p ON a.player_id = p.player_id
      WHERE a.pitching_war IS NOT NULL ${season ? 'AND a.season = ?' : ''}
      ORDER BY a.pitching_war DESC
      LIMIT 5
    `;
    
    const topBatters = season 
      ? db.prepare(topBattersQuery).all(parseInt(season))
      : db.prepare(topBattersQuery).all();
    
    const topPitchers = season 
      ? db.prepare(topPitchersQuery).all(parseInt(season))
      : db.prepare(topPitchersQuery).all();
    
    db.close();
    
    return NextResponse.json({
      advanced_stats: advancedStats,
      league_averages: {
        woba: leagueAvgs?.avg_woba ? parseFloat(leagueAvgs.avg_woba.toFixed(3)) : null,
        wrc_plus: leagueAvgs?.avg_wrc_plus ? parseFloat(leagueAvgs.avg_wrc_plus.toFixed(1)) : null,
        batting_war: leagueAvgs?.avg_batting_war ? parseFloat(leagueAvgs.avg_batting_war.toFixed(1)) : null,
        fip: leagueAvgs?.avg_fip ? parseFloat(leagueAvgs.avg_fip.toFixed(2)) : null,
        pitching_war: leagueAvgs?.avg_pitching_war ? parseFloat(leagueAvgs.avg_pitching_war.toFixed(1)) : null,
        total_records: leagueAvgs?.total_records || 0
      },
      top_performers: {
        batters: topBatters.map((b: any) => ({
          name: b.full_name,
          team: b.current_team,
          season: b.season,
          war: parseFloat(b.batting_war.toFixed(1))
        })),
        pitchers: topPitchers.map((p: any) => ({
          name: p.full_name,
          team: p.current_team,
          season: p.season,
          war: parseFloat(p.pitching_war.toFixed(1))
        }))
      },
      pagination: {
        limit,
        offset,
        total_available: leagueAvgs?.total_records || 0
      },
      filters: {
        stat: stat || 'batting_war',
        season: season || 'all'
      },
      meta: {
        data_source: 'kbo_advanced_stats',
        description: 'Advanced sabermetrics for KBO players including WAR, wOBA, FIP, and more'
      }
    });
    
  } catch (error) {
    console.error('KBO Advanced Stats API error:', error);
    
    // Fallback data
    return NextResponse.json({
      error: 'Database unavailable',
      advanced_stats: [],
      league_averages: {
        woba: 0.325,
        wrc_plus: 100,
        fip: 4.10,
        total_records: 0
      },
      top_performers: { batters: [], pitchers: [] },
      meta: { data_source: 'fallback' }
    }, { status: 500 });
  }
}