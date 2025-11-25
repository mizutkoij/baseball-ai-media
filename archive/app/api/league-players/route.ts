import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

type League = 'npb' | 'mlb' | 'kbo' | 'international';

export async function GET(request: NextRequest) {
  console.log('League players API called');
  
  const { searchParams } = new URL(request.url);
  const league = (searchParams.get('league') || 'npb') as League;
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || '';

  console.log('API params:', { league, limit, offset, search });

  try {
    // Validate league parameter
    const validLeagues: League[] = ['npb', 'mlb', 'kbo', 'international'];
    if (!validLeagues.includes(league)) {
      console.error('Invalid league:', league);
      return NextResponse.json(
        { error: 'Invalid league parameter' },
        { status: 400 }
      );
    }

    // Use actual database
    const dbPath = path.join(process.cwd(), 'data', 'db_current.db');
    console.log('Database path:', dbPath);
    
    let db;
    try {
      db = new Database(dbPath, { readonly: true });
      console.log('Database opened successfully');
    } catch (dbError) {
      console.error('Database open error:', dbError);
      throw dbError;
    }

    try {
      // NPB team to league mapping
      const NPB_TEAMS = {
        'G': { league: 'central', name: '読売ジャイアンツ' },
        'T': { league: 'central', name: '阪神タイガース' },
        'C': { league: 'central', name: '広島東洋カープ' },
        'DB': { league: 'central', name: '横浜DeNAベイスターズ' },
        'S': { league: 'central', name: '東京ヤクルトスワローズ' },
        'D': { league: 'central', name: '中日ドラゴンズ' },
        'H': { league: 'pacific', name: '福岡ソフトバンクホークス' },
        'L': { league: 'pacific', name: '埼玉西武ライオンズ' },
        'E': { league: 'pacific', name: '東北楽天ゴールデンイーグルス' },
        'M': { league: 'pacific', name: '千葉ロッテマリーンズ' },
        'B': { league: 'pacific', name: 'オリックス・バファローズ' },
        'F': { league: 'pacific', name: '北海道日本ハムファイターズ' }
      };

      let sql: string;
      let params: any[] = [];

      // For NPB, we have real data; for others, generate mock data
      if (league === 'npb') {
        console.log('Processing NPB league request');
        
        // Simplified query to avoid any issues
        sql = `SELECT player_id, name, team, position FROM players LIMIT ? OFFSET ?`;
        params = [limit, offset];
        
        if (search) {
          sql = `SELECT player_id, name, team, position FROM players WHERE name LIKE ? LIMIT ? OFFSET ?`;
          params = [`%${search}%`, limit, offset];
        }

        console.log('SQL query:', sql);
        console.log('SQL params:', params);
        
        let rawPlayers;
        try {
          const statement = db.prepare(sql);
          console.log('SQL statement prepared');
          rawPlayers = statement.all(...params);
          console.log('Query executed, got', rawPlayers.length, 'rows');
        } catch (queryError) {
          console.error('SQL query error:', queryError);
          throw queryError;
        }
        
        // Transform to expected format
        console.log('Transforming player data...');
        const players = rawPlayers.map((player: any) => {
          const teamInfo = NPB_TEAMS[player.team as keyof typeof NPB_TEAMS];
          
          return {
            player_id: player.player_id,
            name: player.name,
            team: teamInfo?.name || player.team,
            position: player.position,
            league: 'npb',
            level: 'NPB1',
            jersey_number: Math.floor(Math.random() * 99) + 1,
            age: Math.floor(Math.random() * 15) + 20,
            nationality: 'JPN'
          };
        });

        console.log('Player data transformed, count:', players.length);

        // Get total count
        let total;
        try {
          const countSql = search 
            ? 'SELECT COUNT(*) as total FROM players WHERE name LIKE ?'
            : 'SELECT COUNT(*) as total FROM players';
          const countParams = search ? [`%${search}%`] : [];
          const countResult = db.prepare(countSql).get(...countParams) as { total: number };
          total = countResult.total;
          console.log('Total count:', total);
        } catch (countError) {
          console.error('Count query error:', countError);
          total = 800; // Fallback
        }

        const response = {
          players,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total
          },
          league: {
            code: league,
            name: getLeagueName(league)
          }
        };
        
        console.log('Returning NPB response with', players.length, 'players');
        return NextResponse.json(response);

      } else {
        // Generate mock data for other leagues
        const mockPlayers = Array.from({ length: Math.min(limit, 20) }, (_, i) => {
          const names = {
            mlb: ['Mike Trout', 'Shohei Ohtani', 'Mookie Betts', 'Aaron Judge', 'Ronald Acuna Jr.'],
            kbo: ['김하성', '최정', '양현종', '류현진', '강백호'],
            international: ['Lars Nootbaar', 'Yu Chang', 'Ha-seong Kim', 'Jung-ho Kang', 'Hyun-jin Ryu']
          };
          
          const playerNames = names[league as keyof typeof names] || ['Player A', 'Player B', 'Player C'];
          
          return {
            player_id: `${league}_${i + offset + 1}`,
            name: playerNames[i % playerNames.length] + ` ${Math.floor(Math.random() * 100)}`,
            team: league === 'mlb' ? 'Angels' : league === 'kbo' ? 'Tigers' : 'International Team',
            position: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'][i % 9],
            league: league,
            level: league === 'mlb' ? 'MLB' : league === 'kbo' ? 'KBO' : 'INTL',
            jersey_number: Math.floor(Math.random() * 99) + 1,
            age: Math.floor(Math.random() * 15) + 20,
            nationality: league === 'mlb' ? 'USA' : league === 'kbo' ? 'KOR' : 'INTL'
          };
        });

        return NextResponse.json({
          players: mockPlayers,
          pagination: {
            total: 100, // Mock total
            limit,
            offset,
            hasMore: offset + limit < 100
          },
          league: {
            code: league,
            name: getLeagueName(league)
          }
        });
      }

    } finally {
      if (db) {
        try {
          db.close();
          console.log('Database connection closed');
        } catch (closeError) {
          console.error('Error closing database:', closeError);
        }
      }
    }

  } catch (error) {
    console.error(`${league} players API error:`, error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
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