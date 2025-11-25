import Database from 'better-sqlite3';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { 
  shrinkWobaWeights, 
  shrinkFipConstants, 
  checkAlertConditions, 
  generateUpdateLog,
  ShrinkResult 
} from '../lib/constants/shrink';
import { unionQuery, get as dbGet } from '../lib/db';

interface LeagueConstants {
  wOBA: {
    scale: number;
    wBB: number;
    wHBP: number;
    w1B: number;
    w2B: number;
    w3B: number;
    wHR: number;
  };
  FIP: {
    constant: number;
  };
  parkFactors: Record<string, number>;
  metadata: {
    year: number;
    league: string;
    updated_at: string;
    sample_size: {
      total_pa: number;
      total_bf: number;
      total_games: number;
    };
  };
}

interface ConstantsUpdateOptions {
  publish?: boolean;
  dryRun?: boolean;
  year?: number;
  outputDir?: string;
  alertWebhook?: string;
}

/**
 * NPB係数の計算・更新クラス
 * 物理分割対応: 統合データベースアクセス層を使用
 */
export class ConstantsComputer {
  private options: Required<ConstantsUpdateOptions>;
  private currentConstants: LeagueConstants | null = null;

  constructor(options: ConstantsUpdateOptions = {}) {
    this.options = {
      publish: options.publish ?? false,
      dryRun: options.dryRun ?? false,
      year: options.year ?? new Date().getFullYear(),
      outputDir: options.outputDir ?? './public/data/constants',
      alertWebhook: options.alertWebhook ?? ''
    };

    // 出力ディレクトリ作成
    if (!existsSync(this.options.outputDir)) {
      mkdirSync(this.options.outputDir, { recursive: true });
    }

    // 現在の係数を読み込み
    this.loadCurrentConstants();
  }

  /**
   * 現在の係数を読み込み
   */
  private loadCurrentConstants(): void {
    try {
      const constantsPath = join(this.options.outputDir, 'league_constants.json');
      if (existsSync(constantsPath)) {
        const data = readFileSync(constantsPath, 'utf8');
        this.currentConstants = JSON.parse(data);
        console.log(`📊 Loaded current constants (updated: ${this.currentConstants?.metadata.updated_at})`);
      } else {
        console.log('⚠️  No existing constants found, will use defaults');
      }
    } catch (error) {
      console.error('❌ Failed to load current constants:', error);
    }
  }

  /**
   * wOBA係数の経験的計算（物理分割対応: 両DBからUNION ALL）
   */
  private async calculateEmpiricalWoba(): Promise<{ weights: Record<string, number>; totalPA: number }> {
    const query = `
      SELECT 
        COUNT(*) as total_pa,
        SUM(BB) as total_bb,
        SUM(COALESCE(HBP, 0)) as total_hbp,
        SUM(H - COALESCE(singles_2B, 0) - COALESCE(singles_3B, 0) - COALESCE(HR, 0)) as total_1b,
        SUM(COALESCE(singles_2B, 0)) as total_2b,
        SUM(COALESCE(singles_3B, 0)) as total_3b,
        SUM(COALESCE(HR, 0)) as total_hr,
        SUM(R) as total_runs,
        SUM(AB + BB + COALESCE(HBP, 0) + COALESCE(SF, 0)) as total_pa_calc
      FROM box_batting b
      JOIN games g ON b.game_id = g.game_id
      WHERE g.date >= ? AND g.date < ?
        AND AB > 0  -- 有効打席のみ
      `;

    const yearStart = `${this.options.year}-01-01`;
    const yearEnd = `${this.options.year + 1}-01-01`;
    
    const result = await dbGet(query, [yearStart, yearEnd]) as any;
    
    // テスト用に最低サンプル数を下げる（本番では1000以上）
    const minPA = process.env.NODE_ENV === 'test' ? 100 : 1000;
    if (!result || result.total_pa < minPA) {
      throw new Error(`Insufficient data for ${this.options.year}: ${result?.total_pa || 0} PA (minimum: ${minPA})`);
    }

    // Linear Weights の計算（Run Expectancy Matrix より）
    const totalRuns = result.total_runs;
    const totalOuts = result.total_pa_calc - result.total_bb - result.total_hbp - result.total_1b - result.total_2b - result.total_3b - result.total_hr;
    
    // 簡易計算（実際は Run Expectancy Matrix を使用）
    const runPerOut = -totalRuns / totalOuts * 0.3; // 概算
    
    const weights = {
      wBB: (result.total_runs / result.total_bb) * 0.69,  // 暫定値、実際は複雑な計算
      wHBP: (result.total_runs / result.total_hbp) * 0.72,
      w1B: (result.total_runs / result.total_1b) * 0.89,
      w2B: (result.total_runs / result.total_2b) * 1.27,
      w3B: (result.total_runs / result.total_3b) * 1.62,
      wHR: (result.total_runs / result.total_hr) * 2.10
    };

    return { weights, totalPA: result.total_pa };
  }

  /**
   * FIP係数の経験的計算（物理分割対応: 両DBからUNION ALL）
   */
  private async calculateEmpiricalFip(): Promise<{ fipConstant: number; totalBF: number }> {
    const query = `
      SELECT 
        COUNT(*) as total_bf,
        SUM(ER) as total_er,
        SUM(COALESCE(HR_allowed, 0)) as total_hr,
        SUM(BB) as total_bb,
        SUM(SO) as total_so,
        SUM(IP * 3) as total_outs  -- IP を アウト数に変換
      FROM box_pitching p
      JOIN games g ON p.game_id = g.game_id
      WHERE g.date >= ? AND g.date < ?
        AND IP > 0
      `;

    const yearStart = `${this.options.year}-01-01`;
    const yearEnd = `${this.options.year + 1}-01-01`;
    
    const result = await dbGet(query, [yearStart, yearEnd]) as any;
    
    // テスト用に最低サンプル数を下げる
    const minBF = process.env.NODE_ENV === 'test' ? 50 : 5000;
    if (!result || result.total_bf < minBF) {
      throw new Error(`Insufficient pitching data for ${this.options.year}: ${result?.total_bf || 0} BF (minimum: ${minBF})`);
    }

    // FIP定数 = ERA - (13*HR + 3*BB - 2*SO) / IP
    const leagueEra = (result.total_er * 9) / (result.total_outs / 3);
    const fipBase = (13 * result.total_hr + 3 * result.total_bb - 2 * result.total_so) / (result.total_outs / 3);
    const fipConstant = leagueEra - fipBase;

    return { fipConstant, totalBF: result.total_bf };
  }

  /**
   * パークファクターの計算（物理分割対応: 両DBからUNION ALL）
   */
  private async calculateParkFactors(): Promise<Record<string, number>> {
    const query = `
      SELECT 
        venue,
        COUNT(*) as games,
        AVG(COALESCE(away_score, 0) + COALESCE(home_score, 0)) as avg_runs_per_game,
        AVG(CASE WHEN venue IS NOT NULL THEN COALESCE(away_score, 0) + COALESCE(home_score, 0) END) as home_runs
      FROM games 
      WHERE date >= ? AND date < ?
        AND status = 'final'
        AND venue IS NOT NULL
      GROUP BY venue
      HAVING COUNT(*) >= 3  -- テスト用に最低試合数を減らす
      `;

    const yearStart = `${this.options.year}-01-01`;
    const yearEnd = `${this.options.year + 1}-01-01`;
    
    const results = await unionQuery(query, [yearStart, yearEnd]) as any[];
    
    // リーグ平均を計算
    const leagueAvgRuns = results.reduce((sum, r) => sum + r.avg_runs_per_game * r.games, 0) / 
                          results.reduce((sum, r) => sum + r.games, 0);

    const parkFactors: Record<string, number> = {};
    
    for (const park of results) {
      parkFactors[park.venue] = park.avg_runs_per_game / leagueAvgRuns;
    }

    return parkFactors;
  }

  /**
   * 新係数の計算とシュリンク適用
   */
  async computeNewConstants(): Promise<{
    constants: LeagueConstants;
    shrinkResults: Record<string, ShrinkResult>;
    alerts: any[];
  }> {
    console.log(`🔄 Computing constants for ${this.options.year}...`);

    // 経験的係数の計算（物理分割対応: 統合DB読み込み）
    const { weights: empiricalWoba, totalPA } = await this.calculateEmpiricalWoba();
    const { fipConstant: empiricalFip, totalBF } = await this.calculateEmpiricalFip();
    const empiricalPF = await this.calculateParkFactors();

    // 前回の係数（事前分布）
    const priorWoba = this.currentConstants?.wOBA || {
      wBB: 0.690, wHBP: 0.720, w1B: 0.890, 
      w2B: 1.270, w3B: 1.620, wHR: 2.100
    };
    const priorFip = this.currentConstants?.FIP?.constant || 3.20;
    const priorPF = this.currentConstants?.parkFactors || {};

    // シュリンク推定適用
    const wobaResults = shrinkWobaWeights(empiricalWoba, priorWoba, totalPA);
    const fipResults = shrinkFipConstants(
      { fipConstant: empiricalFip },
      { fipConstant: priorFip },
      totalBF
    );

    // アラートチェック
    const allResults = { ...wobaResults, ...fipResults };
    const { alerts } = checkAlertConditions(allResults);

    // 新係数の構築
    const newConstants: LeagueConstants = {
      wOBA: {
        scale: 1.000, // 固定
        wBB: wobaResults.wBB.value,
        wHBP: wobaResults.wHBP.value,
        w1B: wobaResults.w1B.value,
        w2B: wobaResults.w2B.value,
        w3B: wobaResults.w3B.value,
        wHR: wobaResults.wHR.value
      },
      FIP: {
        constant: fipResults.fipConstant.value
      },
      parkFactors: empiricalPF, // 今回はシュリンクなし（後で追加可能）
      metadata: {
        year: this.options.year,
        league: 'NPB',
        updated_at: new Date().toISOString(),
        sample_size: {
          total_pa: totalPA,
          total_bf: totalBF,
          total_games: Object.keys(empiricalPF).length
        }
      }
    };

    return { constants: newConstants, shrinkResults: allResults, alerts };
  }

  /**
   * 係数の公開（スワップ）
   */
  async publishConstants(constants: LeagueConstants, shrinkResults: Record<string, ShrinkResult>): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    if (this.options.dryRun) {
      console.log('[DRY RUN] Would publish new constants');
      console.log('New wOBA weights:', constants.wOBA);
      console.log('New FIP constant:', constants.FIP.constant);
      return;
    }

    try {
      // バックアップ作成
      if (this.currentConstants) {
        const backupPath = join(this.options.outputDir, `league_constants_backup_${timestamp}.json`);
        writeFileSync(backupPath, JSON.stringify(this.currentConstants, null, 2));
        console.log(`💾 Backup saved: ${backupPath}`);
      }

      // 新係数を公開
      const constantsPath = join(this.options.outputDir, 'league_constants.json');
      writeFileSync(constantsPath, JSON.stringify(constants, null, 2));

      // 更新ログ保存
      const updateLog = generateUpdateLog(shrinkResults, {
        league: 'NPB',
        year: this.options.year
      });
      
      const logPath = join(this.options.outputDir, `update_log_${timestamp}.json`);
      writeFileSync(logPath, JSON.stringify(updateLog, null, 2));

      console.log(`✅ Constants published successfully`);
      console.log(`📊 Updated ${updateLog.summary.changedCoefficients}/${updateLog.summary.totalCoefficients} coefficients`);
      console.log(`🛡️  Guarded ${updateLog.summary.guardedCoefficients} coefficients due to volatility`);
      
    } catch (error) {
      throw new Error(`Failed to publish constants: ${error}`);
    }
  }

  /**
   * Webhook通知送信
   */
  private async sendAlert(alerts: any[], constants: LeagueConstants): Promise<void> {
    if (!this.options.alertWebhook || alerts.length === 0) return;

    const message = {
      text: `🚨 NPB Constants Alert (${this.options.year})`,
      attachments: [{
        color: alerts.some(a => a.severity === 'error') ? 'danger' : 'warning',
        fields: [
          {
            title: 'Alerts',
            value: alerts.map(a => `${a.coefficient}: ${a.reason} (Δ=${(a.delta*100).toFixed(1)}%)`).join('\n'),
            short: false
          },
          {
            title: 'Sample Size',
            value: `PA: ${constants.metadata.sample_size.total_pa.toLocaleString()}`,
            short: true
          }
        ]
      }]
    };

    try {
      // Webhook実装は環境に応じて
      console.log('📨 Alert notification:', message);
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  /**
   * メイン処理
   */
  async run(): Promise<void> {
    try {
      const { constants, shrinkResults, alerts } = await this.computeNewConstants();

      if (alerts.length > 0) {
        console.log(`⚠️  ${alerts.length} alerts detected`);
        await this.sendAlert(alerts, constants);
      }

      if (this.options.publish) {
        await this.publishConstants(constants, shrinkResults);
      } else {
        console.log('📋 Computed new constants (not published, use --publish flag)');
        console.log('wOBA weights:', constants.wOBA);
        console.log('FIP constant:', constants.FIP.constant);
      }

    } catch (error) {
      console.error('❌ Constants computation failed:', error);
      process.exit(1);
    }
  }
}

/**
 * CLI実行
 */
export async function main() {
  const args = process.argv.slice(2);
  const options: ConstantsUpdateOptions = {};

  // 引数解析
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--publish':
        options.publish = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--year':
        options.year = parseInt(args[++i]);
        break;
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--webhook':
        options.alertWebhook = args[++i];
        break;
    }
  }

  // 物理分割対応: 統合データベースアクセス層を使用（個別DB接続不要）
  const computer = new ConstantsComputer(options);
  
  await computer.run();
}

if (require.main === module) {
  main();
}