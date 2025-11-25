#!/usr/bin/env npx tsx

/**
 * BaseballData.jpデータを既存NPBプレイヤーID形式に変換
 * 
 * あなたのID形式: {league_code}{entry_year_code:3桁}{nationality_code}{position_code}{birth_date_code:8桁}{initial_code}
 * BaseballData.jpのID: 2000056 (入団年4桁+連番3桁)
 * 
 * 目的: 
 * - BaseballData.jpの豊富な統計データを既存のNPBシステム形式に変換
 * - 互換性のあるプレイヤーIDを生成
 * - 既存システムに直接統合可能な形式で出力
 * 
 * 使用方法:
 * npx tsx scripts/convert_baseballdata_to_npb_format.ts
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
  player_id: string; // 新しく生成するNPB形式ID
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
  
  // Sabrメトリクス (BaseballData.jpから取得)
  babip?: number;
  isop?: number;
  bb_k?: number;
  contact_rate?: number;
  swing_rate?: number;
  chase_rate?: number;
  gpa?: number;
  noi?: number;
  
  // データソース識別
  data_source: 'baseballdata_jp';
  enhanced_metrics: boolean;
}

class BaseballDataToNPBConverter {
  private baseballdataDir = 'data/baseballdata_2000';
  private outputDir = 'data/npb_format_players';
  
  // あなたのシステムのKANA_MAP再現
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
   * BaseballData.jpのプレイヤー情報からNPB形式IDを生成
   */
  private generateNPBPlayerID(player: BaseballDataPlayer, seasonStats?: SeasonStats): string {
    // league_code: とりあえず'1'(セントラル)または'2'(パシフィック)  
    const leagueCode = this.inferLeagueFromTeam(player.team || '') || '0';
    
    // entry_year_code: BaseballData.jp IDから入団年を抽出 (2000056 → 2000)
    const entryYearCode = player.player_id.substring(0, 4);
    const entryYearLast3 = entryYearCode.slice(-3); // 下3桁
    
    // nationality_code: 名前から日本人(1)か外国人(2)かを推定
    const nationalityCode = this.inferNationality(player.name);
    
    // position_code: 投手(1)か野手(2)かを判定
    const positionCode = player.player_type === 'pitcher' ? '1' : '2';
    
    // birth_date_code: 生年月日不明なので仮の値
    const birthDateCode = '19900101'; // デフォルト値
    
    // initial_code: 名前の読み仮名頭文字をコード化
    const cleanedName = this.cleanPlayerName(player.name);
    const initialCode = this.getInitialCode(cleanedName);
    
    return `${leagueCode}${entryYearLast3}${nationalityCode}${positionCode}${birthDateCode}${initialCode}`;
  }

  /**
   * チーム名からリーグを推定
   */
  private inferLeagueFromTeam(team: string): string {
    const centralTeams = ['巨人', '阪神', '中日', '広島', 'ヤクルト', 'ベイスターズ'];
    const pacificTeams = ['ソフトバンク', 'ロッテ', '日ハム', '楽天', 'オリックス', '西武'];
    
    if (centralTeams.some(t => team.includes(t))) return '1';
    if (pacificTeams.some(t => team.includes(t))) return '2';
    return '0'; // 不明
  }

  /**
   * 名前から国籍を推定
   */
  private inferNationality(name: string): string {
    // 英字が含まれていれば外国人と推定
    return /[a-zA-Z]/.test(name) ? '2' : '1';
  }

  /**
   * プレイヤー名のクリーンアップ
   */
  private cleanPlayerName(name: string): string {
    return name
      .replace(/^\d+年度\s*/, '') // 年度除去
      .replace(/【.*】.*$/, '') // チーム情報除去
      .trim()
      .split(/[\s　]/)[0] || ''; // 最初の名前のみ
  }

  /**
   * 名前頭文字からコードを取得
   */
  private getInitialCode(name: string): string {
    if (!name) return 'X';
    
    // カタカナをひらがなに変換
    const hiragana = name.replace(/[ァ-ヶ]/g, match => 
      String.fromCharCode(match.charCodeAt(0) - 0x60)
    );
    
    const firstChar = hiragana[0];
    return this.kanaMap[firstChar] || 'X';
  }

  /**
   * BaseballData.jpプレイヤーデータを読み込み
   */
  async loadBaseballDataPlayers(): Promise<BaseballDataPlayer[]> {
    console.log('⚾ BaseballData.jpプレイヤーデータ読み込み中...');
    
    try {
      const playersFile = path.join(this.baseballdataDir, 'players_2000.json');
      const content = await fs.readFile(playersFile, 'utf-8');
      const players = JSON.parse(content) as BaseballDataPlayer[];
      
      console.log(`✅ BaseballData.jp選手 ${players.length}名を読み込み完了`);
      return players;
      
    } catch (error) {
      console.error('❌ BaseballData.jpデータ読み込み失敗:', error);
      return [];
    }
  }

  /**
   * プレイヤーの詳細データを取得してNPB形式に変換
   */
  async convertPlayerToNPBFormat(player: BaseballDataPlayer): Promise<NPBFormattedPlayer | null> {
    try {
      console.log(`📊 変換中: ${this.cleanPlayerName(player.name)} (${player.player_id})`);
      
      // BaseballData.jpから詳細データを取得
      const detailedData = await fetchPlayerSeasonData(player.player_id);
      
      // NPB形式IDを生成
      const npbPlayerId = this.generateNPBPlayerID(player, detailedData.seasonStats || undefined);
      
      // プロファイル情報を構築
      const profile: NPBFormattedPlayer['profile'] = {
        'チーム': player.team || '',
        'ポジション': player.player_type === 'pitcher' ? '投手' : '野手',
        'ドラフト': `${player.entry_year}年ドラフト`
      };
      
      // 統計データを変換
      const enhancedStats: EnhancedStats[] = [];
      
      // 現在シーズンの基本成績
      if (detailedData.seasonStats) {
        const stats = detailedData.seasonStats;
        const basicStats: EnhancedStats = {
          year: 2025, // 現在年度
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
        };
        enhancedStats.push(basicStats);
      }
      
      // Sabrメトリクス統合
      if (detailedData.sabrEye) {
        const sabrStats: EnhancedStats = {
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
        };
        enhancedStats.push(sabrStats);
      }
      
      const converted: NPBFormattedPlayer = {
        player_id: npbPlayerId,
        baseballdata_id: player.player_id,
        name: this.cleanPlayerName(player.name),
        name_kana: '', // BaseballData.jpには読み仮名がないため空
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
   * 全プレイヤーを変換してNPB形式で保存
   */
  async convertAllPlayers(): Promise<void> {
    console.log('🚀 BaseballData.jp → NPB形式変換開始');
    
    const baseballDataPlayers = await this.loadBaseballDataPlayers();
    if (baseballDataPlayers.length === 0) {
      throw new Error('BaseballData.jpプレイヤーデータが見つかりません');
    }

    await fs.mkdir(this.outputDir, { recursive: true });
    const playersDir = path.join(this.outputDir, 'players');
    await fs.mkdir(playersDir, { recursive: true });
    
    const convertedPlayers: NPBFormattedPlayer[] = [];
    
    // サンプル数を制限してテスト (最初の20名)
    const samplePlayers = baseballDataPlayers.slice(0, 20);
    
    for (const [index, player] of samplePlayers.entries()) {
      console.log(`\n🔄 進捗: ${index + 1}/${samplePlayers.length}`);
      
      const converted = await this.convertPlayerToNPBFormat(player);
      if (converted) {
        convertedPlayers.push(converted);
        
        // 個別JSONファイルとして保存
        const playerFile = path.join(playersDir, `${converted.player_id}.json`);
        await fs.writeFile(playerFile, JSON.stringify(converted, null, 2), 'utf-8');
      }
      
      // レート制限
      await this.delay(1000);
    }
    
    // インデックスファイル作成
    const indexData = convertedPlayers.map(p => ({
      player_id: p.player_id,
      name: p.name,
      baseballdata_id: p.baseballdata_id
    }));
    
    const indexFile = path.join(this.outputDir, 'player_index.json');
    await fs.writeFile(indexFile, JSON.stringify(indexData, null, 2), 'utf-8');
    
    // 変換レポート作成
    const report = {
      total_converted: convertedPlayers.length,
      sample_size: samplePlayers.length,
      success_rate: ((convertedPlayers.length / samplePlayers.length) * 100).toFixed(1),
      player_types: {
        batters: convertedPlayers.filter(p => p.baseballdata_id.includes('B')).length,
        pitchers: convertedPlayers.filter(p => p.baseballdata_id.includes('P')).length
      },
      generated_at: new Date().toISOString(),
      output_directory: this.outputDir
    };
    
    const reportFile = path.join(this.outputDir, 'conversion_report.json');
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf-8');
    
    console.log(`\n🎉 変換完了！`);
    console.log(`📊 変換結果:`);
    console.log(`  - 変換成功: ${convertedPlayers.length}名`);
    console.log(`  - 成功率: ${report.success_rate}%`);
    console.log(`  - 出力先: ${this.outputDir}`);
    console.log(`📁 ファイル:`);
    console.log(`  - プレイヤーデータ: ${playersDir}/`);
    console.log(`  - インデックス: ${indexFile}`);
    console.log(`  - レポート: ${reportFile}`);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * メイン実行
 */
async function main() {
  try {
    const converter = new BaseballDataToNPBConverter();
    await converter.convertAllPlayers();
    
  } catch (error) {
    console.error('❌ 変換処理中にエラーが発生:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}