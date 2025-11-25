const Database = require('better-sqlite3');

console.log('🔍 Yahoo!データ収集状況の調査...\n');

try {
  const db = new Database('./data/db_current.db');
  
  // 1. テーブル一覧とレコード数
  console.log('📊 データベーステーブル状況:');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  
  for (const table of tables) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
      console.log(`  ${table.name}: ${count.count} records`);
    } catch (e) {
      console.log(`  ${table.name}: error counting`);
    }
  }
  
  // 2. 最新データの確認
  console.log('\n📅 最新データの状況:');
  const recentGames = db.prepare(`
    SELECT date, game_id, home_team, away_team, status, updated_at
    FROM games 
    WHERE date >= '2025-08-20' 
    ORDER BY date DESC, updated_at DESC 
    LIMIT 10
  `).all();
  
  console.log('最新10試合:');
  recentGames.forEach(g => {
    console.log(`  ${g.date} ${g.game_id} ${g.away_team}vs${g.home_team} [${g.status}] (更新: ${g.updated_at})`);
  });
  
  // 3. データソース情報があるかチェック
  const gameSchema = db.prepare("PRAGMA table_info(games)").all();
  const hasDataSource = gameSchema.some(col => col.name.includes('source') || col.name.includes('origin'));
  
  console.log('\n🏷️ データソース情報:');
  console.log(`  data_source フィールド: ${hasDataSource ? '存在' : '存在しない'}`);
  console.log('  スキーマ:', gameSchema.map(col => col.name).join(', '));
  
  // 4. Yahoo!関連データの検索
  console.log('\n🔍 Yahoo!関連データの検索:');
  
  // updated_atに基づく最近のデータ
  const recentUpdates = db.prepare(`
    SELECT COUNT(*) as count, MAX(updated_at) as latest_update
    FROM games 
    WHERE updated_at >= '2025-08-20'
  `).get();
  
  console.log(`  最近更新されたゲーム: ${recentUpdates.count} 件`);
  console.log(`  最新更新日時: ${recentUpdates.latest_update}`);
  
  // 5. 詳細データ（打撃・投手成績）の確認
  console.log('\n📈 詳細統計データ:');
  
  // box_batting テーブル
  const battingData = db.prepare(`
    SELECT COUNT(*) as count, 
           COUNT(DISTINCT game_id) as unique_games,
           MIN(game_id) as earliest_game,
           MAX(game_id) as latest_game
    FROM box_batting
  `).get();
  
  console.log(`  打撃データ: ${battingData.count} 記録, ${battingData.unique_games} 試合分`);
  if (battingData.count > 0) {
    console.log(`    範囲: ${battingData.earliest_game} ～ ${battingData.latest_game}`);
  }
  
  // box_pitching テーブル
  const pitchingData = db.prepare(`
    SELECT COUNT(*) as count, 
           COUNT(DISTINCT game_id) as unique_games,
           MIN(game_id) as earliest_game,
           MAX(game_id) as latest_game
    FROM box_pitching
  `).get();
  
  console.log(`  投手データ: ${pitchingData.count} 記録, ${pitchingData.unique_games} 試合分`);
  if (pitchingData.count > 0) {
    console.log(`    範囲: ${pitchingData.earliest_game} ～ ${pitchingData.latest_game}`);
  }
  
  // 6. サンプルデータの表示
  if (battingData.count > 0) {
    console.log('\n💾 サンプル打撃データ:');
    const sampleBatting = db.prepare('SELECT * FROM box_batting LIMIT 3').all();
    sampleBatting.forEach((row, i) => {
      console.log(`  Sample ${i + 1}:`, row);
    });
  }
  
  if (pitchingData.count > 0) {
    console.log('\n💾 サンプル投手データ:');
    const samplePitching = db.prepare('SELECT * FROM box_pitching LIMIT 3').all();
    samplePitching.forEach((row, i) => {
      console.log(`  Sample ${i + 1}:`, row);
    });
  }
  
  // 7. データの日付範囲
  console.log('\n📊 データ範囲:');
  const dateRange = db.prepare(`
    SELECT MIN(date) as earliest_date, MAX(date) as latest_date, COUNT(*) as total_games
    FROM games
  `).get();
  
  console.log(`  試合データ範囲: ${dateRange.earliest_date} ～ ${dateRange.latest_date}`);
  console.log(`  総試合数: ${dateRange.total_games}`);
  
  db.close();
  
} catch (error) {
  console.error('❌ エラー:', error.message);
}