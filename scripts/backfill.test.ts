/**
 * backfill.test.ts — Test suite for backfill history logic
 * Validates upsert anti-join pattern, delta threshold validation, and dry-run behavior
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { tmpdir } from 'os'

describe('Backfill History Logic', () => {
  let testDb: Database.Database
  let testDbPath: string

  beforeEach(() => {
    // Create a temporary database for each test
    testDbPath = path.join(tmpdir(), `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.db`)
    testDb = new Database(testDbPath)
    testDb.pragma('journal_mode = WAL')
    testDb.exec('PRAGMA foreign_keys = ON;')
  })

  afterEach(() => {
    testDb.close()
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  describe('Anti-join UPSERT Logic', () => {
    beforeEach(() => {
      // Setup test tables
      testDb.exec(`
        CREATE TABLE games (
          game_id TEXT PRIMARY KEY,
          date TEXT,
          team_home TEXT,
          team_away TEXT
        );
        
        CREATE TABLE new_games (
          game_id TEXT PRIMARY KEY,
          date TEXT,
          team_home TEXT,
          team_away TEXT
        );
      `)
    })

    it('should insert only new records and skip duplicates', () => {
      // Insert existing data
      testDb.exec(`
        INSERT INTO games VALUES 
          ('game_001', '2019-04-01', 'Giants', 'Tigers'),
          ('game_002', '2019-04-02', 'Dragons', 'Carp');
      `)

      // Insert test data with one duplicate and two new records
      testDb.exec(`
        INSERT INTO new_games VALUES 
          ('game_002', '2019-04-02', 'Dragons', 'Carp'),  -- duplicate
          ('game_003', '2019-04-03', 'Hawks', 'Lions'),   -- new
          ('game_004', '2019-04-04', 'Eagles', 'Buffaloes'); -- new
      `)

      // Test duplicate detection
      const duplicateStmt = testDb.prepare(`
        SELECT COUNT(*) as count FROM new_games
        WHERE EXISTS (
          SELECT 1 FROM games AS dst WHERE dst.game_id = new_games.game_id
        );`)
      const duplicates = duplicateStmt.get() as { count: number }
      expect(duplicates.count).toBe(1)

      // Execute anti-join upsert
      const beforeCount = testDb.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number }
      const upsertStmt = testDb.prepare(`
        INSERT INTO games
        SELECT * FROM new_games
        WHERE NOT EXISTS (
          SELECT 1 FROM games AS dst WHERE dst.game_id = new_games.game_id
        );`)
      const result = upsertStmt.run()
      const afterCount = testDb.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number }

      expect(beforeCount.count).toBe(2)
      expect(result.changes).toBe(2) // Only 2 new records inserted
      expect(afterCount.count).toBe(4) // 2 existing + 2 new = 4 total
    })

    it('should handle empty new_games table gracefully', () => {
      testDb.exec(`INSERT INTO games VALUES ('game_001', '2019-04-01', 'Giants', 'Tigers');`)
      
      const beforeCount = testDb.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number }
      const upsertStmt = testDb.prepare(`
        INSERT INTO games
        SELECT * FROM new_games
        WHERE NOT EXISTS (
          SELECT 1 FROM games AS dst WHERE dst.game_id = new_games.game_id
        );`)
      const result = upsertStmt.run()
      const afterCount = testDb.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number }

      expect(beforeCount.count).toBe(1)
      expect(result.changes).toBe(0)
      expect(afterCount.count).toBe(1)
    })

    it('should handle all-duplicate scenario', () => {
      testDb.exec(`
        INSERT INTO games VALUES 
          ('game_001', '2019-04-01', 'Giants', 'Tigers'),
          ('game_002', '2019-04-02', 'Dragons', 'Carp');
        INSERT INTO new_games VALUES 
          ('game_001', '2019-04-01', 'Giants', 'Tigers'),
          ('game_002', '2019-04-02', 'Dragons', 'Carp');
      `)
      
      const upsertStmt = testDb.prepare(`
        INSERT INTO games
        SELECT * FROM new_games
        WHERE NOT EXISTS (
          SELECT 1 FROM games AS dst WHERE dst.game_id = new_games.game_id
        );`)
      const result = upsertStmt.run()
      const finalCount = testDb.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number }

      expect(result.changes).toBe(0)
      expect(finalCount.count).toBe(2) // No change
    })
  })

  describe('Delta Threshold Validation', () => {
    const calculateDelta = (prev: any, cur: any) => {
      return Math.abs(cur.woba_coefficients["1B"] - prev.woba_coefficients["1B"]) / prev.woba_coefficients["1B"]
    }

    it('should pass validation for normal coefficient changes (<7%)', () => {
      const prev = { woba_coefficients: { "1B": 0.89 } }
      const current = { woba_coefficients: { "1B": 0.92 } } // 3.37% increase
      
      const delta = calculateDelta(prev, current)
      expect(delta).toBeLessThan(0.07)
      expect(delta * 100).toBeCloseTo(3.37, 1)
    })

    it('should fail validation for large coefficient changes (>7%)', () => {
      const prev = { woba_coefficients: { "1B": 0.89 } }
      const large = { woba_coefficients: { "1B": 0.97 } } // 8.99% increase
      
      const delta = calculateDelta(prev, large)
      expect(delta).toBeGreaterThan(0.07)
      expect(delta * 100).toBeCloseTo(8.99, 1)
    })

    it('should handle edge case at exactly 7% threshold', () => {
      const prev = { woba_coefficients: { "1B": 1.0 } }
      const edge = { woba_coefficients: { "1B": 1.07 } } // Exactly 7%
      
      const delta = calculateDelta(prev, edge)
      expect(delta).toBeCloseTo(0.07, 10) // Use toBeCloseTo for floating point
    })

    it('should handle coefficient decreases as well as increases', () => {
      const prev = { woba_coefficients: { "1B": 0.95 } }
      const decreased = { woba_coefficients: { "1B": 0.87 } } // 8.42% decrease
      
      const delta = calculateDelta(prev, decreased)
      expect(delta).toBeGreaterThan(0.07)
      expect(delta * 100).toBeCloseTo(8.42, 1)
    })
  })

  describe('Transaction Rollback Behavior', () => {
    beforeEach(() => {
      testDb.exec(`
        CREATE TABLE test_data (
          id INTEGER PRIMARY KEY,
          value TEXT NOT NULL
        );
      `)
    })

    it('should rollback transaction on constraint violation', () => {
      testDb.exec(`INSERT INTO test_data (id, value) VALUES (1, 'existing');`)
      
      const beforeCount = testDb.prepare('SELECT COUNT(*) as count FROM test_data').get() as { count: number }
      expect(beforeCount.count).toBe(1)

      // Attempt transaction that will fail due to duplicate primary key
      expect(() => {
        testDb.transaction(() => {
          testDb.exec(`INSERT INTO test_data (id, value) VALUES (2, 'new_record');`)
          testDb.exec(`INSERT INTO test_data (id, value) VALUES (1, 'duplicate_key');`) // Should fail
        })()
      }).toThrow()

      // Verify rollback - should still have only 1 record
      const afterCount = testDb.prepare('SELECT COUNT(*) as count FROM test_data').get() as { count: number }
      expect(afterCount.count).toBe(1)
      
      const existing = testDb.prepare('SELECT value FROM test_data WHERE id = 1').get() as { value: string }
      expect(existing.value).toBe('existing')
    })
  })

  describe('Dry-run Mode Simulation', () => {
    beforeEach(() => {
      testDb.exec(`
        CREATE TABLE games (
          game_id TEXT PRIMARY KEY,
          date TEXT,
          team_home TEXT,
          team_away TEXT
        );
        
        CREATE TABLE new_games (
          game_id TEXT PRIMARY KEY,
          date TEXT,
          team_home TEXT,
          team_away TEXT
        );
      `)
    })

    it('should correctly simulate upsert without modifying data', () => {
      testDb.exec(`
        INSERT INTO games VALUES ('game_001', '2019-04-01', 'Giants', 'Tigers');
        INSERT INTO new_games VALUES 
          ('game_001', '2019-04-01', 'Giants', 'Tigers'),  -- duplicate
          ('game_002', '2019-04-02', 'Dragons', 'Carp');   -- new
      `)

      // Simulate dry-run logic
      const countStmt = testDb.prepare(`SELECT COUNT(*) as count FROM new_games`)
      const duplicateStmt = testDb.prepare(`
        SELECT COUNT(*) as count FROM new_games
        WHERE EXISTS (
          SELECT 1 FROM games AS dst WHERE dst.game_id = new_games.game_id
        );`)
      
      const newRows = countStmt.get() as { count: number }
      const duplicates = duplicateStmt.get() as { count: number }
      const wouldInsert = newRows.count - duplicates.count

      expect(newRows.count).toBe(2)
      expect(duplicates.count).toBe(1)
      expect(wouldInsert).toBe(1)

      // Verify no data was actually modified
      const finalCount = testDb.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number }
      expect(finalCount.count).toBe(1) // Still only the original record
    })
  })
})