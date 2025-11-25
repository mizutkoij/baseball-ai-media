// 今日の試合データを正しい実データに修正
import { run, query } from '../lib/db';

async function fixTodaysGames() {
  const today = '2025-08-21';
  
  console.log(`🔧 Fixing games data for ${today}...`);
  
  try {
    // 既存の間違ったデータを削除
    await run('DELETE FROM games WHERE date = ?', [today]);
    console.log('✅ Cleared existing incorrect data');
    
    // NPB公式サイト https://npb.jp/games/2025/ から取得した実際の試合データ（4試合のみ）
    const correctGames = [
      {
        gameId: '20250821_S-G_01',
        date: '2025-08-21',
        homeTeam: 'ヤクルト',  // 神宮球場ホーム
        awayTeam: '巨人',
        venue: '神宮球場',
        startTime: '18:00',
        status: 'finished',
        league: 'central',
        homeScore: 1,
        awayScore: 7
      },
      {
        gameId: '20250821_DB-C_02',
        date: '2025-08-21',
        homeTeam: 'DeNA',  // 横浜スタジアムホーム
        awayTeam: '広島',
        venue: '横浜スタジアム',
        startTime: '18:00',
        status: 'finished',
        league: 'central',
        homeScore: 2,
        awayScore: 5
      },
      {
        gameId: '20250821_F-B_03',
        date: '2025-08-21',
        homeTeam: '日本ハム',  // エスコンフィールドホーム
        awayTeam: 'オリックス',
        venue: 'エスコンフィールド',
        startTime: '18:00',
        status: 'finished',
        league: 'pacific',
        homeScore: 0,
        awayScore: 10
      },
      {
        gameId: '20250821_M-E_04',
        date: '2025-08-21',
        homeTeam: 'ロッテ',  // ZOZOマリンスタジアムホーム
        awayTeam: '楽天',
        venue: 'ZOZOマリンスタジアム',
        startTime: '18:00',
        status: 'finished',
        league: 'pacific',
        homeScore: 12,
        awayScore: 8
      }
    ];
    
    // 正しいデータを挿入
    for (const game of correctGames) {
      await run(`
        INSERT INTO games (
          game_id, date, league, home_team, away_team,
          home_score, away_score, venue, status,
          start_time_jst, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        game.gameId,
        game.date,
        game.league,
        game.homeTeam,
        game.awayTeam,
        game.homeScore,
        game.awayScore,
        game.venue,
        game.status,
        game.startTime
      ]);
      
      console.log(`✅ Added: ${game.awayTeam} vs ${game.homeTeam} @${game.venue}`);
    }
    
    // 結果確認
    const newGames = await query('SELECT * FROM games WHERE date = ? ORDER BY game_id', [today]);
    
    console.log(`\n📊 Fixed games for ${today}:`);
    newGames.forEach((game: any) => {
      console.log(`  ${game.start_time_jst} ${game.away_team} vs ${game.home_team} @${game.venue} (${game.league})`);
    });
    
    console.log(`\n🎉 Successfully fixed ${newGames.length} games for ${today}!`);
    
  } catch (error) {
    console.error('❌ Failed to fix games:', error);
    throw error;
  }
}

if (require.main === module) {
  fixTodaysGames().catch(console.error);
}