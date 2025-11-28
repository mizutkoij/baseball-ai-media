/**
 * 既存のPlayer型を新しいCompletePlayerData型に変換するマッピング関数
 */

import type {
  CompletePlayerData,
  PlayerProfile,
  PlayerCareer,
  BattingSeasonStats,
  PitchingSeasonStats,
  PlayerDataMeta,
  StarScore,
  Position,
} from '@/lib/types';

// 既存のPlayer型（現在のJSONデータ構造）
export type LegacyPlayer = {
  player_id: string;
  name: string;
  name_kana?: string;
  url?: string;
  first_year?: number | null;
  last_year?: number | null;
  primary_pos: "P" | "B";
  is_active: boolean;
  active_source: string;
  active_confidence?: string;
  batting: Array<Record<string, any>>;
  pitching: Array<Record<string, any>>;
  career: {
    batting: Record<string, any>;
    pitching: Record<string, any>;
  };
};

/**
 * 既存のPlayer型を新しいPlayerProfile型にマッピング
 */
export function mapToPlayerProfile(legacy: LegacyPlayer): PlayerProfile {
  const currentYear = new Date().getFullYear();
  const latestBatting = legacy.batting?.[0];
  const latestPitching = legacy.pitching?.[0];
  const currentTeam = latestBatting?.所属球団 || latestPitching?.所属球団 || "不明";

  // プライマリポジションを取得
  let primaryPosition: Position = legacy.primary_pos === "P" ? "P" : "DH";

  return {
    player_id: legacy.player_id,
    name_kanji: legacy.name,
    name_kana: legacy.name_kana || "",
    name_romaji: "", // 既存データにはないため空
    birth_date: "", // 既存データにはないため空
    age: 0, // 既存データにはないため0
    throws: "R", // 既存データにはないためデフォルト値
    bats: "R", // 既存データにはないためデフォルト値
    primary_position: primaryPosition,
    current_team: currentTeam,
    current_number: "0", // 既存データにはないためデフォルト値
    status: legacy.is_active ? "active" : "retired",
  };
}

/**
 * 既存のPlayer型を新しいPlayerCareer型にマッピング
 */
export function mapToPlayerCareer(legacy: LegacyPlayer): PlayerCareer {
  const currentYear = new Date().getFullYear();
  const currentTeam = legacy.batting?.[0]?.所属球団 || legacy.pitching?.[0]?.所属球団 || "不明";

  // 球団履歴を作成
  const teamHistory = legacy.first_year && legacy.last_year
    ? [{
        team: currentTeam,
        start_year: legacy.first_year,
        end_year: legacy.is_active ? null : legacy.last_year,
        transfer_type: "draft" as const,
      }]
    : [];

  return {
    player_id: legacy.player_id,
    debut_year: legacy.first_year || currentYear,
    team_history: teamHistory,
    number_history: [],
  };
}

/**
 * 既存の打撃データを新しいBattingSeasonStats型にマッピング
 */
export function mapToBattingSeasonStats(yearRow: Record<string, any>): BattingSeasonStats {
  return {
    player_id: "", // 呼び出し側で設定
    year: yearRow.年度 || 0,
    team: yearRow.所属球団 || "",
    league: yearRow.league || "Central",
    level: "1軍",
    games: yearRow.試合 || 0,
    PA: yearRow.打席 || 0,
    AB: yearRow.打数 || 0,
    H: yearRow.安打 || 0,
    doubles: yearRow.二塁打 || 0,
    triples: yearRow.三塁打 || 0,
    HR: yearRow.本塁打 || 0,
    RBI: yearRow.打点 || 0,
    R: yearRow.得点 || 0,
    BB: yearRow.四球 || 0,
    HBP: yearRow.死球 || 0,
    SO: yearRow.三振 || 0,
    SB: yearRow.盗塁 || 0,
    CS: yearRow.盗塁死 || 0,
    GIDP: yearRow.併殺打 || 0,
    SH: yearRow.犠打 || 0,
    SF: yearRow.犠飛 || 0,
    E: yearRow.失策 || 0,
    AVG: yearRow.打率 || 0,
    OBP: yearRow.出塁率 || 0,
    SLG: yearRow.長打率 || 0,
    OPS: yearRow.OPS || 0,
  };
}

/**
 * 既存の投球データを新しいPitchingSeasonStats型にマッピング
 */
export function mapToPitchingSeasonStats(yearRow: Record<string, any>): PitchingSeasonStats {
  return {
    player_id: "", // 呼び出し側で設定
    year: yearRow.年度 || 0,
    team: yearRow.所属球団 || "",
    league: yearRow.league || "Pacific",
    level: "1軍",
    games: yearRow.登板 || 0,
    GS: yearRow.先発 || 0,
    CG: yearRow.完投 || 0,
    SHO: yearRow.完封 || 0,
    IP: yearRow.IP_float || 0,
    BF: yearRow.対戦打者 || 0,
    W: yearRow.勝利 || 0,
    L: yearRow.敗北 || 0,
    SV: yearRow.セーブ || 0,
    HLD: yearRow.ホールド || 0,
    H: yearRow.被安打 || 0,
    HR: yearRow.被本塁打 || 0,
    SO: yearRow.三振 || 0,
    BB: yearRow.四球 || 0,
    HBP: yearRow.死球 || 0,
    R: yearRow.失点 || 0,
    ER: yearRow.自責点 || 0,
    ERA: yearRow.防御率 || 0,
    WHIP: yearRow.WHIP || 0,
    winning_percentage: yearRow.勝率,
    SO_9: yearRow.SO_9,
    BB_9: yearRow.BB_9,
  };
}

/**
 * モックのStarScoreを生成（将来的には実際の計算ロジックに置き換え）
 */
export function generateMockStarScore(
  playerId: string,
  isPitcher: boolean,
  latestStats?: Record<string, any>
): StarScore {
  // 簡易的なスコア計算（モック）
  let totalScore = 400;
  let rank: StarScore['rank'] = 'B';
  let confidence: StarScore['confidence'] = 'medium';
  let description = "サンプルスコアです。今後、実際の計算ロジックが実装されます。";

  if (latestStats) {
    if (isPitcher) {
      const era = latestStats.防御率;
      if (era && era < 3.0) {
        totalScore = 600;
        rank = 'A+';
        confidence = 'high';
        description = `防御率${era.toFixed(2)}の好成績。リーグを代表する投手の一人です。`;
      } else if (era && era < 4.0) {
        totalScore = 500;
        rank = 'A';
        description = `防御率${era.toFixed(2)}。安定した投球内容を見せています。`;
      }
    } else {
      const ops = latestStats.OPS;
      if (ops && ops > 0.900) {
        totalScore = 650;
        rank = 'A+';
        confidence = 'high';
        description = `OPS ${ops.toFixed(3)}の傑出した打撃成績。リーグ屈指の打者です。`;
      } else if (ops && ops > 0.750) {
        totalScore = 550;
        rank = 'A';
        description = `OPS ${ops.toFixed(3)}。優秀な打撃成績を残しています。`;
      }
    }
  }

  return {
    player_id: playerId,
    year: new Date().getFullYear(),
    total_score: totalScore,
    batting_score: isPitcher ? undefined : totalScore,
    pitching_score: isPitcher ? totalScore : undefined,
    rank,
    calculated_at: new Date().toISOString(),
    confidence,
    description,
  };
}

/**
 * メタ情報を生成
 */
export function generatePlayerDataMeta(playerId: string): PlayerDataMeta {
  return {
    player_id: playerId,
    last_updated: new Date().toISOString(),
    data_sources: [
      {
        name: "NPB公式",
        url: "https://npb.jp",
        data_type: ["profile", "season_stats"],
        last_fetched: new Date().toISOString(),
      },
      {
        name: "Baseball Data",
        url: "https://baseballdata.jp",
        data_type: ["advanced_stats", "sabermetrics"],
        last_fetched: new Date().toISOString(),
      },
    ],
    metrics_definitions: {
      FIP_definition_url: "/docs/metrics/fip",
      WAR_definition_url: "/docs/metrics/war",
      star_score_definition_url: "/docs/metrics/star-score",
    },
    data_quality: {
      completeness: 0.75,
      reliability: "high",
      notes: "基本データは完全。高度指標は段階的に拡充中。",
    },
    version: "2.0.0",
  };
}

/**
 * 既存のPlayer型を新しいCompletePlayerData型にマッピング
 */
export function mapToCompletePlayerData(legacy: LegacyPlayer): CompletePlayerData {
  const profile = mapToPlayerProfile(legacy);
  const career = mapToPlayerCareer(legacy);

  // シーズン成績のマッピング
  const batting = legacy.batting?.map(row => {
    const stats = mapToBattingSeasonStats(row);
    stats.player_id = legacy.player_id;
    return stats;
  }) || [];

  const pitching = legacy.pitching?.map(row => {
    const stats = mapToPitchingSeasonStats(row);
    stats.player_id = legacy.player_id;
    return stats;
  }) || [];

  // 最新のシーズンデータを取得
  const latestBatting = legacy.batting?.[0];
  const latestPitching = legacy.pitching?.[0];
  const isPitcher = legacy.primary_pos === "P";

  // モックのStarScoreを生成
  const starScore = generateMockStarScore(
    legacy.player_id,
    isPitcher,
    isPitcher ? latestPitching : latestBatting
  );

  return {
    profile,
    career,
    season_stats: {
      batting: batting.length > 0 ? batting : undefined,
      pitching: pitching.length > 0 ? pitching : undefined,
    },
    original_metrics: {
      star_score: starScore,
    },
    meta: generatePlayerDataMeta(legacy.player_id),
  };
}
