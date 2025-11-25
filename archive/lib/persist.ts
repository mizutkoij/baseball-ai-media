/**
 * データ永続化統合層
 * 
 * 機能:
 * - 既存スクレイパーからcanonical-writerへの橋渡し
 * - データ種別ごとの正規化処理
 * - ログ統合
 * - 最小差分でスクレイパー統合
 */

import { normalizeTeamId, normalizePlayerName, normalizeStadium, normalizeHand, getAndClearWarnings } from './normalize';
import { writeCanonicalSet } from './canonical-writer';
import { withCtx, generateRunId } from './logger';
import type { Kind } from './canonical';

/**
 * 予告先発データの正規化
 */
function normalizeStarter(record: any, date: string): any {
  const normalized = {
    ...record,
    date,
    // チーム名正規化
    home: record.home ? normalizeTeamId(record.home) : normalizeTeamId(record.team),
    away: record.away ? normalizeTeamId(record.away) : normalizeTeamId(record.opponent),
    
    // 投手情報正規化
    homePitcher: record.homePitcher ? {
      ...record.homePitcher,
      name: normalizePlayerName(record.homePitcher.name),
      hand: normalizeHand(record.homePitcher.hand || record.homePitcher.throws),
    } : record.pitcher ? {
      ...record.pitcher,
      name: normalizePlayerName(record.pitcher.name),
      hand: normalizeHand(record.pitcher.hand || record.pitcher.throws),
    } : undefined,
    
    awayPitcher: record.awayPitcher ? {
      ...record.awayPitcher,
      name: normalizePlayerName(record.awayPitcher.name),
      hand: normalizeHand(record.awayPitcher.hand || record.awayPitcher.throws),
    } : undefined,
    
    // 球場名正規化
    venue: record.venue ? normalizeStadium(record.venue) : 
           record.stadium ? normalizeStadium(record.stadium) : undefined,
    
    // ソース情報
    source: record.source || 'npb_official',
    updatedAt: new Date().toISOString(),
  };

  // レガシー形式のサポート（team/opponent → home/away）
  if (record.team && !normalized.home) {
    normalized.home = normalizeTeamId(record.team);
  }
  if (record.opponent && !normalized.away) {
    normalized.away = normalizeTeamId(record.opponent);
  }
  
  return normalized;
}

/**
 * 試合データの正規化
 */
function normalizeGame(record: any): any {
  return {
    ...record,
    // チーム名正規化
    away_team: normalizeTeamId(record.away_team || record.awayTeam),
    home_team: normalizeTeamId(record.home_team || record.homeTeam),
    
    // 球場名正規化
    venue: record.venue ? normalizeStadium(record.venue) : undefined,
    
    // リーグ正規化
    league: record.league === 'central' ? 'CL' : 
            record.league === 'pacific' ? 'PL' : 
            record.league,
    
    // 更新時刻
    updated_at: record.updated_at || new Date().toISOString(),
  };
}

/**
 * 詳細データの正規化
 */
function normalizeDetail(record: any): any {
  return {
    ...record,
    // チーム名正規化（必要に応じて）
    homeTeam: record.homeTeam ? normalizeTeamId(record.homeTeam) : undefined,
    awayTeam: record.awayTeam ? normalizeTeamId(record.awayTeam) : undefined,
    
    // 球場名正規化
    venue: record.venue ? normalizeStadium(record.venue) : undefined,
    
    // 選手名正規化（バッティング統計など）
    playerStats: record.playerStats ? {
      home: record.playerStats.home?.map((p: any) => ({
        ...p,
        name: normalizePlayerName(p.name),
      })),
      away: record.playerStats.away?.map((p: any) => ({
        ...p,
        name: normalizePlayerName(p.name),
      })),
    } : undefined,
  };
}

/**
 * 予告先発データの永続化
 */
export async function persistStarters(opts: {
  date: string;
  items: any[];
  dataDir: string;
  runId?: string;
}): Promise<any> {
  const { date, items, dataDir, runId = generateRunId() } = opts;
  const logger = withCtx({ runId, job: 'starters', date });
  
  logger.info({ items: items.length }, 'Starting starters persistence');
  
  try {
    // 正規化処理
    const normalized = items.map(record => normalizeStarter(record, date));
    
    // 正規化警告の収集
    const warnings = getAndClearWarnings();
    if (warnings.length > 0) {
      logger.warn({ warnings: warnings.length }, 'Normalization warnings detected');
      warnings.forEach(w => logger.debug(w, 'Normalization warning'));
    }
    
    // カノニカル書き込み
    const result = await writeCanonicalSet({
      baseDir: dataDir,
      kind: 'starters' as Kind,
      date,
      records: normalized,
    });
    
    logger.info({
      action: result.action,
      items: result.items,
      added: result.diff?.added.length || 0,
      removed: result.diff?.removed.length || 0,
      updated: result.diff?.updated.length || 0,
      collisions: result.collisions?.length || 0,
    }, 'Starters persistence completed');
    
    return result;
    
  } catch (error) {
    logger.error({ error: String(error) }, 'Starters persistence failed');
    throw error;
  }
}

/**
 * 試合データの永続化
 */
export async function persistGames(opts: {
  date: string;
  items: any[];
  dataDir: string;
  runId?: string;
}): Promise<any> {
  const { date, items, dataDir, runId = generateRunId() } = opts;
  const logger = withCtx({ runId, job: 'games', date });
  
  logger.info({ items: items.length }, 'Starting games persistence');
  
  try {
    // 正規化処理
    const normalized = items.map(normalizeGame);
    
    // 正規化警告の収集
    const warnings = getAndClearWarnings();
    if (warnings.length > 0) {
      logger.warn({ warnings: warnings.length }, 'Normalization warnings detected');
    }
    
    // カノニカル書き込み
    const result = await writeCanonicalSet({
      baseDir: dataDir,
      kind: 'games' as Kind,
      date,
      records: normalized,
    });
    
    logger.info({
      action: result.action,
      items: result.items,
      added: result.diff?.added.length || 0,
      removed: result.diff?.removed.length || 0,
      updated: result.diff?.updated.length || 0,
    }, 'Games persistence completed');
    
    return result;
    
  } catch (error) {
    logger.error({ error: String(error) }, 'Games persistence failed');
    throw error;
  }
}

/**
 * 詳細データの永続化
 */
export async function persistDetails(opts: {
  date: string;
  items: any[];
  dataDir: string;
  runId?: string;
}): Promise<any> {
  const { date, items, dataDir, runId = generateRunId() } = opts;
  const logger = withCtx({ runId, job: 'details', date });
  
  logger.info({ items: items.length }, 'Starting details persistence');
  
  try {
    // 正規化処理
    const normalized = items.map(normalizeDetail);
    
    // 正規化警告の収集
    const warnings = getAndClearWarnings();
    if (warnings.length > 0) {
      logger.warn({ warnings: warnings.length }, 'Normalization warnings detected');
    }
    
    // カノニカル書き込み
    const result = await writeCanonicalSet({
      baseDir: dataDir,
      kind: 'details' as Kind,
      date,
      records: normalized,
    });
    
    logger.info({
      action: result.action,
      items: result.items,
      added: result.diff?.added.length || 0,
      removed: result.diff?.removed.length || 0,
      updated: result.diff?.updated.length || 0,
    }, 'Details persistence completed');
    
    return result;
    
  } catch (error) {
    logger.error({ error: String(error) }, 'Details persistence failed');
    throw error;
  }
}

/**
 * バッチ永続化（複数データタイプ）
 */
export async function persistBatch(opts: {
  date: string;
  dataDir: string;
  starters?: any[];
  games?: any[];
  details?: any[];
  runId?: string;
}): Promise<{
  starters?: any;
  games?: any;
  details?: any;
}> {
  const { date, dataDir, runId = generateRunId() } = opts;
  const logger = withCtx({ runId, job: 'batch', date });
  
  logger.info({
    starters: opts.starters?.length || 0,
    games: opts.games?.length || 0,
    details: opts.details?.length || 0,
  }, 'Starting batch persistence');
  
  const results: any = {};
  
  try {
    if (opts.starters && opts.starters.length > 0) {
      results.starters = await persistStarters({
        date,
        items: opts.starters,
        dataDir,
        runId,
      });
    }
    
    if (opts.games && opts.games.length > 0) {
      results.games = await persistGames({
        date,
        items: opts.games,
        dataDir,
        runId,
      });
    }
    
    if (opts.details && opts.details.length > 0) {
      results.details = await persistDetails({
        date,
        items: opts.details,
        dataDir,
        runId,
      });
    }
    
    logger.info({ results: Object.keys(results) }, 'Batch persistence completed');
    return results;
    
  } catch (error) {
    logger.error({ error: String(error) }, 'Batch persistence failed');
    throw error;
  }
}