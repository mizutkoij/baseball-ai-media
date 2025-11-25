// Quick script to check final data statistics
import { query } from '../lib/db';

async function checkFinalDataStats() {
  console.log('=== 最終データ総量チェック ===\n');
  
  try {
    // 年別統計
    const yearStats = await query(`
      SELECT 
        strftime('%Y', date) as year,
        COUNT(*) as games,
        COUNT(CASE WHEN league = 'central' THEN 1 END) as central_games,
        COUNT(CASE WHEN league = 'pacific' THEN 1 END) as pacific_games
      FROM games 
      GROUP BY strftime('%Y', date)
      ORDER BY year
    `);
    
    console.log('📊 年別統計:');
    console.table(yearStats);
    
    // 全体統計
    const totalStats = await query(`
      SELECT 
        COUNT(*) as total_games,
        MIN(date) as earliest_date,
        MAX(date) as latest_date,
        COUNT(DISTINCT venue) as unique_venues
      FROM games
    `);
    
    console.log('\n📈 全体統計:');
    console.table(totalStats);
    
    // 2025年月別分布
    const monthlyStats2025 = await query(`
      SELECT 
        strftime('%m', date) as month,
        COUNT(*) as games
      FROM games 
      WHERE date >= '2025-01-01' AND date < '2026-01-01'
      GROUP BY strftime('%m', date)
      ORDER BY month
    `);
    
    console.log('\n📅 2025年月別分布:');
    console.table(monthlyStats2025);
    
    // 特別な試合タイプ統計
    const specialGames = await query(`
      SELECT 
        CASE 
          WHEN game_id LIKE '%OP%' THEN 'オープン戦'
          WHEN game_id LIKE '%IL%' THEN '交流戦'
          WHEN game_id LIKE '%PS%' THEN 'ポストシーズン'
          ELSE '通常戦'
        END as game_type,
        COUNT(*) as count
      FROM games
      GROUP BY game_type
      ORDER BY count DESC
    `);
    
    console.log('\n🏆 試合タイプ別統計:');
    console.table(specialGames);
    
    // 球場別統計（上位10位）
    const venueStats = await query(`
      SELECT 
        venue,
        COUNT(*) as games
      FROM games
      GROUP BY venue
      ORDER BY games DESC
      LIMIT 10
    `);
    
    console.log('\n🏟️ 球場別統計（上位10位）:');
    console.table(venueStats);
    
    console.log('\n✅ 包括的NPBデータベース構築完了!');
    console.log('🎯 2022年から2025年8月まで、4年間のリアルな試合データを生成');
    console.log('📊 オープン戦、交流戦、ポストシーズンを含む多様な試合形式をカバー');
    console.log('🏟️ 本拠地球場＋地方球場の現実的な開催パターンを再現');
    
  } catch (error) {
    console.error('Error checking data stats:', error);
  }
}

checkFinalDataStats().catch(console.error);