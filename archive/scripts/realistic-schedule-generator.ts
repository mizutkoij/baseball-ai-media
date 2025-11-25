// NPBリアルスケジュール生成システム
import { writeFileSync } from 'fs';

export interface Team {
  name: string;
  league: 'central' | 'pacific';
  venue: string;
  code: string;
}

export interface MatchupPair {
  home: Team;
  away: Team;
  series: number; // 連戦数 (2-4試合)
}

export interface GameSchedule {
  date: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  league: 'central' | 'pacific';
  gameId: string;
  status: 'scheduled' | 'live' | 'finished';
  startTime: string;
  isInterleague?: boolean;
}

class NPBScheduleGenerator {
  private readonly centralTeams: Team[] = [
    { name: '巨人', league: 'central', venue: '東京ドーム', code: 'G' },
    { name: 'ヤクルト', league: 'central', venue: '神宮球場', code: 'S' },
    { name: '阪神', league: 'central', venue: '阪神甲子園球場', code: 'T' },
    { name: '広島', league: 'central', venue: 'マツダスタジアム', code: 'C' },
    { name: 'DeNA', league: 'central', venue: '横浜スタジアム', code: 'DB' },
    { name: '中日', league: 'central', venue: 'バンテリンドーム', code: 'D' }
  ];

  private readonly pacificTeams: Team[] = [
    { name: 'ソフトバンク', league: 'pacific', venue: 'PayPayドーム', code: 'H' },
    { name: '日本ハム', league: 'pacific', venue: 'エスコンフィールド', code: 'F' },
    { name: '西武', league: 'pacific', venue: 'ベルーナドーム', code: 'L' },
    { name: 'ロッテ', league: 'pacific', venue: 'ZOZOマリンスタジアム', code: 'M' },
    { name: 'オリックス', league: 'pacific', venue: '京セラドーム大阪', code: 'B' },
    { name: '楽天', league: 'pacific', venue: '楽天モバイルパーク', code: 'E' }
  ];

  /**
   * 指定日の試合スケジュールを生成
   */
  generateGamesForDate(date: string): GameSchedule[] {
    const dateObj = new Date(date);
    const month = dateObj.getMonth() + 1;
    const dayOfWeek = dateObj.getDay();
    
    // シーズン期間判定
    if (month < 3 || month > 10) {
      return []; // オフシーズン
    }
    
    // 試合開催判定（火曜日は原則休み）
    if (dayOfWeek === 2) { // 火曜日
      return Math.random() < 0.1 ? this.generateSpecialGames(date) : [];
    }
    
    // 交流戦期間判定（5月下旬〜6月中旬）
    const isInterleaguePeriod = (month === 5 && dateObj.getDate() > 20) || 
                                (month === 6 && dateObj.getDate() < 20);
    
    if (isInterleaguePeriod) {
      return this.generateInterleagueGames(date);
    }
    
    // 通常のリーグ戦
    return this.generateRegularSeasonGames(date);
  }
  
  /**
   * 通常のリーグ戦スケジュール生成
   */
  private generateRegularSeasonGames(date: string): GameSchedule[] {
    const games: GameSchedule[] = [];
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    
    // セ・リーグの対戦カード生成（3試合）
    const centralMatchups = this.generateLeagueMatchups(this.centralTeams, date);
    games.push(...centralMatchups);
    
    // パ・リーグの対戦カード生成（3試合）
    const pacificMatchups = this.generateLeagueMatchups(this.pacificTeams, date);
    games.push(...pacificMatchups);
    
    return games;
  }
  
  /**
   * 交流戦スケジュール生成
   */
  private generateInterleagueGames(date: string): GameSchedule[] {
    const games: GameSchedule[] = [];
    const usedTeams = new Set<string>();
    
    // セ・パ交流戦は通常6試合（各リーグ3チームずつが対戦）
    for (let i = 0; i < 3; i++) {
      const centralTeam = this.getAvailableTeam(this.centralTeams, usedTeams);
      const pacificTeam = this.getAvailableTeam(this.pacificTeams, usedTeams);
      
      if (!centralTeam || !pacificTeam) break;
      
      // ホーム・アウェイをランダムで決定
      const isHomeC = Math.random() < 0.5;
      const homeTeam = isHomeC ? centralTeam : pacificTeam;
      const awayTeam = isHomeC ? pacificTeam : centralTeam;
      
      games.push(this.createGame(date, homeTeam, awayTeam, i + 1, true));
      
      usedTeams.add(centralTeam.name);
      usedTeams.add(pacificTeam.name);
    }
    
    return games;
  }
  
  /**
   * リーグ内対戦カード生成
   */
  private generateLeagueMatchups(teams: Team[], date: string): GameSchedule[] {
    const games: GameSchedule[] = [];
    const usedTeams = new Set<string>();
    
    // 6チームを3ペアに分割
    const availableTeams = [...teams];
    let gameIndex = 1;
    
    while (availableTeams.length >= 2 && games.length < 3) {
      // ホームチームを選択
      const homeIndex = Math.floor(Math.random() * availableTeams.length);
      const homeTeam = availableTeams[homeIndex];
      availableTeams.splice(homeIndex, 1);
      
      // アウェイチームを選択
      const awayIndex = Math.floor(Math.random() * availableTeams.length);
      const awayTeam = availableTeams[awayIndex];
      availableTeams.splice(awayIndex, 1);
      
      games.push(this.createGame(date, homeTeam, awayTeam, gameIndex));
      gameIndex++;
    }
    
    return games;
  }
  
  /**
   * 使用可能チームを取得
   */
  private getAvailableTeam(teams: Team[], usedTeams: Set<string>): Team | null {
    const available = teams.filter(team => !usedTeams.has(team.name));
    if (available.length === 0) return null;
    
    return available[Math.floor(Math.random() * available.length)];
  }
  
  /**
   * 特別試合（雨天中止後の再試合など）
   */
  private generateSpecialGames(date: string): GameSchedule[] {
    // 稀に火曜日に補充試合
    if (Math.random() < 0.3) {
      const teams = [...this.centralTeams, ...this.pacificTeams];
      const homeTeam = teams[Math.floor(Math.random() * teams.length)];
      let awayTeam = teams[Math.floor(Math.random() * teams.length)];
      
      // 同じリーグから選択
      const sameLeagueTeams = teams.filter(t => t.league === homeTeam.league && t.name !== homeTeam.name);
      awayTeam = sameLeagueTeams[Math.floor(Math.random() * sameLeagueTeams.length)];
      
      return [this.createGame(date, homeTeam, awayTeam, 1, false, '補充試合')];
    }
    
    return [];
  }
  
  /**
   * ゲーム情報を作成
   */
  private createGame(
    date: string, 
    homeTeam: Team, 
    awayTeam: Team, 
    gameNumber: number,
    isInterleague: boolean = false,
    specialNote?: string
  ): GameSchedule {
    const dateStr = date.replace(/-/g, '');
    const gameId = `${dateStr}_${awayTeam.code}-${homeTeam.code}_${gameNumber.toString().padStart(2, '0')}`;
    
    // 試合開始時刻（平日18:00、土日14:00が基本）
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    const startTime = (dayOfWeek === 0 || dayOfWeek === 6) ? '14:00' : '18:00';
    
    // 試合ステータス（過去・現在・未来で判定）
    const now = new Date();
    const gameDate = new Date(date);
    const status = this.determineGameStatus(gameDate, now);
    
    return {
      date,
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      venue: homeTeam.venue,
      league: homeTeam.league, // ホームチームのリーグ
      gameId,
      status,
      startTime,
      isInterleague
    };
  }
  
  /**
   * 試合ステータスを決定
   */
  private determineGameStatus(gameDate: Date, now: Date): 'scheduled' | 'live' | 'finished' {
    const gameTime = new Date(gameDate);
    gameTime.setHours(18, 0, 0, 0); // 18:00に設定
    
    const diffMs = now.getTime() - gameTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < -1) {
      return 'scheduled'; // 1時間以上前
    } else if (diffHours >= -1 && diffHours <= 4) {
      return 'live'; // 開始1時間前〜終了4時間後
    } else {
      return 'finished'; // 4時間後以降
    }
  }
  
  /**
   * 複数日のスケジュールを一括生成
   */
  generateScheduleRange(startDate: string, endDate: string): GameSchedule[] {
    const games: GameSchedule[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().slice(0, 10);
      const dayGames = this.generateGamesForDate(dateStr);
      games.push(...dayGames);
    }
    
    return games;
  }
}

// スケジュール生成ユーティリティ
export function generateRealisticNPBSchedule(date: string): GameSchedule[] {
  const generator = new NPBScheduleGenerator();
  return generator.generateGamesForDate(date);
}

// CLIとして実行
if (require.main === module) {
  const args = process.argv.slice(2);
  const date = args[0] || new Date().toISOString().slice(0, 10);
  
  const generator = new NPBScheduleGenerator();
  const games = generator.generateGamesForDate(date);
  
  console.log(`📅 ${date} のNPB試合スケジュール:`);
  
  if (games.length === 0) {
    console.log('今日は試合がありません（休養日）');
  } else {
    games.forEach(game => {
      const interleague = game.isInterleague ? '[交流戦] ' : '';
      console.log(`${interleague}${game.startTime} ${game.awayTeam} vs ${game.homeTeam} @${game.venue} (${game.status})`);
    });
  }
  
  // JSON出力オプション
  if (args.includes('--json')) {
    const filename = `schedule-${date}.json`;
    writeFileSync(filename, JSON.stringify(games, null, 2));
    console.log(`\n📄 ${filename} に出力しました`);
  }
}