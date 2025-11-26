import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

interface NPBPlayer {
  player_id: string;
  name: string;
  name_kana: string;
  profile: {
    投打: string;
    '身長／体重': string;
    生年月日: string;
    経歴: string;
    ドラフト: string;
    ポジション?: string;
  };
  url: string;
  stats: any[];
}

interface DBPlayer {
  player_id: string;
  name: string;
  team: string;
  position: string;
  uniform_number: number;
  height: number;
  weight: number;
  birthdate: string;
  debut_date: string;
  throws: string;
  bats: string;
  batting_average: number;
  home_runs: number;
  rbis: number;
  games: number;
  data_source: string;
}

// Read NPB JSON player data
function readNPBPlayer(filename: string): NPBPlayer | null {
  const playersDir = path.join(process.cwd(), 'data', 'player_database_npb', 'players');
  const filePath = path.join(playersDir, filename);
  
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as NPBPlayer;
  } catch (error) {
    return null;
  }
}

// Get NPB JSON files
function getNPBPlayerFiles(): string[] {
  const playersDir = path.join(process.cwd(), 'data', 'player_database_npb', 'players');
  try {
    return fs.readdirSync(playersDir).filter(file => file.endsWith('.json'));
  } catch (error) {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || '';
  const source = searchParams.get('source') || 'hybrid'; // 'db', 'json', 'hybrid'

  try {
    let allPlayers: any[] = [];

    // Get database players (with actual game stats)
    if (source === 'db' || source === 'hybrid') {
      let dbSql = `
        SELECT 
          p.player_id,
          p.name,
          p.team,
          p.position,
          p.uniform_number,
          p.height,
          p.weight,
          p.birthdate,
          p.debut_date,
          p.throws,
          p.bats,
          bs.batting_average,
          bs.home_runs,
          bs.rbis,
          bs.games,
          'database_stats' as data_source
        FROM players p
        LEFT JOIN batting_stats bs ON p.name = bs.name AND bs.year = 2025
        WHERE 1=1
      `;
      let dbParams: any[] = [];

      if (search) {
        dbSql += ' AND p.name LIKE ?';
        dbParams.push(`%${search}%`);
      }

      dbSql += ' ORDER BY p.name LIMIT ? OFFSET ?';
      dbParams.push(limit, offset);

      const dbPlayers = await query(dbSql, dbParams) as DBPlayer[];
      
      allPlayers = allPlayers.concat(dbPlayers.map((p: DBPlayer) => ({
        ...p,
        source: 'database',
        has_stats: p.batting_average !== null,
        formatted_name: p.name,
        profile_data: null
      })));
    }

    // Get NPB JSON players (with detailed profile)
    if (source === 'json' || source === 'hybrid') {
      const npbFiles = getNPBPlayerFiles();
      let npbCount = 0;
      
      for (const filename of npbFiles.slice(0, 100)) { // Limit for performance
        if (npbCount >= limit) break;
        
        const npbPlayer = readNPBPlayer(filename);
        if (!npbPlayer) continue;

        // Apply search filter
        if (search && !npbPlayer.name.includes(search) && !npbPlayer.name_kana.includes(search)) {
          continue;
        }

        // Check if this player already exists in DB
        const existsInDb = allPlayers.some(p => 
          p.name === npbPlayer.name || 
          p.name === npbPlayer.name_kana
        );

        if (!existsInDb || source === 'json') {
          const latestStats = npbPlayer.stats && Array.isArray(npbPlayer.stats)
            ? npbPlayer.stats
                .filter(s => s && s.stats_type === 'batting')
                .sort((a, b) => (b.年度 || 0) - (a.年度 || 0))[0]
            : null;

          allPlayers.push({
            player_id: npbPlayer.player_id,
            name: npbPlayer.name,
            name_kana: npbPlayer.name_kana,
            team: latestStats?.所属球団 || '不明',
            position: npbPlayer.profile?.ポジション || '不明',
            height: npbPlayer.profile?.['身長／体重']?.split('/')?.[0] || null,
            weight: npbPlayer.profile?.['身長／体重']?.split('/')?.[1] || null,
            birthdate: npbPlayer.profile?.生年月日 || null,
            throws: npbPlayer.profile?.投打?.split('投')?.[0] + '投' || null,
            bats: npbPlayer.profile?.投打?.split('投')?.[1] || null,
            batting_average: latestStats?.打率 || null,
            home_runs: latestStats?.本塁打 || null,
            games: latestStats?.試合 || null,
            source: 'npb_json',
            has_stats: latestStats !== null,
            profile_data: npbPlayer.profile,
            url: npbPlayer.url,
            stats_years: npbPlayer.stats ? npbPlayer.stats.length : 0,
            latest_year: latestStats?.年度 || null,
            formatted_name: npbPlayer.name,
            data_source: 'npb_official_json'
          });
          npbCount++;
        }
      }
    }

    // Sort and paginate final result
    const sortedPlayers = allPlayers
      .sort((a, b) => {
        // Prioritize players with stats
        if (a.has_stats && !b.has_stats) return -1;
        if (!a.has_stats && b.has_stats) return 1;
        return a.formatted_name.localeCompare(b.formatted_name, 'ja');
      })
      .slice(offset, offset + limit);

    return NextResponse.json({
      players: sortedPlayers,
      pagination: {
        total: allPlayers.length,
        limit,
        offset,
        hasMore: offset + limit < allPlayers.length
      },
      stats: {
        database_players: allPlayers.filter(p => p.source === 'database').length,
        npb_json_players: allPlayers.filter(p => p.source === 'npb_json').length,
        players_with_stats: allPlayers.filter(p => p.has_stats).length
      },
      source: `hybrid_${source}`,
      message: `Combining database stats (446 players) with NPB JSON profiles (7,638 players)`
    });

  } catch (error) {
    console.error('Hybrid Players API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}