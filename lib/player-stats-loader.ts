import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export interface PlayerDetailedStats {
  basic_info?: any;
  farm_stats?: any;
  day_night?: any;
  home_visitor?: any;
  count_based?: any;
  runner_situation?: any;
  monthly?: any;
  weekly?: any;
  ballpark?: any;
  opponent_team_league?: any;
  opponent_team_interleague?: any;
  vs_leftright?: any;
  batting_order?: any;
  pitch_types?: any;
  hit_direction?: any;
  hit_content?: any;
  stolen_base_2nd?: any;
  stolen_base_3rd?: any;
  stolen_base_home?: any;
  homerun_types?: any;
  career_stats?: any;
  registration_status?: any;
  registration_history?: any;
}

/**
 * 選手の詳細データを output/2025 ディレクトリから読み込む
 */
export function loadPlayerDetailedStats(
  year: number,
  teamName: string,
  playerName: string
): PlayerDetailedStats | null {
  const basePath = join(process.cwd(), 'output', year.toString(), teamName);

  if (!existsSync(basePath)) {
    console.warn(`Team directory not found: ${basePath}`);
    return null;
  }

  // 選手ディレクトリを探す（背番号付き/なし両方に対応）
  const teamDirs = readdirSync(basePath);
  const playerDir = teamDirs.find(dir =>
    dir.includes(playerName) || dir.endsWith(`_${playerName}`)
  );

  if (!playerDir) {
    console.warn(`Player directory not found for: ${playerName} in ${teamName}`);
    return null;
  }

  const playerPath = join(basePath, playerDir);
  const stats: PlayerDetailedStats = {};

  // 各種JSONファイルを読み込む
  const statFiles: Record<string, keyof PlayerDetailedStats> = {
    'basic_info.json': 'basic_info',
    'farm_stats.json': 'farm_stats',
    'Day_Nighter別成績.json': 'day_night',
    'Home_Visitor別成績.json': 'home_visitor',
    'カウント別成績.json': 'count_based',
    'ランナ−別成績.json': 'runner_situation',
    '月別成績.json': 'monthly',
    '週間成績.json': 'weekly',
    '球場別成績.json': 'ballpark',
    '対チーム別成績(リーグ).json': 'opponent_team_league',
    '対チーム別成績(交流戦).json': 'opponent_team_interleague',
    '対左右別成績.json': 'vs_leftright',
    '打順別成績(先発時).json': 'batting_order',
    '球種一覧 (※参照データ：Sportsnavi・四球に故意四球はカウントせず).json': 'pitch_types',
    '打球方向(安打・本塁・凡打はそれぞれに対する割合).json': 'hit_direction',
    '打撃内容一覧(フライはライナー・犠飛含む).json': 'hit_content',
    '盗塁状況別マトリクス - 二塁盗塁 -.json': 'stolen_base_2nd',
    '盗塁状況別マトリクス - 三塁盗塁 -.json': 'stolen_base_3rd',
    '盗塁状況別マトリクス - 本塁盗塁 -.json': 'stolen_base_home',
    '本塁打の種別一覧.json': 'homerun_types',
    '通算成績(各種指標).json': 'career_stats',
    '登録状況.json': 'registration_status',
    '登録履歴.json': 'registration_history',
  };

  for (const [filename, key] of Object.entries(statFiles)) {
    const filePath = join(playerPath, filename);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        stats[key] = JSON.parse(content);
      } catch (error) {
        console.error(`Error reading ${filename}:`, error);
      }
    }
  }

  return Object.keys(stats).length > 0 ? stats : null;
}

/**
 * チーム内の全選手リストを取得
 */
export function getTeamPlayers(year: number, teamName: string): string[] {
  const basePath = join(process.cwd(), 'output', year.toString(), teamName);

  if (!existsSync(basePath)) {
    return [];
  }

  return readdirSync(basePath)
    .filter(item => {
      const itemPath = join(basePath, item);
      try {
        return readdirSync(itemPath).length > 0; // ディレクトリで、中身がある
      } catch {
        return false;
      }
    })
    .map(dir => {
      // "00_林琢真" → "林琢真" のように選手名を抽出
      const match = dir.match(/_(.+)$/);
      return match ? match[1] : dir;
    });
}

/**
 * 全チームのリストを取得
 */
export function getAvailableTeams(year: number): string[] {
  const basePath = join(process.cwd(), 'output', year.toString());

  if (!existsSync(basePath)) {
    return [];
  }

  return readdirSync(basePath).filter(item => {
    const itemPath = join(basePath, item);
    try {
      return readdirSync(itemPath).length > 0;
    } catch {
      return false;
    }
  });
}
