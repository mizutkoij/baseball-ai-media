import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface PlayerProfile {
  投打: string;
  '身長／体重': string;
  生年月日: string;
  経歴: string;
  ドラフト: string;
}

interface PlayerStats {
  年度: number;
  所属球団: string;
  試合?: number;
  打席?: number;
  打数?: number;
  得点?: number;
  安打?: number;
  二塁打?: number;
  三塁打?: number;
  本塁打?: number;
  塁打?: number;
  打点?: number;
  盗塁?: number;
  打率?: number;
  長打率?: number;
  出塁率?: number;
  stats_type: string;
  登板?: number;
  勝利?: number;
  敗北?: number;
  防御率?: number;
  投球回?: string;
}

interface NPBPlayer {
  player_id: string;
  name: string;
  name_kana: string;
  profile: PlayerProfile;
  url: string;
  stats: PlayerStats[];
}

// Get player files from directory
function getPlayerFiles(): string[] {
  const playersDir = path.join(process.cwd(), 'data', 'player_database_npb', 'players');
  try {
    return fs.readdirSync(playersDir).filter(file => file.endsWith('.json'));
  } catch (error) {
    console.error('Error reading players directory:', error);
    return [];
  }
}

// Read and parse player JSON file
function readPlayerData(filename: string): NPBPlayer | null {
  const playersDir = path.join(process.cwd(), 'data', 'player_database_npb', 'players');
  const filePath = path.join(playersDir, filename);
  
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as NPBPlayer;
  } catch (error) {
    console.error(`Error reading player file ${filename}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || '';
  const team = searchParams.get('team') || '';
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null;

  try {
    const playerFiles = getPlayerFiles();
    const totalPlayers = playerFiles.length;
    
    let players: NPBPlayer[] = [];
    let processedCount = 0;
    let foundPlayers: any[] = [];

    // Process files with pagination in mind
    for (let i = 0; i < playerFiles.length && foundPlayers.length < limit + offset; i++) {
      const playerData = readPlayerData(playerFiles[i]);
      if (!playerData) continue;

      // Apply filters
      let matches = true;
      
      if (search) {
        matches = matches && (
          playerData.name.includes(search) || 
          playerData.name_kana.includes(search)
        );
      }
      
      if (team && playerData.stats && Array.isArray(playerData.stats)) {
        matches = matches && playerData.stats.some(stat => 
          stat && stat.所属球団 && stat.所属球団.includes(team)
        );
      }
      
      if (year && playerData.stats && Array.isArray(playerData.stats)) {
        matches = matches && playerData.stats.some(stat => stat && stat.年度 === year);
      }

      if (matches) {
        // Get latest stats for basic info
        const latestStats = playerData.stats && Array.isArray(playerData.stats)
          ? playerData.stats
              .filter(s => s && s.stats_type === 'batting')
              .sort((a, b) => (b.年度 || 0) - (a.年度 || 0))[0]
          : null;
        
        const formattedPlayer = {
          player_id: playerData.player_id,
          name: playerData.name,
          name_kana: playerData.name_kana,
          profile: playerData.profile,
          current_team: latestStats?.所属球団 || '不明',
          position: '不明', // NPB data doesn't have explicit position
          birth_date: playerData.profile.生年月日,
          height_weight: playerData.profile['身長／体重'],
          batting_throwing: playerData.profile.投打,
          draft: playerData.profile.ドラフト,
          career: playerData.profile.経歴,
          url: playerData.url,
          latest_year: latestStats?.年度,
          games_played: latestStats?.試合,
          batting_average: latestStats?.打率,
          home_runs: latestStats?.本塁打,
          stats_count: playerData.stats ? playerData.stats.length : 0
        };
        
        if (processedCount >= offset && foundPlayers.length < limit) {
          foundPlayers.push(formattedPlayer);
        }
        processedCount++;
      }
    }

    return NextResponse.json({
      players: foundPlayers,
      pagination: {
        total: totalPlayers,
        limit,
        offset,
        hasMore: offset + limit < totalPlayers,
        processedCount
      },
      source: 'npb_real_json_data',
      stats: {
        total_files: totalPlayers,
        matched_players: processedCount
      }
    });

  } catch (error) {
    console.error('NPB Real Players API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}