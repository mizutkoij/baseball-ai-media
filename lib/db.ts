// Database functionality disabled for Vercel compatibility
// All database operations now return mock data

export interface DatabaseConnections {
  current: any;
  history: any;
}

/**
 * Mock database connections for Vercel compatibility
 */
export function openConnections(): DatabaseConnections {
  console.warn('Database connections disabled for Vercel compatibility');
  throw new Error('Database operations not available - using mock data');
}

/**
 * Mock function to maintain API compatibility
 */
export function getUnionQuery() {
  console.warn('Database queries disabled for Vercel compatibility');
  return () => [];
}

/**
 * Mock function to maintain API compatibility  
 */
export function unionQuery(sql: string, params: any[] = []) {
  console.warn('Database queries disabled for Vercel compatibility');
  return Promise.resolve([]);
}

/**
 * Mock query function to maintain API compatibility
 */
export function query(sql: string, params: any[] = []) {
  console.warn('Database queries disabled for Vercel compatibility');
  return Promise.resolve([]);
}

/**
 * Mock get function to maintain API compatibility
 */
export function get(key: string) {
  console.warn('Database get disabled for Vercel compatibility');
  return null;
}

/**
 * Close mock connections
 */
export function closeConnections(connections: DatabaseConnections) {
  // No-op for mock connections
  console.log('Mock database connections closed');
}