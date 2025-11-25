// NPB公式サイトからボックススコアとロースター情報を取得するスクリプト
import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';

interface PlayerBoxScore {
  order: number;
  position: string;
  name: string;
  atBats: number;
  runs: number;
  hits: number;
  rbis: number;
  steals: number;
  inning1: string;
  inning2: string;
  inning3: string;
  inning4: string;
  inning5: string;
  inning6: string;
  inning7: string;
  inning8: string;
  inning9: string;
}

interface PitcherBoxScore {
  name: string;
  pitches: number;
  batters: number;
  innings: string;
  hits: number;
  homeRuns: number;
  walks: number;
  hitBatsmen: number;
  strikeouts: number;
  wildPitches: number;
  balks: number;
  runs: number;
  earnedRuns: number;
  result?: 'W' | 'L' | 'S' | 'H' | 'O';
}

interface TeamBoxScore {
  teamName: string;
  players: PlayerBoxScore[];
  pitchers: PitcherBoxScore[];
  teamTotals: {
    atBats: number;
    runs: number;
    hits: number;
    rbis: number;
    steals: number;
  };
}

interface RosterPlayer {
  number: string;
  name: string;
  position: string;
  age: string;
  bats: string;
  throws: string;
  height: string;
  weight: string;
  career: string;
  birthplace: string;
}

interface GameRoster {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeRoster: RosterPlayer[];
  awayRoster: RosterPlayer[];
}

class NPBBoxScoreScraper {
  private async fetchHtml(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  }

  private parsePlayerBoxScore($: cheerio.CheerioAPI, row: cheerio.Element): PlayerBoxScore | null {
    const cells = $(row).find('td');
    if (cells.length < 15) return null;

    try {
      const order = parseInt($(cells[0]).text().trim()) || 0;
      const position = $(cells[1]).text().trim();
      const name = $(cells[2]).text().trim();
      const atBats = parseInt($(cells[3]).text().trim()) || 0;
      const runs = parseInt($(cells[4]).text().trim()) || 0;
      const hits = parseInt($(cells[5]).text().trim()) || 0;
      const rbis = parseInt($(cells[6]).text().trim()) || 0;
      const steals = parseInt($(cells[7]).text().trim()) || 0;

      return {
        order,
        position,
        name,
        atBats,
        runs,
        hits,
        rbis,
        steals,
        inning1: $(cells[8]).text().trim(),
        inning2: $(cells[9]).text().trim(),
        inning3: $(cells[10]).text().trim(),
        inning4: $(cells[11]).text().trim(),
        inning5: $(cells[12]).text().trim(),
        inning6: $(cells[13]).text().trim(),
        inning7: $(cells[14]).text().trim(),
        inning8: $(cells[15]).text().trim(),
        inning9: $(cells[16]).text().trim()
      };
    } catch (error) {
      console.error('Error parsing player row:', error);
      return null;
    }
  }

  private parsePitcherBoxScore($: cheerio.CheerioAPI, row: cheerio.Element): PitcherBoxScore | null {
    const cells = $(row).find('td');
    if (cells.length < 13) return null;

    try {
      const resultSymbol = $(cells[0]).text().trim();
      const name = $(cells[1]).text().trim();
      
      let result: 'W' | 'L' | 'S' | 'H' | 'O' | undefined;
      if (resultSymbol === '○') result = 'W';
      else if (resultSymbol === '●') result = 'L';
      else if (resultSymbol === 'S') result = 'S';
      else if (resultSymbol === 'H') result = 'H';

      return {
        name,
        pitches: parseInt($(cells[2]).text().trim()) || 0,
        batters: parseInt($(cells[3]).text().trim()) || 0,
        innings: $(cells[4]).text().trim(),
        hits: parseInt($(cells[5]).text().trim()) || 0,
        homeRuns: parseInt($(cells[6]).text().trim()) || 0,
        walks: parseInt($(cells[7]).text().trim()) || 0,
        hitBatsmen: parseInt($(cells[8]).text().trim()) || 0,
        strikeouts: parseInt($(cells[9]).text().trim()) || 0,
        wildPitches: parseInt($(cells[10]).text().trim()) || 0,
        balks: parseInt($(cells[11]).text().trim()) || 0,
        runs: parseInt($(cells[12]).text().trim()) || 0,
        earnedRuns: parseInt($(cells[13]).text().trim()) || 0,
        result
      };
    } catch (error) {
      console.error('Error parsing pitcher row:', error);
      return null;
    }
  }

  async scrapeBoxScore(gameUrl: string): Promise<{awayTeam: TeamBoxScore, homeTeam: TeamBoxScore}> {
    console.log(`📦 ボックススコア取得中: ${gameUrl}`);
    
    const html = await this.fetchHtml(gameUrl);
    const $ = cheerio.load(html);

    const teams: TeamBoxScore[] = [];
    
    // チーム名を取得
    const teamNames: string[] = [];
    $('.team_name').each((i, element) => {
      teamNames.push($(element).text().trim());
    });

    // 各チームのボックススコアを解析
    $('.box_score_table').each((teamIndex, table) => {
      if (teamIndex >= 2) return; // 最初の2つのテーブルのみ（打撃成績）

      const teamName = teamNames[teamIndex] || `Team ${teamIndex + 1}`;
      const players: PlayerBoxScore[] = [];
      
      // 選手データを解析
      $(table).find('tbody tr').each((i, row) => {
        const player = this.parsePlayerBoxScore($, row);
        if (player && player.name && player.name !== 'チーム計') {
          players.push(player);
        }
      });

      teams.push({
        teamName,
        players,
        pitchers: [],
        teamTotals: {
          atBats: 0,
          runs: 0,
          hits: 0,
          rbis: 0,
          steals: 0
        }
      });
    });

    // 投手成績を取得
    $('.pitcher_table').each((teamIndex, table) => {
      if (teamIndex >= teams.length) return;
      
      const pitchers: PitcherBoxScore[] = [];
      
      $(table).find('tbody tr').each((i, row) => {
        const pitcher = this.parsePitcherBoxScore($, row);
        if (pitcher && pitcher.name && pitcher.name !== 'チーム計') {
          pitchers.push(pitcher);
        }
      });

      teams[teamIndex].pitchers = pitchers;
    });

    // チーム合計を計算
    teams.forEach(team => {
      team.teamTotals = team.players.reduce((totals, player) => ({
        atBats: totals.atBats + player.atBats,
        runs: totals.runs + player.runs,
        hits: totals.hits + player.hits,
        rbis: totals.rbis + player.rbis,
        steals: totals.steals + player.steals
      }), { atBats: 0, runs: 0, hits: 0, rbis: 0, steals: 0 });
    });

    return {
      awayTeam: teams[0] || { teamName: 'Away Team', players: [], pitchers: [], teamTotals: { atBats: 0, runs: 0, hits: 0, rbis: 0, steals: 0 } },
      homeTeam: teams[1] || { teamName: 'Home Team', players: [], pitchers: [], teamTotals: { atBats: 0, runs: 0, hits: 0, rbis: 0, steals: 0 } }
    };
  }

  private parseRosterPlayer($: cheerio.CheerioAPI, row: cheerio.Element): RosterPlayer | null {
    const cells = $(row).find('td');
    if (cells.length < 10) return null;

    try {
      return {
        number: $(cells[0]).text().trim(),
        name: $(cells[1]).text().trim(),
        position: $(cells[2]).text().trim(),
        age: $(cells[3]).text().trim(),
        bats: $(cells[4]).text().trim(),
        throws: $(cells[5]).text().trim(),
        height: $(cells[6]).text().trim(),
        weight: $(cells[7]).text().trim(),
        career: $(cells[8]).text().trim(),
        birthplace: $(cells[9]).text().trim()
      };
    } catch (error) {
      console.error('Error parsing roster player:', error);
      return null;
    }
  }

  async scrapeRoster(rosterUrl: string): Promise<GameRoster> {
    console.log(`👥 ロースター情報取得中: ${rosterUrl}`);
    
    const html = await this.fetchHtml(rosterUrl);
    const $ = cheerio.load(html);

    const gameId = rosterUrl.match(/\/(\d{8}\/[^\/]+)\/roster/)?.[1] || '';
    
    // チーム名を取得
    const teamNames: string[] = [];
    $('.team_name, h2').each((i, element) => {
      const teamName = $(element).text().trim();
      if (teamName && teamName.includes('ベイスターズ') || teamName.includes('カープ') || teamName.includes('巨人') || teamName.includes('ヤクルト') || teamName.includes('阪神') || teamName.includes('中日')) {
        teamNames.push(teamName);
      }
    });

    const rosters: RosterPlayer[][] = [[], []];
    
    // ロースターテーブルを解析
    $('.roster_table, table').each((tableIndex, table) => {
      if (tableIndex >= 2) return; // 最初の2つのテーブル
      
      const roster: RosterPlayer[] = [];
      
      $(table).find('tbody tr').each((i, row) => {
        const player = this.parseRosterPlayer($, row);
        if (player && player.name) {
          roster.push(player);
        }
      });

      if (roster.length > 0) {
        rosters[tableIndex] = roster;
      }
    });

    return {
      gameId,
      homeTeam: teamNames[1] || 'Home Team',
      awayTeam: teamNames[0] || 'Away Team',
      homeRoster: rosters[1] || [],
      awayRoster: rosters[0] || []
    };
  }

  async scrapeGameData(boxScoreUrl: string, rosterUrl: string): Promise<{boxScore: any, roster: GameRoster}> {
    try {
      console.log('🎯 NPB試合データ取得開始');
      console.log(`📦 Box Score URL: ${boxScoreUrl}`);
      console.log(`👥 Roster URL: ${rosterUrl}`);

      const [boxScore, roster] = await Promise.all([
        this.scrapeBoxScore(boxScoreUrl),
        this.scrapeRoster(rosterUrl)
      ]);

      return { boxScore, roster };
    } catch (error) {
      console.error('Error scraping game data:', error);
      throw error;
    }
  }
}

// 実行部分
async function main() {
  const scraper = new NPBBoxScoreScraper();
  
  // 提供されたURL（2025年8月21日 DeNA vs 広島）
  const boxScoreUrl = 'https://npb.jp/scores/2025/0821/db-c-20/box.html';
  const rosterUrl = 'https://npb.jp/scores/2025/0820/db-c-19/roster.html';
  
  try {
    const gameData = await scraper.scrapeGameData(boxScoreUrl, rosterUrl);
    
    // 結果を表示
    console.log('\n📊 ボックススコア結果:');
    console.log(`アウェイチーム: ${gameData.boxScore.awayTeam.teamName}`);
    console.log(`ホームチーム: ${gameData.boxScore.homeTeam.teamName}`);
    
    // アウェイチームの打撃成績
    console.log(`\n🏏 ${gameData.boxScore.awayTeam.teamName} 打撃成績:`);
    console.table(gameData.boxScore.awayTeam.players.slice(0, 5).map((p: PlayerBoxScore) => ({
      打順: p.order,
      守備: p.position,
      選手: p.name,
      打数: p.atBats,
      得点: p.runs,
      安打: p.hits,
      打点: p.rbis
    })));

    // ホームチームの打撃成績
    console.log(`\n🏏 ${gameData.boxScore.homeTeam.teamName} 打撃成績:`);
    console.table(gameData.boxScore.homeTeam.players.slice(0, 5).map((p: PlayerBoxScore) => ({
      打順: p.order,
      守備: p.position,
      選手: p.name,
      打数: p.atBats,
      得点: p.runs,
      安打: p.hits,
      打点: p.rbis
    })));

    // 投手成績
    console.log(`\n⚾ ${gameData.boxScore.awayTeam.teamName} 投手成績:`);
    console.table(gameData.boxScore.awayTeam.pitchers.map((p: PitcherBoxScore) => ({
      投手: p.name,
      結果: p.result || '',
      投球回: p.innings,
      被安打: p.hits,
      奪三振: p.strikeouts,
      失点: p.runs,
      自責点: p.earnedRuns
    })));

    console.log(`\n⚾ ${gameData.boxScore.homeTeam.teamName} 投手成績:`);
    console.table(gameData.boxScore.homeTeam.pitchers.map((p: PitcherBoxScore) => ({
      投手: p.name,
      結果: p.result || '',
      投球回: p.innings,
      被安打: p.hits,
      奪三振: p.strikeouts,
      失点: p.runs,
      自責点: p.earnedRuns
    })));

    // ロースター情報
    console.log(`\n👥 ロースター情報:`);
    console.log(`Game ID: ${gameData.roster.gameId}`);
    console.log(`${gameData.roster.awayTeam} 登録選手: ${gameData.roster.awayRoster.length}名`);
    console.log(`${gameData.roster.homeTeam} 登録選手: ${gameData.roster.homeRoster.length}名`);

    if (gameData.roster.homeRoster.length > 0) {
      console.log(`\n👥 ${gameData.roster.homeTeam} ロースター（一部）:`);
      console.table(gameData.roster.homeRoster.slice(0, 5).map(p => ({
        背番号: p.number,
        選手名: p.name,
        ポジション: p.position,
        年齢: p.age,
        出身地: p.birthplace
      })));
    }

    // JSONファイルに保存
    const outputData = {
      gameDate: '2025-08-21',
      gameId: 'db-c-20',
      venue: '横浜スタジアム',
      boxScore: gameData.boxScore,
      roster: gameData.roster,
      scrapedAt: new Date().toISOString()
    };

    writeFileSync('./data/npb-game-20250821.json', JSON.stringify(outputData, null, 2));
    console.log('\n💾 データを ./data/npb-game-20250821.json に保存しました');

  } catch (error) {
    console.error('❌ スクレイピングエラー:', error);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

export { NPBBoxScoreScraper };