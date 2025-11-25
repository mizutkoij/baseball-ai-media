/**
 * Yahoo! 一軍 (NPB1) 一球速報コネクタ
 * リアルタイム差分取り込み + 条件付きGET
 */

import { PoliteHTTPClient, DifferentialIngester, normalizeText, rowHash } from './polite-http-client';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';

export interface NPB1GameData {
  gameId: string;
  date: string;
  level: 'NPB1';
  homeTeam: string;
  awayTeam: string;
  venue: string;
  status: 'scheduled' | 'live' | 'finished';
  score?: {
    home: number;
    away: number;
  };
  inning?: number;
  topBottom?: 'top' | 'bottom';
}

export interface PitchData {
  gameId: string;
  index: string;
  pitchNo: string;
  batterName: string;
  batterHand: 'L' | 'R';
  pitcherName: string;
  pitcherHand: 'L' | 'R';
  pitchType: string;
  velocity?: number;
  result: string;
  balls: number;
  strikes: number;
  outs: number;
  runnersOn: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  coordinates?: {
    x: number;
    y: number;
    zone?: string;
  };
  timestamp: string;
  confidence: 'high' | 'medium' | 'low';
  source: {
    name: 'yahoo';
    url: string;
  };
}

export class YahooNPB1Connector {
  private httpClient: PoliteHTTPClient;
  private cacheDir: string;
  private timelineDir: string;
  
  constructor(contactEmail: string = 'contact@example.com') {
    this.httpClient = new PoliteHTTPClient(contactEmail);
    this.cacheDir = path.join('data', 'cache', 'yahoo_npb1');
    this.timelineDir = path.join('data', 'timeline', 'yahoo_npb1');
    
    // ディレクトリ作成
    fs.mkdir(this.cacheDir, { recursive: true }).catch(() => {});
    fs.mkdir(this.timelineDir, { recursive: true }).catch(() => {});
  }
  
  /**
   * 一軍試合一覧の取得
   */
  async getGamesForDate(date: string): Promise<NPB1GameData[]> {
    const url = `https://baseball.yahoo.co.jp/npb/schedule?date=${date}`;
    
    try {
      const response = await this.httpClient.politeGet(url);
      
      if (response.status === 304) {
        // キャッシュから読み込み
        const cacheFile = path.join(this.cacheDir, `schedule_${date}.json`);
        try {
          const cached = await fs.readFile(cacheFile, 'utf-8');
          return JSON.parse(cached);
        } catch {
          return [];
        }
      }
      
      const $ = cheerio.load(response.data);
      const games: NPB1GameData[] = [];
      
      // スケジュール解析
      $('.bb-score').each((_, element) => {
        const $game = $(element);
        const gameLink = $game.find('a').attr('href');
        
        if (gameLink) {
          const gameIdMatch = gameLink.match(/\/game\/(\d+)\//);
          if (gameIdMatch) {
            const gameId = gameIdMatch[1];
            const homeTeam = normalizeText($game.find('.bb-score__home .bb-score__team').text());
            const awayTeam = normalizeText($game.find('.bb-score__visitor .bb-score__team').text());
            const venue = normalizeText($game.find('.bb-score__venue').text());
            
            let status: 'scheduled' | 'live' | 'finished' = 'scheduled';
            let score = undefined;
            
            const homeScore = $game.find('.bb-score__home .bb-score__score').text().trim();
            const awayScore = $game.find('.bb-score__visitor .bb-score__score').text().trim();
            
            if (homeScore && awayScore && homeScore !== '-' && awayScore !== '-') {
              status = 'finished';
              score = {
                home: parseInt(homeScore) || 0,
                away: parseInt(awayScore) || 0
              };
            } else if ($game.find('.bb-score__status:contains(\"試合中\")').length > 0) {
              status = 'live';
            }
            
            games.push({
              gameId,
              date,
              level: 'NPB1',
              homeTeam,
              awayTeam,
              venue,
              status,
              score
            });
          }
        }
      });
      
      // キャッシュ保存
      const cacheFile = path.join(this.cacheDir, `schedule_${date}.json`);
      await fs.writeFile(cacheFile, JSON.stringify(games, null, 2));
      
      return games;
      
    } catch (error) {
      console.error(`Failed to fetch NPB1 schedule for ${date}:`, error);
      return [];
    }
  }
  
  /**
   * リンクスキャン方式でindex一覧を取得
   */
  async getValidIndexes(gameId: string): Promise<string[]> {
    const url = `https://baseball.yahoo.co.jp/npb/game/${gameId}/score`;
    
    try {
      const response = await this.httpClient.politeGet(url);
      const $ = cheerio.load(response.data);
      const indexes = new Set<string>();
      
      // Method 1: selectタグのoptionから
      $('select option[value]').each((_, element) => {
        const value = $(element).attr('value');
        if (value && /^\d+$/.test(value)) {
          indexes.add(value);
        }
      });
      
      // Method 2: ?index= を含むリンクから
      $('a[href*=\"?index=\"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const match = href.match(/\?index=(\d+)/);
          if (match) {
            indexes.add(match[1]);
          }
        }
      });
      
      // Method 3: data-index 属性から
      $('[data-index]').each((_, element) => {
        const dataIndex = $(element).attr('data-index');
        if (dataIndex && /^\d+$/.test(dataIndex)) {
          indexes.add(dataIndex);
        }
      });
      
      const result = Array.from(indexes).sort((a, b) => parseInt(a) - parseInt(b));
      console.log(`📋 Found ${result.length} indexes via link scanning for game ${gameId}`);
      
      return result;
      
    } catch (error) {
      console.error(`Failed to scan indexes for game ${gameId}:`, error);
      return [];
    }
  }
  
  /**
   * 投球データの差分取り込み
   */
  async ingestPitchData(gameId: string, index: string, confidence: 'high' | 'medium' | 'low' = 'high'): Promise<{newRows: number, totalRows: number}> {
    const url = `https://baseball.yahoo.co.jp/npb/game/${gameId}/score?index=${index}`;
    
    try {
      const response = await this.httpClient.politeGet(url);
      
      if (response.status === 304) {
        // 304の場合は変更なし
        return { newRows: 0, totalRows: 0 };
      }
      
      const $ = cheerio.load(response.data);
      const pitches: PitchData[] = [];
      
      // 打者・投手情報抽出
      const batterCard = $('#batter table.ct');
      const batterName = normalizeText(batterCard.find('td.nm a').text()) || 'unknown';
      const batterHand = batterCard.find('td.dominantHand').text().trim() === '左' ? 'L' : 'R';
      
      const pitcherCard = $('#pit div#pitcherR table.ct');
      const pitcherName = normalizeText(pitcherCard.find('td.nm a').text()) || 'unknown';
      const pitcherHand = pitcherCard.find('td.dominantHand').text().trim() === '左' ? 'L' : 'R';
      
      // 走者状況
      const baseDiv = $('#field div#base');
      const baseClass = baseDiv.attr('class') || '';
      const runnersOn = {
        first: baseClass.includes('1'),
        second: baseClass.includes('2'), 
        third: baseClass.includes('3')
      };
      
      // 投球テーブル解析
      const pitchTable = $('table.bb-splitsTable').filter((_, table) => {
        const headers = $(table).find('thead th').map((_, th) => $(th).text().trim()).get();
        return headers.includes('投球数') && headers.includes('球種') && headers.includes('球速') && headers.includes('結果');
      }).first();
      
      if (pitchTable.length === 0) {
        console.warn(`No pitch table found for ${gameId}:${index}`);
        return { newRows: 0, totalRows: 0 };
      }
      
      // 座標情報の抽出
      const coordinates: Record<string, {x: number, y: number}> = {};
      $('.bb-allocationChart span.bb-icon__ballCircle').each((_, element) => {
        const $span = $(element);
        const pitchNo = $span.find('.bb-icon__number').text().trim();
        const style = $span.attr('style');
        
        if (style && pitchNo) {
          const topMatch = style.match(/top:(\\d+\\.?\\d*)px/);
          const leftMatch = style.match(/left:(\\d+\\.?\\d*)px/);
          
          if (topMatch && leftMatch) {
            coordinates[pitchNo] = {
              x: parseFloat(leftMatch[1]),
              y: parseFloat(topMatch[1])
            };
          }
        }
      });
      
      // 投球データ行の処理
      pitchTable.find('tbody tr').each((_, row) => {
        const $row = $(row);
        
        // 投球アイコンがある行のみ処理
        if ($row.find('.bb-icon__ballCircle').length === 0) return;
        
        const cells = $row.find('td').map((_, td) => $(td).text().trim()).get();
        
        if (cells.length >= 5) {
          const pitchNo = cells[0] || '';
          const pitchType = normalizeText(cells[2]) || '';
          const velocityText = cells[3];
          const result = normalizeText(cells[4]) || '';
          
          let velocity: number | undefined;
          if (velocityText && velocityText !== '-') {
            const velMatch = velocityText.match(/(\d+)/);
            if (velMatch) {
              velocity = parseInt(velMatch[1]);
            }
          }
          
          // カウント情報の抽出（結果から推定）
          let balls = 0, strikes = 0, outs = 0;
          // TODO: より詳細なカウント抽出ロジック
          
          const pitchData: PitchData = {
            gameId,
            index,
            pitchNo,
            batterName,
            batterHand,
            pitcherName, 
            pitcherHand,
            pitchType,
            velocity,
            result,
            balls,
            strikes,
            outs,
            runnersOn,
            coordinates: coordinates[pitchNo] ? {
              ...coordinates[pitchNo],
              zone: this.classifyZone(coordinates[pitchNo].y, coordinates[pitchNo].x)
            } : undefined,
            timestamp: new Date().toISOString(),
            confidence,
            source: {
              name: 'yahoo',
              url
            }
          };
          
          pitches.push(pitchData);
        }
      });
      
      // 差分取り込み
      const timelineFile = path.join(this.timelineDir, `${gameId}_timeline.jsonl`);
      const latestFile = path.join(this.timelineDir, `${gameId}_latest.json`);
      
      const ingester = new DifferentialIngester(timelineFile, latestFile);
      const result = ingester.ingestRows(pitches, gameId, index, confidence);
      
      if (result.newRows > 0) {
        console.log(`✅ Ingested ${result.newRows}/${result.totalRows} new pitch records for ${gameId}:${index}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`Failed to ingest pitch data for ${gameId}:${index}:`, error);
      return { newRows: 0, totalRows: 0 };
    }
  }
  
  /**
   * ゾーン分類
   */
  private classifyZone(y: number, x: number): string {
    let vertical: string;
    if (y < 60) vertical = '高め';
    else if (y < 120) vertical = '中';
    else vertical = '低め';
    
    let horizontal: string;
    if (x < 60) horizontal = '外角';
    else if (x < 120) horizontal = '真ん中';
    else horizontal = '内角';
    
    return `${horizontal}${vertical}`;
  }
  
  /**
   * ライブ監視の開始
   */
  async startLiveMonitoring(gameId: string, options: {
    intervalSeconds?: number;
    onUpdate?: (data: any) => void;
    onError?: (error: Error) => void;
  } = {}): Promise<void> {
    const { intervalSeconds = 15, onUpdate, onError } = options;
    
    console.log(`🔴 Starting live monitoring for game ${gameId} (${intervalSeconds}s interval)`);
    
    let lastChangeTime: Date | null = null;
    
    const monitor = async () => {
      try {
        const indexes = await this.getValidIndexes(gameId);
        
        for (const index of indexes) {
          const result = await this.ingestPitchData(gameId, index);
          
          if (result.newRows > 0) {
            lastChangeTime = new Date();
            onUpdate?.(result);
            
            // 変化があった場合は短い間隔に調整
            setTimeout(monitor, 8000); // 8秒後
            return;
          }
        }
        
        // 変化がない場合は間隔を動的調整
        const currentTime = new Date();
        const dynamicInterval = this.calculateDynamicInterval(lastChangeTime, currentTime);
        
        setTimeout(monitor, dynamicInterval * 1000);
        
      } catch (error) {
        console.error(`Live monitoring error for ${gameId}:`, error);
        onError?.(error as Error);
        
        // エラー時は長い間隔で再試行
        setTimeout(monitor, 30000);
      }
    };
    
    monitor();
  }
  
  /**
   * 動的間隔計算
   */
  private calculateDynamicInterval(lastChangeTime: Date | null, currentTime: Date): number {
    if (!lastChangeTime) return 15; // デフォルト
    
    const elapsed = (currentTime.getTime() - lastChangeTime.getTime()) / 1000;
    
    if (elapsed < 30) return 8;   // 変化直後
    if (elapsed < 90) return 15;  // 通常
    if (elapsed < 300) return 30; // 長時間変化なし
    return 45;                    // 非常に長時間
  }
}