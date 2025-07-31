// scripts/generate_daily_brief.ts
import fs from 'fs/promises';
import path from 'path';

interface GameData {
  game_id: string;
  date: string;
  start_time_jst?: string;
  status: string;
  inning?: string;
  away_team: string;
  home_team: string;
  away_score?: number;
  home_score?: number;
  venue?: string;
  league: string;
}

interface DailyLeader {
  player_id?: string;
  player_name: string;
  team: string;
  metric_name: string;
  metric_value: number;
  game_id?: string;
}

interface BriefData {
  date: string;
  gotd: GameData | null;
  leaders: DailyLeader[];
  notes: string[];
  provenance: {
    source: string;
    method: string;
    generated_at: string;
  };
  summary: {
    total_games: number;
    completed_games: number;
    highest_score_game?: GameData;
    closest_game?: GameData;
  };
}

/**
 * 今日の注目試合を選出する
 * 接戦度 + WPA変動 + 人気チーム等でスコアリング
 */
function selectGameOfTheDay(games: GameData[]): GameData | null {
  if (!games || games.length === 0) return null;

  const scoredGames = games.map(game => {
    let score = 0;
    
    // 1. 試合ステータス優先度
    if (game.status === 'final') {
      score += 50; // 終了した試合を優先
    } else if (game.status === 'live') {
      score += 30; // ライブ試合も評価
    }

    // 2. 接戦度（スコア差が小さいほど高評価）
    if (game.home_score !== null && game.away_score !== null) {
      const scoreDiff = Math.abs(game.home_score - game.away_score);
      if (scoreDiff === 0) score += 30; // 同点
      else if (scoreDiff <= 1) score += 25; // 1点差
      else if (scoreDiff <= 2) score += 20; // 2点差
      else if (scoreDiff <= 3) score += 10; // 3点差
    }

    // 3. 高得点試合ボーナス
    if (game.home_score !== null && game.away_score !== null) {
      const totalRuns = game.home_score + game.away_score;
      if (totalRuns >= 15) score += 20; // 15点以上の乱打戦
      else if (totalRuns >= 10) score += 10; // 10点以上
    }

    // 4. 人気チーム（簡易判定）
    const popularTeams = ['巨人', 'ジャイアンツ', '阪神', 'タイガース', '中日', 'ドラゴンズ', 
                         '広島', 'カープ', 'ヤクルト', 'スワローズ', '横浜', 'DeNA'];
    const isPopularGame = popularTeams.some(team => 
      game.home_team?.includes(team) || game.away_team?.includes(team)
    );
    if (isPopularGame) score += 15;

    return { ...game, selection_score: score };
  });

  scoredGames.sort((a, b) => b.selection_score - a.selection_score);
  return scoredGames[0] || null;
}

/**
 * デイリーリーダーを生成（モック実装）
 * 実際の実装では、日別集計テーブルから取得
 */
function generateDailyLeaders(date: string): DailyLeader[] {
  // TODO: 実際のデータベースクエリに置き換え
  // 現在はプレースホルダー
  return [
    {
      player_name: "選手A",
      team: "巨人",
      metric_name: "wPA",
      metric_value: 0.85,
    },
    {
      player_name: "選手B", 
      team: "阪神",
      metric_name: "RE24",
      metric_value: 2.4,
    }
  ];
}

/**
 * 係数変動チェック
 */
async function checkConstantsVariation(): Promise<string[]> {
  try {
    const constantsPath = path.join(process.cwd(), 'public/data/constants/league_constants.json');
    const constantsData = JSON.parse(await fs.readFile(constantsPath, 'utf8'));
    
    const notes: string[] = [];
    
    // 前日比較は実装複雑なため、現在は省略
    // 実際の実装では、前日のconstantsファイルとの差分をチェック
    
    // サンプル数チェック
    const currentYear = new Date().getFullYear();
    const yearData = constantsData.years?.[currentYear];
    if (yearData && yearData.sample_games < 10) {
      notes.push(`${currentYear}年の係数算出に使用されたサンプル数が少数です（${yearData.sample_games}試合）`);
    }

    return notes;
  } catch (error) {
    console.error('Constants variation check failed:', error);
    return ['係数変動チェックでエラーが発生しました'];
  }
}

/**
 * ブリーフサマリ生成
 */
function generateBriefSummary(games: GameData[]): BriefData['summary'] {
  const completedGames = games.filter(g => g.status === 'final');
  
  let highestScoreGame: GameData | undefined;
  let closestGame: GameData | undefined;
  let maxTotalRuns = 0;
  let minScoreDiff = Infinity;

  for (const game of completedGames) {
    if (game.home_score !== null && game.away_score !== null) {
      const totalRuns = game.home_score + game.away_score;
      const scoreDiff = Math.abs(game.home_score - game.away_score);
      
      if (totalRuns > maxTotalRuns) {
        maxTotalRuns = totalRuns;
        highestScoreGame = game;
      }
      
      if (scoreDiff < minScoreDiff) {
        minScoreDiff = scoreDiff;
        closestGame = game;
      }
    }
  }

  return {
    total_games: games.length,
    completed_games: completedGames.length,
    highest_score_game: highestScoreGame,
    closest_game: closestGame,
  };
}

/**
 * メイン関数：デイリーブリーフ生成
 */
async function main(dateStr?: string) {
  try {
    // 日付設定（デフォルトは昨日）
    const targetDate = dateStr 
      ? dateStr 
      : new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    console.log(`Generating daily brief for ${targetDate}`);

    // 対象日の試合データを読み込み
    const snapshotPath = path.join(process.cwd(), 'snapshots', 'today_games.json');
    let games: GameData[] = [];
    
    try {
      const snapshotData = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
      games = (snapshotData.data || []).filter((game: GameData) => game.date === targetDate);
    } catch (error) {
      console.warn('Failed to load games snapshot:', error);
    }

    // Game of the Day選出
    const gotd = selectGameOfTheDay(games);

    // デイリーリーダー生成
    const leaders = generateDailyLeaders(targetDate);

    // 係数変動チェック
    const notes = await checkConstantsVariation();

    // サマリ生成
    const summary = generateBriefSummary(games);

    // ブリーフデータ作成
    const brief: BriefData = {
      date: targetDate,
      gotd,
      leaders,
      notes,
      provenance: {
        source: "npb_official_html",
        method: "independent_calc",
        generated_at: new Date().toISOString(),
      },
      summary,
    };

    // 出力ディレクトリ作成
    const formattedDate = targetDate.replace(/-/g, '');
    const outDir = path.join(process.cwd(), 'public/column/brief', formattedDate);
    await fs.mkdir(outDir, { recursive: true });

    // JSON出力
    const jsonPath = path.join(outDir, 'index.json');
    await fs.writeFile(jsonPath, JSON.stringify(brief, null, 2));

    // OGP画像生成（プレースホルダー）
    // await buildBriefOgImage(brief, path.join(outDir, 'og.png'));

    console.log(`Daily brief generated successfully:`);
    console.log(`- Date: ${targetDate}`);
    console.log(`- GOTD: ${gotd ? `${gotd.away_team} vs ${gotd.home_team}` : 'None'}`);
    console.log(`- Leaders: ${leaders.length} players`);
    console.log(`- Games: ${games.length} total, ${summary.completed_games} completed`);
    console.log(`- Output: ${jsonPath}`);

    return brief;

  } catch (error) {
    console.error('Daily brief generation failed:', error);
    process.exit(1);
  }
}

// CLI実行時
if (require.main === module) {
  main(process.argv[2]).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as generateDailyBrief, type BriefData, type GameData, type DailyLeader };