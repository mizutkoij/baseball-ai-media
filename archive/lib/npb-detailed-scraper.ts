/**
 * NPB詳細試合データスクレイピングシステム (box.html, roster.html対応)
 * 
 * 機能:
 * - 詳細な試合データ（イニング別スコア、安打数、エラー等）
 * - 選手打撃成績・投手成績
 * - ベンチ入りメンバー・ロースター情報
 * - イニング別打席結果（一ゴロ、三振等）
 */

import * as cheerio from 'cheerio';

export interface DetailedGameData {
  gameId: string;
  date: string;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  startTime: string;
  endTime: string;
  duration: string;
  attendance: string;
  status: 'finished' | 'scheduled' | 'live';
  inningScores: {
    away: number[];
    home: number[];
  };
  teamStats: {
    away: { hits: number; errors: number; };
    home: { hits: number; errors: number; };
  };
  playerStats: {
    away: PlayerBattingStats[];
    home: PlayerBattingStats[];
  };
  pitchers: {
    away: PitcherStats[];
    home: PitcherStats[];
  };
}

export interface PlayerBattingStats {
  battingOrder: number;
  position: string;
  name: string;
  atBats: number;
  runs: number;
  hits: number;
  rbis: number;
  stolenBases: number;
  inningResults: string[]; // 各回の結果 (e.g., "一ゴ失", "右飛", "三振")
}

export interface PitcherStats {
  name: string;
  result: 'W' | 'L' | 'S' | 'H' | '-';
  innings: string;
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
}

export interface RosterData {
  teamName: string;
  pitchers: RosterPlayer[];
  fielders: RosterPlayer[];
}

export interface RosterPlayer {
  number: string;
  name: string;
  battingHand: 'right' | 'left' | 'switch';
  throwingHand: 'right' | 'left';
}

/**
 * NPB試合詳細ページ(box.html)をスクレイピング
 */
export async function scrapeNPBGameDetails(url: string): Promise<DetailedGameData> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 基本情報の抽出
    const gameDate = $('time').text().trim();
    const venue = $('.place').text().trim();
    const gameTitle = $('h3').text().trim();
    
    // チーム名の抽出 (405行目のh3から)
    const teamMatch = gameTitle.match(/】\s*(.+?)\s+vs\s+(.+?)\s+/);
    const homeTeam = teamMatch ? teamMatch[2].trim() : '';
    const awayTeam = teamMatch ? teamMatch[1].trim() : '';
    
    // 試合情報の抽出
    const gameInfo = $('.game_info').text();
    const startTimeMatch = gameInfo.match(/開始\s*(\d{1,2}:\d{2})/);
    const endTimeMatch = gameInfo.match(/終了\s*(\d{1,2}:\d{2})/);
    const durationMatch = gameInfo.match(/試合時間\s*([^\s]+)/);
    const attendanceMatch = gameInfo.match(/入場者\s*([^\s]+)/);
    
    const startTime = startTimeMatch ? startTimeMatch[1] : '';
    const endTime = endTimeMatch ? endTimeMatch[1] : '';
    const duration = durationMatch ? durationMatch[1] : '';
    const attendance = attendanceMatch ? attendanceMatch[1] : '';
    
    // スコアボードの抽出
    const awayInnings: number[] = [];
    const homeInnings: number[] = [];
    let awayScore = 0;
    let homeScore = 0;
    let awayHits = 0;
    let homeHits = 0;
    let awayErrors = 0;
    let homeErrors = 0;
    
    // ラインスコア表から抽出
    $('#tablefix_ls tbody tr.top td').each((i, el) => {
      const text = $(el).text().trim();
      if (i < 9) { // 1-9回
        const score = parseInt(text) || 0;
        awayInnings.push(score);
      } else if ($(el).hasClass('total-1')) {
        awayScore = parseInt(text) || 0;
      } else if ($(el).hasClass('total-2')) {
        if (awayHits === 0) awayHits = parseInt(text) || 0;
        else awayErrors = parseInt(text) || 0;
      }
    });
    
    $('#tablefix_ls tbody tr.bottom td').each((i, el) => {
      const text = $(el).text().trim();
      if (i < 9) { // 1-9回
        const score = text === 'x' ? 0 : (parseInt(text) || 0);
        homeInnings.push(score);
      } else if ($(el).hasClass('total-1')) {
        homeScore = parseInt(text) || 0;
      } else if ($(el).hasClass('total-2')) {
        if (homeHits === 0) homeHits = parseInt(text) || 0;
        else homeErrors = parseInt(text) || 0;
      }
    });
    
    // 選手成績の抽出
    const awayPlayerStats = extractPlayerStats($, '#tablefix_t_b');
    const homePlayerStats = extractPlayerStats($, '#tablefix_b_b');
    
    // 投手成績の抽出
    const awayPitchers = extractPitcherStats($, '.pitcher_record').filter((_, i) => i % 2 === 0);
    const homePitchers = extractPitcherStats($, '.pitcher_record').filter((_, i) => i % 2 === 1);
    
    const gameId = extractGameIdFromUrl(url);
    const status: 'finished' | 'scheduled' | 'live' = gameInfo.includes('試合終了') ? 'finished' : 
                                                     gameInfo.includes('試合開始前') ? 'scheduled' : 'live';
    
    return {
      gameId,
      date: parseDateString(gameDate),
      venue,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      startTime,
      endTime,
      duration,
      attendance,
      status,
      inningScores: {
        away: awayInnings,
        home: homeInnings
      },
      teamStats: {
        away: { hits: awayHits, errors: awayErrors },
        home: { hits: homeHits, errors: homeErrors }
      },
      playerStats: {
        away: awayPlayerStats,
        home: homePlayerStats
      },
      pitchers: {
        away: awayPitchers,
        home: homePitchers
      }
    };
    
  } catch (error) {
    console.error('NPB詳細スクレイピングエラー:', error);
    throw error;
  }
}

/**
 * 選手打撃成績の抽出
 */
function extractPlayerStats($: cheerio.CheerioAPI, tableSelector: string): PlayerBattingStats[] {
  const players: PlayerBattingStats[] = [];
  
  $(tableSelector + ' tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 8) return;
    
    const battingOrder = parseInt($(cells[0]).text().trim()) || 0;
    const position = $(cells[1]).text().trim();
    const name = $(cells[2]).find('a').text().trim() || $(cells[2]).text().trim();
    const atBats = parseInt($(cells[3]).text().trim()) || 0;
    const runs = parseInt($(cells[4]).text().trim()) || 0;
    const hits = parseInt($(cells[5]).text().trim()) || 0;
    const rbis = parseInt($(cells[6]).text().trim()) || 0;
    const stolenBases = parseInt($(cells[7]).text().trim()) || 0;
    
    // 各回の結果を抽出
    const inningResults: string[] = [];
    for (let i = 8; i < cells.length; i++) {
      const result = $(cells[i]).text().trim();
      if (result && result !== '-') {
        inningResults.push(result);
      }
    }
    
    if (name) {
      players.push({
        battingOrder,
        position,
        name,
        atBats,
        runs,
        hits,
        rbis,
        stolenBases,
        inningResults
      });
    }
  });
  
  return players;
}

/**
 * 投手成績の抽出
 */
function extractPitcherStats($: cheerio.CheerioAPI, selector: string): PitcherStats[] {
  const pitchers: PitcherStats[] = [];
  
  $(selector + ' table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 7) return;
    
    const name = $(cells[0]).find('a').text().trim() || $(cells[0]).text().trim();
    const resultText = $(cells[1]).text().trim();
    const result = (['W', 'L', 'S', 'H'].includes(resultText) ? resultText : '-') as PitcherStats['result'];
    const innings = $(cells[2]).text().trim();
    const hits = parseInt($(cells[3]).text().trim()) || 0;
    const runs = parseInt($(cells[4]).text().trim()) || 0;
    const earnedRuns = parseInt($(cells[5]).text().trim()) || 0;
    const walks = parseInt($(cells[6]).text().trim()) || 0;
    const strikeouts = parseInt($(cells[7]).text().trim()) || 0;
    
    if (name) {
      pitchers.push({
        name,
        result,
        innings,
        hits,
        runs,
        earnedRuns,
        walks,
        strikeouts
      });
    }
  });
  
  return pitchers;
}

/**
 * NPB試合ロースター(roster.html)をスクレイピング
 */
export async function scrapeNPBGameRoster(url: string): Promise<{ away: RosterData; home: RosterData }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const rosters: RosterData[] = [];
    
    // 各チームのロースター抽出
    $('h5').each((_, header) => {
      const teamName = $(header).text().trim();
      const teamTable = $(header).next('table');
      
      const pitchers: RosterPlayer[] = [];
      const fielders: RosterPlayer[] = [];
      
      let currentSection = '';
      
      teamTable.find('tr').each((_, row) => {
        const headerCell = $(row).find('th');
        if (headerCell.length > 0) {
          const headerText = headerCell.text().trim();
          if (headerText === '投手') currentSection = 'pitcher';
          else if (headerText === '野手') currentSection = 'fielder';
          return;
        }
        
        const cells = $(row).find('td');
        if (cells.length >= 3) {
          const number = $(cells[0]).text().trim();
          const name = $(cells[1]).find('a').text().trim() || $(cells[1]).text().trim();
          const handInfo = $(cells[2]).text().trim();
          
          // 左投右打などの情報をパース
          const throwingHand = handInfo.includes('左投') ? 'left' : 'right';
          const battingHand = handInfo.includes('左打') ? 'left' : 
                            handInfo.includes('両打') ? 'switch' : 'right';
          
          const player: RosterPlayer = {
            number,
            name,
            battingHand,
            throwingHand
          };
          
          if (currentSection === 'pitcher') {
            pitchers.push(player);
          } else if (currentSection === 'fielder') {
            fielders.push(player);
          }
        }
      });
      
      if (teamName) {
        rosters.push({
          teamName,
          pitchers,
          fielders
        });
      }
    });
    
    return {
      away: rosters[0] || { teamName: '', pitchers: [], fielders: [] },
      home: rosters[1] || { teamName: '', pitchers: [], fielders: [] }
    };
    
  } catch (error) {
    console.error('NPBロースタースクレイピングエラー:', error);
    throw error;
  }
}

/**
 * ユーティリティ関数
 */
function extractGameIdFromUrl(url: string): string {
  const match = url.match(/\/scores\/(\d{4})\/(\d{4})\/(g-[a-z]-\d+)/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function parseDateString(dateStr: string): string {
  // "2025年8月6日（水）" -> "2025-08-06"
  const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return '';
  
  const year = match[1];
  const month = match[2].padStart(2, '0');
  const day = match[3].padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 複数試合の詳細データを一括取得
 */
export async function scrapeMultipleGameDetails(urls: string[]): Promise<DetailedGameData[]> {
  const results: DetailedGameData[] = [];
  
  for (const url of urls) {
    try {
      const gameData = await scrapeNPBGameDetails(url);
      results.push(gameData);
      
      // レート制限対策で少し待機
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`試合データ取得失敗 ${url}:`, error);
    }
  }
  
  return results;
}

/**
 * 試合IDから詳細URLを生成
 */
export function generateNPBDetailUrls(gameId: string): { box: string; roster: string } {
  // gameId例: "2025-0806-g-s-15"
  const [year, date, ...gameCode] = gameId.split('-');
  const gameCodeStr = gameCode.join('-');
  
  const baseUrl = `https://npb.jp/scores/${year}/${date}/${gameCodeStr}`;
  
  return {
    box: `${baseUrl}/box.html`,
    roster: `${baseUrl}/roster.html`
  };
}
