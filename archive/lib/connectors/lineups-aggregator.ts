#!/usr/bin/env npx tsx
/**
 * ラインアップ集約器
 * 公式スタメン発表 + ニュース速報をマージ
 * 確度管理: unknown/partial/confirmed
 */

import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { logger } from "../logger";
import { retryWithBackoff } from "../retry-utils";

const log = logger.child({ component: "lineup-aggregator" });

export type LineupConfidence = "unknown" | "partial" | "confirmed";
export type LineupSource = "official" | "news" | "twitter" | "speculation";

export interface PlayerLineup {
  position: number; // 打順 (1-9)
  playerId: string;
  playerName: string;
  fieldPosition: string; // "1B", "CF", etc.
  battingHand: "L" | "R" | "S"; // Left/Right/Switch
  confidence: LineupConfidence;
  source: LineupSource;
  timestamp: string;
}

export interface TeamLineup {
  teamId: string;
  teamName: string;
  players: PlayerLineup[];
  startingPitcher?: {
    playerId: string;
    playerName: string;
    throwingHand: "L" | "R";
    confidence: LineupConfidence;
    source: LineupSource;
  };
  confirmedAt?: string;
  lastUpdate: string;
}

export interface GameLineups {
  gameId: string;
  date: string;
  homeTeam: TeamLineup;
  awayTeam: TeamLineup;
  overallConfidence: LineupConfidence;
  sources: LineupSource[];
  lastUpdate: string;
}

/**
 * NPB公式サイトからスタメン情報を取得
 */
async function fetchOfficialLineups(gameId: string, date: string): Promise<Partial<GameLineups> | null> {
  try {
    const url = `https://npb.jp/game/${date.replace(/-/g, "")}/${gameId}/`;
    
    log.info({ gameId, date, url }, "Fetching official lineups");
    
    const response = await retryWithBackoff(
      () => fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NPB-Data-Collector/1.0)'
        }
      }),
      { maxRetries: 2, baseDelay: 1000 }
    );
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const homeTeam: Partial<TeamLineup> = { players: [] };
    const awayTeam: Partial<TeamLineup> = { players: [] };
    
    // スタメン表解析（NPB公式の実際の構造に応じて調整が必要）
    $('.starting-lineup .home-team tr, .lineup-table .home tr').each((_, element) => {
      const $row = $(element);
      const position = parseInt($row.find('.position, .order').text().trim());
      const name = $row.find('.player-name, .name').text().trim();
      const fieldPos = $row.find('.field-position, .pos').text().trim();
      
      if (position && name) {
        homeTeam.players?.push({
          position,
          playerId: `p_${gameId}_h_${position}`,
          playerName: name,
          fieldPosition: fieldPos || "unknown",
          battingHand: "R", // デフォルト、後で更新
          confidence: "confirmed",
          source: "official",
          timestamp: new Date().toISOString()
        });
      }
    });
    
    $('.starting-lineup .away-team tr, .lineup-table .away tr').each((_, element) => {
      const $row = $(element);
      const position = parseInt($row.find('.position, .order').text().trim());
      const name = $row.find('.player-name, .name').text().trim();
      const fieldPos = $row.find('.field-position, .pos').text().trim();
      
      if (position && name) {
        awayTeam.players?.push({
          position,
          playerId: `p_${gameId}_a_${position}`,
          playerName: name,
          fieldPosition: fieldPos || "unknown",
          battingHand: "R", // デフォルト
          confidence: "confirmed",
          source: "official",
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // 先発投手情報
    const homePitcher = $('.starting-pitcher .home, .pitcher-info .home').text().trim();
    const awayPitcher = $('.starting-pitcher .away, .pitcher-info .away').text().trim();
    
    if (homePitcher) {
      homeTeam.startingPitcher = {
        playerId: `sp_${gameId}_h`,
        playerName: homePitcher,
        throwingHand: "R", // デフォルト
        confidence: "confirmed",
        source: "official"
      };
    }
    
    if (awayPitcher) {
      awayTeam.startingPitcher = {
        playerId: `sp_${gameId}_a`,
        playerName: awayPitcher,
        throwingHand: "R", // デフォルト
        confidence: "confirmed",
        source: "official"
      };
    }
    
    const hasValidData = (homeTeam.players?.length || 0) > 0 || (awayTeam.players?.length || 0) > 0;
    
    if (hasValidData) {
      return {
        gameId,
        date,
        homeTeam: { ...homeTeam, lastUpdate: new Date().toISOString() } as TeamLineup,
        awayTeam: { ...awayTeam, lastUpdate: new Date().toISOString() } as TeamLineup,
        sources: ["official"],
        lastUpdate: new Date().toISOString()
      };
    }
    
    return null;
    
  } catch (error) {
    log.error({ gameId, error: error.message }, "Official lineup fetch failed");
    return null;
  }
}

/**
 * スポーツニュースサイトからスタメン予想情報を取得
 */
async function fetchNewsLineups(gameId: string, date: string): Promise<Partial<GameLineups> | null> {
  try {
    // 複数のニュースソースを試行
    const sources = [
      `https://baseball.yahoo.co.jp/npb/game/${date.replace(/-/g, "")}/${gameId}`,
      `https://www.nikkansports.com/baseball/news/`,
      `https://www.sponichi.co.jp/baseball/`
    ];
    
    for (const url of sources) {
      try {
        log.debug({ gameId, url }, "Trying news source");
        
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NPB-News-Scraper/1.0)' },
          timeout: 5000
        });
        
        if (!response.ok) continue;
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // ニュース記事からスタメン情報を抽出
        const lineupTexts = $('article, .news-content, .article-body').toArray()
          .map(el => $(el).text())
          .filter(text => 
            text.includes('スタメン') || 
            text.includes('先発') || 
            text.includes('打線')
          );
        
        if (lineupTexts.length > 0) {
          // 簡易的なパース（実際にはより複雑な処理が必要）
          log.info({ gameId, source: url, texts: lineupTexts.length }, "Found news lineup information");
          
          return {
            gameId,
            date,
            homeTeam: { 
              players: [], 
              lastUpdate: new Date().toISOString() 
            } as TeamLineup,
            awayTeam: { 
              players: [], 
              lastUpdate: new Date().toISOString() 
            } as TeamLineup,
            sources: ["news"],
            lastUpdate: new Date().toISOString()
          };
        }
        
      } catch (sourceError) {
        log.debug({ url, error: sourceError.message }, "News source failed");
        continue;
      }
    }
    
    return null;
    
  } catch (error) {
    log.error({ gameId, error: error.message }, "News lineup fetch failed");
    return null;
  }
}

/**
 * 複数ソースからの情報をマージして信頼度を計算
 */
function mergeLineupSources(sources: Partial<GameLineups>[]): GameLineups | null {
  if (sources.length === 0) return null;
  
  // 最も信頼度の高いソースを基準とする
  const official = sources.find(s => s.sources?.includes("official"));
  const base = official || sources[0];
  
  if (!base?.gameId) return null;
  
  // 全体の信頼度を判定
  let overallConfidence: LineupConfidence = "unknown";
  
  if (official) {
    const homeComplete = (base.homeTeam?.players?.length || 0) >= 8;
    const awayComplete = (base.awayTeam?.players?.length || 0) >= 8;
    const hasPitchers = base.homeTeam?.startingPitcher && base.awayTeam?.startingPitcher;
    
    if (homeComplete && awayComplete && hasPitchers) {
      overallConfidence = "confirmed";
    } else if (homeComplete || awayComplete) {
      overallConfidence = "partial";
    }
  } else {
    overallConfidence = "partial"; // ニュースソースのみの場合
  }
  
  // 全ソースをマージ
  const allSources = Array.from(new Set(sources.flatMap(s => s.sources || [])));
  
  return {
    gameId: base.gameId,
    date: base.date || "",
    homeTeam: base.homeTeam as TeamLineup,
    awayTeam: base.awayTeam as TeamLineup,
    overallConfidence,
    sources: allSources,
    lastUpdate: new Date().toISOString()
  };
}

/**
 * 指定試合のラインアップ情報を集約
 */
export async function aggregateGameLineups(gameId: string, date: string): Promise<GameLineups | null> {
  const startTime = Date.now();
  
  try {
    log.info({ gameId, date }, "Starting lineup aggregation");
    
    // 並行して複数ソースから取得
    const [officialLineups, newsLineups] = await Promise.allSettled([
      fetchOfficialLineups(gameId, date),
      fetchNewsLineups(gameId, date)
    ]);
    
    const sources: Partial<GameLineups>[] = [];
    
    if (officialLineups.status === "fulfilled" && officialLineups.value) {
      sources.push(officialLineups.value);
    }
    
    if (newsLineups.status === "fulfilled" && newsLineups.value) {
      sources.push(newsLineups.value);
    }
    
    const merged = mergeLineupSources(sources);
    
    if (merged) {
      log.info({ 
        gameId, 
        confidence: merged.overallConfidence,
        sources: merged.sources,
        homeComplete: merged.homeTeam?.players?.length || 0,
        awayComplete: merged.awayTeam?.players?.length || 0,
        latency: Date.now() - startTime
      }, "Lineup aggregation completed");
    } else {
      log.warn({ gameId, latency: Date.now() - startTime }, "No lineup data found");
    }
    
    return merged;
    
  } catch (error) {
    log.error({ 
      gameId, 
      error: error.message, 
      latency: Date.now() - startTime 
    }, "Lineup aggregation failed");
    
    return null;
  }
}

/**
 * 既存のラインアップデータと新しいデータをマージ
 */
export function updateLineupConfidence(existing: GameLineups, fresh: GameLineups): GameLineups {
  // より新しい、より信頼度の高いデータを優先
  const sourceRank = { "official": 3, "news": 2, "twitter": 1, "speculation": 0 };
  
  const existingRank = Math.max(...existing.sources.map(s => sourceRank[s] || 0));
  const freshRank = Math.max(...fresh.sources.map(s => sourceRank[s] || 0));
  
  if (freshRank > existingRank || 
      (freshRank === existingRank && fresh.lastUpdate > existing.lastUpdate)) {
    return fresh;
  }
  
  return existing;
}

export default {
  aggregateGameLineups,
  updateLineupConfidence,
  mergeLineupSources
};