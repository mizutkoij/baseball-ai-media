/**
 * NPBデータ検証・正規化システム
 * 
 * 機能:
 * - スクレイピングデータの整合性チェック
 * - データ重複除去
 * - フォーマット正規化
 * - エラーレポート生成
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { DataMetrics } from '../types/npb';
import { 
  validateStarters, 
  validateKeyPlays, 
  validateGames, 
  type StarterRecord, 
  type KeyPlay, 
  type ValidationResult, 
  type TeamId 
} from './schemas';
import { validationResults } from './prometheus-metrics';
import { logger } from './logger';

// ValidationResult and DataMetrics are now imported from ../types/npb

export class NPBDataValidator {
  
  // 予告先発データの検証（Zod統合）
  async validateStarters(starters: StarterRecord[]): Promise<ValidationResult> {
    const zodResult = validateStarters(starters);
    
    // メトリクス記録
    try {
      validationResults.inc({ type: 'starters', result: 'valid' }, zodResult.valid.length);
      validationResults.inc({ type: 'starters', result: 'error' }, zodResult.invalid.length);
    } catch (error) {
      // メトリクスが利用できない場合は無視
      logger.debug({ error: String(error) }, 'Metrics not available');
    }
    
    // ログ出力
    logger.debug({
      component: 'data-validator',
      validationRate: zodResult.summary.validationRate,
      total: zodResult.summary.total,
      valid: zodResult.summary.valid,
      invalid: zodResult.summary.invalid,
    }, 'Starters validation completed');

    const result: ValidationResult = {
      isValid: zodResult.invalid.length === 0,
      warnings: [],
      errors: zodResult.invalid.map(item => 
        `Validation error: ${item.error.issues.map(i => i.message).join(', ')}`
      ),
      fixedIssues: [],
      dataQuality: this.calculateDataQuality(zodResult.summary.validationRate),
    };

    const metrics: DataMetrics = {
      totalItems: zodResult.summary.total,
      validItems: zodResult.summary.valid,
      duplicateItems: 0, // TODO: 重複検出ロジック
      incompleteItems: zodResult.summary.invalid,
      errorRate: 1 - zodResult.summary.validationRate,
    };

    // 重複チェック
    const seen = new Set<string>();
    const duplicates: string[] = [];
    
    for (let i = 0; i < starters.length; i++) {
      const starter = starters[i];
      const key = `${starter.gameId}-${starter.date}`;
      
      if (seen.has(key)) {
        duplicates.push(key);
        metrics.duplicateItems++;
      } else {
        seen.add(key);
      }

      // 必須項目チェック
      if (!starter.gameId) {
        result.errors.push(`Row ${i}: gameId is missing`);
        result.isValid = false;
        continue;
      }

      if (!starter.date || !this.isValidDate(starter.date)) {
        result.errors.push(`Row ${i}: Invalid date format: ${starter.date}`);
        result.isValid = false;
        continue;
      }

      if (!starter.home || !starter.away) {
        result.errors.push(`Row ${i}: Team information missing`);
        result.isValid = false;
        continue;
      }

      // チーム名正規化
      starter.home = this.normalizeTeamId(starter.home);
      starter.away = this.normalizeTeamId(starter.away);

      // 投手情報検証
      let hasValidPitcher = false;
      
      if (starter.homePitcher?.name) {
        starter.homePitcher.name = this.normalizePlayerName(starter.homePitcher.name);
        hasValidPitcher = true;
        
        // ERA値検証
        if (starter.homePitcher.era && (starter.homePitcher.era < 0 || starter.homePitcher.era > 20)) {
          result.warnings.push(`Row ${i}: Suspicious ERA value for home pitcher: ${starter.homePitcher.era}`);
        }
      }

      if (starter.awayPitcher?.name) {
        starter.awayPitcher.name = this.normalizePlayerName(starter.awayPitcher.name);
        hasValidPitcher = true;
        
        if (starter.awayPitcher.era && (starter.awayPitcher.era < 0 || starter.awayPitcher.era > 20)) {
          result.warnings.push(`Row ${i}: Suspicious ERA value for away pitcher: ${starter.awayPitcher.era}`);
        }
      }

      if (!hasValidPitcher) {
        result.warnings.push(`Row ${i}: No pitcher information available`);
        metrics.incompleteItems++;
      } else {
        metrics.validItems++;
      }

      // 信頼度チェック
      if (!starter.confidence || starter.confidence < 0 || starter.confidence > 1) {
        starter.confidence = 0.5; // デフォルト値
        result.fixedIssues.push(`Row ${i}: Fixed invalid confidence value`);
      }

      // リーグ情報チェック
      if (starter.league && !['CL', 'PL', 'interleague'].includes(starter.league)) {
        result.warnings.push(`Row ${i}: Unknown league: ${starter.league}`);
      }
    }

    // 重複除去
    if (duplicates.length > 0) {
      result.warnings.push(`Found ${duplicates.length} duplicate entries: ${duplicates.join(', ')}`);
    }

    // エラー率計算
    metrics.errorRate = (result.errors.length / metrics.totalItems) * 100;
    
    // データ品質評価
    if (metrics.errorRate === 0 && metrics.incompleteItems < metrics.totalItems * 0.1) {
      result.dataQuality = 'excellent';
    } else if (metrics.errorRate < 5 && metrics.incompleteItems < metrics.totalItems * 0.3) {
      result.dataQuality = 'good';
    } else if (metrics.errorRate < 15) {
      result.dataQuality = 'fair';
    } else {
      result.dataQuality = 'poor';
    }

    return result;
  }

  // キープレーデータの検証
  async validateKeyPlays(keyPlays: KeyPlay[]): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      fixedIssues: [],
      dataQuality: 'excellent',
    };

    for (let i = 0; i < keyPlays.length; i++) {
      const play = keyPlays[i];

      // 必須項目チェック
      if (!play.description) {
        result.errors.push(`Play ${i}: Description is missing`);
        result.isValid = false;
        continue;
      }

      if (!play.inning || play.inning < 1 || play.inning > 15) {
        result.errors.push(`Play ${i}: Invalid inning: ${play.inning}`);
        result.isValid = false;
        continue;
      }

      if (!play.half || !['top', 'bottom'].includes(play.half)) {
        result.errors.push(`Play ${i}: Invalid half: ${play.half}`);
        result.isValid = false;
        continue;
      }

      if (!play.team) {
        result.errors.push(`Play ${i}: Team is missing`);
        result.isValid = false;
        continue;
      }

      // チーム名正規化
      play.team = this.normalizeTeamId(play.team);

      // WPA値検証
      if (play.wpa && (play.wpa < -1 || play.wpa > 1)) {
        result.warnings.push(`Play ${i}: WPA value outside valid range: ${play.wpa}`);
      }

      // RE24値検証
      if (play.re24 && (play.re24 < -5 || play.re24 > 5)) {
        result.warnings.push(`Play ${i}: RE24 value seems extreme: ${play.re24}`);
      }

      // レバレッジ値検証
      if (play.leverage && (play.leverage < 0 || play.leverage > 10)) {
        result.warnings.push(`Play ${i}: Leverage value seems extreme: ${play.leverage}`);
      }
    }

    // データ品質評価
    const errorRate = (result.errors.length / keyPlays.length) * 100;
    
    if (errorRate === 0 && result.warnings.length < keyPlays.length * 0.1) {
      result.dataQuality = 'excellent';
    } else if (errorRate < 5 && result.warnings.length < keyPlays.length * 0.3) {
      result.dataQuality = 'good';
    } else if (errorRate < 15) {
      result.dataQuality = 'fair';
    } else {
      result.dataQuality = 'poor';
    }

    return result;
  }

  // データファイルの自動修復
  async repairDataFile(filepath: string, dataType: 'starters' | 'keyplays'): Promise<ValidationResult> {
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const data = JSON.parse(content);
      
      let validationResult: ValidationResult;
      
      if (dataType === 'starters' && data.items) {
        validationResult = await this.validateStarters(data.items);
        
        if (validationResult.fixedIssues.length > 0) {
          // 修復されたデータを保存
          await fs.writeFile(filepath, JSON.stringify(data, null, 2));
        }
        
      } else if (dataType === 'keyplays' && (data.items || Array.isArray(data))) {
        const keyPlays = Array.isArray(data) ? data : data.items;
        validationResult = await this.validateKeyPlays(keyPlays);
        
      } else {
        throw new Error(`Unknown data type or invalid format: ${dataType}`);
      }
      
      return validationResult;
      
    } catch (error) {
      return {
        isValid: false,
        warnings: [],
        errors: [`Failed to repair file: ${error}`],
        fixedIssues: [],
        dataQuality: 'poor',
      };
    }
  }

  // バッチ検証（ディレクトリ全体）
  async validateDirectory(dirPath: string, dataType: 'starters' | 'keyplays'): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    try {
      const files = await fs.readdir(dirPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filepath = path.join(dirPath, file);
        console.log(`🔍 検証中: ${file}`);
        
        const result = await this.repairDataFile(filepath, dataType);
        results.push(result);
        
        // 検証結果のサマリー表示
        const status = result.isValid ? '✅' : '❌';
        const quality = result.dataQuality;
        console.log(`  ${status} ${file} - 品質: ${quality} (エラー: ${result.errors.length}, 警告: ${result.warnings.length})`);
      }
      
    } catch (error) {
      console.error(`Failed to validate directory ${dirPath}:`, error);
    }
    
    return results;
  }
  
  private calculateDataQuality(validationRate: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (validationRate >= 0.95) return 'excellent';
    if (validationRate >= 0.85) return 'good';
    if (validationRate >= 0.70) return 'fair';
    return 'poor';
  }

  // ヘルパーメソッド
  private isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime()) && !!dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  }

  private normalizeTeamId(teamId: string): TeamId {
    const teamMap: Record<string, TeamId> = {
      '巨人': 'G', '読売': 'G', 'ジャイアンツ': 'G',
      '阪神': 'T', 'タイガース': 'T',
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

    return teamMap[teamId] || (teamId as TeamId);
  }

  private normalizePlayerName(name: string): string {
    return name
      .replace(/\s+/g, ' ')
      .replace(/[（(].*?[）)]/g, '')
      .trim();
  }
}

// CLI実行時の処理
async function main() {
  const args = process.argv.slice(2);
  const validator = new NPBDataValidator();

  if (args.length < 2) {
    console.log('使用方法: npx tsx lib/data-validator.ts <directory> <type>');
    console.log('例: npx tsx lib/data-validator.ts data/starters starters');
    process.exit(1);
  }

  const [dirPath, dataType] = args;
  
  if (!['starters', 'keyplays'].includes(dataType)) {
    console.log('エラー: データタイプは starters または keyplays を指定してください');
    process.exit(1);
  }

  console.log(`🔍 ディレクトリ検証開始: ${dirPath} (${dataType})`);
  
  const results = await validator.validateDirectory(dirPath, dataType as 'starters' | 'keyplays');
  
  // サマリー表示
  const totalFiles = results.length;
  const validFiles = results.filter(r => r.isValid).length;
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  
  console.log('\n📊 検証結果サマリー:');
  console.log(`  ファイル数: ${totalFiles}`);
  console.log(`  有効ファイル: ${validFiles}`);
  console.log(`  エラー数: ${totalErrors}`);
  console.log(`  警告数: ${totalWarnings}`);
  
  const successRate = (validFiles / totalFiles) * 100;
  console.log(`  成功率: ${successRate.toFixed(1)}%`);
}

if (require.main === module) {
  main().catch(console.error);
}

export type { ValidationResult, DataMetrics };