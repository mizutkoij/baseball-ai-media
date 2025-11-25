import Database from 'better-sqlite3';
import path from 'path';

// より現実的な2024年NPBデータのサンプル作成
class RealisticDataGenerator {
  private db: Database.Database;

  // 実際の有名NPB選手名（架空ではない実名ベース）
  private readonly REAL_PLAYERS = {
    'YG': [
      '坂本勇人', '岡本和真', '大城卓三', '丸佳浩', '門脇誠', '秋広優人', '中山礼都',
      '萩尾匡也', '増田大輝', '松原聖弥', '立岡宗一郎', '若林楽人', '田中俊太'
    ],
    'T': [
      '近本光司', '中野拓夢', '佐藤輝明', '大山悠輔', '森下翔太', '木浪聖也', '糸原健斗',
      '島田海吏', '小幡竜平', '渡邉諒', '熊谷敬宥', '原口文仁', '梅野隆太郎'
    ],
    'C': [
      '菊池涼介', '秋山翔吾', '西川龍馬', '坂倉将吾', '末包昇大', '田村俊介', '中村奨成',
      '羽月隆太郎', '堂林翔太', '小園海斗', '曽根海成', '野間峻祥', '韮澤雄也'
    ],
    'DB': [
      '牧秀悟', '佐野恵太', '宮﨑敏郎', '山本祐大', '楠本泰史', '関根大気', '度会隆輝',
      '森敬斗', '京田陽太', '戸柱恭孝', '嶺井博希', '石川雄洋', '神里和毅'
    ],
    'S': [
      '村上宗隆', '山田哲人', '塩見泰隆', 'オスナ', '長岡秀樹', '中山翔太', '武岡龍世',
      '内山壮真', '西浦直亨', '川端慎吾', '元山飛優', '古賀優大', '中村悠平'
    ],
    'D': [
      '岡林勇希', '高橋周平', '細川成也', '石川昂弥', '福永裕基', '鵜飼航丞', '村松開人',
      '土田龍空', '加藤翔平', '石垣雅海', '伊藤康祐', '田中幹也', '木下雄介'
    ],
    'H': [
      '柳田悠岐', '今宮健太', '牧原大成', '野村大樹', '山川穂高', '栗原陵矢', '海野隆司',
      '中村晨', '三浦瑞樹', 'リチャード', '古谷優人', '真砂勇介', '甲斐拓也'
    ],
    'L': [
      '源田壮亮', '山川穂高', '外崎修汰', '栗山巧', '愛斗', '呉念庭', '金子一輝',
      '森友哉', '岸潤一郎', '水谷瞬', '安田尚憲', '古賀悠斗', '長谷川威展'
    ],
    'E': [
      '辰己涼介', '小深田大翔', '小郷裕哉', '浅村栄斗', '岡島豪郎', '武藤敦貴', '茂木栄五郎',
      '田中和基', '山崎剛', '堀内謙伍', '黒川史陽', '伊藤裕季也', '炭谷銀仁朗'
    ],
    'M': [
      '佐々木朗希', '角中勝也', '山口航輝', '藤原恭大', '高部瑛斗', '友杉篤輝', '和田康士朗',
      '荻野貴司', '福田光輝', '中村奨吾', '安田尚憲', '山本大斗', '田村龍弘'
    ],
    'B': [
      '宗佑磨', '頓宮裕真', '杉本裕太郎', '茶野篤政', '中川圭太', '若月健矢', '紅林弘太郎',
      '太田椋', '福田周平', '安達了一', '宜保翔', '森友哉', '池田陵真'
    ],
    'F': [
      '西川遥輝', '万波中正', '清宮幸太郎', '野村佑希', '松本剛', '宇佐見真吾', '今川優馬',
      '水谷瞬', '福森耀真', '田宮裕涼', '古川裕大', '細川凌平', '郡拓也'
    ]
  };

  constructor() {
    const dbPath = path.join(process.cwd(), 'data', 'db_current.db');
    this.db = new Database(dbPath);
  }

  // 現実的な打者成績生成
  private generateRealisticBattingStats() {
    const players: any[] = [];
    let playerId = 1;

    Object.entries(this.REAL_PLAYERS).forEach(([teamCode, playerNames]) => {
      const league = ['YG', 'T', 'C', 'DB', 'S', 'D'].includes(teamCode) ? 'central' : 'pacific';
      
      playerNames.forEach((name, index) => {
        // 主力選手（上位打者）ほど良い成績
        const isRegular = index < 9;
        const isTopPlayer = index < 3;
        
        const games = isRegular ? Math.floor(Math.random() * 30) + 120 : Math.floor(Math.random() * 80) + 50;
        const atBats = Math.floor(games * (isRegular ? 3.8 : 2.5) + Math.random() * 50);
        
        // 現実的な打率分布（2024年実績ベース）
        let battingAvg;
        if (isTopPlayer) {
          battingAvg = 0.280 + Math.random() * 0.080; // .280-.360
        } else if (isRegular) {
          battingAvg = 0.240 + Math.random() * 0.080; // .240-.320
        } else {
          battingAvg = 0.200 + Math.random() * 0.100; // .200-.300
        }
        
        const hits = Math.floor(atBats * battingAvg);
        const doubles = Math.floor(hits * (0.15 + Math.random() * 0.15));
        const triples = Math.floor(hits * (0.01 + Math.random() * 0.02));
        
        // 現実的な本塁打分布
        let homeRuns;
        if (isTopPlayer && Math.random() > 0.5) {
          homeRuns = Math.floor(Math.random() * 25) + 15; // 15-40本
        } else if (isRegular) {
          homeRuns = Math.floor(Math.random() * 20) + 5;  // 5-25本
        } else {
          homeRuns = Math.floor(Math.random() * 10);      // 0-10本
        }
        
        const runs = Math.floor(hits * 0.6 + homeRuns * 1.8 + Math.random() * 20);
        const rbis = Math.floor(hits * 0.5 + homeRuns * 1.2 + Math.random() * 20);
        const walks = Math.floor(atBats * (0.08 + Math.random() * 0.08));
        const strikeouts = Math.floor(atBats * (0.15 + Math.random() * 0.15));
        const stolenBases = Math.floor(Math.random() * (isTopPlayer ? 30 : 15));
        
        // セイバーメトリクス計算
        const totalBases = hits + doubles + (triples * 2) + (homeRuns * 3);
        const obp = ((hits + walks) / (atBats + walks)) || 0;
        const slg = (totalBases / atBats) || 0;
        const ops = obp + slg;
        
        // ポジション設定（現実的な配分）
        const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
        const position = positions[index % positions.length];
        
        players.push({
          player_id: `${teamCode}_real_${playerId++}`,
          name,
          team: teamCode,
          position,
          year: 2024,
          games,
          at_bats: atBats,
          hits,
          runs,
          rbis,
          doubles,
          triples,
          home_runs: homeRuns,
          walks,
          strikeouts,
          stolen_bases: stolenBases,
          batting_average: Math.round(battingAvg * 1000) / 1000,
          on_base_percentage: Math.round(obp * 1000) / 1000,
          slugging_percentage: Math.round(slg * 1000) / 1000,
          ops: Math.round(ops * 1000) / 1000,
          updated_at: new Date().toISOString()
        });
      });
    });

    return players;
  }

  // データベース更新
  async updateDatabase() {
    try {
      console.log('🏗️  Generating realistic NPB 2024 sample data...');
      
      const players = this.generateRealisticBattingStats();
      
      // 既存データ削除
      this.db.prepare('DELETE FROM batting_stats WHERE year = 2024').run();
      
      // 新データ挿入
      const insertStmt = this.db.prepare(`
        INSERT INTO batting_stats (
          player_id, name, team, position, year, games, at_bats, hits, 
          runs, rbis, doubles, triples, home_runs, walks, strikeouts, 
          stolen_bases, batting_average, on_base_percentage, 
          slugging_percentage, ops, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let insertedCount = 0;
      
      for (const player of players) {
        try {
          insertStmt.run(...Object.values(player));
          insertedCount++;
        } catch (error) {
          console.error(`Failed to insert ${player.name}:`, error);
        }
      }
      
      console.log(`✅ Successfully inserted ${insertedCount} realistic player records`);
      
      // 統計表示
      const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_players,
          AVG(batting_average) as avg_batting_avg,
          MAX(batting_average) as max_batting_avg,
          AVG(home_runs) as avg_home_runs,
          MAX(home_runs) as max_home_runs
        FROM batting_stats WHERE year = 2024
      `).get();
      
      console.log('📊 Database Statistics:');
      console.log(`   Total Players: ${stats.total_players}`);
      console.log(`   Average Batting Avg: ${stats.avg_batting_avg?.toFixed(3)}`);
      console.log(`   Best Batting Avg: ${stats.max_batting_avg?.toFixed(3)}`);
      console.log(`   Average Home Runs: ${stats.avg_home_runs?.toFixed(1)}`);
      console.log(`   Most Home Runs: ${stats.max_home_runs}`);
      
    } finally {
      this.db.close();
    }
  }
}

// 実行
if (require.main === module) {
  const generator = new RealisticDataGenerator();
  generator.updateDatabase().catch(console.error);
}

export default RealisticDataGenerator;