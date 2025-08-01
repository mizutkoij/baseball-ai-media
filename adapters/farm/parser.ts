/**
 * Farm League DOM Parser
 * Isolated adapter for farm league HTML parsing to handle future DOM drift
 */

interface FarmGameData {
  game_id: string;
  date: string;
  league: string;
  away_team: string;
  home_team: string;
  away_score: number;
  home_score: number;
  status: string;
  venue?: string;
  start_time_jst?: string;
}

interface FarmBattingData {
  game_id: string;
  team: string;
  league: string;
  player_id: string;
  name: string;
  batting_order: number;
  position: string;
  AB: number;
  R: number;
  H: number;
  singles_2B: number;
  singles_3B: number;
  HR: number;
  RBI: number;
  BB: number;
  SO: number;
  SB: number;
  CS: number;
  AVG: number;
  OPS: number;
  HBP: number;
  SF: number;
}

interface FarmPitchingData {
  game_id: string;
  team: string;
  league: string;
  opponent: string;
  player_id: string;
  name: string;
  IP: number;
  H: number;
  R: number;
  ER: number;
  BB: number;
  SO: number;
  HR_allowed: number;
  ERA: number;
  WHIP: number;
}

/**
 * Farm League HTML Parser
 * Note: This is a simplified mock implementation
 * In production, this would parse actual farm league DOM structures
 */
class FarmLeagueParser {
  
  /**
   * Parse farm league schedule/game data
   */
  static parseGameData(html: string, year: number, month: number): FarmGameData[] {
    // Mock farm league data generation for testing
    // In production, this would parse actual farm league HTML
    
    const farmTeams = [
      // Central Farm Teams
      '巨人二軍', '阪神二軍', '中日二軍', '広島二軍', 'ヤクルト二軍', 'DeNA二軍',
      // Pacific Farm Teams
      'ソフトバンク二軍', '日本ハム二軍', '西武二軍', 'ロッテ二軍', 'オリックス二軍', '楽天二軍'
    ];

    const farmVenues = [
      'ジャイアンツ球場', '鳴尾浜球場', 'ナゴヤ球場', '日南キャンプ場',
      '戸田球場', '横須賀スタジアム', 'ファーム球場', '鎌ヶ谷スタジアム',
      '所沢球場', 'ロッテ浦和球場', '舞洲ベースボールスタジアム', 'イーグルス利府球場'
    ];

    const games: FarmGameData[] = [];
    
    // Generate 15-25 farm games per month (lower volume than first team)
    const gameCount = Math.floor(Math.random() * 10) + 15;
    
    for (let i = 1; i <= gameCount; i++) {
      const day = Math.floor(Math.random() * 28) + 1;
      const gameId = `${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}_farm_${i.toString().padStart(3, '0')}`;
      
      const homeTeam = farmTeams[Math.floor(Math.random() * farmTeams.length)];
      let awayTeam = farmTeams[Math.floor(Math.random() * farmTeams.length)];
      while (awayTeam === homeTeam) {
        awayTeam = farmTeams[Math.floor(Math.random() * farmTeams.length)];
      }
      
      games.push({
        game_id: gameId,
        date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        league: 'Farm',
        away_team: awayTeam,
        home_team: homeTeam,
        away_score: Math.floor(Math.random() * 10),
        home_score: Math.floor(Math.random() * 10),
        status: 'final',
        venue: farmVenues[Math.floor(Math.random() * farmVenues.length)],
        start_time_jst: ['13:00', '14:00', '15:00'][Math.floor(Math.random() * 3)]
      });
    }
    
    console.log(`🚜 Parsed ${games.length} farm league games for ${year}-${month.toString().padStart(2, '0')}`);
    return games;
  }

  /**
   * Parse farm league batting box scores
   */
  static parseBattingData(html: string, gameData: FarmGameData[]): FarmBattingData[] {
    const battingData: FarmBattingData[] = [];
    
    gameData.forEach(game => {
      // Generate batting data for both teams (8-9 players each)
      for (const team of [game.home_team, game.away_team]) {
        const playerCount = Math.floor(Math.random() * 2) + 8; // 8-9 players
        
        for (let battingOrder = 1; battingOrder <= playerCount; battingOrder++) {
          const ab = Math.floor(Math.random() * 4) + 1;
          const h = Math.min(ab, Math.floor(Math.random() * (ab + 1)));
          const hr = Math.random() < 0.03 ? 1 : 0; // Lower HR rate in farm
          const doubles = Math.random() < 0.12 ? 1 : 0;
          const rbi = Math.floor(Math.random() * 3);
          
          battingData.push({
            game_id: game.game_id,
            team: team,
            league: 'Farm',
            player_id: `farm_${team.replace('二軍', '')}_player_${battingOrder}`,
            name: `${team.replace('二軍', '')}選手${battingOrder}`,
            batting_order: battingOrder,
            position: battingOrder === 1 ? 'P' : ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'][battingOrder - 2] || 'OF',
            AB: ab,
            R: Math.min(rbi, Math.floor(Math.random() * 2)),
            H: h,
            singles_2B: doubles,
            singles_3B: Math.random() < 0.015 ? 1 : 0, // Lower 3B rate
            HR: hr,
            RBI: rbi,
            BB: Math.floor(Math.random() * 2),
            SO: Math.floor(Math.random() * Math.max(1, ab)),
            SB: Math.random() < 0.08 ? 1 : 0,
            CS: 0,
            AVG: ab > 0 ? h / ab : 0.000,
            OPS: ab > 0 ? (h / ab) + ((h + Math.random() * 0.5) / ab) : 0.000,
            HBP: Math.random() < 0.03 ? 1 : 0,
            SF: Math.random() < 0.05 ? 1 : 0
          });
        }
      }
    });
    
    console.log(`🥎 Generated ${battingData.length} farm batting records`);
    return battingData;
  }

  /**
   * Parse farm league pitching box scores
   */
  static parsePitchingData(html: string, gameData: FarmGameData[]): FarmPitchingData[] {
    const pitchingData: FarmPitchingData[] = [];
    
    gameData.forEach(game => {
      // Generate pitching data for both teams (2-4 pitchers each)
      for (const team of [game.home_team, game.away_team]) {
        const numPitchers = Math.floor(Math.random() * 3) + 2; // 2-4 pitchers
        const opponent = team === game.home_team ? game.away_team : game.home_team;
        
        for (let pitcherNum = 1; pitcherNum <= numPitchers; pitcherNum++) {
          const ip = pitcherNum === 1 ? 
            Math.random() * 6 + 3 : // Starter: 3-9 innings (shorter in farm)
            Math.random() * 2.5;   // Reliever: 0-2.5 innings
          
          const hits = Math.floor(Math.random() * Math.max(1, ip * 1.1));
          const runs = Math.floor(Math.random() * Math.max(1, hits * 0.6));
          const er = Math.min(runs, Math.floor(runs * 0.75));
          const bb = Math.floor(Math.random() * Math.max(1, ip * 0.6)); // Higher BB rate in farm
          const so = Math.floor(Math.random() * Math.max(1, ip * 1.2)); // Lower SO rate in farm
          
          pitchingData.push({
            game_id: game.game_id,
            team: team,
            league: 'Farm',
            opponent: opponent,
            player_id: `farm_${team.replace('二軍', '')}_pitcher_${pitcherNum}`,
            name: `${team.replace('二軍', '')}投手${pitcherNum}`,
            IP: Math.round(ip * 3) / 3,
            H: hits,
            R: runs,
            ER: er,
            BB: bb,
            SO: so,
            HR_allowed: Math.random() < 0.08 ? Math.floor(Math.random() * 2) + 1 : 0,
            ERA: ip > 0 ? Math.round((er * 9 / ip) * 100) / 100 : 0.00,
            WHIP: ip > 0 ? Math.round(((hits + bb) / ip) * 100) / 100 : 0.00
          });
        }
      }
    });
    
    console.log(`⚾ Generated ${pitchingData.length} farm pitching records`);
    return pitchingData;
  }

  /**
   * Validate farm league coefficient delta
   * Farm leagues should have similar but slightly different coefficients vs first team
   */
  static validateCoefficientsΔ(farmCoeff: any, firstTeamCoeff: any): { valid: boolean; delta: number } {
    // Simplified validation - in production would check multiple coefficients
    const farmWoba = farmCoeff?.woba_coefficients?.['1B'] || 0.89;
    const firstWoba = firstTeamCoeff?.woba_coefficients?.['1B'] || 0.89;
    
    const delta = Math.abs(farmWoba - firstWoba) / firstWoba;
    
    // Farm league typically has 0-3% difference from first team
    const valid = delta <= 0.05; // 5% threshold for alerts
    
    console.log(`🔍 Farm coefficient Δ: ${(delta * 100).toFixed(2)}% (${valid ? 'PASS' : 'ALERT'})`);
    
    return { valid, delta };
  }
}

module.exports = { FarmLeagueParser };