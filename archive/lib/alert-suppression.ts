/**
 * アラート静音化システム
 * 休養日や試合0件の日の不要なアラートを抑制
 */

export interface AlertSuppressionConfig {
  expectedGamesTotal: number;
  date: string;
  isRestDay?: boolean;
  suppressionRules: {
    httpErrors: number[];      // 抑制するHTTPエラーコード
    logLevel: 'INFO' | 'WARN' | 'ERROR' | 'SILENT';
    discordSuppressed: boolean;
  };
}

export class AlertSuppressionManager {
  private config: AlertSuppressionConfig;

  constructor(date: string = new Date().toISOString().slice(0, 10)) {
    this.config = this.determineSuppressionConfig(date);
  }

  private determineSuppressionConfig(date: string): AlertSuppressionConfig {
    const dayOfWeek = new Date(date).getDay();
    const isMonday = dayOfWeek === 1; // 月曜は基本休養日
    
    // 試合数予測（簡易版）
    const expectedGames = this.predictExpectedGames(date);
    
    if (expectedGames === 0 || isMonday) {
      return {
        expectedGamesTotal: expectedGames,
        date,
        isRestDay: true,
        suppressionRules: {
          httpErrors: [404, 429, 503],
          logLevel: 'INFO',
          discordSuppressed: true
        }
      };
    }

    return {
      expectedGamesTotal: expectedGames,
      date,
      isRestDay: false,
      suppressionRules: {
        httpErrors: [],
        logLevel: 'WARN',
        discordSuppressed: false
      }
    };
  }

  private predictExpectedGames(date: string): number {
    const today = new Date(date);
    const dayOfWeek = today.getDay();
    
    // 月曜・火曜は基本休養日
    if (dayOfWeek === 1 || dayOfWeek === 2) return 0;
    
    // オフシーズン判定（簡易）
    const month = today.getMonth() + 1;
    if (month === 12 || month === 1 || month === 2) return 0;
    
    // 通常期間はファーム2〜4試合
    return Math.floor(Math.random() * 3) + 2;
  }

  shouldSuppressError(httpStatus: number, errorType: string): boolean {
    if (!this.config.isRestDay) return false;
    
    return this.config.suppressionRules.httpErrors.includes(httpStatus);
  }

  getLogLevel(): 'INFO' | 'WARN' | 'ERROR' | 'SILENT' {
    return this.config.suppressionRules.logLevel;
  }

  shouldSuppressDiscord(): boolean {
    return this.config.suppressionRules.discordSuppressed;
  }

  getSuppressionStatus(): {
    isActive: boolean;
    reason: string;
    suppressedErrors: number[];
  } {
    return {
      isActive: this.config.isRestDay || false,
      reason: this.config.expectedGamesTotal === 0 ? 
        'No games expected today' : 
        'Regular monitoring active',
      suppressedErrors: this.config.suppressionRules.httpErrors
    };
  }

  // ログ出力用のメタデータ
  getSuppressionMetadata() {
    return {
      date: this.config.date,
      expectedGames: this.config.expectedGamesTotal,
      isRestDay: this.config.isRestDay,
      suppressionActive: this.config.isRestDay,
      logLevel: this.config.suppressionRules.logLevel
    };
  }
}

export default AlertSuppressionManager;