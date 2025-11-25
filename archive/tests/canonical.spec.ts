/**
 * Canonical System Unit Tests
 * 
 * 機能:
 * - カノニカル化処理テスト
 * - ハッシュ安定性テスト
 * - キー生成テスト
 * - 差分計算テスト
 * - 衝突検出テスト
 */

import { describe, it, expect } from "vitest";
import { 
  canonicalizeRecord, 
  hashRecord, 
  hashSet, 
  keyOf,
  diffSets,
  detectKeyCollisions,
  deepSortKeys
} from "../lib/canonical";

describe("canonical", () => {
  describe("record canonicalization", () => {
    it("excludes volatile fields", () => {
      const recordWithVolatile = {
        date: "2025-08-11",
        team: "G",
        scrapedAt: "2025-08-11T10:00:00Z",
        retrievedAt: "2025-08-11T10:00:00Z",
        sourceTs: "2025-08-11T10:00:00Z",
        warnings: ["some warning"],
        updatedAt: "2025-08-11T10:00:00Z",
        _metadata: { temp: true }
      };

      const canonical = canonicalizeRecord("starters", recordWithVolatile);

      expect(canonical).toEqual({
        date: "2025-08-11",
        team: "G"
      });
      
      // Volatile fields should be excluded
      expect(canonical.scrapedAt).toBeUndefined();
      expect(canonical.retrievedAt).toBeUndefined();
      expect(canonical.sourceTs).toBeUndefined();
      expect(canonical.warnings).toBeUndefined();
      expect(canonical.updatedAt).toBeUndefined();
      expect(canonical._metadata).toBeUndefined();
    });

    it("sorts keys recursively", () => {
      const unsorted = {
        z_last: "last",
        a_first: "first",
        nested: {
          z_nested: "nested_last",
          a_nested: "nested_first"
        }
      };

      const canonical = canonicalizeRecord("starters", unsorted);
      const keys = Object.keys(canonical);
      const nestedKeys = Object.keys(canonical.nested);

      expect(keys).toEqual(["a_first", "nested", "z_last"]);
      expect(nestedKeys).toEqual(["a_nested", "z_nested"]);
    });

    it("handles arrays correctly", () => {
      const withArray = {
        items: [
          { b: 2, a: 1 },
          { d: 4, c: 3 }
        ]
      };

      const canonical = canonicalizeRecord("starters", withArray);
      
      expect(canonical.items[0]).toEqual({ a: 1, b: 2 });
      expect(canonical.items[1]).toEqual({ c: 3, d: 4 });
    });
  });

  describe("deep sort keys", () => {
    it("sorts nested object keys recursively", () => {
      const complex = {
        z: 1,
        a: {
          z: 2,
          a: [
            { z: 3, a: 4 },
            { b: 5, a: 6 }
          ]
        }
      };

      const sorted = deepSortKeys(complex);
      
      expect(Object.keys(sorted)).toEqual(["a", "z"]);
      expect(Object.keys(sorted.a)).toEqual(["a", "z"]);
      expect(Object.keys(sorted.a.a[0])).toEqual(["a", "z"]);
      expect(Object.keys(sorted.a.a[1])).toEqual(["a", "b"]);
    });
  });

  describe("hash stability", () => {
    it("produces identical hashes for equivalent records", () => {
      const record1 = { date: "2025-08-11", team: "G", scrapedAt: "time1" };
      const record2 = { team: "G", date: "2025-08-11", scrapedAt: "time2" };
      const record3 = { team: "G", date: "2025-08-11" };

      const hash1 = hashRecord("starters", record1);
      const hash2 = hashRecord("starters", record2);
      const hash3 = hashRecord("starters", record3);

      // All should have the same hash (volatile fields excluded, order ignored)
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 format
    });

    it("produces different hashes for different content", () => {
      const record1 = { date: "2025-08-11", team: "G" };
      const record2 = { date: "2025-08-11", team: "T" };

      const hash1 = hashRecord("starters", record1);
      const hash2 = hashRecord("starters", record2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("key generation", () => {
    it("generates correct keys for starters", () => {
      const record = { gameId: "20250811001", date: "2025-08-11", team: "G" };
      const key = keyOf("starters", record);
      expect(key).toBe("20250811001");
    });

    it("generates correct keys for games", () => {
      const record = { game_id: "20250811001", date: "2025-08-11" };
      const key = keyOf("games", record);
      expect(key).toBe("20250811001");
    });

    it("generates correct keys for keyplays", () => {
      const record = { 
        gameId: "20250811001", 
        inning: 9, 
        half: "bottom",
        index: 5 
      };
      const key = keyOf("keyplays", record);
      expect(key).toBe("20250811001#9bottom#5");
    });

    it("throws error for missing required fields", () => {
      expect(() => keyOf("starters", { date: "2025-08-11" }))
        .toThrow("Missing gameId for starters key");
      
      expect(() => keyOf("games", { date: "2025-08-11" }))
        .toThrow("Missing gameId/game_id for games key");
    });
  });

  describe("set hashing", () => {
    it("is order-insensitive", () => {
      const records1 = [
        { gameId: "20250811001", date: "2025-08-11", team: "G" },
        { gameId: "20250811002", date: "2025-08-11", team: "T" }
      ];
      const records2 = [...records1].reverse();

      const hash1 = hashSet("starters", records1);
      const hash2 = hashSet("starters", records2);

      expect(hash1).toBe(hash2);
    });

    it("is content-sensitive", () => {
      const records1 = [
        { gameId: "20250811001", date: "2025-08-11", team: "G" }
      ];
      const records2 = [
        { gameId: "20250811001", date: "2025-08-11", team: "T" }
      ];

      const hash1 = hashSet("starters", records1);
      const hash2 = hashSet("starters", records2);

      expect(hash1).not.toBe(hash2);
    });

    it("handles empty arrays", () => {
      const hash = hashSet("starters", []);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("throws error for invalid input", () => {
      expect(() => hashSet("starters", null as any))
        .toThrow("Records must be an array");
    });
  });

  describe("diff calculation", () => {
    const prevRecords = [
      { gameId: "20250811001", date: "2025-08-11", team: "G", score: 5 },
      { gameId: "20250811002", date: "2025-08-11", team: "T", score: 3 },
    ];

    it("detects additions", () => {
      const nextRecords = [
        ...prevRecords,
        { gameId: "20250811003", date: "2025-08-11", team: "DB", score: 7 }
      ];

      const diff = diffSets("starters", prevRecords, nextRecords);

      expect(diff.added).toEqual(["20250811003"]);
      expect(diff.removed).toEqual([]);
      expect(diff.updated).toEqual([]);
      expect(diff.unchanged).toEqual(["20250811001", "20250811002"]);
    });

    it("detects removals", () => {
      const nextRecords = [prevRecords[0]]; // Remove second record

      const diff = diffSets("starters", prevRecords, nextRecords);

      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual(["20250811002"]);
      expect(diff.updated).toEqual([]);
      expect(diff.unchanged).toEqual(["20250811001"]);
    });

    it("detects updates", () => {
      const nextRecords = [
        { gameId: "20250811001", date: "2025-08-11", team: "G", score: 8 }, // Updated score
        prevRecords[1] // Unchanged
      ];

      const diff = diffSets("starters", prevRecords, nextRecords);

      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual([]);
      expect(diff.updated).toEqual(["20250811001"]);
      expect(diff.unchanged).toEqual(["20250811002"]);
    });

    it("handles complex changes", () => {
      const nextRecords = [
        { gameId: "20250811001", date: "2025-08-11", team: "G", score: 8 }, // Updated
        { gameId: "20250811003", date: "2025-08-11", team: "DB", score: 7 }, // Added
        // 20250811002 removed
      ];

      const diff = diffSets("starters", prevRecords, nextRecords);

      expect(diff.added).toEqual(["20250811003"]);
      expect(diff.removed).toEqual(["20250811002"]);
      expect(diff.updated).toEqual(["20250811001"]);
      expect(diff.unchanged).toEqual([]);
    });
  });

  describe("key collision detection", () => {
    it("detects no collisions for unique keys", () => {
      const records = [
        { gameId: "20250811001", date: "2025-08-11", team: "G" },
        { gameId: "20250811002", date: "2025-08-11", team: "T" },
      ];

      const collisions = detectKeyCollisions("starters", records);
      expect(collisions).toHaveLength(0);
    });

    it("detects collisions for same key with different content", () => {
      const records = [
        { gameId: "20250811001", date: "2025-08-11", team: "G", score: 5 },
        { gameId: "20250811001", date: "2025-08-11", team: "G", score: 8 }, // Same key, different content
      ];

      const collisions = detectKeyCollisions("starters", records);
      
      expect(collisions).toHaveLength(1);
      expect(collisions[0].key).toBe("20250811001");
      expect(collisions[0].records).toHaveLength(2);
      expect(collisions[0].hashes).toHaveLength(2);
      expect(collisions[0].hashes[0]).not.toBe(collisions[0].hashes[1]);
    });

    it("ignores identical records with same key", () => {
      const records = [
        { gameId: "20250811001", date: "2025-08-11", team: "G", score: 5 },
        { gameId: "20250811001", date: "2025-08-11", team: "G", score: 5 }, // Same key, same content
      ];

      const collisions = detectKeyCollisions("starters", records);
      expect(collisions).toHaveLength(0); // No collision since content is identical
    });
  });

  describe("error handling", () => {
    it("handles malformed records gracefully", () => {
      expect(() => canonicalizeRecord("starters", null)).not.toThrow();
      expect(() => canonicalizeRecord("starters", undefined)).not.toThrow();
      expect(canonicalizeRecord("starters", null)).toBe(null);
    });

    it("throws meaningful errors for invalid operations", () => {
      expect(() => keyOf("invalid_kind" as any, {}))
        .toThrow("Unknown kind: invalid_kind");
      
      expect(() => keyOf("starters", null))
        .toThrow("Cannot generate key for null/undefined record");
    });
  });
});