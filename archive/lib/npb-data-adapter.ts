import * as fs from 'fs';
import * as path from 'path';
import { DetailedGameData, PlayerBattingStats, PitcherStats, TeamRoster } from '../scripts/fetch_comprehensive_npb_data';

// 既存サイトの型定義（互換性維持）
interface LegacyGameData {
  date: string;
  matchup: string;
  homeTeam: string;
  awayTeam: string;
  venue: string;
  time: string;
  endTime?: string;
  gameTime?: string;
  attendance?: string;
  weather?: string;
  homeScore: number;
  awayScore: number;
  status: 'scheduled' | 'inprogress' | 'finished';
  league: 'central' | 'pacific';
  inningScores?: {
    away: number[];
    home: number[];
  };
  homeHits?: number;
  awayHits?: number;
  homeErrors?: number;
  awayErrors?: number;
  winningPitcher?: string;
  losingPitcher?: string;
  savePitcher?: string;
  holdPitchers?: string[];
  homeLineup?: Array<{
    position: string;
    name: string;
    positionName: string;
    playerId?: string;
  }>;
  awayLineup?: Array<{
    position: string;
    name: string;
    positionName: string;
    playerId?: string;
  }>;
  homeBattery?: string[];
  awayBattery?: string[];
  officials?: {
    chief?: string;
    first?: string;
    second?: string;
    third?: string;
  };
}

// 拡張されたゲームデータ型（新機能追加）
interface EnhancedGameData extends LegacyGameData {
  // 新しい詳細データ
  homeBattingStats?: PlayerBattingStats[];
  awayBattingStats?: PlayerBattingStats[];
  homePitchingStats?: PitcherStats[];
  awayPitchingStats?: PitcherStats[];
  homeRoster?: TeamRoster;
  awayRoster?: TeamRoster;
  detailedAvailable?: boolean;
  dataSource?: 'legacy' | 'detailed' | 'hybrid';
}

// チーム名正規化マッピング
const TEAM_NAME_MAPPING: Record<string, string> = {
  'DeNA': 'DeNA',
  '横浜DeNAベイスターズ': 'DeNA',
  '読売ジャイアンツ': '巨人',
  '巨人': '巨人',
  '東京ヤクルトスワローズ': 'ヤクルト',
  'ヤクルト': 'ヤクルト',
  '阪神タイガース': '阪神',
  '阪神': '阪神',
  '広島東洋カープ': '広島',
  '広島': '広島',
  '中日ドラゴンズ': '中日',
  '中日': '中日',
  'ソフトバンクホークス': 'ソフトバンク',
  'ソフトバンク': 'ソフトバンク',
  '北海道日本ハムファイターズ': '日本ハム',
  '日本ハム': '日本ハム',
  '東北楽天ゴールデンイーグルス': '楽天',
  '楽天': '楽天',
  '千葉ロッテマリーンズ': 'ロッテ',
  'ロッテ': 'ロッテ',
  '埼玉西武ライオンズ': '西武',
  '西武': '西武',
  'オリックスバファローズ': 'オリックス',
  'オリックス': 'オリックス'
};

// チームコードマッピング
const TEAM_CODES: Record<string, string> = {
  'DeNA': 'DB',
  '巨人': 'G',
  'ヤクルト': 'S',
  '阪神': 'T',
  '広島': 'C',
  '中日': 'D',
  'ソフトバンク': 'H',
  '日本ハム': 'F',
  '楽天': 'E',
  'ロッテ': 'M',
  '西武': 'L',
  'オリックス': 'B'
};

// チーム名を正規化
function normalizeTeamName(teamName: string): string {
  return TEAM_NAME_MAPPING[teamName] || teamName;
}

// 詳細データから既存形式への変換
function convertDetailedToLegacy(detailedData: DetailedGameData): LegacyGameData {
  const homeTeam = normalizeTeamName(detailedData.homeTeam);
  const awayTeam = normalizeTeamName(detailedData.awayTeam);
  
  const homeCode = TEAM_CODES[homeTeam] || homeTeam.substring(0, 2).toUpperCase();
  const awayCode = TEAM_CODES[awayTeam] || awayTeam.substring(0, 2).toUpperCase();
  
  // 詳細データの構造に合わせて変数を調整
  const homePitchingStats = detailedData.homePitching || [];
  const awayPitchingStats = detailedData.awayPitching || [];
  const homeBattingStats = detailedData.homeBatting || [];
  const awayBattingStats = detailedData.awayBatting || [];

  // 勝敗投手の抽出
  const winningPitcher = [...homePitchingStats, ...awayPitchingStats]
    .find(p => p.result === 'win')?.name;
  const losingPitcher = [...homePitchingStats, ...awayPitchingStats]
    .find(p => p.result === 'loss')?.name;
  const savePitcher = [...homePitchingStats, ...awayPitchingStats]
    .find(p => p.result === 'save')?.name;
  const holdPitchers = [...homePitchingStats, ...awayPitchingStats]
    .filter(p => p.result === 'hold').map(p => p.name);

  // ラインナップ変換
  const homeLineup = homeBattingStats.map(player => ({
    position: player.battingOrder.toString(),
    name: player.name,
    positionName: player.position,
    playerId: `${homeCode}_${player.name}`
  }));

  const awayLineup = awayBattingStats.map(player => ({
    position: player.battingOrder.toString(),
    name: player.name,
    positionName: player.position,
    playerId: `${awayCode}_${player.name}`
  }));

  // リーグ判定
  const centralTeams = ['DeNA', '巨人', 'ヤクルト', '阪神', '広島', '中日'];
  const league: 'central' | 'pacific' = 
    centralTeams.includes(homeTeam) && centralTeams.includes(awayTeam) 
      ? 'central' : 'pacific';

  return {
    date: detailedData.date,
    matchup: `${awayCode}-${homeCode}`,
    homeTeam,
    awayTeam,
    venue: detailedData.venue,
    time: detailedData.gameTime || '18:00',
    gameTime: detailedData.gameTime,
    attendance: detailedData.attendance,
    weather: detailedData.weather,
    homeScore: detailedData.homeScore,
    awayScore: detailedData.awayScore,
    status: 'finished',
    league,
    inningScores: detailedData.inningScores,
    winningPitcher,
    losingPitcher,
    savePitcher,
    holdPitchers: holdPitchers.length > 0 ? holdPitchers : undefined,
    homeLineup,
    awayLineup
  };
}

// 詳細データを拡張形式に変換
function convertDetailedToEnhanced(detailedData: DetailedGameData): EnhancedGameData {
  const legacy = convertDetailedToLegacy(detailedData);
  
  return {
    ...legacy,
    homeBattingStats: detailedData.homeBatting,
    awayBattingStats: detailedData.awayBatting,
    homePitchingStats: detailedData.homePitching,
    awayPitchingStats: detailedData.awayPitching,
    homeRoster: detailedData.homeRoster,
    awayRoster: detailedData.awayRoster,
    detailedAvailable: true,
    dataSource: 'detailed'
  };
}

// NPBデータアダプター
export class NPBDataAdapter {
  private legacyDataPath: string;
  private detailedDataPath: string;

  constructor() {
    this.legacyDataPath = path.join(process.cwd(), 'data', 'npb_2025_all_games_simple.json');
    this.detailedDataPath = path.join(process.cwd(), 'data', 'npb_2025_detailed_complete.json');
  }

  // 詳細データを読み込み
  private loadDetailedData(): DetailedGameData[] {
    try {
      if (fs.existsSync(this.detailedDataPath)) {
        const data = fs.readFileSync(this.detailedDataPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('詳細データの読み込みに失敗:', error);
    }
    return [];
  }

  // レガシーデータを読み込み
  private loadLegacyData(): Record<string, Record<string, any>> {
    try {
      if (fs.existsSync(this.legacyDataPath)) {
        const data = fs.readFileSync(this.legacyDataPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('レガシーデータの読み込みに失敗:', error);
    }
    return {};
  }

  // 統合されたゲームデータを取得
  getGameData(date: string, matchup: string): EnhancedGameData | null {
    const detailedData = this.loadDetailedData();
    const legacyData = this.loadLegacyData();

    // まず詳細データを検索
    const gameId = `${date}_${matchup.toLowerCase()}`;
    const detailedGame = detailedData.find(game => game.gameId === gameId);

    if (detailedGame) {
      console.log(`詳細データを使用: ${date} ${matchup}`);
      return convertDetailedToEnhanced(detailedGame);
    }

    // レガシーデータを検索
    const legacyGame = legacyData[date]?.[matchup];
    if (legacyGame) {
      console.log(`レガシーデータを使用: ${date} ${matchup}`);
      return {
        ...legacyGame,
        detailedAvailable: false,
        dataSource: 'legacy'
      };
    }

    console.warn(`ゲームデータが見つかりません: ${date} ${matchup}`);
    return null;
  }

  // 特定日の全試合データを取得
  getGamesByDate(date: string): EnhancedGameData[] {
    const detailedData = this.loadDetailedData();
    const legacyData = this.loadLegacyData();
    
    const games: EnhancedGameData[] = [];
    const processedMatchups = new Set<string>();

    // 詳細データから取得
    detailedData.forEach(game => {
      if (game.date === date) {
        const enhanced = convertDetailedToEnhanced(game);
        games.push(enhanced);
        processedMatchups.add(enhanced.matchup);
      }
    });

    // レガシーデータから不足分を補完
    if (legacyData[date]) {
      Object.entries(legacyData[date]).forEach(([matchup, gameData]) => {
        if (!processedMatchups.has(matchup)) {
          games.push({
            ...(gameData as LegacyGameData),
            detailedAvailable: false,
            dataSource: 'legacy'
          });
        }
      });
    }

    return games.sort((a, b) => a.matchup.localeCompare(b.matchup));
  }

  // 利用可能な全日付を取得
  getAvailableDates(): string[] {
    const detailedData = this.loadDetailedData();
    const legacyData = this.loadLegacyData();
    
    const datesSet = new Set<string>();
    
    // 詳細データから日付を取得
    detailedData.forEach(game => datesSet.add(game.date));
    
    // レガシーデータから日付を取得
    Object.keys(legacyData).forEach(date => datesSet.add(date));
    
    return Array.from(datesSet).sort();
  }

  // データソース統計を取得
  getDataSourceStats(): {
    detailedCount: number;
    legacyCount: number;
    totalCount: number;
    dates: string[];
  } {
    const detailedData = this.loadDetailedData();
    const legacyData = this.loadLegacyData();
    
    const legacyCount = Object.values(legacyData).reduce(
      (total, dayGames) => total + Object.keys(dayGames).length, 
      0
    );

    return {
      detailedCount: detailedData.length,
      legacyCount,
      totalCount: detailedData.length + legacyCount,
      dates: this.getAvailableDates()
    };
  }

  // 詳細データへの変換処理
  async convertAllToEnhanced(): Promise<void> {
    console.log('🔄 全データを拡張形式に変換中...');
    
    const detailedData = this.loadDetailedData();
    const legacyData = this.loadLegacyData();
    
    const enhancedData: Record<string, Record<string, EnhancedGameData>> = {};
    let convertedCount = 0;

    // 詳細データを変換
    detailedData.forEach(game => {
      const enhanced = convertDetailedToEnhanced(game);
      if (!enhancedData[enhanced.date]) {
        enhancedData[enhanced.date] = {};
      }
      enhancedData[enhanced.date][enhanced.matchup] = enhanced;
      convertedCount++;
    });

    // レガシーデータを変換
    Object.entries(legacyData).forEach(([date, dayGames]) => {
      if (!enhancedData[date]) {
        enhancedData[date] = {};
      }
      
      Object.entries(dayGames).forEach(([matchup, gameData]) => {
        if (!enhancedData[date][matchup]) {
          enhancedData[date][matchup] = {
            ...(gameData as LegacyGameData),
            detailedAvailable: false,
            dataSource: 'legacy'
          };
          convertedCount++;
        }
      });
    });

    // 拡張データを保存
    const outputPath = path.join(process.cwd(), 'data', 'npb_2025_enhanced_complete.json');
    fs.writeFileSync(outputPath, JSON.stringify(enhancedData, null, 2), 'utf-8');
    
    console.log(`✅ ${convertedCount}試合のデータを拡張形式に変換完了`);
    console.log(`💾 保存先: ${outputPath}`);
  }
}

// Next.js用のAPIヘルパー
export function getGameDataForPage(date: string, matchup: string): EnhancedGameData | null {
  const adapter = new NPBDataAdapter();
  return adapter.getGameData(date, matchup);
}

export function getGamesByDateForPage(date: string): EnhancedGameData[] {
  const adapter = new NPBDataAdapter();
  return adapter.getGamesByDate(date);
}

// 型エクスポート
export type { 
  LegacyGameData, 
  EnhancedGameData, 
  PlayerBattingStats as PlayerBattingStatsType,
  PitcherStats as PitcherStatsType,
  TeamRoster as TeamRosterType
};