// Local SQLite database for development with multi-league support
import Database from 'better-sqlite3';
import path from 'path';

export type League = 'npb' | 'mlb' | 'kbo' | 'international';

export interface DatabaseConnections {
  current: Database.Database;
  history: Database.Database;
}

export interface MultiLeagueConnections {
  npb: Database.Database;
  mlb: Database.Database;
  kbo: Database.Database;
  international: Database.Database;
  comprehensive: Database.Database;
}

/**
 * SQLite database connections for local development
 */
export function openConnections(): DatabaseConnections {
  const currentDbPath = process.env.DB_PATH || './data/db_current.db';
  const historyDbPath = process.env.DB_HISTORY_PATH || './data/db_history.db';
  
  const current = new Database(currentDbPath);
  const history = new Database(historyDbPath);
  
  return { current, history };
}

/**
 * Multi-league SQLite database connections
 * Using comprehensive database for all leagues with league filtering
 */
export function openMultiLeagueConnections(): MultiLeagueConnections {
  const comprehensivePath = process.env.COMPREHENSIVE_DB_PATH || './comprehensive_baseball_database.db';
  
  // Use comprehensive database for all leagues
  const comprehensive = new Database(comprehensivePath);
  const npb = comprehensive;
  const mlb = comprehensive;
  const kbo = comprehensive;
  const international = comprehensive;
  
  return { npb, mlb, kbo, international, comprehensive };
}

/**
 * Get database connection for specific league
 * All leagues use the same comprehensive database
 */
export function getLeagueConnection(league: League): Database.Database {
  const comprehensivePath = process.env.COMPREHENSIVE_DB_PATH || './comprehensive_baseball_database.db';
  return new Database(comprehensivePath);
}

/**
 * Get union query function for SQLite
 */
export function getUnionQuery() {
  const connections = openConnections();
  return (sql: string, params: any[] = []) => {
    try {
      return connections.current.prepare(sql).all(params);
    } catch (error) {
      console.error('SQLite query error:', error);
      return [];
    }
  };
}

/**
 * Union query function for SQLite
 */
export function unionQuery(sql: string, params: any[] = []) {
  const connections = openConnections();
  try {
    const result = connections.current.prepare(sql).all(params);
    closeConnections(connections);
    return Promise.resolve(result);
  } catch (error) {
    console.error('SQLite union query error:', error);
    closeConnections(connections);
    return Promise.resolve([]);
  }
}

/**
 * Query function for SQLite
 */
export function query(sql: string, params: any[] = []) {
  const connections = openConnections();
  try {
    const result = connections.current.prepare(sql).all(params);
    closeConnections(connections);
    return Promise.resolve(result);
  } catch (error) {
    console.error('SQLite query error:', error);
    closeConnections(connections);
    return Promise.resolve([]);
  }
}

/**
 * Get function for SQLite
 */
export function get(sql: string, params: any[] = []) {
  const connections = openConnections();
  try {
    const result = connections.current.prepare(sql).get(params);
    closeConnections(connections);
    return result;
  } catch (error) {
    console.error('SQLite get error:', error);
    closeConnections(connections);
    return null;
  }
}

/**
 * Run function for SQLite (UPDATE, INSERT, DELETE)
 */
export function run(sql: string, params: any[] = []) {
  const connections = openConnections();
  try {
    const result = connections.current.prepare(sql).run(params);
    closeConnections(connections);
    return result;
  } catch (error) {
    console.error('SQLite run error:', error);
    closeConnections(connections);
    return { changes: 0, lastInsertRowid: 0 };
  }
}

/**
 * Multi-league query function
 */
export function queryLeague(league: League, sql: string, params: any[] = []) {
  try {
    const connection = getLeagueConnection(league);
    const result = connection.prepare(sql).all(params);
    connection.close();
    return Promise.resolve(result);
  } catch (error) {
    console.error(`SQLite ${league} query error:`, error);
    return Promise.resolve([]);
  }
}

/**
 * Multi-league get function
 */
export function getLeague(league: League, sql: string, params: any[] = []) {
  try {
    const connection = getLeagueConnection(league);
    const result = connection.prepare(sql).get(params);
    connection.close();
    return result;
  } catch (error) {
    console.error(`SQLite ${league} get error:`, error);
    return null;
  }
}

/**
 * Close multi-league SQLite connections
 */
export function closeMultiLeagueConnections(connections: MultiLeagueConnections) {
  try {
    connections.npb.close();
    connections.mlb.close();
    connections.kbo.close();
    connections.international.close();
    connections.comprehensive.close();
  } catch (error) {
    console.error('Error closing multi-league database connections:', error);
  }
}

/**
 * Close SQLite connections
 */
export function closeConnections(connections: DatabaseConnections) {
  try {
    connections.current.close();
    connections.history.close();
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
}