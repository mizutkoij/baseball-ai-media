#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { DedupeRegistry } from '../registry/dedupe_registry';
import { GameMeta, BoxScore, calculateQualityScore, validateGameData, SourceScore } from './dedupe_merge';

export interface IngestConfig {
  mode: 'live' | 'recent' | 'archive';
  date?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export interface DataProvider {
  name: string;
  reliability: number;
  fetchGames(date: string): Promise<ProviderGameData[]>;
}

export interface ProviderGameData {
  providerGameId: string;
  meta: GameMeta;
  boxScore?: BoxScore;
  rawData?: any;
}

export class DayIngestor {
  private registry: DedupeRegistry;
  private providers: DataProvider[] = [];
  private config: IngestConfig;
  
  constructor(config: IngestConfig) {
    this.config = config;
    this.registry = new DedupeRegistry();
    this.initializeProviders();
  }
  
  private initializeProviders() {
    // NPB公式データプロバイダー（模擬）
    this.providers.push({
      name: 'npb_official',
      reliability: 0.95,
      fetchGames: this.fetchNPBOfficialGames.bind(this)
    });
    
    // Yahoo! スポーツプロバイダー（模擬）
    this.providers.push({
      name: 'yahoo_sports',
      reliability: 0.85,
      fetchGames: this.fetchYahooSportsGames.bind(this)
    });
    
    // 自前データプロバイダー
    this.providers.push({
      name: 'internal_db',
      reliability: 0.90,
      fetchGames: this.fetchInternalGames.bind(this)
    });
  }
  
  /**
   * 指定された日付のデータを収集・統合
   */
  async ingestDay(date: string): Promise<{
    processed: number;
    conflicts: number;
    lowQuality: number;
    errors: string[];
  }> {
    const log = this.createLogger(date);
    const results = {
      processed: 0,
      conflicts: 0,
      lowQuality: 0,
      errors: [] as string[]
    };
    
    log(`🔄 Starting ingest for ${date} (mode: ${this.config.mode})`);
    
    try {
      // 各プロバイダーからデータを取得
      const allProviderData: Array<{
        provider: DataProvider;
        games: ProviderGameData[];
      }> = [];
      
      for (const provider of this.providers) {
        try {
          log(`📡 Fetching from ${provider.name}...`);
          const games = await provider.fetchGames(date);
          allProviderData.push({ provider, games });
          log(`✅ Got ${games.length} games from ${provider.name}`);
        } catch (error) {
          const errorMsg = `Failed to fetch from ${provider.name}: ${error}`;
          log(`❌ ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }
      
      // データを統合・重複排除
      const gameMap = new Map<string, {
        canonicalGameId: string;
        sources: Array<{
          provider: DataProvider;
          data: ProviderGameData;
        }>;
      }>();
      
      // ステージング領域に保存
      for (const { provider, games } of allProviderData) {
        for (const gameData of games) {
          this.saveToStaging(provider.name, date, gameData);
          
          // 重複排除レジストリに登録
          const sourceScore: SourceScore = {
            source: provider.name,
            reliability: provider.reliability,
            timestamp: new Date().toISOString(),
            conflicts: []
          };
          
          const canonicalGameId = this.registry.registerGame(
            gameData.meta,
            gameData.providerGameId,
            provider.name,
            sourceScore,
            gameData.rawData
          );
          
          // ゲームマップに追加
          if (!gameMap.has(canonicalGameId)) {
            gameMap.set(canonicalGameId, {
              canonicalGameId,
              sources: []
            });
          }
          
          gameMap.get(canonicalGameId)!.sources.push({
            provider,
            data: gameData
          });
        }
      }
      
      // 統合データを生成・保存
      for (const [canonicalGameId, gameInfo] of gameMap) {
        try {
          const mergedData = this.mergeGameSources(gameInfo.sources);
          const qualityScore = calculateQualityScore(mergedData.meta, mergedData.boxScore);
          
          // 品質チェック
          const validation = validateGameData(mergedData.meta, mergedData.boxScore);
          if (!validation.valid) {
            log(`⚠️ Quality issues in ${canonicalGameId}: ${validation.errors.join(', ')}`);
            results.errors.push(...validation.errors.map(e => `${canonicalGameId}: ${e}`));
            
            // 品質問題をレジストリに記録
            for (const error of validation.errors) {
              this.registry.logQualityIssue(canonicalGameId, 'invalid', error, 'medium');
            }
          }
          
          if (qualityScore < 70) {
            results.lowQuality++;
            log(`🟡 Low quality score (${qualityScore}) for ${canonicalGameId}`);
          }
          
          if (gameInfo.sources.length > 1) {
            results.conflicts++;
            log(`🔀 Merged ${gameInfo.sources.length} sources for ${canonicalGameId}`);
          }
          
          // 最終データを保存
          this.saveFinalData(canonicalGameId, mergedData, qualityScore);
          results.processed++;
          
        } catch (error) {
          const errorMsg = `Failed to merge ${canonicalGameId}: ${error}`;
          log(`❌ ${errorMsg}`);
          results.errors.push(errorMsg);
        }
      }
      
      log(`✅ Ingest completed: ${results.processed} games processed`);
      
    } catch (error) {
      const errorMsg = `Ingest failed: ${error}`;
      log(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
    }
    
    // 結果をレポートファイルに保存
    this.saveIngestReport(date, results);
    
    return results;
  }
  
  /**
   * 複数ソースからゲームデータをマージ
   */
  private mergeGameSources(sources: Array<{
    provider: DataProvider;
    data: ProviderGameData;
  }>): { meta: GameMeta; boxScore?: BoxScore } {
    if (sources.length === 1) {
      return {
        meta: sources[0].data.meta,
        boxScore: sources[0].data.boxScore
      };
    }
    
    // 最も信頼度の高いソースをベースとし、欠損データを他ソースで補完
    const sortedSources = sources.sort((a, b) => b.provider.reliability - a.provider.reliability);
    const baseMeta = { ...sortedSources[0].data.meta };
    const baseBoxScore = sortedSources[0].data.boxScore ? { ...sortedSources[0].data.boxScore } : undefined;
    
    // 欠損フィールドを他のソースで補完
    for (let i = 1; i < sortedSources.length; i++) {
      const source = sortedSources[i].data;
      
      // メタデータの補完
      if (!baseMeta.venue && source.meta.venue) baseMeta.venue = source.meta.venue;
      if (!baseMeta.start && source.meta.start) baseMeta.start = source.meta.start;
      
      // ボックススコアの補完
      if (!baseBoxScore && source.boxScore) {
        // 基本スコア情報のみコピー（選手データは複雑なので最高信頼度ソースのみ使用）
        // baseBoxScore = { ...source.boxScore };
      }
    }
    
    return { meta: baseMeta, boxScore: baseBoxScore };
  }
  
  /**
   * データをステージング領域に保存
   */
  private saveToStaging(providerName: string, date: string, gameData: ProviderGameData) {
    if (this.config.dryRun) return;
    
    const stagingDir = path.join(__dirname, '../staging', providerName, date);
    if (!existsSync(stagingDir)) {
      mkdirSync(stagingDir, { recursive: true });
    }
    
    const filePath = path.join(stagingDir, `${gameData.providerGameId}.json`);
    const stageData = {
      ...gameData,
      staged_at: new Date().toISOString(),
      provider: providerName
    };
    
    writeFileSync(filePath, JSON.stringify(stageData, null, 2));
  }
  
  /**
   * 最終統合データを保存
   */
  private saveFinalData(
    canonicalGameId: string, 
    mergedData: { meta: GameMeta; boxScore?: BoxScore },
    qualityScore: number
  ) {
    if (this.config.dryRun) return;
    
    const dataDir = path.join(__dirname, '../data/games', canonicalGameId);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    
    // メタデータファイル
    writeFileSync(
      path.join(dataDir, 'meta.json'),
      JSON.stringify({
        ...mergedData.meta,
        quality_score: qualityScore,
        updated_at: new Date().toISOString()
      }, null, 2)
    );
    
    // ボックススコアファイル
    if (mergedData.boxScore) {
      writeFileSync(
        path.join(dataDir, 'box.json'),
        JSON.stringify(mergedData.boxScore, null, 2)
      );
    }
    
    // キープレイ用のプレースホルダー（将来実装）
    const keyPlaysPath = path.join(dataDir, 'keyplays.json');
    if (!existsSync(keyPlaysPath)) {
      writeFileSync(keyPlaysPath, JSON.stringify({ plays: [] }, null, 2));
    }
  }
  
  /**
   * インジェストレポートを保存
   */
  private saveIngestReport(date: string, results: any) {
    if (this.config.dryRun) return;
    
    const reportDir = path.join(__dirname, '../../.reports/ingest');
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }
    
    const report = {
      date,
      mode: this.config.mode,
      timestamp: new Date().toISOString(),
      ...results,
      registry_stats: this.registry.getStats()
    };
    
    // JSONL形式で追記
    const reportLine = JSON.stringify(report) + '\n';
    writeFileSync(
      path.join(reportDir, `${date}.jsonl`),
      reportLine,
      { flag: 'a' }
    );
  }
  
  /**
   * ロガーを作成
   */
  private createLogger(date: string) {
    return (message: string) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${date}] ${message}`;
      
      if (this.config.verbose) {
        console.log(logMessage);
      }
      
      // ログファイルに記録（オプション）
      // writeFileSync(logPath, logMessage + '\n', { flag: 'a' });
    };
  }
  
  /**
   * 模擬NPB公式データ取得
   */
  private async fetchNPBOfficialGames(date: string): Promise<ProviderGameData[]> {
    // 実際の実装では NPB.jp のAPIまたはスクレイピング
    return this.generateMockGames(date, 'npb_official');
  }
  
  /**
   * 模擬Yahoo!スポーツデータ取得
   */
  private async fetchYahooSportsGames(date: string): Promise<ProviderGameData[]> {
    // 実際の実装では Yahoo! スポーツのAPIまたはスクレイピング
    return this.generateMockGames(date, 'yahoo_sports');
  }
  
  /**
   * 内部データベースからデータ取得
   */
  private async fetchInternalGames(date: string): Promise<ProviderGameData[]> {
    // 既存のserver-data-collectorの結果を利用
    try {
      const { query } = await import('../../lib/db');
      const games = await query(`
        SELECT * FROM games 
        WHERE date = ? 
        ORDER BY game_id
      `, [date]);
      
      return games.map((game: any) => ({
        providerGameId: game.game_id,
        meta: {
          gameId: game.game_id,
          dateISO: game.date,
          venue: game.venue,
          league: game.league as 'central' | 'pacific',
          status: game.status as 'scheduled' | 'live' | 'finished',
          home: { id: game.home_team, name: game.home_team },
          away: { id: game.away_team, name: game.away_team },
          start: game.start_time_jst
        },
        boxScore: game.home_score !== null ? {
          gameId: game.game_id,
          teams: {
            home: { runs: game.home_score || 0, hits: 0, errors: 0 },
            away: { runs: game.away_score || 0, hits: 0, errors: 0 }
          },
          players: { home: [], away: [] },
          pitchers: { home: [], away: [] }
        } : undefined,
        rawData: game
      }));
    } catch (error) {
      console.warn('Failed to fetch from internal DB:', error);
      return [];
    }
  }
  
  /**
   * 模擬データ生成（テスト用）
   */
  private generateMockGames(date: string, provider: string): ProviderGameData[] {
    const teams = ['巨人', 'ヤクルト', '阪神', '広島', 'DeNA', '中日', 'ソフトバンク', '日本ハム'];
    const games: ProviderGameData[] = [];
    
    // 日付に基づいて試合数を決定（土日は多め）
    const dayOfWeek = new Date(date).getDay();
    const gameCount = (dayOfWeek === 0 || dayOfWeek === 6) ? 6 : 3;
    
    for (let i = 0; i < gameCount; i++) {
      const homeTeam = teams[Math.floor(Math.random() * teams.length)];
      let awayTeam = teams[Math.floor(Math.random() * teams.length)];
      while (awayTeam === homeTeam) {
        awayTeam = teams[Math.floor(Math.random() * teams.length)];
      }
      
      const gameId = `${date.replace(/-/g, '')}_${provider}_${i + 1}`;
      
      games.push({
        providerGameId: gameId,
        meta: {
          gameId,
          dateISO: date,
          venue: `${homeTeam}本拠地`,
          league: ['巨人', 'ヤクルト', '阪神'].includes(homeTeam) ? 'central' : 'pacific',
          status: Math.random() > 0.5 ? 'finished' : 'scheduled',
          home: { id: homeTeam, name: homeTeam },
          away: { id: awayTeam, name: awayTeam },
          start: `${date}T18:00:00+09:00`
        }
      });
    }
    
    return games;
  }
  
  /**
   * リソースクリーンアップ
   */
  cleanup() {
    this.registry.close();
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  const mode = (args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'recent') as 'live' | 'recent' | 'archive';
  const date = args.find(arg => arg.startsWith('--date='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  
  const config: IngestConfig = { mode, date, dryRun, verbose };
  const ingestor = new DayIngestor(config);
  
  try {
    let targetDates: string[] = [];
    
    switch (mode) {
      case 'live':
        // 今日と昨日
        targetDates = [
          new Date().toISOString().slice(0, 10),
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        ];
        break;
        
      case 'recent':
        // 直近3日
        for (let i = 0; i < 3; i++) {
          targetDates.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
        }
        break;
        
      case 'archive':
        if (date) {
          targetDates = [date];
        } else {
          // 30日前から180日前までの範囲で1日
          const daysAgo = 30 + Math.floor(Math.random() * 150);
          targetDates = [new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)];
        }
        break;
    }
    
    let totalProcessed = 0;
    let totalErrors = 0;
    
    for (const targetDate of targetDates) {
      const results = await ingestor.ingestDay(targetDate);
      totalProcessed += results.processed;
      totalErrors += results.errors.length;
      
      console.log(`📅 ${targetDate}: ${results.processed} games, ${results.conflicts} conflicts, ${results.lowQuality} low-quality`);
      
      if (results.errors.length > 0) {
        console.log(`⚠️ Errors: ${results.errors.length}`);
        if (verbose) {
          results.errors.forEach(error => console.log(`   ${error}`));
        }
      }
    }
    
    console.log(`\n✅ Total: ${totalProcessed} games processed across ${targetDates.length} dates`);
    if (totalErrors > 0) {
      console.log(`⚠️ Total errors: ${totalErrors}`);
    }
    
  } catch (error) {
    console.error('❌ Ingest failed:', error);
    process.exit(1);
  } finally {
    ingestor.cleanup();
  }
}

if (require.main === module) {
  main().catch(console.error);
}