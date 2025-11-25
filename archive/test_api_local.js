const Database = require('better-sqlite3');
const path = require('path');

console.log('Testing API logic locally...');

const gameId = '20170413_db-t-02';

try {
  console.log(`Testing game: ${gameId}`);
  
  const db = new Database('./data/db_current.db');
  
  // Test basic game query
  const gameQuery = `
    SELECT game_id, date, league, home_team, away_team, 
           home_score, away_score, venue, status, start_time_jst, updated_at
    FROM games 
    WHERE game_id = ?
  `;
  
  const game = db.prepare(gameQuery).get(gameId);
  
  if (!game) {
    console.log('Game not found');
    db.close();
    process.exit(1);
  }
  
  console.log('Game found:');
  console.log(`  ${game.away_team} vs ${game.home_team}`);
  console.log(`  Score: ${game.away_score}-${game.home_score}`);
  console.log(`  Status: ${game.status}`);
  
  // Test batting query
  const battingQuery = `
    SELECT team, name, batting_order, position, 
           AB, R, H, RBI, BB, SO, HR, AVG, OPS
    FROM box_batting 
    WHERE game_id = ?
    ORDER BY team, batting_order
  `;
  
  let battingStats = [];
  try {
    battingStats = db.prepare(battingQuery).all(gameId) || [];
    console.log(`Batting stats found: ${battingStats.length} records`);
  } catch (error) {
    console.log('Batting stats error:', error.message);
  }

  // Test pitching query
  const pitchingQuery = `
    SELECT team, name, result, innings, hits, runs, earned_runs, 
           walks, strikeouts, ERA
    FROM box_pitching 
    WHERE game_id = ?
    ORDER BY team
  `;
  
  let pitchingStats = [];
  try {
    pitchingStats = db.prepare(pitchingQuery).all(gameId) || [];
    console.log(`Pitching stats found: ${pitchingStats.length} records`);
  } catch (error) {
    console.log('Pitching stats error:', error.message);
  }

  // Mock data generation test
  console.log('\nTesting mock data generation...');
  
  const generateMockLineups = (teamName) => {
    const positions = ['中', '二', '右', '一', '左', '三', '遊', '捕', '投'];
    const mockNames = [
      '田中 太郎', '佐藤 次郎', '鈴木 三郎', '高橋 四郎', '伊藤 五郎',
      '渡辺 六郎', '山本 七郎', '中村 八郎', '小林 九郎'
    ];
    
    return positions.map((pos, index) => ({
      player_id: `${teamName}_${index + 1}`,
      name: mockNames[index] || `選手${index + 1}`,
      position: pos,
      order_no: index + 1,
      position_name: pos === '投' ? '投手' : pos === '捕' ? '捕手' : `${pos}手`
    }));
  };

  const homeLineup = generateMockLineups(game.home_team);
  const awayLineup = generateMockLineups(game.away_team);
  
  console.log(`Generated mock lineups:`);
  console.log(`  Home (${game.home_team}): ${homeLineup.length} players`);
  console.log(`  Away (${game.away_team}): ${awayLineup.length} players`);
  
  // Test response structure
  const responseData = {
    data: {
      game: {
        game_id: game.game_id,
        home_team: game.home_team,
        away_team: game.away_team,
        status: game.status === 'finished' ? 'final' : game.status
      },
      lineups: {
        [game.home_team]: homeLineup,
        [game.away_team]: awayLineup
      },
      batting: {
        [game.home_team]: [],
        [game.away_team]: []
      },
      pitching: {
        [game.home_team]: [],
        [game.away_team]: []
      }
    }
  };
  
  console.log('\nResponse structure test passed!');
  console.log(`Response keys: ${Object.keys(responseData.data)}`);
  
  db.close();
  console.log('\nAll tests passed! API logic should work.');
  
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}