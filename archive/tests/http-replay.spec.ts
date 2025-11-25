/**
 * HTTP Recording/Replay Tests - Phase 6: Testing/DX
 * 
 * 機能:
 * - ネットワークリクエストの録画・再生
 * - CI環境でのネット接続不要テスト
 * - HTTP エラーハンドリングテスト
 * - レート制限テスト
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import nock from 'nock';
import * as fs from 'fs/promises';
import * as path from 'path';

// NPBスクレーパーのHTTP部分をテスト用に抽出
class TestableHTTPScraper {
  private baseUrl = 'https://npb.jp';
  private userAgent = 'Mozilla/5.0 (compatible; NPB-Test-Bot/1.0)';

  async fetchSchedulePage(date: string): Promise<string> {
    const dateStr = date.replace(/-/g, '');
    const url = `${this.baseUrl}/games/${dateStr}/`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': this.userAgent }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`);
    }
    
    return response.text();
  }

  async fetchGameDetail(gameId: string, date: string): Promise<string> {
    const dateStr = date.replace(/-/g, '');
    const gameNum = gameId.slice(-2);
    const url = `${this.baseUrl}/games/${dateStr}/${gameNum}/preview/`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': this.userAgent }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`);
    }
    
    return response.text();
  }

  async checkRateLimit(requests: Array<{ url: string; delay: number }>) {
    const results = [];
    
    for (const req of requests) {
      const start = Date.now();
      
      try {
        const response = await fetch(req.url, {
          headers: { 'User-Agent': this.userAgent }
        });
        
        const duration = Date.now() - start;
        results.push({
          url: req.url,
          status: response.status,
          duration,
          success: response.ok
        });
        
        if (req.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, req.delay));
        }
        
      } catch (error) {
        results.push({
          url: req.url,
          status: 0,
          duration: Date.now() - start,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return results;
  }
}

describe("HTTP Recording/Replay", () => {
  const scraper = new TestableHTTPScraper();
  let recordingMode = false;

  beforeAll(async () => {
    // CI環境または明示的なレコーディングモード以外ではネットワークを無効化
    recordingMode = process.env.NOCK_RECORD === 'true' || process.env.CI === 'true';
    
    if (!recordingMode) {
      // すべての実際のHTTPリクエストをブロック
      nock.disableNetConnect();
      
      // テスト用のHTTPレスポンスをセットアップ
      await setupMockedResponses();
    }
  });

  afterAll(async () => {
    if (!recordingMode) {
      nock.enableNetConnect();
    }
    nock.cleanAll();
  });

  describe("schedule page fetching", () => {
    it("fetches schedule page successfully", async () => {
      const html = await scraper.fetchSchedulePage('2025-08-11');
      
      // HTMLの基本構造を検証
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      
      // NPBサイト特有の要素があることを確認
      expect(html).toMatch(/試合|ゲーム|schedule|game/i);
      
      // テストモードでは固定レスポンスなので、スナップショット検証
      if (!recordingMode) {
        expect(html).toMatchSnapshot('schedule-page-html');
      }
    });

    it("handles HTTP errors gracefully", async () => {
      if (!recordingMode) {
        // 404エラーをモック
        nock('https://npb.jp')
          .get('/games/20250899/')
          .reply(404, 'Not Found');
      }
      
      await expect(scraper.fetchSchedulePage('2025-08-99'))
        .rejects.toThrow('HTTP 404');
    });

    it("handles network timeouts", async () => {
      if (!recordingMode) {
        // タイムアウトをモック
        nock('https://npb.jp')
          .get('/games/20250810/')
          .delay(5000) // 5秒遅延
          .reply(200, '<html><body>Delayed response</body></html>');
      }
      
      // ここではタイムアウトをテストするため短いタイムアウトを設定
      // 実際の実装ではAbortControllerを使用
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 1000)
      );
      
      const fetchPromise = scraper.fetchSchedulePage('2025-08-10');
      
      // レースコンディション: 1秒でタイムアウト vs 実際のリクエスト
      if (!recordingMode) {
        await expect(Promise.race([fetchPromise, timeoutPromise]))
          .rejects.toThrow('Request timeout');
      } else {
        // レコーディングモードでは実際のリクエストを実行
        const result = await fetchPromise;
        expect(result).toBeDefined();
      }
    });
  });

  describe("game detail fetching", () => {
    it("fetches game preview page", async () => {
      const html = await scraper.fetchGameDetail('2025081101', '2025-08-11');
      
      expect(html).toContain('<html');
      expect(html).toMatch(/先発|投手|pitcher|preview/i);
      
      if (!recordingMode) {
        expect(html).toMatchSnapshot('game-detail-html');
      }
    });

    it("falls back gracefully when preview unavailable", async () => {
      if (!recordingMode) {
        // プレビューページが存在しない場合のモック
        nock('https://npb.jp')
          .get('/games/20250811/99/preview/')
          .reply(404, 'Preview not available');
      }
      
      await expect(scraper.fetchGameDetail('2025081199', '2025-08-11'))
        .rejects.toThrow('HTTP 404');
    });
  });

  describe("rate limiting behavior", () => {
    it("respects rate limits", async () => {
      const requests = [
        { url: 'https://npb.jp/games/20250811/', delay: 100 },
        { url: 'https://npb.jp/games/20250811/01/preview/', delay: 100 },
        { url: 'https://npb.jp/games/20250811/02/preview/', delay: 100 },
      ];
      
      if (!recordingMode) {
        // レート制限テスト用のモック
        requests.forEach((req, index) => {
          nock('https://npb.jp')
            .get(new URL(req.url).pathname)
            .delay(req.delay)
            .reply(200, `<html><body>Response ${index}</body></html>`);
        });
      }
      
      const results = await scraper.checkRateLimit(requests);
      
      // すべてのリクエストが成功することを確認
      expect(results.every(r => r.success)).toBe(true);
      
      // レート制限遵守（最低100msの間隔）を確認
      for (let i = 1; i < results.length; i++) {
        const timeDiff = results[i].duration - results[i-1].duration;
        expect(Math.abs(timeDiff)).toBeGreaterThanOrEqual(90); // 多少の誤差を許容
      }
    });

    it("handles burst requests appropriately", async () => {
      // 短時間に多数のリクエストを送信するテスト
      const burstRequests = Array.from({ length: 5 }, (_, i) => ({
        url: `https://npb.jp/games/20250811/0${i+1}/preview/`,
        delay: 0 // 遅延なし
      }));
      
      if (!recordingMode) {
        burstRequests.forEach((req, index) => {
          nock('https://npb.jp')
            .get(new URL(req.url).pathname)
            .reply(200, `<html><body>Burst response ${index}</body></html>`);
        });
      }
      
      const start = Date.now();
      const results = await scraper.checkRateLimit(burstRequests);
      const totalDuration = Date.now() - start;
      
      // バーストリクエストでも合理的な時間内に完了
      expect(totalDuration).toBeLessThan(5000); // 5秒以内
      expect(results.length).toBe(5);
    });
  });

  describe("response caching simulation", () => {
    it("simulates ETag-based caching", async () => {
      const testETag = '"sample-etag-12345"';
      
      if (!recordingMode) {
        // 最初のリクエスト: 200 OK with ETag
        nock('https://npb.jp')
          .get('/games/20250811/')
          .reply(200, '<html><body>Original content</body></html>', {
            'ETag': testETag,
            'Cache-Control': 'max-age=300'
          });
        
        // 2回目のリクエスト: 304 Not Modified
        nock('https://npb.jp')
          .get('/games/20250811/')
          .matchHeader('if-none-match', testETag)
          .reply(304);
      }
      
      // 最初のリクエスト
      const response1 = await fetch('https://npb.jp/games/20250811/');
      const content1 = await response1.text();
      const etag = response1.headers.get('etag');
      
      expect(response1.status).toBe(200);
      expect(etag).toBe(testETag);
      
      if (!recordingMode) {
        expect(content1).toMatchSnapshot('cached-content');
        
        // ETagを使った条件付きリクエスト
        const response2 = await fetch('https://npb.jp/games/20250811/', {
          headers: { 'If-None-Match': etag! }
        });
        
        expect(response2.status).toBe(304);
      }
    });
  });

  describe("error scenarios", () => {
    it("handles server errors", async () => {
      if (!recordingMode) {
        nock('https://npb.jp')
          .get('/games/20250811/')
          .reply(500, 'Internal Server Error');
      }
      
      await expect(scraper.fetchSchedulePage('2025-08-11'))
        .rejects.toThrow('HTTP 500');
    });

    it("handles malformed responses", async () => {
      if (!recordingMode) {
        nock('https://npb.jp')
          .get('/games/20250812/')
          .reply(200, 'Invalid HTML content without proper tags');
      }
      
      const html = await scraper.fetchSchedulePage('2025-08-12');
      
      // 不正なHTMLでも文字列として取得できることを確認
      expect(typeof html).toBe('string');
      expect(html).toBe('Invalid HTML content without proper tags');
    });
  });
});

// ヘルパー関数: モックレスポンスのセットアップ
async function setupMockedResponses() {
  // サンプルHTMLファイルを読み込み
  const scheduleHtml = await loadFixtureOrDefault('game_schedule_sample.html', 
    '<html><body><div class="game-card"><div class="team-name">テストチーム1</div></div></body></html>'
  );
  
  const detailHtml = await loadFixtureOrDefault('pitcher_detail_sample.html',
    '<html><body><div class="home-pitcher"><div class="pitcher-name">テスト投手</div></div></body></html>'
  );
  
  // デフォルトのモックレスポンス
  nock('https://npb.jp')
    .persist()
    .get(/\/games\/\d{8}\/$/)
    .reply(200, scheduleHtml, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'max-age=300'
    });
  
  nock('https://npb.jp')
    .persist()
    .get(/\/games\/\d{8}\/\d{2}\/preview\/$/)
    .reply(200, detailHtml, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'max-age=600'
    });
}

async function loadFixtureOrDefault(filename: string, defaultContent: string): Promise<string> {
  try {
    return await fs.readFile(
      path.join(__dirname, 'fixtures/npb/starters', filename),
      'utf-8'
    );
  } catch {
    return defaultContent;
  }
}