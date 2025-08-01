import Database from 'better-sqlite3';
import { existsSync } from 'fs';

const CURRENT_PATH = process.env.DB_CURRENT || './data/db_current.db';
const HISTORY_PATH = process.env.DB_HISTORY || './data/db_history.db';

/**
 * 物理分割されたデータベースの統合アクセス層
 * - db_current: 直近2シーズン（2024-2025）読み書き
 * - db_history: 過去データ（2019-2023）読み込みのみ
 */

export interface DatabaseConnections {
  current: Database.Database;
  history: Database.Database;
}

/**
 * データベース接続を開く
 */
export function openConnections(): DatabaseConnections {
  if (!existsSync(CURRENT_PATH)) {
    throw new Error(`Current database not found: ${CURRENT_PATH}`);
  }
  
  if (!existsSync(HISTORY_PATH)) {
    throw new Error(`History database not found: ${HISTORY_PATH}`);
  }

  const dbCurrent = new Database(CURRENT_PATH);
  const dbHistory = new Database(HISTORY_PATH, { readonly: true });

  return { current: dbCurrent, history: dbHistory };
}

/**
 * 接続を閉じる
 */
export function closeConnections(connections: DatabaseConnections): void {
  connections.current.close();
  connections.history.close();
}

/**
 * 汎用クエリ実行（フォールバック方式）
 * 1. まず db_current で実行
 * 2. 結果が0件なら db_history で実行
 * 3. 両方の結果をマージして返す
 */
export async function query<T = any>(
  sql: string, 
  params: any[] = [], 
  options: { 
    preferHistory?: boolean;
    currentOnly?: boolean;
    historyOnly?: boolean;
  } = {}
): Promise<T[]> {
  const connections = openConnections();
  
  try {
    let results: T[] = [];

    if (options.historyOnly) {
      // History のみ
      results = connections.history.prepare(sql).all(...params) as T[];
    } else if (options.currentOnly) {
      // Current のみ
      results = connections.current.prepare(sql).all(...params) as T[];
    } else if (options.preferHistory) {
      // History を優先、0件なら Current
      results = connections.history.prepare(sql).all(...params) as T[];
      if (results.length === 0) {
        results = connections.current.prepare(sql).all(...params) as T[];
      }
    } else {
      // デフォルト: Current を優先、0件なら History
      results = connections.current.prepare(sql).all(...params) as T[];
      if (results.length === 0) {
        results = connections.history.prepare(sql).all(...params) as T[];
      }
    }

    return results;
  } finally {
    closeConnections(connections);
  }
}

/**
 * UNION ALL クエリ（両DBから結果を統合）
 */
export async function unionQuery<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const connections = openConnections();
  
  try {
    const currentResults = connections.current.prepare(sql).all(...params) as T[];
    const historyResults = connections.history.prepare(sql).all(...params) as T[];
    
    return [...currentResults, ...historyResults];
  } finally {
    closeConnections(connections);
  }
}

/**
 * 単一レコード取得（フォールバック方式）
 */
export async function get<T = any>(
  sql: string,
  params: any[] = [],
  options: { preferHistory?: boolean } = {}
): Promise<T | undefined> {
  const results = await query<T>(sql, params, options);
  return results[0];
}

/**
 * 書き込み専用（常に db_current）
 */
export function write(
  sql: string,
  params: any[] = []
): Database.RunResult {
  if (!existsSync(CURRENT_PATH)) {
    throw new Error(`Current database not found: ${CURRENT_PATH}`);
  }

  const db = new Database(CURRENT_PATH);
  try {
    return db.prepare(sql).run(...params);
  } finally {
    db.close();
  }
}

/**
 * トランザクション実行（db_current のみ）
 */
export function transaction<T>(
  callback: (db: Database.Database) => T
): T {
  if (!existsSync(CURRENT_PATH)) {
    throw new Error(`Current database not found: ${CURRENT_PATH}`);
  }

  const db = new Database(CURRENT_PATH);
  try {
    const txn = db.transaction(callback);
    return txn(db);
  } finally {
    db.close();
  }
}

/**
 * 年度別データベース選択ヘルパー
 */
export function selectDbByYear(year: number): 'current' | 'history' {
  return year >= 2024 ? 'current' : 'history';
}

/**
 * デバッグ: 両DBの基本統計
 */
export async function getDbStats(): Promise<{
  current: { games: number; batting: number; pitching: number };
  history: { games: number; batting: number; pitching: number };
}> {
  const connections = openConnections();
  
  try {
    const currentStats = {
      games: connections.current.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number },
      batting: connections.current.prepare('SELECT COUNT(*) as count FROM box_batting').get() as { count: number },
      pitching: connections.current.prepare('SELECT COUNT(*) as count FROM box_pitching').get() as { count: number }
    };

    const historyStats = {
      games: connections.history.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number },
      batting: connections.history.prepare('SELECT COUNT(*) as count FROM box_batting').get() as { count: number },
      pitching: connections.history.prepare('SELECT COUNT(*) as count FROM box_pitching').get() as { count: number }
    };

    return {
      current: {
        games: currentStats.games.count,
        batting: currentStats.batting.count,
        pitching: currentStats.pitching.count
      },
      history: {
        games: historyStats.games.count,
        batting: historyStats.batting.count,
        pitching: historyStats.pitching.count
      }
    };
  } finally {
    closeConnections(connections);
  }
}