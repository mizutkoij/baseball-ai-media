import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('Individual player API called for ID:', params.id);
  
  try {
    const playerId = params.id;
    
    // Use actual database
    const dbPath = path.join(process.cwd(), 'data', 'db_current.db');
    
    if (!fs.existsSync(dbPath)) {
      console.error('Database file not found:', dbPath);
      return NextResponse.json(
        { error: 'Database not found' },
        { status: 404 }
      );
    }
    
    const db = new Database(dbPath, { readonly: true });

    try {
      // Get basic player info from our database
      const playerQuery = `
        SELECT 
          player_id,
          name,
          name_english,
          team,
          position,
          uniform_number,
          height,
          weight,
          birthdate,
          debut_date,
          throws,
          bats,
          created_at,
          updated_at
        FROM players 
        WHERE player_id = ?
      `;
      
      const player = db.prepare(playerQuery).get(playerId);
      
      // Try to load detailed stats from JSON file first
      const jsonFilePath = path.join(process.cwd(), 'data', 'player_database_npb', 'players', `${playerId}.json`);
      let detailedStats = null;
      let first_year = null;
      let last_year = null;
      
      if (fs.existsSync(jsonFilePath)) {
        try {
          const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
          detailedStats = jsonData;
          
          // Extract career span from stats
          if (jsonData.stats && jsonData.stats.length > 0) {
            const years = jsonData.stats
              .map((stat: any) => stat.年度)
              .filter((year: any) => year && year > 1900 && year < 2030)
              .sort((a: number, b: number) => a - b);
            
            if (years.length > 0) {
              first_year = years[0];
              last_year = years[years.length - 1];
            }
          }
          
          console.log('Loaded detailed stats from JSON:', { first_year, last_year, statsCount: jsonData.stats?.length });
        } catch (jsonError) {
          console.error('Error loading JSON stats:', jsonError);
        }
      }
      
      // If player not in database but has JSON data, return JSON-only data
      if (!player && !detailedStats) {
        console.log('Player not found in database or JSON files:', playerId);
        return NextResponse.json(
          { error: 'Player not found' },
          { status: 404 }
        );
      }

      // Calculate age if birthdate is available
      let age = null;
      let birthdate = player?.birthdate;
      
      // If no database entry, try to get birthdate from JSON profile
      if (!birthdate && detailedStats?.profile?.生年月日) {
        const jpDate = detailedStats.profile.生年月日;
        // Convert Japanese date format (YYYY年MM月DD日) to ISO format
        const match = jpDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (match) {
          birthdate = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        }
      }
      
      if (birthdate) {
        try {
          const birthYear = parseInt(birthdate.split('-')[0]);
          age = new Date().getFullYear() - birthYear;
        } catch (err) {
          console.error('Error calculating age:', err);
        }
      }

      // Team to league mapping
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

      // Extract team info from either database or JSON stats
      let teamCode = player?.team;
      if (!teamCode && detailedStats?.stats && detailedStats.stats.length > 0) {
        // Try to extract team from most recent stats
        const recentStat = detailedStats.stats[detailedStats.stats.length - 1];
        const teamName = recentStat.所属球団;
        // Map team names to codes (simplified)
        const teamMapping: { [key: string]: string } = {
          '東北楽天': 'E',
          '読売': 'G',
          '阪神': 'T',
          'ソフトバンク': 'H',
          'ロッテ': 'M',
          'オリックス': 'B',
          '西武': 'L',
          '日本ハム': 'F',
          '広島': 'C',
          '中日': 'D',
          '横浜': 'DB',
          'ヤクルト': 'S'
        };
        
        for (const [name, code] of Object.entries(teamMapping)) {
          if (teamName && teamName.includes(name)) {
            teamCode = code;
            break;
          }
        }
      }
      
      const teamInfo = teamCode ? NPB_TEAMS[teamCode as keyof typeof NPB_TEAMS] : null;
      
      // Determine position from JSON profile if not in database
      let position = player?.position;
      if (!position && detailedStats?.profile?.ポジション) {
        position = detailedStats.profile.ポジション === '投手' ? 'P' : 'B';
      }

      const result = {
        player_id: playerId,
        name: player?.name || detailedStats?.name || '選手',
        name_kana: detailedStats?.name_kana || null,
        name_english: player?.name_english || null,
        url: detailedStats?.url || null,
        first_year: first_year,
        last_year: last_year,
        primary_pos: position === 'P' ? 'P' : 'B',
        position: position || 'B',
        team: teamCode || 'Unknown',
        team_name: teamInfo?.name || teamCode || 'Unknown',
        uniform_number: player?.uniform_number || null,
        height: player?.height || null,
        weight: player?.weight || null,
        birthdate: birthdate,
        debut_date: player?.debut_date || null,
        throws: player?.throws || null,
        bats: player?.bats || null,
        age: age,
        is_active: last_year && last_year >= 2022,
        active_source: player ? 'database' : 'json',
        active_confidence: player ? '推定' : 'JSON',
        batting: detailedStats?.stats?.filter((s: any) => s.stats_type === 'batting') || [],
        pitching: detailedStats?.stats?.filter((s: any) => s.stats_type === 'pitching') || [],
        career: {
          batting: {},
          pitching: {}
        }
      };

      console.log('Returning player data:', { 
        name: result.name, 
        first_year: result.first_year, 
        last_year: result.last_year,
        batting_records: result.batting.length,
        pitching_records: result.pitching.length
      });

      return NextResponse.json(result);

    } finally {
      db.close();
    }

  } catch (error) {
    console.error('Individual player API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}