/**
 * NPB予告先発スクレイピングシステム
 * 
 * 機能:
 * - NPB公式サイトから予告先発情報を取得
 * - 選手名・投打・成績の自動抽出
 * - 信頼度スコアの自動計算
 */

import * as cheerio from 'cheerio';
import type { StarterRecord, TeamId, League } from '../types/npb';

interface NPBStarterInfo {
  name: string;
  hand?: "R" | "L";
  era?: number;
  wins?: number;
  losses?: number;
  note?: string;
}

interface NPBGameInfo {
  gameId: string;
  date: string;
  league: League;
  home: TeamId;
  away: TeamId;
  venue?: string;
  time?: string;
}

export class NPBStartersScraper {
  private baseUrl = 'https://npb.jp';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  async scrapeStartersForDate(date: string): Promise<StarterRecord[]> {
    try {
      console.log(`🔍 ${date}の予告先発を取得中...`);
      
      // NPB公式の試合日程ページにアクセス
      const dateStr = date.replace(/-/g, ''); // YYYYMMDD形式に変換
      const scheduleUrl = `${this.baseUrl}/games/${dateStr}/`;
      
      const response = await fetch(scheduleUrl, {
        headers: { 'User-Agent': this.userAgent }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${scheduleUrl}`);
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const games = this.parseGamesFromSchedule($, date);
      const starters: StarterRecord[] = [];
      
      // 各試合の詳細ページから先発投手情報を取得
      for (const game of games) {
        try {
          const starterInfo = await this.scrapeGameStarters(game);
          if (starterInfo) {
            starters.push(starterInfo);
          }
        } catch (error) {
          console.error(`Failed to scrape starters for game ${game.gameId}:`, error);
        }
        
        // レート制限対応
        await this.sleep(1000);
      }
      
      console.log(`✅ ${date}: ${starters.length}件の先発情報を取得`);
      return starters;
      
    } catch (error) {
      console.error(`Failed to scrape starters for ${date}:`, error);
      return [];
    }
  }

  private parseGamesFromSchedule($: cheerio.CheerioAPI, date: string): NPBGameInfo[] {
    const games: NPBGameInfo[] = [];
    
    // NPB公式サイトの試合一覧セクションを解析
    $('.game-card, .schedule-game, .game-item').each((index, element) => {
      try {
        const $game = $(element);
        
        // 試合ID生成（日付+連番）
        const gameId = `${date.replace(/-/g, '')}${(index + 1).toString().padStart(2, '0')}`;
        
        // チーム名抽出
        const teams = $game.find('.team-name, .team').map((_, el) => $(el).text().trim()).get();
        if (teams.length < 2) return;
        
        const [awayTeam, homeTeam] = teams;
        
        // リーグ判定（チーム名から推定）
        const league = this.determineLeague(homeTeam, awayTeam);
        
        // 会場・時間情報
        const venue = $game.find('.venue, .stadium').text().trim();
        const time = $game.find('.time, .start-time').text().trim();
        
        games.push({
          gameId,
          date,
          league,
          home: this.normalizeTeamName(homeTeam),
          away: this.normalizeTeamName(awayTeam),
          venue: venue || undefined,
          time: time || undefined,
        });
        
      } catch (error) {
        console.error(`Failed to parse game ${index}:`, error);
      }
    });
    
    return games;
  }

  private async scrapeGameStarters(game: NPBGameInfo): Promise<StarterRecord | null> {
    try {
      // 試合詳細ページまたは先発発表ページのURL構築
      const detailUrl = `${this.baseUrl}/games/${game.date.replace(/-/g, '')}/${game.gameId.slice(-2)}/preview/`;
      
      const response = await fetch(detailUrl, {
        headers: { 'User-Agent': this.userAgent }
      });
      
      if (!response.ok) {
        // プレビューページが無い場合、別のURLパターンを試す
        return await this.scrapeFromAlternativeSource(game);
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // 先発投手情報を抽出
      const homePitcher = this.extractPitcherInfo($, 'home');
      const awayPitcher = this.extractPitcherInfo($, 'away');
      
      // 信頼度計算
      const confidence = this.calculateConfidence(homePitcher, awayPitcher);
      
      if (!homePitcher?.name && !awayPitcher?.name) {
        return null;
      }
      
      return {
        gameId: game.gameId,
        date: game.date,
        league: game.league,
        home: game.home,
        away: game.away,
        homePitcher: homePitcher || undefined,
        awayPitcher: awayPitcher || undefined,
        confidence,
        source: "npb_official",
        updatedAt: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error(`Failed to scrape starters for game ${game.gameId}:`, error);
      return null;
    }
  }

  private extractPitcherInfo($: cheerio.CheerioAPI, team: 'home' | 'away'): NPBStarterInfo | null {
    try {
      // 複数のセレクターパターンを試行
      const selectors = [
        `.${team}-pitcher, .pitcher-${team}`,
        `.${team}-starter, .starter-${team}`,
        `.${team}-team .pitcher, .${team}-team .starter`,
      ];
      
      let $pitcher = cheerio.load('')('');
      
      for (const selector of selectors) {
        $pitcher = $(selector);
        if ($pitcher.length > 0) break;
      }
      
      if ($pitcher.length === 0) {
        return null;
      }
      
      // 投手名抽出
      const name = $pitcher.find('.name, .player-name').text().trim() || 
                  $pitcher.find('a').text().trim() || 
                  $pitcher.text().trim();
                  
      if (!name) return null;
      
      // 投打情報
      const handText = $pitcher.find('.hand, .throw').text().trim();
      const hand = handText.includes('右') ? 'R' : handText.includes('左') ? 'L' : undefined;
      
      // 成績情報
      const eraText = $pitcher.find('.era').text().trim();
      const era = eraText ? parseFloat(eraText) : undefined;
      
      const recordText = $pitcher.find('.record, .win-loss').text().trim();
      const recordMatch = recordText.match(/(\d+)勝(\d+)敗/);
      const wins = recordMatch ? parseInt(recordMatch[1]) : undefined;
      const losses = recordMatch ? parseInt(recordMatch[2]) : undefined;
      
      // 追加情報
      const note = $pitcher.find('.note, .comment').text().trim() || undefined;
      
      return {
        name: this.cleanPlayerName(name),
        hand,
        era: era && isFinite(era) ? era : undefined,
        wins,
        losses,
        note,
      };
      
    } catch (error) {
      console.error(`Failed to extract pitcher info for ${team}:`, error);
      return null;
    }
  }

  private async scrapeFromAlternativeSource(game: NPBGameInfo): Promise<StarterRecord | null> {
    // スポーツ新聞サイトやその他のソースから補完取得
    // 実装例: 日刊スポーツ、スポニチ等のAPIがあれば活用
    
    try {
      // 暫定的にnullを返す（実際には他のソースを実装）
      console.log(`Alternative source scraping for ${game.gameId} - not implemented`);
      return null;
      
    } catch (error) {
      console.error(`Alternative source failed for ${game.gameId}:`, error);
      return null;
    }
  }

  private calculateConfidence(home: NPBStarterInfo | null, away: NPBStarterInfo | null): number {
    let confidence = 0;
    
    // 基本情報の有無で加点
    if (home?.name) confidence += 0.4;
    if (away?.name) confidence += 0.4;
    
    // 成績情報の有無で加点
    if (home?.era || home?.wins) confidence += 0.1;
    if (away?.era || away?.wins) confidence += 0.1;
    
    // 投打情報があれば信頼度アップ
    if (home?.hand || away?.hand) confidence += 0.05;
    
    return Math.min(confidence, 1.0);
  }

  private determineLeague(homeTeam: string, awayTeam: string): League {
    const clTeams = ['巨人', '阪神', '中日', '広島', 'ヤクルト', 'DeNA', 'ＤｅＮＡ'];
    const plTeams = ['ソフトバンク', '日本ハム', '西武', 'オリックス', 'ロッテ', '楽天'];
    
    const isHomeCL = clTeams.some(team => homeTeam.includes(team));
    const isAwayCL = clTeams.some(team => awayTeam.includes(team));
    
    if (isHomeCL || isAwayCL) return "CL";
    return "PL";
  }

  private normalizeTeamName(teamName: string): TeamId {
    const teamMap: Record<string, TeamId> = {
      '読売': 'G', '巨人': 'G',
      '阪神': 'T',
      '中日': 'D', 'ドラゴンズ': 'D',
      '広島': 'C', 'カープ': 'C',
      'ヤクルト': 'S', 'スワローズ': 'S',
      'DeNA': 'DB', 'ＤｅＮＡ': 'DB', 'ベイスターズ': 'DB',
      'ソフトバンク': 'H', 'ホークス': 'H',
      '日本ハム': 'F', 'ファイターズ': 'F',
      '西武': 'L', 'ライオンズ': 'L',
      'オリックス': 'Bs', 'バファローズ': 'Bs',
      'ロッテ': 'M', 'マリーンズ': 'M',
      '楽天': 'E', 'イーグルス': 'E',
    };
    
    for (const [key, value] of Object.entries(teamMap)) {
      if (teamName.includes(key)) return value;
    }
    
    return teamName.substring(0, 2) as TeamId; // フォールバック
  }

  private cleanPlayerName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/[（(].*?[）)]/g, '') // 括弧内の情報を除去
      .trim();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export async function scrapeNPBStarters(date: string): Promise<StarterRecord[]> {
  const scraper = new NPBStartersScraper();
  return await scraper.scrapeStartersForDate(date);
}