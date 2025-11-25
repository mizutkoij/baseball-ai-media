// 問題のあるスケジュールデータをクリーンアップして修正
import { run, query } from '../lib/db';

async function cleanupAndFixSchedule() {
  console.log('🧹 Starting schedule data cleanup and fix...');
  
  try {
    // 1. 今日の問題のあるデータを確認
    const today = new Date().toISOString().slice(0, 10);
    const todayGames = await query('SELECT * FROM games WHERE date = ? ORDER BY game_id', [today]);
    
    console.log(`📅 Found ${todayGames.length} games for ${today}:`);
    todayGames.forEach((game: any) => {
      console.log(`   ${game.game_id}: ${game.away_team} vs ${game.home_team} @${game.venue} (${game.status})`);
    });
    
    // 2. 問題のあるデータを削除（重複チームや不正な組み合わせ）
    console.log('\n🗑️ Removing problematic data...');
    
    // 今日の全データを削除（再生成のため）
    await run('DELETE FROM games WHERE date = ?', [today]);
    console.log(`✅ Cleared ${todayGames.length} games for ${today}`);
    
    // 3. 最近1週間のデータも問題があれば削除
    const recentDates = [];
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      recentDates.push(date.toISOString().slice(0, 10));
    }
    
    for (const date of recentDates) {
      const games = await query('SELECT * FROM games WHERE date = ?', [date]);
      if (games.length > 0) {
        // 同じチームが複数試合に出場している場合を検出
        const teamCount: { [team: string]: number } = {};
        for (const game of games as any[]) {
          teamCount[game.home_team] = (teamCount[game.home_team] || 0) + 1;
          teamCount[game.away_team] = (teamCount[game.away_team] || 0) + 1;
        }
        
        const duplicateTeams = Object.entries(teamCount).filter(([team, count]) => count > 1);
        if (duplicateTeams.length > 0) {
          console.log(`⚠️ ${date}: Duplicate teams detected - ${duplicateTeams.map(([t, c]) => `${t}(${c})`).join(', ')}`);
          await run('DELETE FROM games WHERE date = ?', [date]);
          console.log(`🧹 Cleaned up ${games.length} games for ${date}`);
        }
      }
    }
    
    // 4. 新しいリアルなスケジュールで再生成
    console.log('\n🆕 Generating realistic schedules...');
    
    const { ServerDataCollector } = await import('./server-data-collector');
    const collector = new ServerDataCollector();
    
    // 今日を含む直近3日分を再生成
    for (let i = 0; i < 3; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      
      try {
        await collector.collectDayData(dateStr);
        console.log(`✅ Generated realistic schedule for ${dateStr}`);
      } catch (error) {
        console.log(`⚠️ Failed to generate for ${dateStr}: ${error}`);
      }
    }
    
    // 5. 結果確認
    const newTodayGames = await query('SELECT * FROM games WHERE date = ? ORDER BY game_id', [today]);
    console.log(`\n📊 New schedule for ${today} (${newTodayGames.length} games):`);
    
    const teamUsage: { [team: string]: number } = {};
    for (const game of newTodayGames as any[]) {
      console.log(`   ${game.game_id}: ${game.away_team} vs ${game.home_team} @${game.venue} (${game.league})`);
      teamUsage[game.home_team] = (teamUsage[game.home_team] || 0) + 1;
      teamUsage[game.away_team] = (teamUsage[game.away_team] || 0) + 1;
    }
    
    // 6. 検証：同じチームの重複使用がないかチェック
    const duplicates = Object.entries(teamUsage).filter(([team, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log(`❌ Still have duplicate teams: ${duplicates.map(([t, c]) => `${t}(${c})`).join(', ')}`);
    } else {
      console.log('✅ No duplicate teams detected - schedule looks good!');
    }
    
    // 7. 統計情報
    const centralTeams = newTodayGames.filter((g: any) => g.league === 'central').length;
    const pacificTeams = newTodayGames.filter((g: any) => g.league === 'pacific').length;
    console.log(`📈 League distribution: Central ${centralTeams}, Pacific ${pacificTeams}`);
    
    console.log('\n🎉 Schedule cleanup and fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// 実行
if (require.main === module) {
  cleanupAndFixSchedule().catch(console.error);
}