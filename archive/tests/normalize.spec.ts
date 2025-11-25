/**
 * Normalization System Unit Tests
 * 
 * 機能:
 * - チーム名正規化テスト
 * - 選手名正規化テスト 
 * - 球場名正規化テスト
 * - 投打正規化テスト
 * - エラーハンドリングテスト
 */

import { describe, it, expect } from "vitest";
import { 
  normalizeTeamId, 
  normalizePlayerName, 
  normalizeStadium, 
  normalizeHand,
  normalizePosition,
  getAndClearWarnings
} from "../lib/normalize";

describe("normalize", () => {
  describe("team normalization", () => {
    it("normalizes team aliases correctly", () => {
      // セリーグ
      expect(normalizeTeamId("巨人")).toBe("G");
      expect(normalizeTeamId("読売ジャイアンツ")).toBe("G");
      expect(normalizeTeamId("阪神")).toBe("T");
      expect(normalizeTeamId("阪神タイガース")).toBe("T");
      expect(normalizeTeamId("横浜DeNA")).toBe("DB");
      expect(normalizeTeamId("横浜DeNAベイスターズ")).toBe("DB");
      expect(normalizeTeamId("ヤクルト")).toBe("S");
      expect(normalizeTeamId("東京ヤクルトスワローズ")).toBe("S");
      expect(normalizeTeamId("広島")).toBe("C");
      expect(normalizeTeamId("広島東洋カープ")).toBe("C");
      expect(normalizeTeamId("中日")).toBe("D");
      expect(normalizeTeamId("中日ドラゴンズ")).toBe("D");

      // パリーグ
      expect(normalizeTeamId("ソフトバンク")).toBe("H");
      expect(normalizeTeamId("福岡ソフトバンクホークス")).toBe("H");
      expect(normalizeTeamId("日本ハム")).toBe("F");
      expect(normalizeTeamId("北海道日本ハムファイターズ")).toBe("F");
      expect(normalizeTeamId("西武")).toBe("L");
      expect(normalizeTeamId("埼玉西武ライオンズ")).toBe("L");
      expect(normalizeTeamId("オリックス")).toBe("Bs");
      expect(normalizeTeamId("オリックスバファローズ")).toBe("Bs");
      expect(normalizeTeamId("ロッテ")).toBe("M");
      expect(normalizeTeamId("千葉ロッテマリーンズ")).toBe("M");
      expect(normalizeTeamId("楽天")).toBe("E");
      expect(normalizeTeamId("東北楽天ゴールデンイーグルス")).toBe("E");
    });

    it("handles already normalized team IDs", () => {
      expect(normalizeTeamId("G")).toBe("G");
      expect(normalizeTeamId("T")).toBe("T");
      expect(normalizeTeamId("DB")).toBe("DB");
      expect(normalizeTeamId("Bs")).toBe("Bs");
    });

    it("throws error for unknown teams", () => {
      expect(() => normalizeTeamId("未知のチーム")).toThrow("Unknown team alias");
      expect(() => normalizeTeamId("")).toThrow("Team name is required");
    });
  });

  describe("player name normalization", () => {
    it("normalizes kanji variants", () => {
      expect(normalizePlayerName("髙橋一郎")).toBe("高橋一郎");
      expect(normalizePlayerName("﨑野太郎")).toBe("崎野太郎");
      expect(normalizePlayerName("齊藤花子")).toBe("斉藤花子");
    });

    it("normalizes spaces", () => {
      expect(normalizePlayerName("菅野　智之")).toBe("菅野 智之"); // 全角→半角
      expect(normalizePlayerName("　田中　花子　")).toBe("田中 花子"); // トリミング＋正規化
      expect(normalizePlayerName("山田  太郎")).toBe("山田 太郎"); // 複数スペース→単一
    });

    it("removes middle dots and parentheses", () => {
      expect(normalizePlayerName("佐藤・Jr.")).toBe("佐藤Jr.");
      expect(normalizePlayerName("鈴木(元阪神)")).toBe("鈴木");
      expect(normalizePlayerName("田中（通算200勝）")).toBe("田中");
    });

    it("handles empty or undefined input", () => {
      expect(normalizePlayerName("")).toBe("");
      expect(normalizePlayerName(" ")).toBe("");
    });

    it("handles complex combinations", () => {
      expect(normalizePlayerName("髙﨑　太郎・Jr.(元巨人)")).toBe("高崎 太郎Jr.");
    });
  });

  describe("stadium normalization", () => {
    it("normalizes stadium aliases", () => {
      expect(normalizeStadium("東京D")).toBe("東京ドーム");
      expect(normalizeStadium("甲子園")).toBe("阪神甲子園球場");
      expect(normalizeStadium("神宮")).toBe("明治神宮野球場");
      expect(normalizeStadium("横浜")).toBe("横浜スタジアム");
      expect(normalizeStadium("PayPay")).toBe("福岡PayPayドーム");
      expect(normalizeStadium("エスコン")).toBe("ES CON FIELD HOKKAIDO");
      expect(normalizeStadium("ベルーナ")).toBe("ベルーナドーム");
      expect(normalizeStadium("マツダ")).toBe("MAZDA Zoom-Zoom スタジアム広島");
    });

    it("handles already normalized stadium names", () => {
      expect(normalizeStadium("東京ドーム")).toBe("東京ドーム");
      expect(normalizeStadium("阪神甲子園球場")).toBe("阪神甲子園球場");
    });

    it("returns unknown stadium names as-is", () => {
      expect(normalizeStadium("未知の球場")).toBe("未知の球場");
      expect(normalizeStadium("")).toBe("");
    });
  });

  describe("hand normalization", () => {
    it("normalizes hand indicators", () => {
      expect(normalizeHand("右")).toBe("R");
      expect(normalizeHand("左")).toBe("L");
      expect(normalizeHand("R")).toBe("R");
      expect(normalizeHand("L")).toBe("L");
      expect(normalizeHand("r")).toBe("R");
      expect(normalizeHand("l")).toBe("L");
    });

    it("returns undefined for unknown or empty input", () => {
      expect(normalizeHand("")).toBe(undefined);
      expect(normalizeHand("不明")).toBe(undefined);
      expect(normalizeHand(undefined)).toBe(undefined);
    });
  });

  describe("position normalization", () => {
    it("normalizes position abbreviations", () => {
      expect(normalizePosition("投")).toBe("投手");
      expect(normalizePosition("P")).toBe("投手");
      expect(normalizePosition("捕")).toBe("捕手");
      expect(normalizePosition("C")).toBe("捕手");
      expect(normalizePosition("一")).toBe("一塁手");
      expect(normalizePosition("1B")).toBe("一塁手");
      expect(normalizePosition("遊")).toBe("遊撃手");
      expect(normalizePosition("SS")).toBe("遊撃手");
      expect(normalizePosition("指")).toBe("指名打者");
      expect(normalizePosition("DH")).toBe("指名打者");
    });

    it("handles already normalized positions", () => {
      expect(normalizePosition("投手")).toBe("投手");
      expect(normalizePosition("右翼手")).toBe("右翼手");
    });

    it("returns unknown positions as-is", () => {
      expect(normalizePosition("未知ポジション")).toBe("未知ポジション");
    });
  });

  describe("warning collection", () => {
    it("collects and clears warnings", () => {
      // Clear any existing warnings
      getAndClearWarnings();

      // This should not generate warnings since it's a known team
      normalizeTeamId("巨人");
      
      let warnings = getAndClearWarnings();
      expect(warnings).toHaveLength(0);

      // Unknown stadium should not generate warnings (returns as-is)
      normalizeStadium("未知の球場");
      
      warnings = getAndClearWarnings();
      expect(warnings).toHaveLength(0);
    });
  });

  describe("NFKC normalization", () => {
    it("applies Unicode NFKC normalization", () => {
      // Full-width to half-width characters
      const fullWidth = "ＡＢＣ１２３";
      const result = normalizePlayerName(fullWidth);
      expect(result).toBe("ABC123");
    });
  });
});