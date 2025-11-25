// Verify NPB box score data in database
import { query } from '../lib/db';

async function checkBoxScoreData() {
  console.log('=== NPBボックススコアデータ確認 ===\n');
  
  try {
    // 基本試合情報
    const gameInfo = await query(`
      SELECT * FROM games 
      WHERE game_id LIKE '%20250821%' OR date = '2025-08-21'
      ORDER BY updated_at DESC
    `);
    
    console.log('🎯 試合基本情報:');
    console.table(gameInfo);
    
    // 選手成績テーブルの存在確認
    const tables = await query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name LIKE '%box%'
    `);
    
    console.log('\n📊 ボックススコアテーブル:');
    console.table(tables);
    
    if (tables.some((t: any) => t.name === 'player_box_scores')) {
      // 選手成績
      const playerStats = await query(`
        SELECT * FROM player_box_scores 
        WHERE game_id LIKE '%20250821%'
        ORDER BY team_name, batting_order
      `);
      
      console.log('\n🏏 選手打撃成績:');
      if (playerStats.length > 0) {
        console.table(playerStats.slice(0, 10).map((p: any) => ({
          チーム: p.team_name,
          打順: p.batting_order,
          選手: p.player_name,
          守備: p.position,
          打数: p.at_bats,
          得点: p.runs,
          安打: p.hits,
          打点: p.rbis
        })));
      } else {
        console.log('選手データが見つかりません');
      }
    }
    
    if (tables.some((t: any) => t.name === 'pitcher_box_scores')) {
      // 投手成績
      const pitcherStats = await query(`
        SELECT * FROM pitcher_box_scores 
        WHERE game_id LIKE '%20250821%'
        ORDER BY team_name
      `);
      
      console.log('\n⚾ 投手成績:');
      if (pitcherStats.length > 0) {
        console.table(pitcherStats.map((p: any) => ({
          チーム: p.team_name,
          投手: p.pitcher_name,
          結果: p.result || '',
          投球回: p.innings,
          被安打: p.hits,
          失点: p.runs,
          自責点: p.earned_runs
        })));
      } else {
        console.log('投手データが見つかりません');
      }
    }
    
    // 総件数確認
    const totalGames = await query('SELECT COUNT(*) as count FROM games');
    console.log(`\n📈 総試合数: ${totalGames[0]?.count || 0}`);
    
    const totalPlayers = await query(`
      SELECT COUNT(*) as count FROM player_box_scores
    `).catch(() => [{count: 0}]);
    console.log(`👥 選手成績レコード数: ${totalPlayers[0]?.count || 0}`);
    
    const totalPitchers = await query(`
      SELECT COUNT(*) as count FROM pitcher_box_scores  
    `).catch(() => [{count: 0}]);
    console.log(`🥎 投手成績レコード数: ${totalPitchers[0]?.count || 0}`);
    
    console.log('\n✅ NPBボックススコアデータ確認完了!');
    
  } catch (error) {
    console.error('❌ データ確認エラー:', error);
  }
}

checkBoxScoreData().catch(console.error);