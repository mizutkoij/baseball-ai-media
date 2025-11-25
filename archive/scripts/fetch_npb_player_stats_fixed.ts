import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const TEAM_MAPPING: Record<string, string> = {
  '神': '阪神', '巨': '巨人', 'デ': 'DeNA', '広': '広島', '中': '中日', 'ヤ': 'ヤクルト',
  'ソ': 'ソフトバンク', '日': '日本ハム', 'オ': 'オリックス', '楽': '楽天', '西': '西武', 'ロ': 'ロッテ'
};

interface PlayerStats {
  playerId: string;
  name: string;
  team: string;
  position: string;
  league: 'central' | 'pacific';
  
  // 打撃成績
  battingStats?: {
    rank: number;
    games: number;
    plateAppearances: number;
    atBats: number;
    runs: number;
    hits: number;
    doubles: number;
    triples: number;
    homeRuns: number;
    totalBases: number;
    rbis: number;
    stolenBases: number;
    caughtStealing: number;
    sacrificeHits: number;
    sacrificeFlies: number;
    walks: number;
    intentionalWalks: number;
    hitByPitch: number;
    strikeouts: number;
    doublePlay: number;
    battingAverage: number;
    sluggingPercentage: number;
    onBasePercentage: number;
  };
  
  // 投手成績
  pitchingStats?: {
    rank: number;
    games: number;
    wins: number;
    losses: number;
    saves: number;
    holds: number;
    inningsPitched: number;
    hits: number;
    homeRuns: number;
    walks: number;
    strikeouts: number;
    wildPitches: number;
    balks: number;
    runs: number;
    earnedRuns: number;
    era: number;
    whip: number;
    winningPercentage: number;
  };
}

interface TeamRoster {
  teamName: string;
  players: PlayerStats[];
  league: 'central' | 'pacific';
  lastUpdated: string;
}

// NPB 2025年成績ページから選手データを取得
async function fetchPlayerStats(league: 'central' | 'pacific'): Promise<PlayerStats[]> {
  const players: PlayerStats[] = [];
  
  const leagueCode = league === 'central' ? 'c' : 'p';
  
  try {
    // 打撃成績ページ
    const battingUrl = `https://npb.jp/bis/2025/stats/bat_${leagueCode}.html`;
    console.log(`🏏 ${league}リーグ打撃成績取得: ${battingUrl}`);
    
    const battingResponse = await fetch(battingUrl);
    const battingHtml = await battingResponse.text();
    const $batting = cheerio.load(battingHtml);
    
    // 打撃成績の抽出
    await extractBattingStats($batting, league, players);
    
    // 投手成績ページ
    const pitchingUrl = `https://npb.jp/bis/2025/stats/pit_${leagueCode}.html`;
    console.log(`⚾ ${league}リーグ投手成績取得: ${pitchingUrl}`);
    
    const pitchingResponse = await fetch(pitchingUrl);
    const pitchingHtml = await pitchingResponse.text();
    const $pitching = cheerio.load(pitchingHtml);
    
    // 投手成績の抽出
    await extractPitchingStats($pitching, league, players);
    
    console.log(`✅ ${league}リーグ選手成績取得完了: ${players.length}人`);
    
    return players;
    
  } catch (error) {
    console.error(`❌ ${league}リーグ選手成績取得エラー: ${error}`);
    return [];
  }
}

// 打撃成績の抽出
async function extractBattingStats($: cheerio.CheerioAPI, league: 'central' | 'pacific', players: PlayerStats[]) {
  console.log('📊 打撃成績テーブル解析中...');
  
  $('table').each((tableIndex, table) => {
    const $table = $(table);
    const headers = $table.find('tr').first().find('th, td');
    
    if (headers.length > 15) { // 打撃成績テーブルの判定
      console.log(`📈 打撃成績テーブル発見: ${headers.length}列`);
      
      $table.find('tr').each((rowIndex, row) => {
        if (rowIndex === 0) return; // ヘッダーをスキップ
        
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 20) {
          try {
            const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
            
            // 選手名とチーム情報の抽出
            const playerInfo = cellTexts[1]; // "選手名(チーム略称)"
            console.log(`🔍 デバッグ: playerInfo = "${playerInfo}"`);
            const match = playerInfo.match(/^(.+?)\(([^)]+)\)$/);
            
            if (match) {
              console.log(`✅ マッチ成功: 名前="${match[1]}", チーム="${match[2]}"`);
            } else {
              console.log(`❌ マッチ失敗: "${playerInfo}"`);
              return; // このループをスキップ
            }
            
            if (match) {
              const playerName = match[1].trim();
              const teamAbbr = match[2].trim();
              const teamName = TEAM_MAPPING[teamAbbr] || teamAbbr;
              
              // 既存の選手を探す
              let player = players.find(p => p.name === playerName && p.team === teamName);
              if (!player) {
                player = {
                  playerId: `${teamAbbr}_${playerName}`,
                  name: playerName,
                  team: teamName,
                  position: 'Unknown',
                  league
                };
                players.push(player);
              }
              
              // 打撃成績を解析
              player.battingStats = {
                rank: parseInt(cellTexts[0]) || 0,
                battingAverage: parseFloat(cellTexts[2]) || 0,
                games: parseInt(cellTexts[3]) || 0,
                plateAppearances: parseInt(cellTexts[4]) || 0,
                atBats: parseInt(cellTexts[5]) || 0,
                runs: parseInt(cellTexts[6]) || 0,
                hits: parseInt(cellTexts[7]) || 0,
                doubles: parseInt(cellTexts[8]) || 0,
                triples: parseInt(cellTexts[9]) || 0,
                homeRuns: parseInt(cellTexts[10]) || 0,
                totalBases: parseInt(cellTexts[11]) || 0,
                rbis: parseInt(cellTexts[12]) || 0,
                stolenBases: parseInt(cellTexts[13]) || 0,
                caughtStealing: parseInt(cellTexts[14]) || 0,
                sacrificeHits: parseInt(cellTexts[15]) || 0,
                sacrificeFlies: parseInt(cellTexts[16]) || 0,
                walks: parseInt(cellTexts[17]) || 0,
                intentionalWalks: parseInt(cellTexts[18]) || 0,
                hitByPitch: parseInt(cellTexts[19]) || 0,
                strikeouts: parseInt(cellTexts[20]) || 0,
                doublePlay: parseInt(cellTexts[21]) || 0,
                sluggingPercentage: parseFloat(cellTexts[22]) || 0,
                onBasePercentage: parseFloat(cellTexts[23]) || 0
              };
              
              console.log(`  🏏 ${player.team} ${playerName}: 打率${player.battingStats.battingAverage}, ${player.battingStats.homeRuns}本塁打`);
            }
          } catch (error) {
            console.warn(`⚠️  打撃成績解析エラー [行${rowIndex}]: ${error}`);
          }
        }
      });
    }
  });
}

// 投手成績の抽出
async function extractPitchingStats($: cheerio.CheerioAPI, league: 'central' | 'pacific', players: PlayerStats[]) {
  console.log('📊 投手成績テーブル解析中...');
  
  $('table').each((tableIndex, table) => {
    const $table = $(table);
    const headers = $table.find('tr').first().find('th, td');
    
    // 投手成績テーブルの判定（防御率テーブル）
    if (headers.length > 15 && $table.text().includes('防御率')) {
      console.log(`📈 投手成績テーブル発見: ${headers.length}列`);
      
      $table.find('tr').each((rowIndex, row) => {
        if (rowIndex === 0) return; // ヘッダーをスキップ
        
        const $row = $(row);
        const cells = $row.find('td');
        
        if (cells.length >= 15) {
          try {
            const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
            
            // 投手名とチーム情報の抽出
            const pitcherInfo = cellTexts[1]; // "投手名(チーム略称)"
            console.log(`🔍 デバッグ(投手): pitcherInfo = "${pitcherInfo}"`);
            const match = pitcherInfo.match(/^(.+?)\(([^)]+)\)$/);
            
            if (match) {
              console.log(`✅ マッチ成功(投手): 名前="${match[1]}", チーム="${match[2]}"`);
            } else {
              console.log(`❌ マッチ失敗(投手): "${pitcherInfo}"`);
              return; // このループをスキップ
            }
            
            if (match) {
              const pitcherName = match[1].trim();
              const teamAbbr = match[2].trim();
              const teamName = TEAM_MAPPING[teamAbbr] || teamAbbr;
              
              // 既存の選手を探す
              let player = players.find(p => p.name === pitcherName && p.team === teamName);
              if (!player) {
                player = {
                  playerId: `${teamAbbr}_${pitcherName}`,
                  name: pitcherName,
                  team: teamName,
                  position: 'P',
                  league
                };
                players.push(player);
              } else {
                player.position = 'P';
              }
              
              // 投手成績を解析
              player.pitchingStats = {
                rank: parseInt(cellTexts[0]) || 0,
                era: parseFloat(cellTexts[2]) || 0,
                games: parseInt(cellTexts[3]) || 0,
                wins: parseInt(cellTexts[4]) || 0,
                losses: parseInt(cellTexts[5]) || 0,
                saves: parseInt(cellTexts[6]) || 0,
                holds: parseInt(cellTexts[7]) || 0,
                inningsPitched: parseFloat(cellTexts[8]) || 0,
                hits: parseInt(cellTexts[9]) || 0,
                homeRuns: parseInt(cellTexts[10]) || 0,
                walks: parseInt(cellTexts[11]) || 0,
                strikeouts: parseInt(cellTexts[12]) || 0,
                wildPitches: parseInt(cellTexts[13]) || 0,
                balks: parseInt(cellTexts[14]) || 0,
                runs: parseInt(cellTexts[15]) || 0,
                earnedRuns: parseInt(cellTexts[16]) || 0,
                whip: parseFloat(cellTexts[17]) || 0,
                winningPercentage: parseFloat(cellTexts[18]) || 0
              };
              
              console.log(`  ⚾ ${player.team} ${pitcherName}: 防御率${player.pitchingStats.era}, ${player.pitchingStats.wins}勝`);
            }
          } catch (error) {
            console.warn(`⚠️  投手成績解析エラー [行${rowIndex}]: ${error}`);
          }
        }
      });
    }
  });
}

// 全リーグ成績を取得
async function fetchAllLeagueStats(): Promise<TeamRoster[]> {
  const allRosters: TeamRoster[] = [];
  
  console.log('🚀 NPB 2025年成績データ取得開始');
  
  // セントラルリーグ
  console.log('\\n📊 セントラルリーグ成績取得中...');
  const centralPlayers = await fetchPlayerStats('central');
  
  // チーム別にグループ化
  const centralTeams: Record<string, PlayerStats[]> = {};
  centralPlayers.forEach(player => {
    if (!centralTeams[player.team]) {
      centralTeams[player.team] = [];
    }
    centralTeams[player.team].push(player);
  });
  
  Object.entries(centralTeams).forEach(([teamName, players]) => {
    allRosters.push({
      teamName,
      players,
      league: 'central',
      lastUpdated: new Date().toISOString()
    });
  });
  
  // レート制限
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // パシフィックリーグ
  console.log('\\n📊 パシフィックリーグ成績取得中...');
  const pacificPlayers = await fetchPlayerStats('pacific');
  
  // チーム別にグループ化
  const pacificTeams: Record<string, PlayerStats[]> = {};
  pacificPlayers.forEach(player => {
    if (!pacificTeams[player.team]) {
      pacificTeams[player.team] = [];
    }
    pacificTeams[player.team].push(player);
  });
  
  Object.entries(pacificTeams).forEach(([teamName, players]) => {
    allRosters.push({
      teamName,
      players,
      league: 'pacific',
      lastUpdated: new Date().toISOString()
    });
  });
  
  return allRosters;
}

// メイン処理
async function main() {
  console.log('🚀 NPB 2025年選手個人成績取得開始');
  
  try {
    // 全リーグ成績を取得
    const teamRosters = await fetchAllLeagueStats();
    
    // データを保存
    const outputPath = path.join(__dirname, '../data/npb_player_stats_2025_fixed.json');
    fs.writeFileSync(outputPath, JSON.stringify(teamRosters, null, 2), 'utf-8');
    
    console.log(`\\n🎉 NPB 2025年選手個人成績取得完了!`);
    console.log(`💾 データ保存: ${outputPath}`);
    
    // サマリー表示
    let totalPlayers = 0;
    let totalBatters = 0;
    let totalPitchers = 0;
    
    console.log(`\\n📊 取得結果サマリー:`);
    teamRosters.forEach(roster => {
      const batters = roster.players.filter(p => p.battingStats).length;
      const pitchers = roster.players.filter(p => p.pitchingStats).length;
      
      console.log(`\\n🏟️  ${roster.teamName} (${roster.league})`);
      console.log(`   総選手数: ${roster.players.length}人`);
      console.log(`   野手: ${batters}人, 投手: ${pitchers}人`);
      
      // トップ選手を表示
      const topBatter = roster.players
        .filter(p => p.battingStats && p.battingStats.battingAverage > 0)
        .sort((a, b) => (b.battingStats?.battingAverage || 0) - (a.battingStats?.battingAverage || 0))[0];
      
      const topPitcher = roster.players
        .filter(p => p.pitchingStats && p.pitchingStats.era > 0)
        .sort((a, b) => (a.pitchingStats?.era || 999) - (b.pitchingStats?.era || 999))[0];
      
      if (topBatter?.battingStats) {
        console.log(`   最高打率: ${topBatter.name} (${topBatter.battingStats.battingAverage})`);
      }
      if (topPitcher?.pitchingStats) {
        console.log(`   最優秀防御率: ${topPitcher.name} (${topPitcher.pitchingStats.era})`);
      }
      
      totalPlayers += roster.players.length;
      totalBatters += batters;
      totalPitchers += pitchers;
    });
    
    console.log(`\\n📈 総計:`);
    console.log(`   全選手: ${totalPlayers}人`);
    console.log(`   野手: ${totalBatters}人`);
    console.log(`   投手: ${totalPitchers}人`);
    
    // 両リーグトップ選手
    const allPlayers = teamRosters.flatMap(roster => roster.players);
    
    const topBattingAvg = allPlayers
      .filter(p => p.battingStats && p.battingStats.battingAverage > 0)
      .sort((a, b) => (b.battingStats?.battingAverage || 0) - (a.battingStats?.battingAverage || 0))[0];
    
    const topHomeRuns = allPlayers
      .filter(p => p.battingStats && p.battingStats.homeRuns > 0)
      .sort((a, b) => (b.battingStats?.homeRuns || 0) - (a.battingStats?.homeRuns || 0))[0];
    
    const topEra = allPlayers
      .filter(p => p.pitchingStats && p.pitchingStats.era > 0)
      .sort((a, b) => (a.pitchingStats?.era || 999) - (b.pitchingStats?.era || 999))[0];
    
    console.log(`\\n🏆 2025年リーダー:`);
    if (topBattingAvg?.battingStats) {
      console.log(`   首位打者: ${topBattingAvg.team} ${topBattingAvg.name} (${topBattingAvg.battingStats.battingAverage})`);
    }
    if (topHomeRuns?.battingStats) {
      console.log(`   本塁打王: ${topHomeRuns.team} ${topHomeRuns.name} (${topHomeRuns.battingStats.homeRuns}本)`);
    }
    if (topEra?.pitchingStats) {
      console.log(`   最優秀防御率: ${topEra.team} ${topEra.name} (${topEra.pitchingStats.era})`);
    }
    
  } catch (error) {
    console.error(`❌ メイン処理エラー: ${error}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { fetchPlayerStats, fetchAllLeagueStats, PlayerStats, TeamRoster };