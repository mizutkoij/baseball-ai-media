import { NextRequest, NextResponse } from "next/server";
import path from 'path';

// Add runtime config to prevent static generation
export const dynamic = 'force-dynamic';

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

// Helper to escape CSV values
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const searchParams = new URLSearchParams(req.url.split('?')[1] || '');
  const playerId = searchParams.get("playerId");
  const year = searchParams.get("year");
  const format = searchParams.get("format") || "csv";

  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  if (format !== "csv") {
    return NextResponse.json({ error: "only csv format supported" }, { status: 400 });
  }

  try {
    const db = getDatabase();
    
    // Get player basic information
    const playerQuery = `
      SELECT player_id, full_name, league, primary_position, current_team, nationality
      FROM detailed_players_master 
      WHERE player_id = ?
    `;
    
    const player = db.prepare(playerQuery).get(parseInt(playerId));
    
    if (!player) {
      db.close();
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    
    // Get yearly performance data
    let performanceQuery = `
      SELECT * FROM yearly_performance 
      WHERE player_id = ?
    `;
    const params = [parseInt(playerId)];
    
    if (year) {
      performanceQuery += ' AND season = ?';
      params.push(parseInt(year));
    }
    
    performanceQuery += ' ORDER BY season DESC';
    
    const yearlyData = db.prepare(performanceQuery).all(...params);
    
    db.close();
    
    // Generate CSV content
    let csvContent = '';
    
    // Header with player info
    csvContent += `# Player Export - ${player.full_name} (ID: ${player.player_id})\n`;
    csvContent += `# League: ${player.league?.toUpperCase()}, Team: ${player.current_team}, Position: ${player.primary_position}\n`;
    csvContent += `# Nationality: ${player.nationality}, Export Date: ${new Date().toISOString()}\n`;
    csvContent += `\n`;
    
    if (yearlyData.length === 0) {
      csvContent += `# No performance data found for player ${playerId}\n`;
      csvContent += `season,team,league,message\n`;
      csvContent += `${year || 'all'},${player.current_team},${player.league},No data available\n`;
    } else {
      // Determine if player is primarily pitcher or batter
      const hasBattingData = yearlyData.some((row: any) => row.at_bats > 0 || row.hits > 0);
      const hasPitchingData = yearlyData.some((row: any) => row.games_pitched > 0 || row.innings_pitched > 0);
      
      if (hasBattingData) {
        // Batting statistics CSV
        csvContent += `# Batting Statistics\n`;
        csvContent += `season,age,team,league,games_played,plate_appearances,at_bats,hits,runs,rbis,doubles,triples,home_runs,walks,strikeouts,stolen_bases,caught_stealing,batting_avg,on_base_pct,slugging_pct,ops\n`;
        
        yearlyData.forEach((row: any) => {
          if (row.at_bats > 0 || row.hits > 0 || row.games_played > 0) {
            csvContent += [
              row.season,
              row.age,
              escapeCsvValue(row.team_name),
              row.league_level,
              row.games_played || 0,
              row.plate_appearances || 0,
              row.at_bats || 0,
              row.hits || 0,
              row.runs || 0,
              row.rbis || 0,
              row.doubles || 0,
              row.triples || 0,
              row.home_runs || 0,
              row.walks || 0,
              row.strikeouts || 0,
              row.stolen_bases || 0,
              row.caught_stealing || 0,
              (row.batting_avg || 0).toFixed(3),
              (row.on_base_pct || 0).toFixed(3),
              (row.slugging_pct || 0).toFixed(3),
              (row.ops || 0).toFixed(3)
            ].join(',') + '\n';
          }
        });
      }
      
      if (hasPitchingData) {
        if (hasBattingData) csvContent += '\n';
        // Pitching statistics CSV
        csvContent += `# Pitching Statistics\n`;
        csvContent += `season,age,team,league,games_pitched,games_started,innings_pitched,wins,losses,saves,holds,hits_allowed,runs_allowed,earned_runs,walks_allowed,strikeouts_pitched,home_runs_allowed,era,whip\n`;
        
        yearlyData.forEach((row: any) => {
          if (row.games_pitched > 0 || row.innings_pitched > 0) {
            csvContent += [
              row.season,
              row.age,
              escapeCsvValue(row.team_name),
              row.league_level,
              row.games_pitched || 0,
              row.games_started_pitcher || 0,
              (row.innings_pitched || 0).toFixed(1),
              row.wins || 0,
              row.losses || 0,
              row.saves || 0,
              row.holds || 0,
              row.hits_allowed || 0,
              row.runs_allowed || 0,
              row.earned_runs || 0,
              row.walks_allowed || 0,
              row.strikeouts_pitched || 0,
              row.home_runs_allowed || 0,
              row.era ? row.era.toFixed(2) : '',
              row.whip ? row.whip.toFixed(3) : ''
            ].join(',') + '\n';
          }
        });
      }
    }
    
    const filename = `${player.league}-player-${playerId}-${player.full_name.replace(/[^a-zA-Z0-9]/g, '_')}-${year || 'all'}-stats.csv`;
    
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
    
  } catch (error) {
    console.error('Export error:', error);
    
    // Fallback to mock data
    const csvData = `# Export Error - Using fallback data
# Player ID: ${playerId}, Year: ${year || 'all'}
# Error: ${error instanceof Error ? error.message : 'Unknown error'}

season,team,league,status
${year || '2024'},Unknown,${playerId.startsWith('11') ? 'KBO' : 'NPB'},Export failed - database unavailable`;

    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="player-${playerId}-${year || 'all'}-error.csv"`,
      },
    });
  }
}