// lib/live-state-from-secondary.ts
/**
 * セカンダリソースからGameState抽出
 * Primary（詳細データ）が失敗/欠損時のフォールバック
 */

import { GameState } from './live-state';
import { logger } from './logger';

const log = logger.child({ job: 'secondary-source' });

export interface SecondarySource {
  name: string;
  priority: number; // 低い方が優先
  fetcher: (gameId: string, date: string) => Promise<Partial<GameState> | null>;
}

// セカンダリソース定義（優先順）
const SOURCES: SecondarySource[] = [
  {
    name: 'npb-official-scoreboard',
    priority: 1,
    fetcher: fetchNPBScoreboard
  },
  {
    name: 'shadow-scraper',
    priority: 2,
    fetcher: fetchShadowScraper
  }
];

/**
 * メイン関数：複数ソースから GameState 補完
 */
export async function fetchSecondaryState(
  gameId: string, 
  date: string
): Promise<Partial<GameState> | null> {
  const sorted = SOURCES.sort((a, b) => a.priority - b.priority);
  
  for (const source of sorted) {
    try {
      log.debug({ gameId, date, source: source.name }, 'Trying secondary source');
      
      const state = await source.fetcher(gameId, date);
      if (state) {
        log.info({ 
          gameId, 
          date, 
          source: source.name,
          fields: Object.keys(state)
        }, 'Secondary state acquired');
        
        return {
          ...state,
          _source: source.name,
          _inferred: true,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      log.warn({ 
        gameId, 
        date, 
        source: source.name, 
        error: error.message 
      }, 'Secondary source failed');
    }
  }
  
  log.warn({ gameId, date }, 'All secondary sources failed');
  return null;
}

/**
 * フィールド単位マージ：primary ?? secondary の順
 */
export function mergeGameState(
  primary: Partial<GameState> | null,
  secondary: Partial<GameState> | null
): GameState | null {
  if (!primary && !secondary) return null;
  
  const merged = {
    gameId: primary?.gameId ?? secondary?.gameId ?? '',
    inning: primary?.inning ?? secondary?.inning ?? 1,
    top: primary?.top ?? secondary?.top ?? true,
    outs: (primary?.outs ?? secondary?.outs ?? 0) as 0|1|2,
    bases: primary?.bases ?? secondary?.bases ?? 0,
    homeScore: primary?.homeScore ?? secondary?.homeScore ?? 0,
    awayScore: primary?.awayScore ?? secondary?.awayScore ?? 0,
    timestamp: primary?.timestamp ?? secondary?.timestamp ?? new Date().toISOString()
  };
  
  // どのフィールドが推定されたかログ
  const inferred = [];
  if (!primary?.inning && secondary?.inning) inferred.push('inning');
  if (!primary?.outs && secondary?.outs) inferred.push('outs');
  if (!primary?.bases && secondary?.bases) inferred.push('bases');
  if (!primary?.homeScore && secondary?.homeScore) inferred.push('homeScore');
  if (!primary?.awayScore && secondary?.awayScore) inferred.push('awayScore');
  
  if (inferred.length > 0) {
    log.info({ 
      gameId: merged.gameId,
      inferred_fields: inferred,
      primary_source: primary?._source ?? 'unknown',
      secondary_source: secondary?._source ?? 'unknown'
    }, 'Game state merged with inference');
  }
  
  return merged;
}

/**
 * NPB公式スコアボードから基本情報取得
 */
async function fetchNPBScoreboard(gameId: string, date: string): Promise<Partial<GameState> | null> {
  // 実装例：簡易スコアボードAPI（仮想）
  // 実際は npb.jp の適切なエンドポイントを使用
  
  try {
    // gameId例: "20250812_G-T_01" -> league=CL, home=G, away=T
    const [dateStr, teams, game] = gameId.split('_');
    if (!teams || teams.length !== 3) return null;
    
    const [away, home] = [teams[0], teams[2]];
    
    // 模擬APIレスポンス（実際はHTTP取得）
    const mockResponse = await simulateScoreboardAPI(date, home, away);
    if (!mockResponse) return null;
    
    return {
      gameId,
      inning: mockResponse.inning,
      top: mockResponse.top_bottom === 'top',
      outs: mockResponse.outs as 0|1|2,
      bases: mockResponse.runners_code, // NPB形式から変換
      homeScore: mockResponse.home_score,
      awayScore: mockResponse.away_score,
      _source: 'npb-scoreboard'
    };
  } catch (error) {
    log.warn({ error: error.message }, 'NPB scoreboard fetch failed');
    return null;
  }
}

/**
 * シャドウスクレイパーから詳細状況取得
 */
async function fetchShadowScraper(gameId: string, date: string): Promise<Partial<GameState> | null> {
  try {
    // 別実装のスクレイパー（存在する場合）
    // こちらは詳細度が高いが信頼性が低い可能性
    
    const mockData = await simulateShadowScraper(gameId, date);
    if (!mockData) return null;
    
    return {
      gameId,
      inning: mockData.inning,
      top: !mockData.bottom_half,
      outs: mockData.outs as 0|1|2,
      bases: convertBasesToCode(mockData.runners),
      homeScore: mockData.home_runs,
      awayScore: mockData.away_runs,
      _source: 'shadow-scraper'
    };
  } catch (error) {
    log.warn({ error: error.message }, 'Shadow scraper failed');
    return null;
  }
}

/**
 * 保守的な bases 推定（確実な情報のみ）
 */
export function conservativeBases(
  previousBases: number, 
  scoreChange: number, 
  outsChange: number
): number {
  // スコアが入った場合の最小変化仮定
  if (scoreChange > 0) {
    // 得点があればランナーはクリア傾向
    return 0;
  }
  
  // アウトが増えた場合、ランナーは変化なしと仮定
  if (outsChange > 0) {
    return previousBases;
  }
  
  // 不明な場合は前回のまま
  return previousBases;
}

/**
 * ランナー配置をNPBコードに変換
 */
function convertBasesToCode(runners: { base: number }[]): number {
  let code = 0;
  for (const runner of runners || []) {
    if (runner.base === 1) code |= 1;
    if (runner.base === 2) code |= 2;
    if (runner.base === 3) code |= 4;
  }
  return code;
}

// モック関数（実際の実装時は削除）
async function simulateScoreboardAPI(date: string, home: string, away: string) {
  // 実際はHTTPリクエスト
  await new Promise(r => setTimeout(r, 100));
  
  return {
    inning: 6,
    top_bottom: 'bottom',
    outs: 1,
    runners_code: 2, // 2塁にランナー
    home_score: 4,
    away_score: 3
  };
}

async function simulateShadowScraper(gameId: string, date: string) {
  await new Promise(r => setTimeout(r, 150));
  
  return {
    inning: 6,
    bottom_half: true,
    outs: 1,
    runners: [{ base: 2 }],
    home_runs: 4,
    away_runs: 3
  };
}