/**
 * DOM Parser Snapshot Tests - Phase 6: Testing/DX
 * 
 * 機能:
 * - NPBスクレーパーのDOM解析テスト
 * - HTMLスナップショットテスト
 * - パーサー回帰テスト
 * - セレクタ変更検出
 */

import { describe, it, expect } from "vitest";
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

// NPBStartersScraperの主要メソッドを模擬実装（テスト用）
class TestableNPBParser {
  parseGamesFromSchedule($: cheerio.CheerioAPI, date: string) {
    const games: any[] = [];
    
    $('.game-card, .schedule-game, .game-item').each((index, element) => {
      const $game = $(element);
      
      const gameId = `${date.replace(/-/g, '')}${(index + 1).toString().padStart(2, '0')}`;
      const teams = $game.find('.team-name, .team').map((_, el) => $(el).text().trim()).get();
      
      if (teams.length >= 2) {
        const [awayTeam, homeTeam] = teams;
        const venue = $game.find('.venue, .stadium').text().trim();
        const time = $game.find('.time, .start-time').text().trim();
        
        games.push({
          gameId,
          date,
          home: this.normalizeTeamName(homeTeam),
          away: this.normalizeTeamName(awayTeam),
          venue: venue || undefined,
          time: time || undefined,
        });
      }
    });
    
    return games;
  }

  extractPitcherInfo($: cheerio.CheerioAPI, side: 'home' | 'away') {
    // パターン1: .home-pitcher/.away-pitcher
    const pitcherSelector = `.${side}-pitcher`;
    let $pitcher = $(pitcherSelector);
    
    if ($pitcher.length === 0) {
      // パターン2: .home-team-starter/.away-team-starter
      $pitcher = $(`.${side}-team-starter`);
    }
    
    if ($pitcher.length === 0) {
      return null;
    }
    
    const name = $pitcher.find('.pitcher-name, .name').text().trim();
    const handText = $pitcher.find('.pitcher-hand, .throw').text().trim();
    
    // 投打情報の正規化
    let hand: "R" | "L" | undefined;
    if (handText.includes('右')) hand = 'R';
    else if (handText.includes('左')) hand = 'L';
    
    // 成績解析
    const statsText = $pitcher.find('.pitcher-stats, .record').text();
    const era = this.parseERA(statsText);
    const wins = this.parseWins(statsText);
    const losses = this.parseLosses(statsText);
    
    return {
      name,
      hand,
      era,
      wins,
      losses
    };
  }

  private normalizeTeamName(teamName: string): string {
    // 簡略化したチーム名正規化
    const mappings: Record<string, string> = {
      '読売ジャイアンツ': 'G',
      '巨人': 'G',
      '阪神タイガース': 'T',
      '阪神': 'T',
      '横浜DeNAベイスターズ': 'DB',
      '横浜DeNA': 'DB',
      '広島東洋カープ': 'C',
      '広島': 'C',
      '福岡ソフトバンクホークス': 'H',
      'ソフトバンク': 'H',
      'オリックス・バファローズ': 'Bs',
      'オリックス': 'Bs',
    };
    
    return mappings[teamName.trim()] || teamName;
  }

  private parseERA(text: string): number | undefined {
    const eraMatch = text.match(/防御率([\d.]+)|(\d+\.\d+)/);
    return eraMatch ? parseFloat(eraMatch[1] || eraMatch[2]) : undefined;
  }

  private parseWins(text: string): number | undefined {
    const winsMatch = text.match(/(\d+)勝/);
    return winsMatch ? parseInt(winsMatch[1], 10) : undefined;
  }

  private parseLosses(text: string): number | undefined {
    const lossesMatch = text.match(/(\d+)敗/);
    return lossesMatch ? parseInt(lossesMatch[1], 10) : undefined;
  }
}

describe("NPB DOM Parser", () => {
  const parser = new TestableNPBParser();

  describe("game schedule parsing", () => {
    it("parses game schedule HTML correctly", async () => {
      const fixtureContent = await fs.readFile(
        path.join(__dirname, 'fixtures/npb/starters/game_schedule_sample.html'),
        'utf-8'
      );
      
      const $ = cheerio.load(fixtureContent);
      const games = parser.parseGamesFromSchedule($, '2025-08-11');
      
      // スナップショット検証
      expect(games).toMatchSnapshot('game-schedule-parse');
      
      // 構造検証
      expect(games).toHaveLength(3);
      
      // 第1試合: 読売 vs 阪神
      expect(games[0]).toMatchObject({
        gameId: '2025081101',
        date: '2025-08-11',
        home: 'T', // 阪神
        away: 'G', // 読売
        venue: '東京ドーム',
        time: '18:00'
      });
      
      // 第2試合: 横浜 vs 広島
      expect(games[1]).toMatchObject({
        gameId: '2025081102',
        date: '2025-08-11',
        home: 'C', // 広島
        away: 'DB', // 横浜
        venue: '横浜スタジアム',
        time: '18:00'
      });
      
      // 第3試合: ソフトバンク vs オリックス
      expect(games[2]).toMatchObject({
        gameId: '2025081103',
        date: '2025-08-11',
        home: 'Bs', // オリックス
        away: 'H', // ソフトバンク
        venue: '福岡PayPayドーム',
        time: '18:00'
      });
    });

    it("handles empty schedule gracefully", () => {
      const emptyHtml = '<html><body><div class="no-games">本日の試合はありません</div></body></html>';
      const $ = cheerio.load(emptyHtml);
      const games = parser.parseGamesFromSchedule($, '2025-08-11');
      
      expect(games).toEqual([]);
    });

    it("handles malformed HTML structure", () => {
      const malformedHtml = `
        <html><body>
          <div class="game-card">
            <div class="team-name">読売ジャイアンツ</div>
            <!-- 相手チーム情報が欠損 -->
            <div class="venue">東京ドーム</div>
          </div>
        </body></html>
      `;
      
      const $ = cheerio.load(malformedHtml);
      const games = parser.parseGamesFromSchedule($, '2025-08-11');
      
      // チーム情報が不足している試合はスキップされる
      expect(games).toEqual([]);
    });
  });

  describe("pitcher information extraction", () => {
    let $: cheerio.CheerioAPI;

    beforeAll(async () => {
      const fixtureContent = await fs.readFile(
        path.join(__dirname, 'fixtures/npb/starters/pitcher_detail_sample.html'),
        'utf-8'
      );
      $ = cheerio.load(fixtureContent);
    });

    it("extracts home pitcher info correctly", () => {
      const homeInfo = parser.extractPitcherInfo($, 'home');
      
      // スナップショット検証
      expect(homeInfo).toMatchSnapshot('home-pitcher-info');
      
      // 詳細検証
      expect(homeInfo).toEqual({
        name: '菅野 智之',
        hand: 'R',
        era: 2.45,
        wins: 12,
        losses: 4
      });
    });

    it("extracts away pitcher info correctly", () => {
      const awayInfo = parser.extractPitcherInfo($, 'away');
      
      // スナップショット検証
      expect(awayInfo).toMatchSnapshot('away-pitcher-info');
      
      // 詳細検証
      expect(awayInfo).toEqual({
        name: '髙橋 遥人',
        hand: 'L',
        era: 3.12,
        wins: 8,
        losses: 6
      });
    });

    it("handles alternative selector patterns", () => {
      // 異なるセレクタパターンをテスト
      const altHtml = `
        <html><body>
          <div class="home-team-starter">
            <div class="name">山本 由伸</div>
            <div class="throw">右投</div>
            <div class="record">15勝3敗 防御率1.98</div>
          </div>
          <div class="away-team-starter">
            <div class="name">有原 航平</div>
            <div class="throw">右投</div>
            <div class="record">9勝7敗 防御率2.87</div>
          </div>
        </body></html>
      `;
      
      const $alt = cheerio.load(altHtml);
      
      const homeInfo = parser.extractPitcherInfo($alt, 'home');
      const awayInfo = parser.extractPitcherInfo($alt, 'away');
      
      expect(homeInfo).toEqual({
        name: '山本 由伸',
        hand: 'R',
        era: 1.98,
        wins: 15,
        losses: 3
      });
      
      expect(awayInfo).toEqual({
        name: '有原 航平',
        hand: 'R',
        era: 2.87,
        wins: 9,
        losses: 7
      });
    });

    it("returns null for missing pitcher info", () => {
      const emptyHtml = '<html><body><div class="no-pitcher-info"></div></body></html>';
      const $empty = cheerio.load(emptyHtml);
      
      const homeInfo = parser.extractPitcherInfo($empty, 'home');
      const awayInfo = parser.extractPitcherInfo($empty, 'away');
      
      expect(homeInfo).toBeNull();
      expect(awayInfo).toBeNull();
    });
  });

  describe("regression detection", () => {
    it("detects CSS selector changes", async () => {
      // 将来のNPBサイト変更を検出するためのテスト
      const currentSelectors = [
        '.game-card',
        '.team-name',
        '.venue',
        '.time',
        '.pitcher-name',
        '.pitcher-hand',
        '.pitcher-stats'
      ];
      
      const fixtureContent = await fs.readFile(
        path.join(__dirname, 'fixtures/npb/starters/game_schedule_sample.html'),
        'utf-8'
      );
      
      const $ = cheerio.load(fixtureContent);
      
      // 各セレクタが期待される要素数を返すかチェック
      const selectorResults = currentSelectors.map(selector => ({
        selector,
        count: $(selector).length
      }));
      
      // セレクタの構造が変わった場合、このスナップショットが失敗する
      expect(selectorResults).toMatchSnapshot('css-selectors-structure');
    });

    it("validates HTML structure consistency", async () => {
      const fixtures = [
        'game_schedule_sample.html',
        'pitcher_detail_sample.html'
      ];
      
      const structures: any[] = [];
      
      for (const fixture of fixtures) {
        const content = await fs.readFile(
          path.join(__dirname, `fixtures/npb/starters/${fixture}`),
          'utf-8'
        );
        
        const $ = cheerio.load(content);
        
        // HTML構造の要約を作成
        const structure = {
          fixture,
          bodyClasses: $('body').attr('class') || '',
          majorContainers: $('div[class*="container"], div[class*="content"]')
            .map((_, el) => $(el).attr('class'))
            .get(),
          gameElements: $('.game-card, .game-item, .schedule-game').length,
          pitcherElements: $('.pitcher, .starter, [class*="pitcher"]').length
        };
        
        structures.push(structure);
      }
      
      // HTML構造の一貫性をスナップショット検証
      expect(structures).toMatchSnapshot('html-structure-consistency');
    });
  });

  describe("edge cases and error handling", () => {
    it("handles Japanese text normalization in DOM", () => {
      const textWithVariants = `
        <html><body>
          <div class="pitcher-name">髙橋 太郎</div>
          <div class="team-name">横浜DeNA　ベイスターズ</div>
        </body></html>
      `;
      
      const $ = cheerio.load(textWithVariants);
      
      const pitcherName = $('.pitcher-name').text().trim();
      const teamName = $('.team-name').text().trim();
      
      // Unicode正規化が必要な文字が含まれていることを検証
      expect(pitcherName).toBe('髙橋 太郎'); // 髙は異体字
      expect(teamName).toBe('横浜DeNA　ベイスターズ'); // 全角スペース
    });

    it("handles incomplete pitcher statistics", () => {
      const incompleteHtml = `
        <html><body>
          <div class="home-pitcher">
            <div class="pitcher-name">新人投手</div>
            <div class="pitcher-hand">右</div>
            <!-- 成績データなし -->
          </div>
        </body></html>
      `;
      
      const $ = cheerio.load(incompleteHtml);
      const info = parser.extractPitcherInfo($, 'home');
      
      expect(info).toEqual({
        name: '新人投手',
        hand: 'R',
        era: undefined,
        wins: undefined,
        losses: undefined
      });
    });
  });
});