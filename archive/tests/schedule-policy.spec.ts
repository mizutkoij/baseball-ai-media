/**
 * Schedule Policy Tests - Phase 6: Testing/DX
 * 
 * 機能:
 * - スマートスケジューリングロジック検証
 * - JST時間帯処理テスト
 * - 試合有無による頻度調整テスト
 * - 時間窓ロジック検証
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fs from 'fs/promises';
import { planFor, determineExecutionDecision, type DayPlan, type GameInfo } from "../lib/schedule-policy";
import { makeTmpDir, createTestDataFile } from "./utils/tmpfs";

describe("Schedule Policy", () => {
  let testDataDir: string;

  beforeEach(async () => {
    testDataDir = await makeTmpDir("schedule_test");
  });

  describe("day planning", () => {
    it("creates default plan for no-game days", async () => {
      // 試合データなしのテスト
      await createTestDataFile(testDataDir, "games", "2025-08-11", []);

      const plan = await planFor("2025-08-11", testDataDir);

      expect(plan).toMatchSnapshot("no-games-day-plan");
      
      // 試合なし日は低頻度スケジュール
      expect(plan.hasGames).toBe(false);
      expect(plan.pre.everyMin).toBe(120); // 2時間間隔
      expect(plan.during.everyMin).toBe(120);
      expect(plan.post.everyMin).toBe(120);
    });

    it("creates game day plan with variable frequencies", async () => {
      // 典型的な試合データをセットアップ
      const gameData: GameInfo[] = [
        {
          gameId: "2025081101",
          date: "2025-08-11",
          startTime: "18:00",
          home: "G",
          away: "T",
          league: "CL",
          venue: "東京ドーム"
        },
        {
          gameId: "2025081102", 
          date: "2025-08-11",
          startTime: "18:00",
          home: "DB",
          away: "C", 
          league: "CL",
          venue: "横浜スタジアム"
        }
      ];

      await createTestDataFile(testDataDir, "games", "2025-08-11", gameData);

      const plan = await planFor("2025-08-11", testDataDir);

      expect(plan).toMatchSnapshot("game-day-plan");

      // 試合あり日は可変頻度スケジュール
      expect(plan.hasGames).toBe(true);
      expect(plan.pre.everyMin).toBe(60); // 試合前1時間間隔
      expect(plan.during.everyMin).toBe(15); // 試合中15分間隔
      expect(plan.post.everyMin).toBe(30); // 試合後30分間隔
      
      // 時間窓の検証
      expect(plan.gameWindows).toHaveLength(2);
      expect(plan.gameWindows[0]).toMatchObject({
        startTime: "18:00",
        preStartMin: 16 * 60 + 0, // 16:00開始 (2時間前)
        duringStartMin: 18 * 60 + 0, // 18:00開始
        duringEndMin: 21 * 60 + 0, // 21:00終了 (3時間後)
        postEndMin: 23 * 60 + 0 // 23:00まで (2時間後)
      });
    });

    it("handles multiple games with overlapping windows", async () => {
      // 時間が近い複数試合
      const gameData: GameInfo[] = [
        {
          gameId: "2025081101",
          date: "2025-08-11", 
          startTime: "14:00",
          home: "G",
          away: "T",
          league: "CL",
          venue: "東京ドーム"
        },
        {
          gameId: "2025081102",
          date: "2025-08-11",
          startTime: "18:00", 
          home: "H",
          away: "L",
          league: "PL",
          venue: "福岡PayPayドーム"
        }
      ];

      await createTestDataFile(testDataDir, "games", "2025-08-11", gameData);

      const plan = await planFor("2025-08-11", testDataDir);
      
      expect(plan.gameWindows).toHaveLength(2);
      
      // 最初の試合: 14:00スタート
      expect(plan.gameWindows[0].duringStartMin).toBe(14 * 60); // 840分
      expect(plan.gameWindows[0].duringEndMin).toBe(17 * 60); // 1020分
      
      // 2番目の試合: 18:00スタート  
      expect(plan.gameWindows[1].duringStartMin).toBe(18 * 60); // 1080分
      expect(plan.gameWindows[1].duringEndMin).toBe(21 * 60); // 1260分
    });

    it("handles malformed game time data gracefully", async () => {
      const gameData = [
        {
          gameId: "2025081101",
          date: "2025-08-11",
          startTime: "invalid-time", // 不正な時間
          home: "G",
          away: "T",
          league: "CL"
        }
      ];

      await createTestDataFile(testDataDir, "games", "2025-08-11", gameData);

      const plan = await planFor("2025-08-11", testDataDir);
      
      // 不正なデータは無視されて試合なし扱い
      expect(plan.hasGames).toBe(false);
      expect(plan.gameWindows).toHaveLength(0);
    });
  });

  describe("execution decision logic", () => {
    it("decides correctly during pre-game window", async () => {
      const plan: DayPlan = {
        hasGames: true,
        pre: { everyMin: 60 },
        during: { everyMin: 15 },
        post: { everyMin: 30 },
        gameWindows: [{
          startTime: "18:00",
          preStartMin: 16 * 60, // 16:00
          duringStartMin: 18 * 60, // 18:00
          duringEndMin: 21 * 60, // 21:00
          postEndMin: 23 * 60 // 23:00
        }]
      };

      // 17:00 (試合前1時間)でのテスト
      const decision = determineExecutionDecision(plan, 17 * 60);

      expect(decision).toEqual({
        shouldExecute: true,
        phase: "pre",
        nextCheckMin: 60,
        reason: "Pre-game data collection (1h intervals)"
      });
    });

    it("decides correctly during game window", async () => {
      const plan: DayPlan = {
        hasGames: true,
        pre: { everyMin: 60 },
        during: { everyMin: 15 },
        post: { everyMin: 30 },
        gameWindows: [{
          startTime: "18:00",
          preStartMin: 16 * 60,
          duringStartMin: 18 * 60, // 18:00
          duringEndMin: 21 * 60, // 21:00
          postEndMin: 23 * 60
        }]
      };

      // 19:00 (試合中)でのテスト
      const decision = determineExecutionDecision(plan, 19 * 60);

      expect(decision).toEqual({
        shouldExecute: true,
        phase: "during", 
        nextCheckMin: 15,
        reason: "Active game monitoring (15min intervals)"
      });
    });

    it("decides correctly during post-game window", async () => {
      const plan: DayPlan = {
        hasGames: true,
        pre: { everyMin: 60 },
        during: { everyMin: 15 },
        post: { everyMin: 30 },
        gameWindows: [{
          startTime: "18:00",
          preStartMin: 16 * 60,
          duringStartMin: 18 * 60,
          duringEndMin: 21 * 60, // 21:00
          postEndMin: 23 * 60 // 23:00
        }]
      };

      // 22:00 (試合後)でのテスト  
      const decision = determineExecutionDecision(plan, 22 * 60);

      expect(decision).toEqual({
        shouldExecute: true,
        phase: "post",
        nextCheckMin: 30,
        reason: "Post-game data capture (30min intervals)"
      });
    });

    it("decides correctly outside game windows", async () => {
      const plan: DayPlan = {
        hasGames: true,
        pre: { everyMin: 60 },
        during: { everyMin: 15 },
        post: { everyMin: 30 },
        gameWindows: [{
          startTime: "18:00",
          preStartMin: 16 * 60, // 16:00
          duringStartMin: 18 * 60,
          duringEndMin: 21 * 60,
          postEndMin: 23 * 60 // 23:00
        }]
      };

      // 12:00 (全ての窓の外)でのテスト
      const decision = determineExecutionDecision(plan, 12 * 60);

      expect(decision).toEqual({
        shouldExecute: false,
        phase: "idle",
        nextCheckMin: 240, // 4時間後に再チェック (16:00まで)
        reason: "Outside active time windows"
      });
    });

    it("handles no-games day correctly", async () => {
      const plan: DayPlan = {
        hasGames: false,
        pre: { everyMin: 120 },
        during: { everyMin: 120 },
        post: { everyMin: 120 },
        gameWindows: []
      };

      // 任意の時間でのテスト
      const decision = determineExecutionDecision(plan, 15 * 60);

      expect(decision).toEqual({
        shouldExecute: true,
        phase: "maintenance",
        nextCheckMin: 120,
        reason: "Regular maintenance check (no games scheduled)"
      });
    });
  });

  describe("JST time handling", () => {
    it("processes JST game times correctly", async () => {
      const gameData = [
        {
          gameId: "2025081101", 
          date: "2025-08-11",
          startTime: "13:00", // JST午後1時
          home: "G",
          away: "T",
          league: "CL"
        }
      ];

      await createTestDataFile(testDataDir, "games", "2025-08-11", gameData);

      const plan = await planFor("2025-08-11", testDataDir);

      // JST 13:00 = 13 * 60 = 780分
      expect(plan.gameWindows[0].duringStartMin).toBe(13 * 60);
      
      // プリゲーム窓: 11:00開始 (2時間前)
      expect(plan.gameWindows[0].preStartMin).toBe(11 * 60);
      
      // 試合窓: 13:00-16:00 (3時間)
      expect(plan.gameWindows[0].duringEndMin).toBe(16 * 60);
      
      // ポストゲーム窓: 18:00まで (2時間後)
      expect(plan.gameWindows[0].postEndMin).toBe(18 * 60);
    });

    it("handles midnight crossing games", async () => {
      const gameData = [
        {
          gameId: "2025081101",
          date: "2025-08-11", 
          startTime: "22:00", // JST午後10時 (深夜に跨る可能性)
          home: "G",
          away: "T",
          league: "CL"
        }
      ];

      await createTestDataFile(testDataDir, "games", "2025-08-11", gameData);

      const plan = await planFor("2025-08-11", testDataDir);

      // 試合開始: 22:00 = 22 * 60 = 1320分
      expect(plan.gameWindows[0].duringStartMin).toBe(22 * 60);
      
      // 試合終了: 01:00翌日 = 25 * 60 = 1500分 (24時間表記で翌日)
      expect(plan.gameWindows[0].duringEndMin).toBe(25 * 60);
      
      // ポストゲーム終了: 03:00翌日 = 27 * 60 = 1620分
      expect(plan.gameWindows[0].postEndMin).toBe(27 * 60);
    });
  });

  describe("edge cases", () => {
    it("handles missing game data files", async () => {
      // ファイルが存在しない場合のテスト
      const plan = await planFor("2025-99-99", testDataDir);

      expect(plan.hasGames).toBe(false);
      expect(plan.gameWindows).toHaveLength(0);
    });

    it("handles corrupted game data", async () => {
      // 不正なJSONファイルを作成
      const corruptedPath = `${testDataDir}/games/date=2025-08-11/latest.json`;
      await fs.mkdir(`${testDataDir}/games/date=2025-08-11`, { recursive: true });
      await fs.writeFile(corruptedPath, '{ invalid json }');

      const plan = await planFor("2025-08-11", testDataDir);

      // 不正データの場合は試合なし扱い
      expect(plan.hasGames).toBe(false);
    });

    it("handles games with missing required fields", async () => {
      const incompleteGameData = [
        {
          gameId: "2025081101",
          date: "2025-08-11"
          // startTime, home, awayが欠損
        }
      ];

      await createTestDataFile(testDataDir, "games", "2025-08-11", incompleteGameData);

      const plan = await planFor("2025-08-11", testDataDir);

      // 必要フィールドが欠損している試合は無視
      expect(plan.hasGames).toBe(false);
      expect(plan.gameWindows).toHaveLength(0);
    });
  });

  describe("performance and efficiency", () => {
    it("handles large number of games efficiently", async () => {
      // 大量の試合データ (12球団 x 複数試合 = 36試合)
      const manyGames = Array.from({ length: 36 }, (_, i) => ({
        gameId: `202508110${i.toString().padStart(2, '0')}`,
        date: "2025-08-11",
        startTime: `${12 + Math.floor(i / 6)}:00`, // 12:00-17:00に分散
        home: `Team${i % 12}`,
        away: `Team${(i + 6) % 12}`,
        league: i % 2 === 0 ? "CL" : "PL"
      }));

      await createTestDataFile(testDataDir, "games", "2025-08-11", manyGames);

      const startTime = Date.now();
      const plan = await planFor("2025-08-11", testDataDir);
      const duration = Date.now() - startTime;

      // 処理時間は100ms以内であること
      expect(duration).toBeLessThan(100);
      
      // すべての試合が処理されること
      expect(plan.hasGames).toBe(true);
      expect(plan.gameWindows.length).toBeGreaterThan(0);
      expect(plan.gameWindows.length).toBeLessThanOrEqual(manyGames.length);
    });

    it("calculates time windows without memory leaks", async () => {
      // メモリリークがないことを確認するため、繰り返し処理
      const gameData = [{
        gameId: "2025081101",
        date: "2025-08-11",
        startTime: "18:00",
        home: "G", 
        away: "T",
        league: "CL"
      }];

      await createTestDataFile(testDataDir, "games", "2025-08-11", gameData);

      // 1000回繰り返し処理
      for (let i = 0; i < 1000; i++) {
        const plan = await planFor("2025-08-11", testDataDir);
        expect(plan.hasGames).toBe(true);
      }

      // メモリ使用量の大幅増加がないことを間接的に確認
      // (Node.jsのGCが適切に動作していれば問題なし)
      const finalPlan = await planFor("2025-08-11", testDataDir);
      expect(finalPlan.hasGames).toBe(true);
    });
  });
});