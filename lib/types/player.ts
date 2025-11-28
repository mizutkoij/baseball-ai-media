/**
 * Player-related TypeScript interfaces
 * Comprehensive player data types for Baseball AI Media
 */

// ============================================
// 1. CORE INFORMATION (プロフィール・経歴)
// ============================================

/**
 * 選手プロフィールの基本情報
 */
export interface PlayerProfile {
  /** 選手ID（内部管理用） */
  player_id: string;

  /** 氏名（漢字） */
  name_kanji: string;

  /** 氏名（よみがな） */
  name_kana: string;

  /** 氏名（ローマ字） */
  name_romaji: string;

  /** 生年月日 */
  birth_date: string; // ISO 8601 format: "YYYY-MM-DD"

  /** 年齢（自動計算） */
  age: number;

  /** 出身地（都道府県） */
  birthplace_prefecture?: string;

  /** 出身地（市区町村） */
  birthplace_city?: string;

  /** 身長（cm） */
  height?: number;

  /** 体重（kg） */
  weight?: number;

  /** 投球/投打 */
  throws: 'R' | 'L' | 'S'; // Right, Left, Switch

  /** 打席 */
  bats: 'R' | 'L' | 'S'; // Right, Left, Switch

  /** メインポジション */
  primary_position: Position;

  /** サブポジション */
  secondary_positions?: Position[];

  /** 現在の所属球団 */
  current_team: string;

  /** 現在の背番号 */
  current_number: string;

  /** 在籍状況 */
  status: 'active' | 'injured' | 'retired' | 'free_agent' | 'minor';
}

/**
 * 野球のポジション
 */
export type Position =
  | 'P'    // 投手
  | 'C'    // 捕手
  | '1B'   // 一塁手
  | '2B'   // 二塁手
  | '3B'   // 三塁手
  | 'SS'   // 遊撃手
  | 'LF'   // 左翼手
  | 'CF'   // 中堅手
  | 'RF'   // 右翼手
  | 'DH'   // 指名打者
  | 'OF'   // 外野手（汎用）
  | 'IF'   // 内野手（汎用）
  | 'UTIL'; // ユーティリティ

/**
 * 選手の経歴情報
 */
export interface PlayerCareer {
  /** 選手ID */
  player_id: string;

  /** 出身高校 */
  high_school?: string;

  /** 出身大学 */
  college?: string;

  /** 社会人チーム */
  corporate_team?: string;

  /** ドラフト情報 */
  draft?: {
    /** ドラフト年 */
    year: number;

    /** 順位（1位、2位…） */
    round: number;

    /** 指名球団 */
    team: string;

    /** ドラフト種別 */
    type?: 'new_player' | 'developmental' | '育成' | 'free_agent';
  };

  /** プロ入り年 */
  debut_year: number;

  /** プロ初出場日 */
  debut_date?: string;

  /** 所属球団履歴 */
  team_history: TeamHistory[];

  /** 背番号履歴 */
  number_history: NumberHistory[];
}

/**
 * 所属球団履歴
 */
export interface TeamHistory {
  /** 球団名 */
  team: string;

  /** 開始年 */
  start_year: number;

  /** 終了年（現在所属の場合はnull） */
  end_year: number | null;

  /** 移籍方法 */
  transfer_type?: 'draft' | 'trade' | 'free_agent' | 'release';
}

/**
 * 背番号履歴
 */
export interface NumberHistory {
  /** 背番号 */
  number: string;

  /** 開始年 */
  start_year: number;

  /** 終了年（現在使用中の場合はnull） */
  end_year: number | null;

  /** 球団名 */
  team: string;
}

// ============================================
// 2. SEASON STATS (シーズン成績)
// ============================================

/**
 * シーズン成績の共通フィールド
 */
export interface BaseSeasonStats {
  /** 選手ID */
  player_id: string;

  /** 年度 */
  year: number;

  /** 球団 */
  team: string;

  /** リーグ */
  league: 'Central' | 'Pacific' | 'Eastern' | 'Western';

  /** レベル */
  level: '1軍' | '2軍' | 'ポストシーズン' | '代表';

  /** 試合数 */
  games: number;
}

/**
 * 打撃シーズン成績
 */
export interface BattingSeasonStats extends BaseSeasonStats {
  /** 打席 */
  PA: number;

  /** 打数 */
  AB: number;

  /** 安打 */
  H: number;

  /** 二塁打 */
  doubles: number;

  /** 三塁打 */
  triples: number;

  /** 本塁打 */
  HR: number;

  /** 打点 */
  RBI: number;

  /** 得点 */
  R: number;

  /** 四球 */
  BB: number;

  /** 死球 */
  HBP: number;

  /** 三振 */
  SO: number;

  /** 盗塁 */
  SB: number;

  /** 盗塁失敗 */
  CS: number;

  /** 併殺打 */
  GIDP: number;

  /** 犠打 */
  SH: number;

  /** 犠飛 */
  SF: number;

  /** 失策 */
  E: number;

  /** 打率 */
  AVG: number;

  /** 出塁率 */
  OBP: number;

  /** 長打率 */
  SLG: number;

  /** OPS */
  OPS: number;
}

/**
 * 投手シーズン成績
 */
export interface PitchingSeasonStats extends BaseSeasonStats {
  /** 先発 */
  GS: number;

  /** 完投 */
  CG: number;

  /** 完封 */
  SHO: number;

  /** 投球回 */
  IP: number;

  /** 打者 */
  BF: number;

  /** 勝利 */
  W: number;

  /** 敗戦 */
  L: number;

  /** セーブ */
  SV: number;

  /** ホールド */
  HLD: number;

  /** 被安打 */
  H: number;

  /** 被本塁打 */
  HR: number;

  /** 奪三振 */
  SO: number;

  /** 与四球 */
  BB: number;

  /** 与死球 */
  HBP: number;

  /** 失点 */
  R: number;

  /** 自責点 */
  ER: number;

  /** 防御率 */
  ERA: number;

  /** WHIP */
  WHIP: number;

  /** 勝率 */
  winning_percentage?: number;

  /** 奪三振率（K/9） */
  SO_9?: number;

  /** 与四球率（BB/9） */
  BB_9?: number;
}

// ============================================
// 3. ADVANCED & SABERMETRICS (セイバー指標)
// ============================================

/**
 * 打者の高度指標
 */
export interface AdvancedBattingStats {
  /** 選手ID */
  player_id: string;

  /** 年度 */
  year: number;

  /** WAR（総合） */
  WAR: number;

  /** 打撃WAR */
  batting_WAR?: number;

  /** 守備WAR */
  fielding_WAR?: number;

  /** 走塁WAR */
  baserunning_WAR?: number;

  /** wRC+（リーグ平均を100とした加重得点圏創出） */
  wRC_plus: number;

  /** OPS+（リーグ平均を100としたOPS） */
  OPS_plus: number;

  /** 四球率 */
  BB_pct: number;

  /** 三振率 */
  K_pct: number;

  /** ISO（長打力指標） */
  ISO: number;

  /** BABIP（インプレー打球安打率） */
  BABIP: number;

  /** wOBA（加重出塁率） */
  wOBA: number;

  /** Hard%（強打球率）※近似値の可能性あり */
  hard_hit_pct?: number;

  /** 盗塁成功率 */
  SB_success_rate?: number;

  /** Off（攻撃貢献度） */
  Off?: number;

  /** Def（守備貢献度） */
  Def?: number;
}

/**
 * 投手の高度指標
 */
export interface AdvancedPitchingStats {
  /** 選手ID */
  player_id: string;

  /** 年度 */
  year: number;

  /** WAR */
  WAR: number;

  /** ERA+（リーグ平均を100とした防御率） */
  ERA_plus: number;

  /** ERA-（リーグ平均を100とし、小さいほど良い） */
  ERA_minus?: number;

  /** FIP（Fielding Independent Pitching） */
  FIP: number;

  /** FIP-（リーグ平均を100とし、小さいほど良い） */
  FIP_minus?: number;

  /** xFIP（Expected FIP） */
  xFIP?: number;

  /** 奪三振率 */
  K_pct: number;

  /** 与四球率 */
  BB_pct: number;

  /** K-BB%（奪三振率 - 与四球率） */
  K_minus_BB_pct: number;

  /** 被BABIP */
  BABIP: number;

  /** ゴロ率 */
  GB_pct?: number;

  /** フライ率 */
  FB_pct?: number;

  /** HR/FB率（フライあたりの本塁打率） */
  HR_per_FB?: number;

  /** LOB%（残塁率） */
  LOB_pct?: number;

  /** RA9-WAR */
  RA9_WAR?: number;
}

// ============================================
// 4. ORIGINAL METRICS (オリジナル指標)
// ============================================

/**
 * Baseball AI Media オリジナルの☆スコア
 */
export interface StarScore {
  /** 選手ID */
  player_id: string;

  /** 年度 */
  year: number;

  /** ☆総合スコア（1〜999） */
  total_score: number;

  /** 打撃☆ */
  batting_score?: number;

  /** 守備☆ */
  fielding_score?: number;

  /** 走塁☆ */
  baserunning_score?: number;

  /** 投球☆（投手の場合） */
  pitching_score?: number;

  /** スコアランク */
  rank: 'S+' | 'S' | 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'E';

  /** 計算日時 */
  calculated_at: string;

  /** スコアの信頼度 */
  confidence: 'high' | 'medium' | 'low';

  /** 説明文 */
  description?: string;
}

/**
 * 価値逆転スコア（Undervalued Index）
 */
export interface UndervaluedIndex {
  /** 選手ID */
  player_id: string;

  /** 年度 */
  year: number;

  /** UII スコア（正の値：過小評価、負の値：過大評価） */
  uii_score: number;

  /** 表面的な評価 */
  surface_rating: number;

  /** 真の貢献度 */
  true_contribution: number;

  /** 評価ギャップ */
  gap: number;

  /** カテゴリ */
  category: 'highly_undervalued' | 'undervalued' | 'fair' | 'overvalued' | 'highly_overvalued';

  /** 説明 */
  explanation?: string;
}

/**
 * WPA（Win Probability Added）指標
 */
export interface WPAStats {
  /** 選手ID */
  player_id: string;

  /** 年度 */
  year: number;

  /** 打撃WPA */
  batting_WPA?: number;

  /** 投球WPA */
  pitching_WPA?: number;

  /** WPA/LI（レバレッジ指数で調整したWPA） */
  WPA_per_LI?: number;

  /** クラッチスコア */
  clutch_score?: number;

  /** RE24（Run Expectancy 24 base-out states） */
  RE24?: number;

  /** REW（Run Expectancy Wins） */
  REW?: number;
}

/**
 * AI予測スコア（来季予測）
 */
export interface PredictedScore {
  /** 選手ID */
  player_id: string;

  /** 予測対象年 */
  predicted_year: number;

  /** 来季☆予測（範囲） */
  predicted_star_range: {
    min: number;
    max: number;
    expected: number;
  };

  /** 来季期待度ラベル */
  expectation_label: 'S+' | 'S' | 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D';

  /** 予測の信頼度 */
  confidence: number; // 0-1

  /** 予測根拠 */
  reasoning?: string;

  /** モデルバージョン */
  model_version: string;

  /** 予測日時 */
  predicted_at: string;
}

// ============================================
// 5. PITCH & PLATE APPEARANCE LOGS (一球・一打席ログ)
// ============================================

/**
 * 打席ログ
 */
export interface PlateAppearance {
  /** 打席ID */
  pa_id: string;

  /** 選手ID */
  player_id: string;

  /** 試合ID */
  game_id: string;

  /** 日付 */
  date: string;

  /** イニング */
  inning: number;

  /** 表裏 */
  half: 'top' | 'bottom';

  /** 打順位置 */
  batting_order: number;

  /** 対戦投手ID */
  pitcher_id: string;

  /** 対戦投手名 */
  pitcher_name: string;

  /** スコア状況 */
  score_situation: {
    /** 自チーム得点 */
    team_score: number;

    /** 相手チーム得点 */
    opponent_score: number;
  };

  /** ランナー状況 */
  runners: {
    first: boolean;
    second: boolean;
    third: boolean;
  };

  /** アウトカウント */
  outs: 0 | 1 | 2;

  /** カウント推移 */
  count_sequence?: string[]; // ['0-0', '0-1', '1-1', '1-2', ...]

  /** 最終カウント */
  final_count: string;

  /** 結果 */
  result: PAResult;

  /** 打球方向 */
  hit_direction?: HitDirection;

  /** 打球種別 */
  batted_ball_type?: BattedBallType;

  /** WPA増減 */
  WPA_delta?: number;

  /** RE24増減 */
  RE24_delta?: number;

  /** レバレッジ指数 */
  leverage_index?: number;
}

/**
 * 打席結果の種類
 */
export type PAResult =
  | '単打' | '二塁打' | '三塁打' | '本塁打'
  | '四球' | '死球' | '三振'
  | 'ゴロ' | 'フライ' | 'ライナー'
  | '犠打' | '犠飛'
  | '併殺' | '失策' | '野選'
  | '振逃';

/**
 * 打球方向
 */
export type HitDirection =
  | 'left' | 'left_center' | 'center' | 'right_center' | 'right'
  | 'pull' | 'center' | 'opposite';

/**
 * 打球種別
 */
export type BattedBallType =
  | 'ground_ball' | 'line_drive' | 'fly_ball' | 'popup';

/**
 * 投球ログ
 */
export interface Pitch {
  /** 投球ID */
  pitch_id: string;

  /** 投手ID */
  pitcher_id: string;

  /** 試合ID */
  game_id: string;

  /** 日付 */
  date: string;

  /** イニング */
  inning: number;

  /** 打席ID */
  pa_id: string;

  /** 対戦打者ID */
  batter_id: string;

  /** 対戦打者名 */
  batter_name: string;

  /** 球種 */
  pitch_type: PitchType;

  /** 球速（km/h） */
  velocity?: number;

  /** コース（ゾーンID） */
  zone?: number; // 1-9のストライクゾーン、10-16のボールゾーン等

  /** 投球前カウント */
  count_before: string; // '0-0', '1-2', etc.

  /** 投球後カウント */
  count_after: string;

  /** 結果 */
  pitch_result: PitchResult;

  /** 打球種別（インプレーの場合） */
  batted_ball_type?: BattedBallType;

  /** 投球順（打席内） */
  pitch_number: number;
}

/**
 * 球種
 */
export type PitchType =
  | 'ストレート' | 'ツーシーム' | 'カットボール' | 'スプリット'
  | 'スライダー' | 'カーブ' | 'チェンジアップ' | 'シンカー'
  | 'フォーク' | 'ナックル' | 'スクリュー' | 'その他';

/**
 * 投球結果
 */
export type PitchResult =
  | '見逃しストライク' | '空振り' | 'ファウル' | 'ボール'
  | 'インプレー' | 'デッドボール';

// ============================================
// 6. FARM STATS (ファーム情報)
// ============================================

/**
 * ファーム（2軍）成績
 */
export interface FarmStats {
  /** 選手ID */
  player_id: string;

  /** 年度 */
  year: number;

  /** リーグ */
  league: 'Eastern' | 'Western';

  /** 打撃成績（野手の場合） */
  batting?: BattingSeasonStats;

  /** 投手成績（投手の場合） */
  pitching?: PitchingSeasonStats;

  /** ポジション別出場数 */
  position_appearances?: Record<Position, number>;

  /** ファームでの打順 */
  typical_batting_order?: number;

  /** ファームでの役割（投手） */
  pitching_role?: 'starter' | 'closer' | 'setup' | 'middle_relief' | 'long_relief';
}

/**
 * 昇格・降格履歴
 */
export interface RosterMovement {
  /** 選手ID */
  player_id: string;

  /** 移動タイプ */
  movement_type: 'promotion' | 'demotion';

  /** 移動日 */
  movement_date: string;

  /** 移動元 */
  from_level: '1軍' | '2軍';

  /** 移動先 */
  to_level: '1軍' | '2軍';

  /** 直前10試合の成績（サマリ） */
  stats_before_movement?: {
    games: number;
    batting?: { AVG: number; OPS: number; };
    pitching?: { ERA: number; WHIP: number; };
  };

  /** 直後10試合の成績（サマリ） */
  stats_after_movement?: {
    games: number;
    batting?: { AVG: number; OPS: number; };
    pitching?: { ERA: number; WHIP: number; };
  };

  /** 理由 */
  reason?: string;
}

// ============================================
// 7. SPLITS (審判・球場・相性系)
// ============================================

/**
 * 審判別成績
 */
export interface UmpireSplits {
  /** 選手ID */
  player_id: string;

  /** 審判名 */
  umpire_name: string;

  /** 試合数 */
  games: number;

  /** 打者の場合 */
  batting?: {
    PA: number;
    OBP: number;
    BB_pct: number;
    K_pct: number;
    HR_pct: number;
  };

  /** 投手の場合 */
  pitching?: {
    IP: number;
    BB_pct: number;
    K_pct: number;
    strike_pct: number;
    runs_tendency: number; // 失点傾向
  };
}

/**
 * 球場別成績
 */
export interface ParkSplits {
  /** 選手ID */
  player_id: string;

  /** 球場名 */
  park_name: string;

  /** 試合数 */
  games: number;

  /** 打者の場合 */
  batting?: {
    PA: number;
    OPS: number;
    HR_pct: number;
    hit_direction_tendency?: Record<HitDirection, number>;
  };

  /** 投手の場合 */
  pitching?: {
    IP: number;
    HR_per_9: number;
    GB_FB_ratio: number;
    ERA: number;
    FIP: number;
  };
}

/**
 * マッチアップ別成績
 */
export interface MatchupSplits {
  /** 選手ID */
  player_id: string;

  /** 対戦相手ID */
  opponent_id: string;

  /** 対戦相手名 */
  opponent_name: string;

  /** 対戦タイプ */
  matchup_type: 'vs_pitcher' | 'vs_batter' | 'vs_battery';

  /** 対戦数 */
  encounters: number;

  /** 打者 vs 投手 */
  batting_vs_pitcher?: {
    PA: number;
    AVG: number;
    OPS: number;
    HR: number;
  };

  /** 投手 vs 打者 */
  pitching_vs_batter?: {
    PA: number;
    AVG_against: number;
    OPS_against: number;
    K_pct: number;
  };
}

/**
 * 左右投手別成績
 */
export interface HandednessSplits {
  /** 選手ID */
  player_id: string;

  /** 対戦相手の投球腕 */
  pitcher_hand: 'L' | 'R';

  /** 打者の場合 */
  batting?: {
    PA: number;
    AVG: number;
    OBP: number;
    SLG: number;
    OPS: number;
    K_pct: number;
    BB_pct: number;
  };

  /** 投手の場合（対左打者/対右打者） */
  pitching?: {
    PA: number;
    AVG_against: number;
    OPS_against: number;
    K_pct: number;
    BB_pct: number;
  };
}

// ============================================
// 8. EXTERNAL LINKS & MEDIA (SNS・ハイライト)
// ============================================

/**
 * 選手の外部リンク
 */
export interface PlayerLinks {
  /** 選手ID */
  player_id: string;

  /** X（Twitter）アカウント */
  twitter_url?: string;

  /** Instagram */
  instagram_url?: string;

  /** YouTube */
  youtube_url?: string;

  /** NPB公式ページ */
  npb_official_url?: string;

  /** Wikipedia */
  wikipedia_url?: string;

  /** Baseball Reference（MLB系） */
  baseball_reference_url?: string;

  /** 球団公式ページ */
  team_official_url?: string;

  /** 自作ハイライトプレイリスト */
  highlight_playlist_url?: string;

  /** その他のリンク */
  other_links?: Array<{
    label: string;
    url: string;
  }>;
}

// ============================================
// 9. META INFORMATION (メタ情報)
// ============================================

/**
 * データのメタ情報（透明性のため）
 */
export interface PlayerDataMeta {
  /** 選手ID */
  player_id: string;

  /** データ最終更新日時 */
  last_updated: string; // ISO 8601

  /** データソース一覧 */
  data_sources: DataSource[];

  /** 使用している指標の定義へのリンク */
  metrics_definitions?: {
    FIP_definition_url?: string;
    WAR_definition_url?: string;
    star_score_definition_url?: string;
    UII_definition_url?: string;
  };

  /** データ品質 */
  data_quality: {
    completeness: number; // 0-1（1が完全）
    reliability: 'high' | 'medium' | 'low';
    notes?: string;
  };

  /** データバージョン */
  version: string;
}

/**
 * データソース
 */
export interface DataSource {
  /** ソース名 */
  name: string;

  /** URL */
  url?: string;

  /** データタイプ */
  data_type: string[];

  /** 最終取得日時 */
  last_fetched?: string;
}

// ============================================
// 10. INTEGRATED PLAYER DATA (統合型)
// ============================================

/**
 * 選手の全データを統合した型
 */
export interface CompletePlayerData {
  /** プロフィール */
  profile: PlayerProfile;

  /** 経歴 */
  career: PlayerCareer;

  /** 1軍シーズン成績 */
  season_stats: {
    batting?: BattingSeasonStats[];
    pitching?: PitchingSeasonStats[];
  };

  /** 2軍シーズン成績 */
  farm_stats?: FarmStats[];

  /** 高度指標 */
  advanced_stats?: {
    batting?: AdvancedBattingStats[];
    pitching?: AdvancedPitchingStats[];
  };

  /** オリジナル指標 */
  original_metrics?: {
    star_score?: StarScore;
    undervalued_index?: UndervaluedIndex;
    wpa_stats?: WPAStats;
    predicted_score?: PredictedScore;
  };

  /** 打席ログ（最新N件） */
  recent_plate_appearances?: PlateAppearance[];

  /** 投球ログ（最新N件） */
  recent_pitches?: Pitch[];

  /** 昇格・降格履歴 */
  roster_movements?: RosterMovement[];

  /** 各種スプリット */
  splits?: {
    umpire?: UmpireSplits[];
    park?: ParkSplits[];
    matchup?: MatchupSplits[];
    handedness?: HandednessSplits[];
  };

  /** 外部リンク */
  links?: PlayerLinks;

  /** メタ情報 */
  meta: PlayerDataMeta;
}
