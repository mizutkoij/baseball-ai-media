import Database from 'better-sqlite3';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export type Severity = 'error' | 'warning';
export interface Finding {
  rule: string;
  severity: Severity;
  key: Record<string, string | number>;
  detail?: any;
}

export interface ValidationResult {
  gameId: string;
  findings: Finding[];
  hasErrors: boolean;
  hasWarnings: boolean;
  timestamp: string;
}

/**
 * ゲーム単位でのデータ検証
 * 破損データを事前検出し、取り込み前に除外する
 */
export async function validateGame(db: Database.Database, gameId: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    // 1. 打撃データ検証: H ≤ AB
    const badHits = db.prepare(`
      SELECT team, player_id, AB, H, (H - AB) as excess
      FROM box_batting 
      WHERE game_id = ? AND H > AB
    `).all(gameId) as any[];
    
    badHits.forEach(r => findings.push({
      rule: 'bat_H_le_AB',
      severity: 'error',
      key: { gameId, team: r.team, player: r.player_id },
      detail: { AB: r.AB, H: r.H, excess: r.excess }
    }));

    // 2. 打撃データ検証: 1B = H - (2B+3B+HR) ≥ 0
    const badSingles = db.prepare(`
      SELECT team, player_id, H, singles_2B, singles_3B, HR, 
             (H - COALESCE(singles_2B,0) - COALESCE(singles_3B,0) - COALESCE(HR,0)) as calc_1B
      FROM box_batting 
      WHERE game_id = ? 
        AND (H - COALESCE(singles_2B,0) - COALESCE(singles_3B,0) - COALESCE(HR,0)) < 0
    `).all(gameId) as any[];
    
    badSingles.forEach(r => findings.push({
      rule: 'bat_singles_consistency',
      severity: 'error',
      key: { gameId, team: r.team, player: r.player_id },
      detail: { H: r.H, calc_1B: r.calc_1B }
    }));

    // 3. 投球データ検証: ER ≤ R
    const badER = db.prepare(`
      SELECT team, player_id, R, ER, (ER - R) as excess_er
      FROM box_pitching 
      WHERE game_id = ? AND ER > R
    `).all(gameId) as any[];
    
    badER.forEach(r => findings.push({
      rule: 'pit_ER_le_R',
      severity: 'error',
      key: { gameId, team: r.team, player: r.player_id },
      detail: { R: r.R, ER: r.ER, excess_er: r.excess_er }
    }));

    // 4. 投球データ検証: HR_allowed ≤ H_allowed
    const badHRAllowed = db.prepare(`
      SELECT team, player_id, H as H_allowed, HR_allowed, (HR_allowed - H) as excess_hr
      FROM box_pitching 
      WHERE game_id = ? AND HR_allowed > H
    `).all(gameId) as any[];
    
    badHRAllowed.forEach(r => findings.push({
      rule: 'pit_HR_le_H',
      severity: 'error',
      key: { gameId, team: r.team, player: r.player_id },
      detail: { H_allowed: r.H_allowed, HR_allowed: r.HR_allowed, excess_hr: r.excess_hr }
    }));

    // 5. チーム得点クロスチェック
    const teamRunDiff = db.prepare(`
      WITH bat AS (
        SELECT team, SUM(R) AS runs_scored FROM box_batting WHERE game_id = ? GROUP BY team
      ), pit AS (
        SELECT opponent AS team, SUM(R) AS runs_allowed FROM box_pitching WHERE game_id = ? GROUP BY opponent
      )
      SELECT 
        bat.team,
        bat.runs_scored,
        pit.runs_allowed,
        ABS(bat.runs_scored - pit.runs_allowed) as diff
      FROM bat JOIN pit USING(team)
      WHERE ABS(bat.runs_scored - pit.runs_allowed) > 0
    `).all(gameId, gameId) as any[];
    
    teamRunDiff.forEach(r => findings.push({
      rule: 'runs_cross_check',
      severity: r.diff > 1 ? 'error' : 'warning',
      key: { gameId, team: r.team },
      detail: { runs_scored: r.runs_scored, runs_allowed: r.runs_allowed, diff: r.diff }
    }));

    // 6. チーム合計検証（打撃）
    const teamBattingSum = db.prepare(`
      SELECT 
        team,
        COUNT(*) as player_count,
        SUM(R) as total_runs,
        SUM(AB) as total_ab,
        SUM(H) as total_hits
      FROM box_batting 
      WHERE game_id = ?
      GROUP BY team
      HAVING COUNT(*) = 0 OR SUM(AB) = 0
    `).all(gameId) as any[];
    
    teamBattingSum.forEach(r => findings.push({
      rule: 'team_batting_completeness',
      severity: 'warning',
      key: { gameId, team: r.team },
      detail: { player_count: r.player_count, total_ab: r.total_ab }
    }));

  } catch (error) {
    findings.push({
      rule: 'validation_error',
      severity: 'error',
      key: { gameId },
      detail: { error: error instanceof Error ? error.message : String(error) }
    });
  }

  return findings;
}

/**
 * 複数ゲームの一括検証
 */
export async function validateGames(db: Database.Database, gameIds: string[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  for (const gameId of gameIds) {
    const findings = await validateGame(db, gameId);
    results.push({
      gameId,
      findings,
      hasErrors: findings.some(f => f.severity === 'error'),
      hasWarnings: findings.some(f => f.severity === 'warning'),
      timestamp: new Date().toISOString()
    });
  }
  
  return results;
}

/**
 * 検証結果をログファイルに保存
 */
export function saveValidationResults(results: ValidationResult[], outputDir: string): void {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // ゲーム単位のログ
  for (const result of results) {
    const logFile = join(outputDir, `${result.gameId}.json`);
    writeFileSync(logFile, JSON.stringify(result, null, 2));
  }

  // 集計サマリ
  const summary = {
    total_games: results.length,
    games_with_errors: results.filter(r => r.hasErrors).length,
    games_with_warnings: results.filter(r => r.hasWarnings).length,
    total_findings: results.reduce((sum, r) => sum + r.findings.length, 0),
    error_count: results.reduce((sum, r) => sum + r.findings.filter(f => f.severity === 'error').length, 0),
    warning_count: results.reduce((sum, r) => sum + r.findings.filter(f => f.severity === 'warning').length, 0),
    timestamp: new Date().toISOString(),
    error_games: results.filter(r => r.hasErrors).map(r => r.gameId),
    common_rules: getCommonRuleFrequency(results)
  };

  const summaryFile = join(outputDir, 'validation_summary.json');
  writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  console.log(`✅ Validation completed: ${summary.total_games} games, ${summary.error_count} errors, ${summary.warning_count} warnings`);
  if (summary.games_with_errors > 0) {
    console.log(`⚠️  ${summary.games_with_errors} games have errors and should be excluded from ingestion`);
  }
}

/**
 * 共通ルール違反の頻度分析
 */
function getCommonRuleFrequency(results: ValidationResult[]): Record<string, number> {
  const ruleCounts: Record<string, number> = {};
  
  for (const result of results) {
    for (const finding of result.findings) {
      ruleCounts[finding.rule] = (ruleCounts[finding.rule] || 0) + 1;
    }
  }
  
  return Object.fromEntries(
    Object.entries(ruleCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10) // Top 10
  );
}

/**
 * 検証通過ゲームのリストを取得
 */
export function getValidGames(results: ValidationResult[]): string[] {
  return results
    .filter(r => !r.hasErrors)
    .map(r => r.gameId);
}

/**
 * CLI実行用メイン関数
 */
export async function main() {
  const args = process.argv.slice(2);
  const dbPath = args[0] || './data/baseball.db';
  const gameIds = args.slice(1);
  
  if (gameIds.length === 0) {
    console.error('Usage: tsx validate.ts <db_path> <game_id1> [game_id2] ...');
    process.exit(1);
  }
  
  try {
    const db = new Database(dbPath);
    const results = await validateGames(db, gameIds);
    
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const outputDir = join(process.cwd(), 'logs', 'validate', date);
    
    saveValidationResults(results, outputDir);
    
    const validGames = getValidGames(results);
    console.log(`Valid games for ingestion: ${validGames.length}/${results.length}`);
    console.log(`Valid game IDs: ${validGames.join(', ')}`);
    
    db.close();
    
    // エラーがあった場合は非ゼロ終了
    const hasErrors = results.some(r => r.hasErrors);
    process.exit(hasErrors ? 1 : 0);
    
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}