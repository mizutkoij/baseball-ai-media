import { NextRequest, NextResponse } from 'next/server';
import { queryLeague, League } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const league = (searchParams.get('league') || 'npb') as League;
  const statType = searchParams.get('type') || 'batting';
  const season = searchParams.get('season') || '2025';
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    // Validate league parameter
    const validLeagues: League[] = ['npb', 'mlb', 'kbo', 'international'];
    if (!validLeagues.includes(league)) {
      return NextResponse.json(
        { error: 'Invalid league parameter' },
        { status: 400 }
      );
    }

    // Validate stat type
    const validStatTypes = ['batting', 'pitching', 'fielding'];
    if (!validStatTypes.includes(statType)) {
      return NextResponse.json(
        { error: 'Invalid stat type. Must be one of: batting, pitching, fielding' },
        { status: 400 }
      );
    }

    let sql: string;
    let orderBy: string;

    if (statType === 'batting') {
      sql = `
        SELECT 
          p.player_id,
          p.name,
          p.team,
          p.position,
          bs.games_played,
          bs.at_bats,
          bs.hits,
          bs.doubles,
          bs.triples,
          bs.home_runs,
          bs.runs_batted_in,
          bs.batting_average,
          bs.on_base_percentage,
          bs.slugging_percentage,
          bs.ops,
          bs.wrc_plus,
          bs.war
        FROM players p
        JOIN batting_stats bs ON p.player_id = bs.player_id
        WHERE bs.season = ? AND bs.at_bats >= 100
      `;
      orderBy = 'ORDER BY bs.wrc_plus DESC, bs.ops DESC';
    } else if (statType === 'pitching') {
      sql = `
        SELECT 
          p.player_id,
          p.name,
          p.team,
          p.position,
          ps.games_played,
          ps.games_started,
          ps.innings_pitched,
          ps.wins,
          ps.losses,
          ps.saves,
          ps.era,
          ps.whip,
          ps.strikeouts,
          ps.walks,
          ps.fip,
          ps.era_minus,
          ps.war
        FROM players p
        JOIN pitching_stats ps ON p.player_id = ps.player_id
        WHERE ps.season = ? AND ps.innings_pitched >= 50
      `;
      orderBy = 'ORDER BY ps.era_minus ASC, ps.fip ASC';
    } else {
      sql = `
        SELECT 
          p.player_id,
          p.name,
          p.team,
          p.position,
          fs.games_played,
          fs.fielding_percentage,
          fs.errors,
          fs.assists,
          fs.putouts,
          fs.double_plays,
          fs.range_factor,
          fs.defensive_runs_saved
        FROM players p
        JOIN fielding_stats fs ON p.player_id = fs.player_id
        WHERE fs.season = ? AND fs.games_played >= 50
      `;
      orderBy = 'ORDER BY fs.defensive_runs_saved DESC, fs.fielding_percentage DESC';
    }

    const finalSql = `${sql} ${orderBy} LIMIT ?`;
    const stats = await queryLeague(league, finalSql, [season, limit]);

    // Get league leaders for different categories
    const leaders = await getLeagueLeaders(league, statType, season);

    return NextResponse.json({
      stats,
      leaders,
      league: {
        code: league,
        name: getLeagueName(league),
        season: season,
        statType: statType
      },
      metadata: {
        totalPlayers: stats.length,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`${league} stats API error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getLeagueLeaders(league: League, statType: string, season: string) {
  try {
    const leaders: any = {};

    if (statType === 'batting') {
      // Home run leader
      const hrSql = `
        SELECT p.name, p.team, bs.home_runs
        FROM players p
        JOIN batting_stats bs ON p.player_id = bs.player_id
        WHERE bs.season = ? AND bs.at_bats >= 100
        ORDER BY bs.home_runs DESC
        LIMIT 1
      `;
      const hrLeader = await queryLeague(league, hrSql, [season]);
      leaders.homeRuns = hrLeader[0] || null;

      // RBI leader
      const rbiSql = `
        SELECT p.name, p.team, bs.runs_batted_in
        FROM players p
        JOIN batting_stats bs ON p.player_id = bs.player_id
        WHERE bs.season = ? AND bs.at_bats >= 100
        ORDER BY bs.runs_batted_in DESC
        LIMIT 1
      `;
      const rbiLeader = await queryLeague(league, rbiSql, [season]);
      leaders.rbi = rbiLeader[0] || null;

      // Batting average leader
      const avgSql = `
        SELECT p.name, p.team, bs.batting_average
        FROM players p
        JOIN batting_stats bs ON p.player_id = bs.player_id
        WHERE bs.season = ? AND bs.at_bats >= 100
        ORDER BY bs.batting_average DESC
        LIMIT 1
      `;
      const avgLeader = await queryLeague(league, avgSql, [season]);
      leaders.battingAverage = avgLeader[0] || null;
    } else if (statType === 'pitching') {
      // ERA leader
      const eraSql = `
        SELECT p.name, p.team, ps.era
        FROM players p
        JOIN pitching_stats ps ON p.player_id = ps.player_id
        WHERE ps.season = ? AND ps.innings_pitched >= 50
        ORDER BY ps.era ASC
        LIMIT 1
      `;
      const eraLeader = await queryLeague(league, eraSql, [season]);
      leaders.era = eraLeader[0] || null;

      // Wins leader
      const winsSql = `
        SELECT p.name, p.team, ps.wins
        FROM players p
        JOIN pitching_stats ps ON p.player_id = ps.player_id
        WHERE ps.season = ? AND ps.innings_pitched >= 50
        ORDER BY ps.wins DESC
        LIMIT 1
      `;
      const winsLeader = await queryLeague(league, winsSql, [season]);
      leaders.wins = winsLeader[0] || null;

      // Strikeouts leader
      const soSql = `
        SELECT p.name, p.team, ps.strikeouts
        FROM players p
        JOIN pitching_stats ps ON p.player_id = ps.player_id
        WHERE ps.season = ? AND ps.innings_pitched >= 50
        ORDER BY ps.strikeouts DESC
        LIMIT 1
      `;
      const soLeader = await queryLeague(league, soSql, [season]);
      leaders.strikeouts = soLeader[0] || null;
    }

    return leaders;
  } catch (error) {
    console.error('Error getting league leaders:', error);
    return {};
  }
}

function getLeagueName(league: League): string {
  switch (league) {
    case 'npb':
      return 'NPB';
    case 'mlb':
      return 'MLB';
    case 'kbo':
      return 'KBO';
    case 'international':
      return 'International';
    default:
      return 'Unknown';
  }
}