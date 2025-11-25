/**
 * Multi-Source Scraper - プロバイダ多重化システム
 * 
 * 機能:
 * - 複数データプロバイダからの並行取得
 * - Shadow run による突合・差分検出
 * - 自動フェイルオーバー
 * - プロバイダ固有の正規化
 */

import { logger } from './logger';
import { incrementCounter, recordHistogram } from './prometheus-metrics';
import { normalizeTeamId, normalizePlayerName } from './normalize';
import { hashRecord } from './canonical';
import type { StarterRecord, GameInfo, TeamId, League } from '../types/npb';

export interface DataProvider {
  name: string;
  priority: number;
  enabled: boolean;
  healthCheck: () => Promise<boolean>;
  fetchGames: (date: string) => Promise<GameInfo[]>;
  fetchStarters: (date: string) => Promise<StarterRecord[]>;
  fetchKeyplays?: (gameId: string) => Promise<any[]>;
}

export interface ComparisonResult {
  field: string;
  provider1: string;
  provider2: string;
  value1: any;
  value2: any;
  severity: 'info' | 'warn' | 'error';
}

export interface MultiSourceResult<T> {
  data: T[];
  primaryProvider: string;
  secondaryProvider?: string;
  differences: ComparisonResult[];
  fallbackUsed: boolean;
  timestamp: string;
}

class NPBOfficialProvider implements DataProvider {
  name = 'npb_official';
  priority = 1;
  enabled = true;

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://npb.jp/', { method: 'HEAD', timeout: 5000 });
      return response.ok;
    } catch {
      return false;
    }
  }

  async fetchGames(date: string): Promise<GameInfo[]> {
    // NPB公式サイトからの試合情報取得（既存実装を使用）
    const dateStr = date.replace(/-/g, '');
    const response = await fetch(`https://npb.jp/games/${dateStr}/`);
    
    if (!response.ok) {
      throw new Error(`NPB API error: ${response.status}`);
    }
    
    const html = await response.text();
    return this.parseGamesFromHTML(html, date);
  }

  async fetchStarters(date: string): Promise<StarterRecord[]> {
    // NPB公式サイトからの先発投手情報取得
    const games = await this.fetchGames(date);
    const starters: StarterRecord[] = [];
    
    for (const game of games) {
      try {
        const starterInfo = await this.fetchGameStarters(game);
        if (starterInfo) {
          starters.push({ 
            ...starterInfo, 
            provider: this.name,
            scrapedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.warn('Failed to fetch starter for game', {
          gameId: game.gameId,
          provider: this.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return starters;
  }

  private parseGamesFromHTML(html: string, date: string): GameInfo[] {
    // HTML解析実装（簡略版）
    return []; // 既存のパーサーロジックを移行
  }

  private async fetchGameStarters(game: GameInfo): Promise<StarterRecord | null> {
    // 先発投手詳細取得実装（簡略版）
    return null; // 既存のスクレーパーロジックを移行
  }
}

class BaseballDataProvider implements DataProvider {
  name = 'baseballdata';
  priority = 2;
  enabled = true;

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://baseballdata.jp/', { method: 'HEAD', timeout: 5000 });
      return response.ok;
    } catch {
      return false;
    }
  }

  async fetchGames(date: string): Promise<GameInfo[]> {
    // BaseballData.jp からの試合情報取得
    const response = await fetch(`https://baseballdata.jp/api/games?date=${date}`);
    
    if (!response.ok) {
      throw new Error(`BaseballData API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.games?.map((game: any) => this.normalizeGameData(game)) || [];
  }

  async fetchStarters(date: string): Promise<StarterRecord[]> {
    // BaseballData.jp からの先発投手情報取得
    const response = await fetch(`https://baseballdata.jp/api/starters?date=${date}`);
    
    if (!response.ok) {
      throw new Error(`BaseballData API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.starters?.map((starter: any) => ({
      ...this.normalizeStarterData(starter),
      provider: this.name,
      scrapedAt: new Date().toISOString()
    })) || [];
  }

  private normalizeGameData(rawGame: any): GameInfo {
    return {
      gameId: rawGame.game_id,
      date: rawGame.date,
      startTime: rawGame.start_time,
      home: normalizeTeamId(rawGame.home_team) as TeamId,
      away: normalizeTeamId(rawGame.away_team) as TeamId,
      league: this.determineLeague(rawGame.home_team, rawGame.away_team),
      venue: rawGame.venue
    };
  }

  private normalizeStarterData(rawStarter: any): Omit<StarterRecord, 'provider' | 'scrapedAt'> {
    return {
      gameId: rawStarter.game_id,
      date: rawStarter.date,
      team: normalizeTeamId(rawStarter.team) as TeamId,
      playerName: normalizePlayerName(rawStarter.pitcher_name),
      hand: rawStarter.hand === '左' ? 'L' : 'R',
      era: parseFloat(rawStarter.era) || undefined,
      wins: parseInt(rawStarter.wins) || undefined,
      losses: parseInt(rawStarter.losses) || undefined
    };
  }

  private determineLeague(homeTeam: string, awayTeam: string): League {
    // チーム名からリーグを判定（簡略実装）
    const clTeams = ['巨人', '阪神', '横浜', 'ヤクルト', '広島', '中日'];
    const isHomeCL = clTeams.some(team => homeTeam.includes(team));
    const isAwayCL = clTeams.some(team => awayTeam.includes(team));
    
    if (isHomeCL && isAwayCL) return 'CL';
    if (!isHomeCL && !isAwayCL) return 'PL';
    return 'interleague';
  }
}

export class MultiSourceScraper {
  private providers: DataProvider[] = [];
  private shadowRunEnabled = true;

  constructor() {
    this.providers = [
      new NPBOfficialProvider(),
      new BaseballDataProvider()
    ];
  }

  /**
   * 複数ソースから試合情報を取得
   */
  async fetchGamesMultiSource(date: string): Promise<MultiSourceResult<GameInfo>> {
    const correlationId = `games-${date}-${Date.now()}`;
    
    logger.info('Starting multi-source games fetch', {
      correlationId,
      date,
      providers: this.providers.map(p => ({ name: p.name, enabled: p.enabled }))
    });

    const enabledProviders = this.providers
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    if (enabledProviders.length === 0) {
      throw new Error('No enabled providers available');
    }

    let primaryData: GameInfo[] = [];
    let primaryProvider = '';
    let secondaryData: GameInfo[] = [];
    let secondaryProvider = '';
    let fallbackUsed = false;

    // Primary provider からデータ取得
    for (const provider of enabledProviders) {
      try {
        const isHealthy = await provider.healthCheck();
        if (!isHealthy) {
          logger.warn('Provider health check failed', {
            correlationId,
            provider: provider.name
          });
          continue;
        }

        const startTime = Date.now();
        primaryData = await provider.fetchGames(date);
        const duration = Date.now() - startTime;

        recordHistogram('multi_source_fetch_duration_seconds', duration / 1000, {
          provider: provider.name,
          data_type: 'games',
          result: 'success'
        });

        primaryProvider = provider.name;
        logger.info('Primary provider fetch successful', {
          correlationId,
          provider: provider.name,
          recordCount: primaryData.length,
          duration
        });
        break;

      } catch (error) {
        logger.error('Primary provider fetch failed', {
          correlationId,
          provider: provider.name,
          error: error instanceof Error ? error.message : String(error)
        });

        incrementCounter('multi_source_errors_total', {
          provider: provider.name,
          data_type: 'games',
          error_type: 'fetch_failure'
        });

        // 次のプロバイダにフォールバック
        fallbackUsed = true;
        continue;
      }
    }

    if (primaryData.length === 0) {
      throw new Error('All providers failed to fetch games data');
    }

    // Shadow run - セカンダリプロバイダからも並行取得
    let differences: ComparisonResult[] = [];
    
    if (this.shadowRunEnabled && enabledProviders.length > 1) {
      const secondaryProviderInstance = enabledProviders.find(p => p.name !== primaryProvider);
      
      if (secondaryProviderInstance) {
        try {
          const startTime = Date.now();
          secondaryData = await secondaryProviderInstance.fetchGames(date);
          const duration = Date.now() - startTime;

          recordHistogram('multi_source_fetch_duration_seconds', duration / 1000, {
            provider: secondaryProviderInstance.name,
            data_type: 'games',
            result: 'success'
          });

          secondaryProvider = secondaryProviderInstance.name;
          
          // データ突合・差分検出
          differences = this.compareGameData(primaryData, secondaryData);
          
          // 差分をメトリクスとして記録
          differences.forEach(diff => {
            incrementCounter('data_disagreement_total', {
              field: diff.field,
              primary_provider: diff.provider1,
              secondary_provider: diff.provider2,
              severity: diff.severity
            });
          });

          logger.info('Shadow run completed', {
            correlationId,
            secondaryProvider: secondaryProviderInstance.name,
            differences: differences.length,
            duration
          });

        } catch (error) {
          logger.warn('Shadow run failed', {
            correlationId,
            secondaryProvider: secondaryProviderInstance.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    incrementCounter('multi_source_fetch_total', {
      primary_provider: primaryProvider,
      secondary_provider: secondaryProvider || 'none',
      fallback_used: fallbackUsed.toString()
    });

    return {
      data: primaryData,
      primaryProvider,
      secondaryProvider: secondaryProvider || undefined,
      differences,
      fallbackUsed,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 複数ソースから先発投手情報を取得
   */
  async fetchStartersMultiSource(date: string): Promise<MultiSourceResult<StarterRecord>> {
    const correlationId = `starters-${date}-${Date.now()}`;
    
    logger.info('Starting multi-source starters fetch', { correlationId, date });

    const enabledProviders = this.providers
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    let primaryData: StarterRecord[] = [];
    let primaryProvider = '';
    let fallbackUsed = false;

    // Primary provider からデータ取得
    for (const provider of enabledProviders) {
      try {
        const isHealthy = await provider.healthCheck();
        if (!isHealthy) {
          logger.warn('Provider health check failed', {
            correlationId,
            provider: provider.name
          });
          continue;
        }

        const startTime = Date.now();
        primaryData = await provider.fetchStarters(date);
        const duration = Date.now() - startTime;

        recordHistogram('multi_source_fetch_duration_seconds', duration / 1000, {
          provider: provider.name,
          data_type: 'starters',
          result: 'success'
        });

        primaryProvider = provider.name;
        logger.info('Primary starters fetch successful', {
          correlationId,
          provider: provider.name,
          recordCount: primaryData.length,
          duration
        });
        break;

      } catch (error) {
        logger.error('Primary starters fetch failed', {
          correlationId,
          provider: provider.name,
          error: error instanceof Error ? error.message : String(error)
        });

        fallbackUsed = true;
        continue;
      }
    }

    if (primaryData.length === 0) {
      throw new Error('All providers failed to fetch starters data');
    }

    // Shadow run for starters
    let secondaryData: StarterRecord[] = [];
    let secondaryProvider = '';
    let differences: ComparisonResult[] = [];

    if (this.shadowRunEnabled && enabledProviders.length > 1) {
      const secondaryProviderInstance = enabledProviders.find(p => p.name !== primaryProvider);
      
      if (secondaryProviderInstance) {
        try {
          secondaryData = await secondaryProviderInstance.fetchStarters(date);
          secondaryProvider = secondaryProviderInstance.name;
          
          // 先発投手データ突合
          differences = this.compareStarterData(primaryData, secondaryData);
          
          differences.forEach(diff => {
            incrementCounter('data_disagreement_total', {
              field: diff.field,
              primary_provider: diff.provider1,
              secondary_provider: diff.provider2,
              severity: diff.severity
            });
          });

        } catch (error) {
          logger.warn('Shadow run for starters failed', {
            correlationId,
            secondaryProvider: secondaryProviderInstance.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    return {
      data: primaryData,
      primaryProvider,
      secondaryProvider: secondaryProvider || undefined,
      differences,
      fallbackUsed,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 試合データの突合・差分検出
   */
  private compareGameData(primary: GameInfo[], secondary: GameInfo[]): ComparisonResult[] {
    const differences: ComparisonResult[] = [];
    
    // ゲームIDでマッチング
    const secondaryMap = new Map(secondary.map(g => [g.gameId, g]));
    
    for (const primaryGame of primary) {
      const secondaryGame = secondaryMap.get(primaryGame.gameId);
      
      if (!secondaryGame) {
        differences.push({
          field: 'game_existence',
          provider1: 'primary',
          provider2: 'secondary', 
          value1: primaryGame.gameId,
          value2: null,
          severity: 'warn'
        });
        continue;
      }

      // 重要フィールドの比較
      this.compareField(differences, 'home_team', primaryGame.home, secondaryGame.home, 'error');
      this.compareField(differences, 'away_team', primaryGame.away, secondaryGame.away, 'error');
      this.compareField(differences, 'start_time', primaryGame.startTime, secondaryGame.startTime, 'warn');
      this.compareField(differences, 'venue', primaryGame.venue, secondaryGame.venue, 'info');
    }

    return differences;
  }

  /**
   * 先発投手データの突合・差分検出
   */
  private compareStarterData(primary: StarterRecord[], secondary: StarterRecord[]): ComparisonResult[] {
    const differences: ComparisonResult[] = [];
    
    // ゲームID+チームでマッチング
    const secondaryMap = new Map(
      secondary.map(s => [`${s.gameId}-${s.team}`, s])
    );
    
    for (const primaryStarter of primary) {
      const key = `${primaryStarter.gameId}-${primaryStarter.team}`;
      const secondaryStarter = secondaryMap.get(key);
      
      if (!secondaryStarter) {
        differences.push({
          field: 'starter_existence',
          provider1: 'primary',
          provider2: 'secondary',
          value1: key,
          value2: null,
          severity: 'warn'
        });
        continue;
      }

      // 投手名比較（正規化後）
      const primaryName = normalizePlayerName(primaryStarter.playerName);
      const secondaryName = normalizePlayerName(secondaryStarter.playerName);
      
      this.compareField(differences, 'starter_pitcher', primaryName, secondaryName, 'error');
      this.compareField(differences, 'pitcher_hand', primaryStarter.hand, secondaryStarter.hand, 'warn');
      
      // 成績比較（許容誤差あり）
      if (primaryStarter.era && secondaryStarter.era) {
        const eraDiff = Math.abs(primaryStarter.era - secondaryStarter.era);
        if (eraDiff > 0.1) {
          differences.push({
            field: 'pitcher_era',
            provider1: 'primary',
            provider2: 'secondary',
            value1: primaryStarter.era,
            value2: secondaryStarter.era,
            severity: eraDiff > 0.5 ? 'warn' : 'info'
          });
        }
      }
    }

    return differences;
  }

  private compareField(
    differences: ComparisonResult[],
    field: string,
    value1: any,
    value2: any,
    severity: 'info' | 'warn' | 'error'
  ) {
    if (value1 !== value2) {
      differences.push({
        field,
        provider1: 'primary',
        provider2: 'secondary',
        value1,
        value2,
        severity
      });
    }
  }

  /**
   * プロバイダの有効/無効切り替え
   */
  setProviderEnabled(providerName: string, enabled: boolean): void {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      provider.enabled = enabled;
      logger.info('Provider enabled status changed', {
        provider: providerName,
        enabled
      });
    }
  }

  /**
   * Shadow run の有効/無効切り替え
   */
  setShadowRunEnabled(enabled: boolean): void {
    this.shadowRunEnabled = enabled;
    logger.info('Shadow run enabled status changed', { enabled });
  }

  /**
   * 利用可能なプロバイダ一覧取得
   */
  getProviders(): Array<{name: string, priority: number, enabled: boolean}> {
    return this.providers.map(p => ({
      name: p.name,
      priority: p.priority,
      enabled: p.enabled
    }));
  }
}