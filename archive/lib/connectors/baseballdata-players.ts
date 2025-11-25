/**
 * baseballdata.jp Player Dashboard Connector
 * Parses ...db.html and ...detail.html for pitch mix, zone data, and sequences
 */

import { PoliteHTTPClient, normalizeText } from './polite-http-client';
import { 
  normalizeToPlateCoordinates, 
  extractBaseballDataBoundingBox,
  PlateCoordinates,
  PixelCoordinates,
  BoundingBox
} from '../coordinate-normalization';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface PitchMixData {
  pitchType: string;
  percentage: number;
  count: number;
}

export interface ZoneMatrixData {
  zone: string;
  plateX: number;
  plateZ: number;
  count: number;
  average?: number;
  ops?: number;
}

export interface ByInningData {
  inning: number;
  pitchCount: number;
  avgVelocity?: number;
  strikeRate?: number;
}

export interface VelocityData {
  pitchType: string;
  avgVelocity: number;
  maxVelocity: number;
  minVelocity: number;
}

export interface PitchSequenceData {
  sequenceNo: number;
  pitchType: string;
  velocity?: number;
  plateX?: number;
  plateZ?: number;
  zone?: string;
  result: string;
}

export interface PlayerDashboardData {
  playerId: string;
  playerName: string;
  gameId: string;
  type: 'db' | 'detail';
  
  // Dashboard data (from ...db.html)
  pitchMix?: PitchMixData[];
  zoneMatrixL?: ZoneMatrixData[];  // vs Left-handed batters
  zoneMatrixR?: ZoneMatrixData[];  // vs Right-handed batters
  byInning?: ByInningData[];
  avgVelocity?: VelocityData[];
  
  // Detail data (from ...detail.html)
  pitchSequences?: PitchSequenceData[];
  totalPitches?: number;
  
  // Quality assessment
  confidence: 'high' | 'medium' | 'low';
  source: 'baseballdata';
  scrapedAt: string;
  boundingBox?: BoundingBox;
}

export class BaseballDataPlayersConnector {
  private httpClient: PoliteHTTPClient;
  private cacheDir: string;
  
  constructor(contactEmail: string = 'contact@example.com') {
    this.httpClient = new PoliteHTTPClient(contactEmail);
    
    // Conservative mode for baseballdata.jp
    this.httpClient.enableConservativeMode(); // 30s intervals
    
    this.cacheDir = path.join('data', 'cache', 'baseballdata_players');
    fs.mkdir(this.cacheDir, { recursive: true }).catch(() => {});
  }
  
  /**
   * Parse dashboard HTML (...db.html)
   */
  async parseDbHtml(url: string): Promise<PlayerDashboardData | null> {
    try {
      const response = await this.httpClient.politeGet(url);
      const $ = cheerio.load(response.data);
      
      // Extract player and game info from URL
      const urlMatch = url.match(/\/players\/([^\/]+)\/([^\/]+)\/.*db\.html/);
      if (!urlMatch) {
        console.warn('Could not parse player/game from URL:', url);
        return null;
      }
      
      const playerId = urlMatch[1];
      const gameId = urlMatch[2];
      const playerName = this.extractPlayerName($);
      
      // Extract JavaScript data arrays
      const scriptContent = $('script').map((_, el) => $(el).html() || '').get().join('\n');
      
      const data: PlayerDashboardData = {
        playerId,
        playerName,
        gameId,
        type: 'db',
        confidence: 'medium',
        source: 'baseballdata',
        scrapedAt: new Date().toISOString()
      };
      
      // Parse pitch mix data
      data.pitchMix = this.parsePitchMix(scriptContent);
      
      // Parse zone matrices  
      data.zoneMatrixL = this.parseZoneMatrix(scriptContent, 'L');
      data.zoneMatrixR = this.parseZoneMatrix(scriptContent, 'R');
      
      // Parse by-inning data
      data.byInning = this.parseByInning(scriptContent);
      
      // Parse velocity data
      data.avgVelocity = this.parseVelocityData(scriptContent);
      
      // Assess confidence based on data availability
      data.confidence = this.assessDbConfidence(data);
      
      return data;
      
    } catch (error) {
      console.error(`Failed to parse db.html from ${url}:`, error);
      return null;
    }
  }
  
  /**
   * Parse detail HTML (...detail.html)
   */
  async parseDetailHtml(url: string): Promise<PlayerDashboardData | null> {
    try {
      const response = await this.httpClient.politeGet(url);
      const $ = cheerio.load(response.data);
      
      // Extract player and game info
      const urlMatch = url.match(/\/players\/([^\/]+)\/([^\/]+)\/.*detail\.html/);
      if (!urlMatch) {
        console.warn('Could not parse player/game from detail URL:', url);
        return null;
      }
      
      const playerId = urlMatch[1];
      const gameId = urlMatch[2];
      const playerName = this.extractPlayerName($);
      
      const data: PlayerDashboardData = {
        playerId,
        playerName,
        gameId,
        type: 'detail',
        confidence: 'medium',
        source: 'baseballdata',
        scrapedAt: new Date().toISOString()
      };
      
      // Extract pitch chart coordinates and sequence
      const chartData = this.extractPitchChart($);
      data.pitchSequences = chartData.sequences;
      data.totalPitches = chartData.totalPitches;
      data.boundingBox = chartData.boundingBox;
      
      // Assess confidence
      data.confidence = this.assessDetailConfidence(data);
      
      return data;
      
    } catch (error) {
      console.error(`Failed to parse detail.html from ${url}:`, error);
      return null;
    }
  }
  
  /**
   * Extract player name from page
   */
  private extractPlayerName($: cheerio.CheerioAPI): string {
    const selectors = [
      '.player-name',
      '.name',
      'h1',
      '.title',
      '.player-info .name'
    ];
    
    for (const selector of selectors) {
      const name = $(selector).first().text().trim();
      if (name && name.length > 1) {
        return normalizeText(name);
      }
    }
    
    return 'unknown';
  }
  
  /**
   * Parse pitch mix from JavaScript
   */
  private parsePitchMix(scriptContent: string): PitchMixData[] | undefined {
    const pitchMix = this.pickSeries(scriptContent, /var\s+pitchMix20\d{2}\s*=\s*(\[[\s\S]*?\]);/);
    
    if (!pitchMix || !Array.isArray(pitchMix)) {
      return undefined;
    }
    
    return pitchMix.map((item: any) => ({
      pitchType: normalizeText(item.name || item.label || ''),
      percentage: parseFloat(item.y || item.value || 0),
      count: parseInt(item.count || item.total || 0)
    })).filter(item => item.pitchType && item.percentage > 0);
  }
  
  /**
   * Parse zone matrix data
   */
  private parseZoneMatrix(scriptContent: string, side: 'L' | 'R'): ZoneMatrixData[] | undefined {
    const pattern = new RegExp(`var\\s+zoneMatrix${side}20\\d{2}\\s*=\\s*(\\[[\\s\\S]*?\\]);`);
    const zoneMatrix = this.pickSeries(scriptContent, pattern);
    
    if (!zoneMatrix || !Array.isArray(zoneMatrix)) {
      return undefined;
    }
    
    return zoneMatrix.map((item: any, index: number) => {
      // Convert matrix index to plate coordinates (3x3 grid)
      const row = Math.floor(index / 3);
      const col = index % 3;
      
      const plateX = (col - 1) * 0.55; // -0.55, 0, 0.55
      const plateZ = 2.0 + (2 - row) * 0.5; // 2.5, 2.0, 1.5
      
      const zone = this.indexToZone(row, col);
      
      return {
        zone,
        plateX,
        plateZ,
        count: parseInt(item.count || item.value || 0),
        average: parseFloat(item.avg || item.average),
        ops: parseFloat(item.ops || item.obp)
      };
    }).filter(item => item.count > 0);
  }
  
  /**
   * Parse by-inning data
   */
  private parseByInning(scriptContent: string): ByInningData[] | undefined {
    const byInning = this.pickSeries(scriptContent, /var\s+byInningSeries20\d{2}\s*=\s*(\[[\s\S]*?\]);/);
    
    if (!byInning || !Array.isArray(byInning)) {
      return undefined;
    }
    
    return byInning.map((item: any, index: number) => ({
      inning: index + 1,
      pitchCount: parseInt(item.pitches || item.count || 0),
      avgVelocity: parseFloat(item.velocity || item.speed),
      strikeRate: parseFloat(item.strikes || item.strikeRate)
    })).filter(item => item.pitchCount > 0);
  }
  
  /**
   * Parse velocity data
   */
  private parseVelocityData(scriptContent: string): VelocityData[] | undefined {
    const vAvg = this.pickSeries(scriptContent, /var\s+avgVeloSeries20\d{2}\s*=\s*(\[[\s\S]*?\]);/);
    
    if (!vAvg || !Array.isArray(vAvg)) {
      return undefined;
    }
    
    return vAvg.map((item: any) => ({
      pitchType: normalizeText(item.name || item.type || ''),
      avgVelocity: parseFloat(item.avg || item.average || 0),
      maxVelocity: parseFloat(item.max || item.maximum || 0),
      minVelocity: parseFloat(item.min || item.minimum || 0)
    })).filter(item => item.pitchType && item.avgVelocity > 0);
  }
  
  /**
   * Extract pitch chart coordinates and sequences
   */
  private extractPitchChart($: cheerio.CheerioAPI): {
    sequences: PitchSequenceData[];
    totalPitches: number;
    boundingBox?: BoundingBox;
  } {
    const sequences: PitchSequenceData[] = [];
    let boundingBox: BoundingBox | undefined;
    
    // Find chart container
    const chartContainer = $('.pitch-chart, .chart-container, .pitch-sequence').first();
    
    if (chartContainer.length > 0) {
      const scriptContent = $('script').map((_, el) => $(el).html() || '').get().join('\n');
      boundingBox = extractBaseballDataBoundingBox(chartContainer, scriptContent);
    }
    
    // Extract pitch points
    $('.pitch-point, .pitch-marker, .ball-circle').each((index, element) => {
      const $el = $(element);
      const style = $el.attr('style') || '';
      
      // Extract position
      const topMatch = style.match(/top:\s*(\d+(?:\.\d+)?)px/);
      const leftMatch = style.match(/left:\s*(\d+(?:\.\d+)?)px/);
      
      if (topMatch && leftMatch && boundingBox) {
        const pixel: PixelCoordinates = {
          x: parseFloat(leftMatch[1]),
          y: parseFloat(topMatch[1])
        };
        
        const plateCoords = normalizeToPlateCoordinates(pixel, boundingBox);
        
        // Extract pitch metadata
        const pitchType = normalizeText($el.attr('data-type') || $el.find('.type').text() || '');
        const velocity = parseFloat($el.attr('data-velocity') || $el.find('.velocity').text() || '0') || undefined;
        const result = normalizeText($el.attr('data-result') || $el.find('.result').text() || '');
        
        sequences.push({
          sequenceNo: index + 1,
          pitchType,
          velocity,
          plateX: plateCoords.plateX,
          plateZ: plateCoords.plateZ,
          zone: plateCoords.zone,
          result
        });
      }
    });
    
    return {
      sequences: sequences.filter(s => s.pitchType || s.result),
      totalPitches: sequences.length,
      boundingBox
    };
  }
  
  /**
   * Extract JavaScript series data
   */
  private pickSeries(src: string, regex: RegExp): any[] | null {
    const match = src.match(regex);
    if (!match) return null;
    
    try {
      // Clean up JavaScript object/array to valid JSON
      const jsonish = match[1]
        .replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":')      // key: → "key":
        .replace(/'([^']*)'/g, '"$1"')                  // 'value' → "value"
        .replace(/,\s*}/g, '}')                         // Remove trailing commas
        .replace(/,\s*]/g, ']');
      
      return JSON.parse(jsonish);
    } catch (error) {
      console.warn('Failed to parse JavaScript series:', error);
      return null;
    }
  }
  
  /**
   * Convert matrix index to zone name
   */
  private indexToZone(row: number, col: number): string {
    const horizontal = ['外角', '真ん中', '内角'][col] || '真ん中';
    const vertical = ['高め', '中', '低め'][row] || '中';
    return `${horizontal}${vertical}`;
  }
  
  /**
   * Assess dashboard data confidence
   */
  private assessDbConfidence(data: PlayerDashboardData): 'high' | 'medium' | 'low' {
    let score = 0;
    
    if (data.pitchMix && data.pitchMix.length > 0) score += 2;
    if (data.zoneMatrixL && data.zoneMatrixL.length > 0) score += 1;
    if (data.zoneMatrixR && data.zoneMatrixR.length > 0) score += 1;
    if (data.byInning && data.byInning.length > 0) score += 1;
    if (data.avgVelocity && data.avgVelocity.length > 0) score += 1;
    
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }
  
  /**
   * Assess detail data confidence
   */
  private assessDetailConfidence(data: PlayerDashboardData): 'high' | 'medium' | 'low' {
    const pitchCount = data.totalPitches || 0;
    const hasCoordinates = data.pitchSequences?.some(p => p.plateX !== undefined) || false;
    
    if (pitchCount >= 30 && hasCoordinates) return 'high';
    if (pitchCount >= 10) return 'medium';
    return 'low';
  }
  
  /**
   * Get both dashboard and detail data for a player/game
   */
  async getPlayerGameData(
    playerId: string, 
    gameId: string, 
    baseUrl: string = 'https://baseballdata.jp'
  ): Promise<{
    dashboard?: PlayerDashboardData;
    detail?: PlayerDashboardData;
  }> {
    const dbUrl = `${baseUrl}/players/${playerId}/${gameId}/db.html`;
    const detailUrl = `${baseUrl}/players/${playerId}/${gameId}/detail.html`;
    
    const [dashboard, detail] = await Promise.allSettled([
      this.parseDbHtml(dbUrl),
      this.parseDetailHtml(detailUrl)
    ]);
    
    return {
      dashboard: dashboard.status === 'fulfilled' ? dashboard.value || undefined : undefined,
      detail: detail.status === 'fulfilled' ? detail.value || undefined : undefined
    };
  }
}

// Helper function for easy access
export async function fetchPlayerDashboardData(
  playerId: string,
  gameId: string,
  contactEmail?: string
): Promise<PlayerDashboardData[]> {
  const connector = new BaseballDataPlayersConnector(contactEmail);
  const { dashboard, detail } = await connector.getPlayerGameData(playerId, gameId);
  
  const results: PlayerDashboardData[] = [];
  if (dashboard) results.push(dashboard);
  if (detail) results.push(detail);
  
  return results;
}