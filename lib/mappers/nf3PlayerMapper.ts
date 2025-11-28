/**
 * nf3データ（背番号_名前形式）を新しい型定義にマッピング
 */

import type {
  CompletePlayerData,
  PlayerProfile,
  PlayerCareer,
  PitchingSeasonStats,
  BattingSeasonStats,
  PlayerDataMeta,
  StarScore,
} from '@/lib/types';

// nf3のall-stats APIレスポンス型
export type NF3AllStatsData = {
  playerName: string;
  team: string;
  number: string;
  pitcherStats: Record<string, any> | null;
  batterStats: Record<string, any> | null;
};

/**
 * nf3データを PlayerProfile にマッピング
 */
export function mapNF3ToPlayerProfile(data: NF3AllStatsData): PlayerProfile {
  const isPitcher = data.pitcherStats !== null;

  return {
    player_id: `${data.team}_${data.number}_${data.playerName}`,
    name_kanji: data.playerName,
    name_kana: "",
    name_romaji: "",
    birth_date: "",
    age: 0,
    throws: data.pitcherStats?.basic_info?.腕 === "右" ? "R" :
            data.pitcherStats?.basic_info?.腕 === "左" ? "L" : "R",
    bats: data.pitcherStats?.basic_info?.席 === "右" ? "R" :
          data.pitcherStats?.basic_info?.席 === "左" ? "L" : "R",
    primary_position: isPitcher ? "P" : "DH",
    current_team: data.team,
    current_number: data.number,
    status: "active",
  };
}

/**
 * nf3データを PlayerCareer にマッピング
 */
export function mapNF3ToPlayerCareer(data: NF3AllStatsData): PlayerCareer {
  return {
    player_id: `${data.team}_${data.number}_${data.playerName}`,
    debut_year: new Date().getFullYear(),
    team_history: [{
      team: data.team,
      start_year: new Date().getFullYear(),
      end_year: null,
      transfer_type: "draft",
    }],
    number_history: [{
      number: data.number,
      start_year: new Date().getFullYear(),
      end_year: null,
      team: data.team,
    }],
  };
}

/**
 * nf3通算成績を PitchingSeasonStats にマッピング
 */
export function mapNF3ToPitchingStats(
  careerData: Record<string, any>,
  playerId: string,
  team: string
): PitchingSeasonStats {
  return {
    player_id: playerId,
    year: new Date().getFullYear(),
    team: team,
    league: team === "ロッテ" || team === "西武" || team === "楽天" ||
           team === "オリックス" || team === "日本ハム" || team === "ソフトバンク"
           ? "Pacific" : "Central",
    level: "1軍",
    games: parseFloat(careerData.試合) || 0,
    GS: parseFloat(careerData.先発) || 0,
    CG: parseFloat(careerData.完投) || 0,
    SHO: parseFloat(careerData.完封) || 0,
    IP: parseFloat(careerData.回数) || 0,
    BF: parseFloat(careerData.被打者) || 0,
    W: parseFloat(careerData.勝利) || 0,
    L: parseFloat(careerData.敗戦) || 0,
    SV: parseFloat(careerData.Ｓ) || 0,
    HLD: parseFloat(careerData.HLD) || 0,
    H: parseFloat(careerData.被安) || 0,
    HR: parseFloat(careerData.被本) || 0,
    SO: parseFloat(careerData.三振) || 0,
    BB: parseFloat(careerData.四球) || 0,
    HBP: parseFloat(careerData.死球) || 0,
    R: parseFloat(careerData.失点) || 0,
    ER: parseFloat(careerData.自責) || 0,
    ERA: parseFloat(careerData.防御率) || 0,
    WHIP: parseFloat(careerData.WHIP) || 0,
  };
}

/**
 * モックのStarScoreを生成
 */
export function generateNF3StarScore(
  data: NF3AllStatsData,
  stats?: PitchingSeasonStats | BattingSeasonStats
): StarScore {
  const playerId = `${data.team}_${data.number}_${data.playerName}`;
  const isPitcher = data.pitcherStats !== null;

  let totalScore = 400;
  let rank: StarScore['rank'] = 'B';
  let confidence: StarScore['confidence'] = 'medium';
  let description = "今季のデータを基に算出したスコアです。";

  if (isPitcher && data.pitcherStats?.通算成績) {
    const era = parseFloat(data.pitcherStats.通算成績[0]?.防御率);
    const innings = parseFloat(data.pitcherStats.通算成績[0]?.回数);

    if (!isNaN(era) && innings > 0) {
      if (era < 2.0) {
        totalScore = 700;
        rank = 'S';
        confidence = 'high';
        description = `防御率${era.toFixed(2)}の圧倒的な成績。リーグトップクラスの投手です。`;
      } else if (era < 3.0) {
        totalScore = 600;
        rank = 'A+';
        confidence = 'high';
        description = `防御率${era.toFixed(2)}の優秀な成績。安定した投球内容を見せています。`;
      } else if (era < 4.0) {
        totalScore = 500;
        rank = 'A';
        description = `防御率${era.toFixed(2)}。リーグ平均を上回る安定した投球です。`;
      } else if (innings < 5) {
        totalScore = 412;
        rank = 'B';
        confidence = 'low';
        description = `今季は登板機会が少なく、評価は限定的です。直近の投球内容に注目。`;
      }
    }
  }

  return {
    player_id: playerId,
    year: new Date().getFullYear(),
    total_score: totalScore,
    pitching_score: isPitcher ? totalScore : undefined,
    batting_score: !isPitcher ? totalScore : undefined,
    rank,
    calculated_at: new Date().toISOString(),
    confidence,
    description,
  };
}

/**
 * メタ情報を生成
 */
export function generateNF3PlayerDataMeta(playerId: string): PlayerDataMeta {
  return {
    player_id: playerId,
    last_updated: new Date().toISOString(),
    data_sources: [
      {
        name: "nf3 (Freak)",
        url: "https://nf3.sakura.ne.jp",
        data_type: ["詳細成績", "状況別成績", "球種データ"],
        last_fetched: new Date().toISOString(),
      },
      {
        name: "Baseball Data",
        url: "https://baseballdata.jp",
        data_type: ["補足データ"],
        last_fetched: new Date().toISOString(),
      },
    ],
    metrics_definitions: {
      FIP_definition_url: "/docs/metrics/fip",
      WAR_definition_url: "/docs/metrics/war",
      star_score_definition_url: "/docs/metrics/star-score",
    },
    data_quality: {
      completeness: 0.85,
      reliability: "high",
      notes: "nf3からの詳細データを使用。2025シーズンの最新データを反映。",
    },
    version: "2.0.0-nf3",
  };
}

/**
 * nf3データを CompletePlayerData にマッピング
 */
export function mapNF3ToCompletePlayerData(data: NF3AllStatsData): CompletePlayerData {
  const profile = mapNF3ToPlayerProfile(data);
  const career = mapNF3ToPlayerCareer(data);
  const playerId = profile.player_id;

  // 投手成績のマッピング
  let pitchingStats: PitchingSeasonStats | undefined;
  if (data.pitcherStats?.通算成績 && data.pitcherStats.通算成績[0]) {
    pitchingStats = mapNF3ToPitchingStats(
      data.pitcherStats.通算成績[0],
      playerId,
      data.team
    );
  }

  // StarScoreの生成
  const starScore = generateNF3StarScore(data, pitchingStats);

  return {
    profile,
    career,
    season_stats: {
      pitching: pitchingStats ? [pitchingStats] : undefined,
    },
    original_metrics: {
      star_score: starScore,
    },
    meta: generateNF3PlayerDataMeta(playerId),
  };
}
