/**
 * Yahoo! ファーム (NPB2) 一球速報コネクタ
 * イースタン・ウエスタン両リーグ対応
 */

import { PoliteHTTPClient, DifferentialIngester, normalizeText, rowHash } from './polite-http-client';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import path from 'path';

export interface NPB2GameData {
  gameId: string;
  date: string;
  level: 'NPB2';
  farmLeague: 'EAST' | 'WEST';
  homeTeam: string;
  awayTeam: string;
  venue: string;
  venueNormalized: string;
  status: 'scheduled' | 'live' | 'finished';
  score?: {
    home: number;
    away: number;
  };
  inning?: number;
  topBottom?: 'top' | 'bottom';
}

export interface FarmPitchData {
  gameId: string;
  index: string;
  level: 'NPB2';
  farmLeague: 'EAST' | 'WEST';
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

// ファームチーム正規化辞書
const FARM_TEAM_MAPPING: Record<string, { normalized: string; league: 'EAST' | 'WEST' }> = {
  // イースタン・リーグ
  '巨人': { normalized: '読売ジャイアンツ', league: 'EAST' },
  'ヤクルト': { normalized: '東京ヤクルトスワローズ', league: 'EAST' },
  'DeNA': { normalized: '横浜DeNAベイスターズ', league: 'EAST' },
  '西武': { normalized: '埼玉西武ライオンズ', league: 'EAST' },
  '日本ハム': { normalized: '北海道日本ハムファイターズ', league: 'EAST' },
  '楽天': { normalized: '東北楽天ゴールデンイーグルス', league: 'EAST' },
  
  // ウエスタン・リーグ
  '阪神': { normalized: '阪神タイガース', league: 'WEST' },
  '広島': { normalized: '広島東洋カープ', league: 'WEST' },
  '中日': { normalized: '中日ドラゴンズ', league: 'WEST' },
  'オリックス': { normalized: 'オリックス・バファローズ', league: 'WEST' },
  'ソフトバンク': { normalized: '福岡ソフトバンクホークス', league: 'WEST' },
  'ロッテ': { normalized: '千葉ロッテマリーンズ', league: 'WEST' }
};

// ファーム球場正規化
const FARM_VENUE_MAPPING: Record<string, string> = {
  'ジャイアンツ球場': '読売ジャイアンツ球場',
  '戸田球場': '戸田市営球場',
  '大宮球場': 'ライオンズパーク大宮',
  '鎌ケ谷': '鎌ケ谷スタジアム',
  '藤沢': '藤沢コース',
  '青森': '青森県営球場',
  'タマホーム': 'タマホームスタジアム筑後',
  '安芸': 'マツダスタジアム安芸',
  '北谷': '北谷公園野球場',
  '沖縄': '沖縄セルラー球場',
  'ナゴヤ': 'ナゴヤ球場',
  '鳴門': '鳴門球場'
};

export class YahooNPB2Connector {
  private httpClient: PoliteHTTPClient;
  private cacheDir: string;
  private timelineDir: string;
  
  constructor(contactEmail: string = 'contact@example.com') {
    this.httpClient = new PoliteHTTPClient(contactEmail);
    this.cacheDir = path.join('data', 'cache', 'yahoo_npb2');
    this.timelineDir = path.join('data', 'timeline', 'yahoo_npb2');
    
    // ディレクトリ作成
    fs.mkdir(this.cacheDir, { recursive: true }).catch(() => {});
    fs.mkdir(this.timelineDir, { recursive: true }).catch(() => {});
  }
  
  /**
   * ファーム試合一覧の取得
   */
  async getFarmGamesForDate(date: string, league?: 'EAST' | 'WEST'): Promise<NPB2GameData[]> {
    const games: NPB2GameData[] = [];
    
    // イースタン・リーグ
    if (!league || league === 'EAST') {
      const eastGames = await this.getGamesForLeague(date, 'EAST');
      games.push(...eastGames);
    }
    
    // ウエスタン・リーグ  
    if (!league || league === 'WEST') {
      const westGames = await this.getGamesForLeague(date, 'WEST');
      games.push(...westGames);
    }
    
    return games;
  }
  
  private async getGamesForLeague(date: string, league: 'EAST' | 'WEST'): Promise<NPB2GameData[]> {
    // Yahoo ファーム試合一覧URL
    const leagueCode = league === 'EAST' ? 'el' : 'wl';
    const url = `https://baseball.yahoo.co.jp/npb/schedule/farm?date=${date}&league=${leagueCode}`;
    
    try {
      const response = await this.httpClient.politeGet(url);
      
      if (response.status === 304) {
        // キャッシュから読み込み
        const cacheFile = path.join(this.cacheDir, `schedule_${league}_${date}.json`);
        try {
          const cached = await fs.readFile(cacheFile, 'utf-8');
          return JSON.parse(cached);
        } catch {
          return [];
        }
      }
      
      const $ = cheerio.load(response.data);
      const games: NPB2GameData[] = [];
      
      // ファーム試合スケジュール解析
      $('.bb-score, .schedule-table tr').each((_, element) => {
        const $element = $(element);
        
        // 試合リンクの検索
        const gameLink = $element.find('a[href*="/game/"]').attr('href') || 
                        $element.find('a').filter((_, a) => $(a).attr('href')?.includes('/game/')).attr('href');
        
        if (gameLink) {
          const gameIdMatch = gameLink.match(/\/game\/(\d+)\//);
          if (gameIdMatch) {
            const gameId = gameIdMatch[1];
            
            // チーム名の抽出
            let homeTeam = '';
            let awayTeam = '';
            let venue = '';
            
            // パターン1: bb-score形式
            if ($element.hasClass('bb-score')) {
              homeTeam = normalizeText($element.find('.bb-score__home .bb-score__team').text());
              awayTeam = normalizeText($element.find('.bb-score__visitor .bb-score__team').text());
              venue = normalizeText($element.find('.bb-score__venue').text());
            }
            // パターン2: テーブル形式
            else {
              const cells = $element.find('td');
              if (cells.length >= 3) {
                const matchText = cells.eq(1).text();
                const venueText = cells.eq(2).text();
                
                // "チームA vs チームB" 形式の解析
                const vsMatch = matchText.match(/(.+?)\s*(?:vs|対|－)\s*(.+)/);
                if (vsMatch) {
                  awayTeam = normalizeText(vsMatch[1]);
                  homeTeam = normalizeText(vsMatch[2]);
                  venue = normalizeText(venueText);
                }
              }
            }
            
            // チーム名とリーグの正規化
            const homeTeamInfo = this.normalizeTeamInfo(homeTeam);
            const awayTeamInfo = this.normalizeTeamInfo(awayTeam);
            
            // リーグの一致確認
            if (homeTeamInfo.league === league || awayTeamInfo.league === league) {
              let status: 'scheduled' | 'live' | 'finished' = 'scheduled';
              let score = undefined;
              
              // スコアの確認
              const homeScore = $element.find('.bb-score__home .bb-score__score').text().trim();
              const awayScore = $element.find('.bb-score__visitor .bb-score__score').text().trim();
              
              if (homeScore && awayScore && homeScore !== '-' && awayScore !== '-') {
                status = 'finished';
                score = {
                  home: parseInt(homeScore) || 0,
                  away: parseInt(awayScore) || 0
                };
              } else if ($element.find(':contains("試合中")').length > 0) {
                status = 'live';
              }
              
              games.push({
                gameId,
                date,
                level: 'NPB2',
                farmLeague: league,
                homeTeam: homeTeamInfo.normalized,
                awayTeam: awayTeamInfo.normalized,
                venue,
                venueNormalized: this.normalizeVenue(venue),
                status,
                score
              });
            }
          }
        }
      });
      
      // キャッシュ保存
      const cacheFile = path.join(this.cacheDir, `schedule_${league}_${date}.json`);
      await fs.writeFile(cacheFile, JSON.stringify(games, null, 2));
      
      console.log(`📋 Found ${games.length} ${league} farm games for ${date}`);
      return games;
      
    } catch (error) {
      console.error(`Failed to fetch NPB2 ${league} schedule for ${date}:`, error);
      return [];
    }
  }
  
  private normalizeTeamInfo(teamName: string): { normalized: string; league: 'EAST' | 'WEST' } {
    const normalized = normalizeText(teamName);
    
    // 直接マッピング
    for (const [key, value] of Object.entries(FARM_TEAM_MAPPING)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }
    
    // 部分マッチング
    for (const [key, value] of Object.entries(FARM_TEAM_MAPPING)) {
      if (normalized.includes(key.substring(0, 2)) || key.includes(normalized.substring(0, 2))) {
        return value;
      }
    }
    
    // デフォルト（推測）
    return { normalized: teamName, league: 'EAST' };
  }
  
  private normalizeVenue(venue: string): string {
    const normalized = normalizeText(venue);
    
    for (const [key, value] of Object.entries(FARM_VENUE_MAPPING)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }
    
    return venue;
  }
  
  /**
   * ファーム投球データの差分取り込み
   */
  async ingestFarmPitchData(
    gameId: string, 
    index: string, 
    farmLeague: 'EAST' | 'WEST',
    confidence: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<{newRows: number, totalRows: number}> {
    const url = `https://baseball.yahoo.co.jp/npb/game/${gameId}/score?index=${index}`;
    
    try {
      const response = await this.httpClient.politeGet(url);
      
      if (response.status === 304) {
        return { newRows: 0, totalRows: 0 };
      }
      
      const $ = cheerio.load(response.data);
      const pitches: FarmPitchData[] = [];
      
      // 基本的な抽出ロジックは1軍と同じだが、ファーム特有の情報を追加
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
      
      // 投球テーブル解析（ファームでは項目が異なる場合がある）
      const pitchTable = $('table.bb-splitsTable').filter((_, table) => {
        const headers = $(table).find('thead th').map((_, th) => $(th).text().trim()).get();
        return headers.some(h => h.includes('投球') || h.includes('球種') || h.includes('結果'));
      }).first();
      
      if (pitchTable.length === 0) {
        console.warn(`No pitch table found for farm game ${gameId}:${index}`);
        return { newRows: 0, totalRows: 0 };
      }
      
      // 座標情報の抽出
      const coordinates: Record<string, {x: number, y: number}> = {};
      $('.bb-allocationChart span.bb-icon__ballCircle').each((_, element) => {
        const $span = $(element);
        const pitchNo = $span.find('.bb-icon__number').text().trim();
        const style = $span.attr('style');
        
        if (style && pitchNo) {
          const topMatch = style.match(/top:(\d+\.?\d*)px/);
          const leftMatch = style.match(/left:(\d+\.?\d*)px/);
          
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
        
        if ($row.find('.bb-icon__ballCircle').length === 0) return;
        
        const cells = $row.find('td').map((_, td) => $(td).text().trim()).get();
        
        if (cells.length >= 4) { // ファームはデータが少ない場合がある
          const pitchNo = cells[0] || '';
          const pitchType = normalizeText(cells[1] || cells[2]) || '';
          const velocityText = cells[2] || cells[3] || '';
          const result = normalizeText(cells[cells.length - 1]) || '';
          
          let velocity: number | undefined;
          if (velocityText && velocityText !== '-') {
            const velMatch = velocityText.match(/(\d+)/);
            if (velMatch) {
              velocity = parseInt(velMatch[1]);
            }
          }
          
          const pitchData: FarmPitchData = {
            gameId,
            index,
            level: 'NPB2',
            farmLeague,
            pitchNo,
            batterName,
            batterHand,
            pitcherName,
            pitcherHand,
            pitchType,
            velocity,
            result,
            balls: 0, // ファームではカウント情報が限定的
            strikes: 0,
            outs: 0,
            runnersOn,
            coordinates: coordinates[pitchNo] ? {
              ...coordinates[pitchNo],
              zone: this.classifyZone(coordinates[pitchNo].y, coordinates[pitchNo].x)
            } : undefined,
            timestamp: new Date().toISOString(),
            confidence, // ファームは通常medium confidence
            source: {
              name: 'yahoo',
              url
            }
          };
          
          pitches.push(pitchData);
        }
      });
      
      // 差分取り込み
      const timelineFile = path.join(this.timelineDir, `${farmLeague}_${gameId}_timeline.jsonl`);
      const latestFile = path.join(this.timelineDir, `${farmLeague}_${gameId}_latest.json`);
      
      const ingester = new DifferentialIngester(timelineFile, latestFile);
      const result = await ingester.ingestRows(pitches, gameId, index, confidence);
      
      if (result.newRows > 0) {
        console.log(`✅ Ingested ${result.newRows}/${result.totalRows} new farm pitch records for ${farmLeague} ${gameId}:${index}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`Failed to ingest farm pitch data for ${farmLeague} ${gameId}:${index}:`, error);
      return { newRows: 0, totalRows: 0 };
    }
  }
  
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
   * ファーム特有の統計収集
   */
  async collectProspectStats(playerId: string, league: 'EAST' | 'WEST'): Promise<any> {
    // 将来的な育成選手統計機能
    // 昇格前後の成績比較、発達指標など
    return {
      playerId,
      league,
      prospect: true,
      // TODO: 実装
    };
  }
}