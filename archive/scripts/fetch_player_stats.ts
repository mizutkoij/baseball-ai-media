import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const TEAM_CODE_MAPPING: Record<string, string> = {
  'c': '広島', 'd': '中日', 'g': '巨人', 's': 'ヤクルト', 't': '阪神', 'db': 'DeNA',
  'h': 'ソフトバンク', 'f': '日本ハム', 'e': '楽天', 'm': 'ロッテ', 'l': '西武', 'b': 'オリックス'
};

interface PlayerStats {
  playerId: string;
  name: string;
  team: string;
  position: string;
  
  // 打撃成績
  battingStats?: {
    games: number;
    plateAppearances: number;
    atBats: number;
    runs: number;
    hits: number;
    doubles: number;
    triples: number;
    homeRuns: number;
    rbis: number;
    stolenBases: number;
    walks: number;
    strikeouts: number;
    battingAverage: number;
    onBasePercentage: number;
    sluggingPercentage: number;
  };
  
  // 投手成績
  pitchingStats?: {
    games: number;
    wins: number;
    losses: number;
    saves: number;
    holds: number;
    inningsPitched: number;
    hits: number;
    earnedRuns: number;
    walks: number;
    strikeouts: number;
    era: number;
    whip: number;
  };
}

interface TeamRoster {
  teamName: string;
  teamCode: string;
  players: PlayerStats[];
  lastUpdated: string;
}

// NPB選手成績ページから個人成績を取得
async function fetchPlayerStats(teamCode: string, league: 'central' | 'pacific'): Promise<PlayerStats[]> {
  const players: PlayerStats[] = [];
  
  try {
    // 打撃成績ページ
    const battingUrl = `https://npb.jp/bis/2025/stats/${league === 'central' ? 'cle' : 'ple'}_b.html`;
    console.log(`🏏 打撃成績取得: ${battingUrl}`);
    
    const battingResponse = await fetch(battingUrl);
    const battingHtml = await battingResponse.text();
    const $batting = cheerio.load(battingHtml);
    
    // 投手成績ページ
    const pitchingUrl = `https://npb.jp/bis/2025/stats/${league === 'central' ? 'cle' : 'ple'}_p.html`;
    console.log(`⚾ 投手成績取得: ${pitchingUrl}`);
    
    const pitchingResponse = await fetch(pitchingUrl);
    const pitchingHtml = await pitchingResponse.text();
    const $pitching = cheerio.load(pitchingHtml);
    
    // 打撃成績の抽出
    extractBattingStats($batting, teamCode, players);
    
    // 投手成績の抽出
    extractPitchingStats($pitching, teamCode, players);
    
    console.log(`✅ ${TEAM_CODE_MAPPING[teamCode]}の選手成績取得完了: ${players.length}人`);
    
    return players;
    
  } catch (error) {
    console.error(`❌ 選手成績取得エラー [${teamCode}]: ${error}`);
    return [];
  }
}

// 打撃成績の抽出
function extractBattingStats($: cheerio.CheerioAPI, targetTeamCode: string, players: PlayerStats[]) {
  const targetTeam = TEAM_CODE_MAPPING[targetTeamCode];
  
  $('table').each((_, table) => {
    const $table = $(table);
    const headerText = $table.find('tr').first().text();
    
    // 打撃成績テーブルの判定
    if (headerText.includes('打率') || headerText.includes('安打') || headerText.includes('本塁打')) {
      console.log(`📊 打撃成績テーブル発見`);
      
      $table.find('tr').each((rowIndex, row) => {
        if (rowIndex === 0) return; // ヘッダーをスキップ
        
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 10) {
          const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
          
          // チーム名が含まれている列を探す
          let teamColumn = -1;
          let nameColumn = -1;
          
          cellTexts.forEach((text, index) => {
            if (text === targetTeam || text.includes(targetTeam)) {
              teamColumn = index;
              nameColumn = index - 1; // 通常選手名はチーム名の前
            }
          });
          
          if (teamColumn >= 0 && nameColumn >= 0 && cellTexts[nameColumn]) {
            const playerName = cellTexts[nameColumn].trim();
            
            // 既存の選手を探す
            let player = players.find(p => p.name === playerName && p.team === targetTeam);
            if (!player) {
              player = {
                playerId: `${targetTeamCode}_${playerName}`,
                name: playerName,
                team: targetTeam,
                position: 'Unknown'
              };
              players.push(player);
            }
            
            // 打撃成績を解析
            try {
              player.battingStats = {
                games: parseInt(cellTexts[teamColumn + 1]) || 0,
                plateAppearances: parseInt(cellTexts[teamColumn + 2]) || 0,
                atBats: parseInt(cellTexts[teamColumn + 3]) || 0,
                runs: parseInt(cellTexts[teamColumn + 4]) || 0,
                hits: parseInt(cellTexts[teamColumn + 5]) || 0,
                doubles: parseInt(cellTexts[teamColumn + 6]) || 0,
                triples: parseInt(cellTexts[teamColumn + 7]) || 0,
                homeRuns: parseInt(cellTexts[teamColumn + 8]) || 0,
                rbis: parseInt(cellTexts[teamColumn + 9]) || 0,
                stolenBases: parseInt(cellTexts[teamColumn + 10]) || 0,
                walks: parseInt(cellTexts[teamColumn + 11]) || 0,
                strikeouts: parseInt(cellTexts[teamColumn + 12]) || 0,
                battingAverage: parseFloat(cellTexts[teamColumn + 13]) || 0,
                onBasePercentage: parseFloat(cellTexts[teamColumn + 14]) || 0,
                sluggingPercentage: parseFloat(cellTexts[teamColumn + 15]) || 0
              };
              
              console.log(`  📈 ${playerName}: 打率${player.battingStats.battingAverage}, ${player.battingStats.homeRuns}本塁打`);
            } catch (error) {
              console.warn(`⚠️  打撃成績解析エラー [${playerName}]: ${error}`);
            }
          }
        }
      });
    }
  });
}

// 投手成績の抽出
function extractPitchingStats($: cheerio.CheerioAPI, targetTeamCode: string, players: PlayerStats[]) {
  const targetTeam = TEAM_CODE_MAPPING[targetTeamCode];
  
  $('table').each((_, table) => {
    const $table = $(table);
    const headerText = $table.find('tr').first().text();
    
    // 投手成績テーブルの判定
    if (headerText.includes('防御率') || headerText.includes('勝利') || headerText.includes('奪三振')) {
      console.log(`📊 投手成績テーブル発見`);
      
      $table.find('tr').each((rowIndex, row) => {
        if (rowIndex === 0) return; // ヘッダーをスキップ
        
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 10) {
          const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
          
          // チーム名が含まれている列を探す
          let teamColumn = -1;
          let nameColumn = -1;
          
          cellTexts.forEach((text, index) => {
            if (text === targetTeam || text.includes(targetTeam)) {
              teamColumn = index;
              nameColumn = index - 1;
            }
          });
          
          if (teamColumn >= 0 && nameColumn >= 0 && cellTexts[nameColumn]) {
            const playerName = cellTexts[nameColumn].trim();
            
            // 既存の選手を探す
            let player = players.find(p => p.name === playerName && p.team === targetTeam);
            if (!player) {
              player = {
                playerId: `${targetTeamCode}_${playerName}`,
                name: playerName,
                team: targetTeam,
                position: 'P'
              };
              players.push(player);
            } else {
              player.position = 'P';
            }
            
            // 投手成績を解析
            try {
              player.pitchingStats = {
                games: parseInt(cellTexts[teamColumn + 1]) || 0,
                wins: parseInt(cellTexts[teamColumn + 2]) || 0,
                losses: parseInt(cellTexts[teamColumn + 3]) || 0,
                saves: parseInt(cellTexts[teamColumn + 4]) || 0,
                holds: parseInt(cellTexts[teamColumn + 5]) || 0,
                inningsPitched: parseFloat(cellTexts[teamColumn + 6]) || 0,
                hits: parseInt(cellTexts[teamColumn + 7]) || 0,
                earnedRuns: parseInt(cellTexts[teamColumn + 8]) || 0,
                walks: parseInt(cellTexts[teamColumn + 9]) || 0,
                strikeouts: parseInt(cellTexts[teamColumn + 10]) || 0,
                era: parseFloat(cellTexts[teamColumn + 11]) || 0,
                whip: parseFloat(cellTexts[teamColumn + 12]) || 0
              };
              
              console.log(`  📈 ${playerName}: 防御率${player.pitchingStats.era}, ${player.pitchingStats.wins}勝`);
            } catch (error) {
              console.warn(`⚠️  投手成績解析エラー [${playerName}]: ${error}`);
            }
          }
        }
      });
    }
  });
}

// 全チーム成績を取得
async function fetchAllTeamStats(): Promise<TeamRoster[]> {
  const allRosters: TeamRoster[] = [];
  
  const centralTeams = ['g', 's', 't', 'c', 'd', 'db'];
  const pacificTeams = ['h', 'l', 'm', 'f', 'e', 'b'];
  
  console.log('🚀 セントラルリーグ選手成績取得開始');
  
  // セントラルリーグ
  for (const teamCode of centralTeams) {
    console.log(`\n📊 ${TEAM_CODE_MAPPING[teamCode]} 成績取得中...`);
    const players = await fetchPlayerStats(teamCode, 'central');
    
    allRosters.push({
      teamName: TEAM_CODE_MAPPING[teamCode],
      teamCode: teamCode.toUpperCase(),
      players,
      lastUpdated: new Date().toISOString()
    });
    
    // レート制限
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\n🚀 パシフィックリーグ選手成績取得開始');
  
  // パシフィックリーグ
  for (const teamCode of pacificTeams) {
    console.log(`\n📊 ${TEAM_CODE_MAPPING[teamCode]} 成績取得中...`);
    const players = await fetchPlayerStats(teamCode, 'pacific');
    
    allRosters.push({
      teamName: TEAM_CODE_MAPPING[teamCode],
      teamCode: teamCode.toUpperCase(),
      players,
      lastUpdated: new Date().toISOString()
    });
    
    // レート制限
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  return allRosters;
}

// メイン処理
async function main() {
  console.log('🚀 NPB選手個人成績取得開始');
  
  try {
    // 全チーム成績を取得
    const teamRosters = await fetchAllTeamStats();
    
    // データを保存
    const outputPath = path.join(__dirname, '../data/npb_player_stats_2025.json');
    fs.writeFileSync(outputPath, JSON.stringify(teamRosters, null, 2), 'utf-8');
    
    console.log(`\n🎉 NPB選手個人成績取得完了!`);
    console.log(`💾 データ保存: ${outputPath}`);
    
    // サマリー表示
    let totalPlayers = 0;
    let totalBatters = 0;
    let totalPitchers = 0;
    
    teamRosters.forEach(roster => {
      console.log(`\n📊 ${roster.teamName} (${roster.teamCode})`);
      console.log(`   総選手数: ${roster.players.length}人`);
      
      const batters = roster.players.filter(p => p.battingStats).length;
      const pitchers = roster.players.filter(p => p.pitchingStats).length;
      
      console.log(`   野手: ${batters}人, 投手: ${pitchers}人`);
      
      totalPlayers += roster.players.length;
      totalBatters += batters;
      totalPitchers += pitchers;
    });
    
    console.log(`\n📈 総計:`);
    console.log(`   全選手: ${totalPlayers}人`);
    console.log(`   野手: ${totalBatters}人`);
    console.log(`   投手: ${totalPitchers}人`);
    
  } catch (error) {
    console.error(`❌ メイン処理エラー: ${error}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { fetchPlayerStats, fetchAllTeamStats, PlayerStats, TeamRoster };