#!/usr/bin/env npx tsx

/**
 * BaseballData.jp 2011年以降データをNPB形式に変換（効率化版）
 * 
 * 重要: BaseballData.jpは2011年以降のデータのみ保持
 * - 2011年以前の入団選手: その時に現役だった場合のみデータ存在
 * - 推奨対象年: 2011-2025年入団選手
 * 
 * ID形式調整:
 * - 2011年入団: 2011001 → 11001... (頭文字1)
 * - 2012年入団: 2012001 → 12001...
 * - など
 * 
 * 使用方法:
 * npx tsx scripts/convert_baseballdata_2001_plus.ts --year 2011
 * npx tsx scripts/convert_baseballdata_2001_plus.ts --start-year 2011 --end-year 2025
 */

import fs from 'fs/promises';
import path from 'path';
import { 
  BaseballDataScraper, 
  fetchPlayerSeasonData, 
  BaseballDataPlayer, 
  SeasonStats,
  SabrEyeStats 
} from '../lib/baseballdata-scraper';

// あなたの既存システム形式のプレイヤー情報
interface NPBFormattedPlayer {
  player_id: string; // NPB形式ID
  baseballdata_id: string; // 元のBaseballData.jp ID
  name: string;
  name_kana: string;
  profile: {
    '背番号'?: string;
    '投打'?: string;
    '身長/体重'?: string;
    '生年月日'?: string;
    '出身地'?: string;
    'ドラフト'?: string;
    'チーム'?: string;
    'ポジション'?: string;
  };
  url: string;
  stats?: EnhancedStats[];
}

interface EnhancedStats {
  year: number;
  stats_type: 'batting' | 'pitching';
  
  // 基本成績
  games?: number;
  at_bats?: number;
  hits?: number;
  doubles?: number;
  triples?: number;
  home_runs?: number;
  rbis?: number;
  runs?: number;
  walks?: number;
  strikeouts?: number;
  stolen_bases?: number;
  batting_average?: number;
  on_base_percentage?: number;
  slugging_percentage?: number;
  ops?: number;
  
  // Sabrメトリクス
  babip?: number;
  isop?: number;
  bb_k?: number;
  contact_rate?: number;
  swing_rate?: number;
  chase_rate?: number;
  gpa?: number;
  noi?: number;
  
  data_source: 'baseballdata_jp';
  enhanced_metrics: boolean;
}

class BaseballDataConverter2001Plus {
  private kanaMap: Record<string, string>;
  
  constructor() {
    this.kanaMap = this.createKanaMap();
  }

  private createKanaMap(): Record<string, string> {
    const kanaGroups = {
      '0': "あいうえおゔ",
      '1': "かきくけこがぎぐげご", 
      '2': "さしすせそざじずぜぞ",
      '3': "たちつてとだぢづでど",
      '4': "なにぬねの",
      '5': "はひふへほばびぶべぼぱぴぷぺぽ",
      '6': "まみむめも",
      '7': "やゆよ",
      '8': "らりるれろ",
      '9': "わをん"
    };
    
    const kanaMap: Record<string, string> = {};
    for (const [code, chars] of Object.entries(kanaGroups)) {
      for (const char of chars) {
        kanaMap[char] = code;
      }
    }
    return kanaMap;
  }

  /**
   * 2001年以降のBaseballData.jpプレイヤー情報からNPB形式IDを生成
   */
  private generateNPBPlayerID(player: BaseballDataPlayer): string {
    // league_code: セ(1)またはパ(2)
    const leagueCode = this.inferLeagueFromTeam(player.team || '') || '0';
    
    // entry_year_code: BaseballData.jp IDから入団年を抽出
    const entryYearCode = player.player_id.substring(0, 4);
    const entryYearLast3 = entryYearCode.slice(-3); // 下3桁
    
    // nationality_code: 日本人(1)か外国人(2)
    const nationalityCode = this.inferNationality(player.name);
    
    // position_code: 投手(1)か野手(2)
    const positionCode = player.player_type === 'pitcher' ? '1' : '2';
    
    // birth_date_code: 生年月日不明なので仮の値
    const birthDateCode = '19900101'; 
    
    // initial_code: 名前の読み仮名頭文字をコード化
    const cleanedName = this.cleanPlayerName(player.name);
    const initialCode = this.getInitialCode(cleanedName);
    
    return `${leagueCode}${entryYearLast3}${nationalityCode}${positionCode}${birthDateCode}${initialCode}`;
  }

  private inferLeagueFromTeam(team: string): string {
    const centralTeams = ['巨人', '阪神', '中日', '広島', 'ヤクルト', 'ベイスターズ'];
    const pacificTeams = ['ソフトバンク', 'ロッテ', '日ハム', '楽天', 'オリックス', '西武'];
    
    if (centralTeams.some(t => team.includes(t))) return '1';
    if (pacificTeams.some(t => team.includes(t))) return '2';
    return '0';
  }

  private inferNationality(name: string): string {
    return /[a-zA-Z]/.test(name) ? '2' : '1';
  }

  private cleanPlayerName(name: string): string {
    return name
      .replace(/^\d+年度\s*/, '') 
      .replace(/【.*】.*$/, '') 
      .trim()
      .split(/[\s　]/)[0] || '';
  }

  private getInitialCode(name: string): string {
    if (!name) return 'X';
    
    const hiragana = name.replace(/[ァ-ヶ]/g, match => 
      String.fromCharCode(match.charCodeAt(0) - 0x60)
    );
    
    const firstChar = hiragana[0];
    return this.kanaMap[firstChar] || 'X';
  }

  /**
   * 指定年のBaseballData.jpプレイヤーデータを読み込み
   */
  async loadBaseballDataPlayers(year: number): Promise<BaseballDataPlayer[]> {
    console.log(`⚾ ${year}年BaseballData.jpプレイヤーデータ読み込み中...`);
    
    try {
      const playersFile = `data/baseballdata_${year}/players_${year}.json`;
      const content = await fs.readFile(playersFile, 'utf-8');
      const players = JSON.parse(content) as BaseballDataPlayer[];
      
      console.log(`✅ BaseballData.jp選手 ${players.length}名を読み込み完了`);
      return players;
      
    } catch (error) {
      console.error(`❌ ${year}年データ読み込み失敗:`, error);
      return [];
    }
  }

  /**
   * プレイヤーをNPB形式に変換
   */
  async convertPlayerToNPBFormat(player: BaseballDataPlayer): Promise<NPBFormattedPlayer | null> {
    try {
      console.log(`📊 変換中: ${this.cleanPlayerName(player.name)} (${player.player_id})`);
      
      const detailedData = await fetchPlayerSeasonData(player.player_id);
      const npbPlayerId = this.generateNPBPlayerID(player);
      
      const profile: NPBFormattedPlayer['profile'] = {
        'チーム': player.team || '',
        'ポジション': player.player_type === 'pitcher' ? '投手' : '野手',
        'ドラフト': `${player.entry_year}年ドラフト`
      };
      
      const enhancedStats: EnhancedStats[] = [];
      
      if (detailedData.seasonStats) {
        const stats = detailedData.seasonStats;
        enhancedStats.push({
          year: 2025,
          stats_type: 'batting',
          games: stats.games,
          at_bats: stats.at_bats,
          hits: stats.hits,
          doubles: stats.doubles,
          triples: stats.triples,
          home_runs: stats.home_runs,
          rbis: stats.rbis,
          runs: stats.runs,
          walks: stats.walks,
          strikeouts: stats.strikeouts,
          stolen_bases: stats.stolen_bases,
          batting_average: stats.batting_average,
          on_base_percentage: stats.on_base_percentage,
          slugging_percentage: stats.slugging_percentage,
          ops: stats.ops,
          data_source: 'baseballdata_jp',
          enhanced_metrics: false
        });
      }
      
      if (detailedData.sabrEye) {
        enhancedStats.push({
          year: 2025,
          stats_type: 'batting',
          babip: detailedData.sabrEye.babip,
          isop: detailedData.sabrEye.isop,
          bb_k: detailedData.sabrEye.bb_k,
          contact_rate: detailedData.sabrEye.contact_rate,
          swing_rate: detailedData.sabrEye.swing_rate,
          chase_rate: detailedData.sabrEye.chase_rate,
          gpa: detailedData.sabrEye.gpa,
          noi: detailedData.sabrEye.noi,
          data_source: 'baseballdata_jp',
          enhanced_metrics: true
        });
      }
      
      const converted: NPBFormattedPlayer = {
        player_id: npbPlayerId,
        baseballdata_id: player.player_id,
        name: this.cleanPlayerName(player.name),
        name_kana: '',
        profile,
        url: `https://baseballdata.jp/playerB/${player.player_id}.html`,
        stats: enhancedStats
      };
      
      console.log(`✅ 変換完了: ${converted.name} → ${npbPlayerId}`);
      return converted;
      
    } catch (error) {
      console.error(`❌ 変換失敗: ${player.player_id}`, error);
      return null;
    }
  }

  /**
   * 指定年の全プレイヤーを変換
   */
  async convertPlayersForYear(year: number): Promise<void> {
    console.log(`🚀 ${year}年プレイヤーNPB形式変換開始`);
    
    const baseballDataPlayers = await this.loadBaseballDataPlayers(year);
    if (baseballDataPlayers.length === 0) {
      console.log(`⚠️ ${year}年のデータが見つかりません`);
      return;
    }

    const outputDir = `data/npb_format_players_${year}`;
    await fs.mkdir(outputDir, { recursive: true });
    const playersDir = path.join(outputDir, 'players');
    await fs.mkdir(playersDir, { recursive: true });
    
    const convertedPlayers: NPBFormattedPlayer[] = [];
    
    // 最初の30名をサンプル変換（調整可能）
    const samplePlayers = baseballDataPlayers.slice(0, 30);
    
    for (const [index, player] of samplePlayers.entries()) {
      console.log(`\n🔄 進捗: ${index + 1}/${samplePlayers.length}`);
      
      const converted = await this.convertPlayerToNPBFormat(player);
      if (converted) {
        convertedPlayers.push(converted);
        
        const playerFile = path.join(playersDir, `${converted.player_id}.json`);
        await fs.writeFile(playerFile, JSON.stringify(converted, null, 2), 'utf-8');
      }
      
      await this.delay(800); // レート制限
    }
    
    // インデックスファイル作成
    const indexData = convertedPlayers.map(p => ({
      player_id: p.player_id,
      name: p.name,
      baseballdata_id: p.baseballdata_id
    }));
    
    const indexFile = path.join(outputDir, 'player_index.json');
    await fs.writeFile(indexFile, JSON.stringify(indexData, null, 2), 'utf-8');
    
    // レポート作成
    const report = {
      year,
      total_converted: convertedPlayers.length,
      sample_size: samplePlayers.length,
      success_rate: ((convertedPlayers.length / samplePlayers.length) * 100).toFixed(1),
      generated_at: new Date().toISOString(),
      output_directory: outputDir
    };
    
    const reportFile = path.join(outputDir, 'conversion_report.json');
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf-8');
    
    console.log(`\n🎉 ${year}年変換完了！`);
    console.log(`📊 変換結果: ${convertedPlayers.length}名成功`);
    console.log(`📁 出力先: ${outputDir}`);
  }

  /**
   * 複数年の一括変換
   */
  async convertMultipleYears(startYear: number, endYear: number): Promise<void> {
    console.log(`🌟 ${startYear}-${endYear}年一括変換開始`);
    
    for (let year = startYear; year <= endYear; year++) {
      await this.convertPlayersForYear(year);
      console.log(`✅ ${year}年完了\n`);
    }
    
    console.log(`🎯 全年度変換完了: ${startYear}-${endYear}`);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * コマンドライン引数解析
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let year: number | null = null;
  let startYear: number | null = null;
  let endYear: number | null = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--year':
        year = parseInt(args[i + 1]);
        i++;
        break;
      case '--start-year':
        startYear = parseInt(args[i + 1]);
        i++;
        break;
      case '--end-year':
        endYear = parseInt(args[i + 1]);
        i++;
        break;
      case '--help':
        console.log(`
BaseballData.jp NPB形式変換 (2011年以降データ対応)

⚠️  重要: BaseballData.jpは2011年以降のデータのみ保持
    2011年以前の入団選手は、その時現役だった場合のみデータ存在

推奨使用方法:
  # 効率的な対象年度 (2011-2025)
  npx tsx scripts/convert_baseballdata_2001_plus.ts --start-year 2011 --end-year 2025
  
  # 単一年度変換
  npx tsx scripts/convert_baseballdata_2001_plus.ts --year 2011

例:
  npx tsx scripts/convert_baseballdata_2001_plus.ts --year 2020
  npx tsx scripts/convert_baseballdata_2001_plus.ts --start-year 2015 --end-year 2025
        `);
        process.exit(0);
    }
  }

  return { year, startYear, endYear };
}

/**
 * メイン実行
 */
async function main() {
  try {
    const { year, startYear, endYear } = parseArgs();
    const converter = new BaseballDataConverter2001Plus();
    
    if (year) {
      await converter.convertPlayersForYear(year);
    } else if (startYear && endYear) {
      await converter.convertMultipleYears(startYear, endYear);
    } else {
      console.log('引数が不正です。--help でヘルプを表示');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 変換処理中にエラーが発生:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}