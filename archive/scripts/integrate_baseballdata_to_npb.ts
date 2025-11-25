#!/usr/bin/env npx tsx

/**
 * BaseballData.jp データを既存NPBプレイヤーシステムに統合
 * 
 * 目的:
 * - BaseballData.jpの豊富な統計データを既存のNPBプレイヤーIDシステムに統合
 * - IDマッピングテーブルを作成し、両システムの連携を実現
 * - 既存のプレイヤーデータベースにBaseballData.jpの詳細データを追加
 * 
 * 使用方法:
 * npx tsx scripts/integrate_baseballdata_to_npb.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { 
  BaseballDataScraper, 
  fetchPlayerSeasonData, 
  BaseballDataPlayer, 
  SeasonStats,
  SabrEyeStats,
  SplitVsTeamStats 
} from '../lib/baseballdata-scraper';

// 既存NPBシステムのインターフェース
interface NPBPlayerProfile {
  player_id: string; // NPBシステムの長いID
  name: string;
  name_kana: string;
  profile: {
    '背番号'?: string;
    '投打'?: string;
    '身長/体重'?: string;
    '生年月日'?: string;
    '出身地'?: string;
    'ドラフト'?: string;
  };
  url: string;
  stats?: any[];
}

interface PlayerIDMapping {
  npb_id: string; // NPBシステムの長いID
  baseballdata_id: string; // BaseballData.jpの7桁ID  
  name: string;
  name_kana: string;
  team: string;
  confidence_score: number; // マッチング信頼度 (0-100)
  match_method: 'exact_name' | 'fuzzy_name' | 'kana_match' | 'manual';
  updated_at: string;
}

interface EnhancedPlayerData {
  // 既存NPBデータ
  npb_data: NPBPlayerProfile;
  
  // BaseballData.jpデータ
  baseballdata_data?: {
    player_info: BaseballDataPlayer;
    season_stats?: SeasonStats;
    sabr_eye?: SabrEyeStats;
    vs_team_stats?: SplitVsTeamStats[];
    career_data?: (SeasonStats | any)[];
  };
  
  // マッピング情報
  mapping: PlayerIDMapping;
}

class BaseballDataNPBIntegrator {
  private npbPlayersDir = 'data/player_database_npb/players';
  private baseballdataDir = 'data/baseballdata_2000'; 
  private outputDir = 'data/integrated_player_database';
  private mappingFile = path.join(this.outputDir, 'player_id_mapping.json');
  
  constructor() {}

  /**
   * 既存NPBプレイヤーデータを読み込み
   */
  async loadNPBPlayers(): Promise<NPBPlayerProfile[]> {
    console.log('🏟️ NPBプレイヤーデータ読み込み中...');
    
    try {
      const files = await fs.readdir(this.npbPlayersDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const players: NPBPlayerProfile[] = [];
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.npbPlayersDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const player = JSON.parse(content) as NPBPlayerProfile;
          players.push(player);
        } catch (error) {
          console.warn(`⚠️ ファイル読み込み失敗: ${file}`, error);
        }
      }
      
      console.log(`✅ NPBプレイヤー ${players.length}名を読み込み完了`);
      return players;
      
    } catch (error) {
      console.error('❌ NPBプレイヤーデータ読み込み失敗:', error);
      return [];
    }
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
   * 名前の正規化（カタカナ→ひらがな、スペース除去など）
   */
  private normalizeName(name: string): string {
    return name
      .replace(/[ァ-ヶ]/g, match => String.fromCharCode(match.charCodeAt(0) - 0x60)) // カタカナ→ひらがな
      .replace(/[\s　]/g, '') // スペース除去
      .toLowerCase();
  }

  /**
   * 選手名マッチング（複数のアルゴリズムを使用）
   */
  private matchPlayerNames(npbPlayer: NPBPlayerProfile, baseballdataPlayer: BaseballDataPlayer): {
    confidence: number;
    method: PlayerIDMapping['match_method'];
  } {
    const npbName = this.normalizeName(npbPlayer.name);
    const npbKana = this.normalizeName(npbPlayer.name_kana);
    
    // BaseballData.jpの名前をクリーンアップ（年度情報等を除去）
    const bdName = this.normalizeName(
      baseballdataPlayer.name
        .replace(/^\d+年度\s*/, '') // 年度情報除去
        .replace(/【.*】.*/, '') // チーム情報除去
        .split(/[\s　]/)[0] || '' // 最初の名前部分のみ
    );

    // 1. 完全一致
    if (npbName === bdName) {
      return { confidence: 100, method: 'exact_name' };
    }

    // 2. カナ名一致  
    if (npbKana && bdName && npbKana === bdName) {
      return { confidence: 90, method: 'kana_match' };
    }

    // 3. 部分一致（姓または名）
    if (npbName.length >= 2 && bdName.length >= 2) {
      const npbParts = [npbName.slice(0, npbName.length/2), npbName.slice(npbName.length/2)];
      const bdParts = [bdName.slice(0, bdName.length/2), bdName.slice(bdName.length/2)];
      
      const matches = npbParts.filter(part => bdParts.some(bdPart => 
        part.includes(bdPart) || bdPart.includes(part)
      ));
      
      if (matches.length > 0) {
        return { confidence: 60 + (matches.length * 15), method: 'fuzzy_name' };
      }
    }

    return { confidence: 0, method: 'manual' };
  }

  /**
   * プレイヤーIDマッピングを作成
   */
  async createPlayerMapping(
    npbPlayers: NPBPlayerProfile[], 
    baseballdataPlayers: BaseballDataPlayer[]
  ): Promise<PlayerIDMapping[]> {
    console.log('🔗 プレイヤーIDマッピング作成中...');
    
    const mappings: PlayerIDMapping[] = [];
    
    for (const npbPlayer of npbPlayers) {
      let bestMatch: {
        player: BaseballDataPlayer;
        confidence: number;
        method: PlayerIDMapping['match_method'];
      } | null = null;

      // 各BaseballData.jp選手との類似度を計算
      for (const bdPlayer of baseballdataPlayers) {
        const matchResult = this.matchPlayerNames(npbPlayer, bdPlayer);
        
        if (matchResult.confidence > (bestMatch?.confidence || 0)) {
          bestMatch = {
            player: bdPlayer,
            confidence: matchResult.confidence,
            method: matchResult.method
          };
        }
      }

      // 信頼度が閾値以上の場合のみマッピング作成
      if (bestMatch && bestMatch.confidence >= 60) {
        const mapping: PlayerIDMapping = {
          npb_id: npbPlayer.player_id,
          baseballdata_id: bestMatch.player.player_id,
          name: npbPlayer.name,
          name_kana: npbPlayer.name_kana,
          team: bestMatch.player.team || '',
          confidence_score: bestMatch.confidence,
          match_method: bestMatch.method,
          updated_at: new Date().toISOString()
        };
        
        mappings.push(mapping);
        console.log(`✅ マッピング作成: ${npbPlayer.name} → ${bestMatch.player.name} (信頼度: ${bestMatch.confidence}%)`);
      } else {
        console.log(`⚠️ マッチング失敗: ${npbPlayer.name} (最高信頼度: ${bestMatch?.confidence || 0}%)`);
      }
    }
    
    console.log(`🎯 ${mappings.length}件のマッピングを作成完了`);
    return mappings;
  }

  /**
   * 統合データを作成
   */
  async createEnhancedPlayerData(
    mappings: PlayerIDMapping[], 
    npbPlayers: NPBPlayerProfile[]
  ): Promise<EnhancedPlayerData[]> {
    console.log('🌟 統合プレイヤーデータ作成中...');
    
    const enhancedData: EnhancedPlayerData[] = [];
    const scraper = new BaseballDataScraper();
    
    for (const mapping of mappings) {
      const npbPlayer = npbPlayers.find(p => p.player_id === mapping.npb_id);
      if (!npbPlayer) continue;

      console.log(`📊 詳細データ取得中: ${mapping.name} (${mapping.baseballdata_id})`);
      
      try {
        // BaseballData.jpから詳細データを取得
        const baseballdataData = await fetchPlayerSeasonData(mapping.baseballdata_id);
        
        const enhanced: EnhancedPlayerData = {
          npb_data: npbPlayer,
          baseballdata_data: {
            player_info: baseballdataData.player || {} as BaseballDataPlayer,
            season_stats: baseballdataData.seasonStats || undefined,
            sabr_eye: baseballdataData.sabrEye || undefined,
            vs_team_stats: baseballdataData.vsTeamStats || [],
            career_data: [] // キャリアデータは別途取得可能
          },
          mapping
        };
        
        enhancedData.push(enhanced);
        console.log(`✅ 統合完了: ${mapping.name}`);
        
        // レート制限
        await this.delay(1000);
        
      } catch (error) {
        console.error(`❌ データ取得失敗: ${mapping.name}`, error);
        
        // エラーの場合でもNPBデータのみで統合データを作成
        const enhanced: EnhancedPlayerData = {
          npb_data: npbPlayer,
          mapping
        };
        enhancedData.push(enhanced);
      }
    }
    
    console.log(`🎉 ${enhancedData.length}名の統合データ作成完了`);
    return enhancedData;
  }

  /**
   * 統合データを保存
   */
  async saveIntegratedData(
    mappings: PlayerIDMapping[],
    enhancedData: EnhancedPlayerData[]
  ): Promise<void> {
    console.log('💾 統合データ保存中...');
    
    await fs.mkdir(this.outputDir, { recursive: true });
    
    // 1. マッピングテーブル保存
    await fs.writeFile(
      this.mappingFile,
      JSON.stringify(mappings, null, 2),
      'utf-8'
    );
    
    // 2. 統合データを個別ファイルとして保存
    const enhancedDir = path.join(this.outputDir, 'enhanced_players');
    await fs.mkdir(enhancedDir, { recursive: true });
    
    for (const data of enhancedData) {
      const filename = `${data.npb_data.player_id}.json`;
      const filepath = path.join(enhancedDir, filename);
      
      await fs.writeFile(
        filepath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    }
    
    // 3. サマリーレポート作成
    const report = {
      total_npb_players: enhancedData.length,
      mapped_players: mappings.length,
      mapping_success_rate: ((mappings.length / enhancedData.length) * 100).toFixed(1),
      confidence_distribution: {
        high_confidence: mappings.filter(m => m.confidence_score >= 90).length,
        medium_confidence: mappings.filter(m => m.confidence_score >= 70 && m.confidence_score < 90).length,
        low_confidence: mappings.filter(m => m.confidence_score < 70).length
      },
      method_distribution: {
        exact_name: mappings.filter(m => m.match_method === 'exact_name').length,
        kana_match: mappings.filter(m => m.match_method === 'kana_match').length,
        fuzzy_name: mappings.filter(m => m.match_method === 'fuzzy_name').length,
        manual: mappings.filter(m => m.match_method === 'manual').length
      },
      generated_at: new Date().toISOString()
    };
    
    const reportFile = path.join(this.outputDir, 'integration_report.json');
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2), 'utf-8');
    
    console.log(`✅ 統合データ保存完了:`);
    console.log(`  - マッピング: ${this.mappingFile}`);
    console.log(`  - 統合データ: ${enhancedDir}/`);
    console.log(`  - レポート: ${reportFile}`);
    console.log(`📊 マッピング成功率: ${report.mapping_success_rate}%`);
  }

  /**
   * メイン統合プロセス
   */
  async integrate(): Promise<void> {
    try {
      console.log('🚀 BaseballData.jp → NPB統合プロセス開始');
      
      // 1. データ読み込み
      const npbPlayers = await this.loadNPBPlayers();
      const baseballdataPlayers = await this.loadBaseballDataPlayers();
      
      if (npbPlayers.length === 0) {
        throw new Error('NPBプレイヤーデータが見つかりません');
      }
      
      if (baseballdataPlayers.length === 0) {
        throw new Error('BaseballData.jpプレイヤーデータが見つかりません');
      }
      
      // 2. マッピング作成
      const mappings = await this.createPlayerMapping(npbPlayers, baseballdataPlayers);
      
      // 3. 統合データ作成
      const enhancedData = await this.createEnhancedPlayerData(mappings, npbPlayers);
      
      // 4. データ保存
      await this.saveIntegratedData(mappings, enhancedData);
      
      console.log('🎉 統合プロセス完了！');
      
    } catch (error) {
      console.error('❌ 統合プロセス失敗:', error);
      throw error;
    }
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
    const integrator = new BaseballDataNPBIntegrator();
    await integrator.integrate();
    
  } catch (error) {
    console.error('❌ 統合処理中にエラーが発生:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}