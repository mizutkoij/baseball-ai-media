// lib/imputation-ladder.ts
/**
 * "推定のはしご" - データ欠損時の段階的補完ロジック
 * 確実性の高い順に適用して、運用継続を優先
 */

import { GameState } from './live-state';
import { logger } from './logger';

const log = logger.child({ job: 'imputation' });

export interface ImputationResult {
  gameState: GameState;
  confidence: 'high' | 'medium' | 'low' | 'minimal';
  imputedFields: string[];
  method: string[];
  reliable: boolean; // 予測に使用可能かどうか
}

export interface ImputationContext {
  previousState?: GameState;
  knownEvents?: string[]; // 'score_change', 'inning_change' など
  timeElapsed?: number;    // 前回からの経過秒数
  sourceConfidence?: number; // データソースの信頼度
}

/**
 * メイン関数：段階的にデータを補完
 */
export function imputeGameState(
  partialState: Partial<GameState>,
  context: ImputationContext = {}
): ImputationResult {
  
  log.debug({
    gameId: partialState.gameId,
    missingFields: findMissingFields(partialState)
  }, 'Starting imputation ladder');
  
  let state = { ...partialState } as GameState;
  const imputedFields: string[] = [];
  const methods: string[] = [];
  
  // Level 1: 必須フィールドの最小補完（確実性: 高）
  const level1 = applyLevel1Imputation(state, context);
  state = level1.state;
  imputedFields.push(...level1.fields);
  methods.push(...level1.methods);
  
  // Level 2: コンテキスト推定（確実性: 中）
  const level2 = applyLevel2Imputation(state, context);
  state = level2.state;
  imputedFields.push(...level2.fields);
  methods.push(...level2.methods);
  
  // Level 3: 統計的補完（確実性: 低）
  const level3 = applyLevel3Imputation(state, context);
  state = level3.state;
  imputedFields.push(...level3.fields);
  methods.push(...level3.methods);
  
  // Level 4: 最後の手段（確実性: 最小）
  const level4 = applyLevel4Imputation(state, context);
  state = level4.state;
  imputedFields.push(...level4.fields);
  methods.push(...level4.methods);
  
  // 最終的な信頼度評価
  const confidence = assessOverallConfidence(imputedFields, methods, context);
  const reliable = confidence !== 'minimal' && imputedFields.length <= 3;
  
  log.info({
    gameId: state.gameId,
    imputedFields,
    confidence,
    reliable,
    methods
  }, 'Imputation ladder completed');
  
  return {
    gameState: state,
    confidence,
    imputedFields,
    method: methods,
    reliable
  };
}

/**
 * Level 1: 必須フィールドの最小補完
 * - gameId, timestamp は絶対必要
 * - 欠損時はエラー or デフォルト値
 */
function applyLevel1Imputation(
  state: GameState,
  context: ImputationContext
): { state: GameState; fields: string[]; methods: string[] } {
  const fields: string[] = [];
  const methods: string[] = [];
  
  // gameId が無い場合は推定不可
  if (!state.gameId) {
    throw new Error('gameId is required and cannot be imputed');
  }
  
  // timestamp が無い場合は現在時刻
  if (!state.timestamp) {
    state.timestamp = new Date().toISOString();
    fields.push('timestamp');
    methods.push('current_time');
  }
  
  return { state, fields, methods };
}

/**
 * Level 2: コンテキスト推定
 * - 前回状態との差分から推定
 * - 既知イベントから逆算
 */
function applyLevel2Imputation(
  state: GameState,
  context: ImputationContext
): { state: GameState; fields: string[]; methods: string[] } {
  const fields: string[] = [];
  const methods: string[] = [];
  
  const prev = context.previousState;
  if (!prev) return { state, fields, methods };
  
  // inning の推定
  if (state.inning === undefined || state.inning === null) {
    if (context.knownEvents?.includes('inning_change')) {
      state.inning = prev.inning + 1;
      fields.push('inning');
      methods.push('inning_increment');
    } else {
      state.inning = prev.inning;
      fields.push('inning');
      methods.push('inning_maintain');
    }
  }
  
  // top/bottom の推定
  if (state.top === undefined || state.top === null) {
    if (context.knownEvents?.includes('inning_change')) {
      // イニング変更があった場合、表裏を切り替え
      state.top = prev.top ? false : true;
      fields.push('top');
      methods.push('inning_flip');
    } else {
      state.top = prev.top;
      fields.push('top');
      methods.push('top_maintain');
    }
  }
  
  // outs の推定
  if (state.outs === undefined || state.outs === null) {
    if (context.knownEvents?.includes('inning_change')) {
      state.outs = 0; // 新しいイニングは0アウト
      fields.push('outs');
      methods.push('inning_reset_outs');
    } else {
      // 保守的：アウトは変化なしと仮定
      state.outs = prev.outs;
      fields.push('outs');
      methods.push('outs_maintain');
    }
  }
  
  // スコアの推定
  if (state.homeScore === undefined || state.homeScore === null) {
    if (context.knownEvents?.includes('score_change')) {
      // スコア変化があったが具体値不明：+1と仮定
      if (state.top === false) { // ホーム攻撃中
        state.homeScore = prev.homeScore + 1;
        methods.push('home_score_increment');
      } else {
        state.homeScore = prev.homeScore;
        methods.push('home_score_maintain');
      }
    } else {
      state.homeScore = prev.homeScore;
      methods.push('home_score_maintain');
    }
    fields.push('homeScore');
  }
  
  if (state.awayScore === undefined || state.awayScore === null) {
    if (context.knownEvents?.includes('score_change')) {
      if (state.top === true) { // アウェイ攻撃中
        state.awayScore = prev.awayScore + 1;
        methods.push('away_score_increment');
      } else {
        state.awayScore = prev.awayScore;
        methods.push('away_score_maintain');
      }
    } else {
      state.awayScore = prev.awayScore;
      methods.push('away_score_maintain');
    }
    fields.push('awayScore');
  }
  
  // bases の保守的推定
  if (state.bases === undefined || state.bases === null) {
    if (context.knownEvents?.includes('score_change')) {
      // 得点があった場合、ランナーはクリアされた可能性が高い
      state.bases = 0;
      fields.push('bases');
      methods.push('bases_clear_on_score');
    } else if (context.knownEvents?.includes('inning_change')) {
      // イニング変更時は必ずクリア
      state.bases = 0;
      fields.push('bases');
      methods.push('bases_clear_on_inning');
    } else {
      // 不明な場合は前回のまま（保守的）
      state.bases = prev.bases;
      fields.push('bases');
      methods.push('bases_maintain');
    }
  }
  
  return { state, fields, methods };
}

/**
 * Level 3: 統計的補完
 * - 典型的な値で補完
 * - イニング・時間帯での統計値
 */
function applyLevel3Imputation(
  state: GameState,
  context: ImputationContext
): { state: GameState; fields: string[]; methods: string[] } {
  const fields: string[] = [];
  const methods: string[] = [];
  
  // inning の統計補完
  if (state.inning === undefined || state.inning === null) {
    // 時間帯から推定（簡易版）
    const hour = new Date().getHours();
    if (hour >= 18 && hour <= 20) {
      state.inning = 5; // 夜間の典型的な進行
    } else {
      state.inning = 1; // デフォルト
    }
    fields.push('inning');
    methods.push('inning_statistical');
  }
  
  // その他フィールドのデフォルト値
  if (state.top === undefined || state.top === null) {
    state.top = true; // 表から開始
    fields.push('top');
    methods.push('top_default');
  }
  
  if (state.outs === undefined || state.outs === null) {
    state.outs = 0; // 0アウトが最も頻度が高い
    fields.push('outs');
    methods.push('outs_statistical');
  }
  
  if (state.bases === undefined || state.bases === null) {
    state.bases = 0; // ランナーなしが最も頻度が高い
    fields.push('bases');
    methods.push('bases_statistical');
  }
  
  if (state.homeScore === undefined || state.homeScore === null) {
    state.homeScore = 0; // スコアのデフォルト
    fields.push('homeScore');
    methods.push('score_default');
  }
  
  if (state.awayScore === undefined || state.awayScore === null) {
    state.awayScore = 0; // スコアのデフォルト
    fields.push('awayScore');
    methods.push('score_default');
  }
  
  return { state, fields, methods };
}

/**
 * Level 4: 最後の手段
 * - 動作継続のための最小限の値
 * - 信頼性は最低だが、システムは止まらない
 */
function applyLevel4Imputation(
  state: GameState,
  context: ImputationContext
): { state: GameState; fields: string[]; methods: string[] } {
  const fields: string[] = [];
  const methods: string[] = [];
  
  // 型安全性のための最終キャスト
  if (typeof state.inning !== 'number') {
    state.inning = 1;
    fields.push('inning');
    methods.push('emergency_default');
  }
  
  if (typeof state.top !== 'boolean') {
    state.top = true;
    fields.push('top');
    methods.push('emergency_default');
  }
  
  if (typeof state.outs !== 'number' || state.outs < 0 || state.outs > 2) {
    state.outs = 0 as 0|1|2;
    fields.push('outs');
    methods.push('emergency_default');
  }
  
  if (typeof state.bases !== 'number') {
    state.bases = 0;
    fields.push('bases');
    methods.push('emergency_default');
  }
  
  if (typeof state.homeScore !== 'number') {
    state.homeScore = 0;
    fields.push('homeScore');
    methods.push('emergency_default');
  }
  
  if (typeof state.awayScore !== 'number') {
    state.awayScore = 0;
    fields.push('awayScore');
    methods.push('emergency_default');
  }
  
  return { state, fields, methods };
}

/**
 * 欠損フィールドの検出
 */
function findMissingFields(state: Partial<GameState>): string[] {
  const required = ['gameId', 'inning', 'top', 'outs', 'bases', 'homeScore', 'awayScore', 'timestamp'];
  return required.filter(field => 
    state[field] === undefined || state[field] === null
  );
}

/**
 * 全体的な信頼度評価
 */
function assessOverallConfidence(
  imputedFields: string[],
  methods: string[],
  context: ImputationContext
): 'high' | 'medium' | 'low' | 'minimal' {
  
  const emergencyMethods = methods.filter(m => m.includes('emergency')).length;
  const statisticalMethods = methods.filter(m => m.includes('statistical')).length;
  const contextMethods = methods.filter(m => m.includes('maintain') || m.includes('increment')).length;
  
  // 緊急補完が多い場合は最小信頼度
  if (emergencyMethods > 2) return 'minimal';
  
  // 統計補完が多い場合は低信頼度
  if (statisticalMethods > 3) return 'low';
  
  // コンテキスト推定が多い場合は中信頼度
  if (contextMethods > 2) return 'medium';
  
  // 補完フィールドが少ない場合は高信頼度
  if (imputedFields.length <= 2) return 'high';
  
  return 'medium';
}

/**
 * 補完されたGameStateの妥当性チェック
 */
export function validateImputedState(result: ImputationResult): boolean {
  const state = result.gameState;
  
  // 基本的な妥当性チェック
  if (state.inning < 1 || state.inning > 20) return false;
  if (state.outs < 0 || state.outs > 2) return false;
  if (state.bases < 0 || state.bases > 7) return false;
  if (state.homeScore < 0 || state.awayScore < 0) return false;
  if (!state.gameId || !state.timestamp) return false;
  
  // 信頼度が minimal で重要フィールドが補完されている場合は却下
  if (result.confidence === 'minimal' && 
      result.imputedFields.includes('homeScore') && 
      result.imputedFields.includes('awayScore')) {
    return false;
  }
  
  return true;
}