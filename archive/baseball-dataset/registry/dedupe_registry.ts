import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { canonicalKey, fingerprint, GameMeta, SourceScore } from '../orchestrator/dedupe_merge';

const DB_PATH = path.join(__dirname, 'dedupe_registry.sqlite');

export class DedupeRegistry {
  private db: Database.Database;
  
  constructor() {
    // データベースファイルのディレクトリを作成
    const dbDir = path.dirname(DB_PATH);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(DB_PATH);
    this.initTables();
  }
  
  private initTables() {
    // メインのゲーム重複管理テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_registry (
        canonical_game_id TEXT PRIMARY KEY,
        canonical_key TEXT UNIQUE NOT NULL,
        fingerprint TEXT NOT NULL,
        date_iso TEXT NOT NULL,
        home_team TEXT NOT NULL,
        away_team TEXT NOT NULL,
        venue TEXT,
        league TEXT,
        quality_score INTEGER DEFAULT 0,
        first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        source_count INTEGER DEFAULT 1
      )
    `);
    
    // プロバイダー別のゲームID管理
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS provider_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_game_id TEXT NOT NULL,
        provider_source TEXT NOT NULL,
        canonical_game_id TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        raw_data TEXT, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider_game_id, provider_source),
        FOREIGN KEY (canonical_game_id) REFERENCES game_registry (canonical_game_id)
      )
    `);
    
    // 品質問題追跡テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS quality_issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        canonical_game_id TEXT NOT NULL,
        issue_type TEXT NOT NULL, -- 'conflict', 'missing', 'invalid'
        description TEXT NOT NULL,
        severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        FOREIGN KEY (canonical_game_id) REFERENCES game_registry (canonical_game_id)
      )
    `);
    
    // インデックス作成
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_canonical_key ON game_registry (canonical_key)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_date_iso ON game_registry (date_iso)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_provider_source ON provider_games (provider_source)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_quality_score ON game_registry (quality_score)`);
  }
  
  /**
   * ゲームを登録または既存のものに統合
   */
  registerGame(
    meta: GameMeta,
    providerGameId: string,
    providerSource: string,
    sourceScore: SourceScore,
    rawData?: any
  ): string {
    const canKey = canonicalKey(meta);
    const fp = fingerprint(meta);
    
    // 既存のゲームを検索
    const existingGame = this.db
      .prepare('SELECT canonical_game_id FROM game_registry WHERE canonical_key = ?')
      .get(canKey) as { canonical_game_id: string } | undefined;
    
    let canonicalGameId: string;
    
    if (existingGame) {
      // 既存のゲームに統合
      canonicalGameId = existingGame.canonical_game_id;
      
      // ソースカウントと更新時刻を更新
      this.db
        .prepare(`
          UPDATE game_registry 
          SET source_count = source_count + 1,
              last_updated_at = CURRENT_TIMESTAMP,
              fingerprint = ?
          WHERE canonical_game_id = ?
        `)
        .run(fp, canonicalGameId);
        
    } else {
      // 新規ゲームとして登録
      canonicalGameId = this.generateCanonicalGameId(meta);
      
      this.db
        .prepare(`
          INSERT INTO game_registry (
            canonical_game_id, canonical_key, fingerprint,
            date_iso, home_team, away_team, venue, league,
            quality_score
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          canonicalGameId,
          canKey,
          fp,
          meta.dateISO.slice(0, 10),
          meta.home.name,
          meta.away.name,
          meta.venue,
          meta.league,
          sourceScore.reliability * 100
        );
    }
    
    // プロバイダー情報を記録
    this.db
      .prepare(`
        INSERT OR REPLACE INTO provider_games (
          provider_game_id, provider_source, canonical_game_id,
          confidence_score, raw_data
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        providerGameId,
        providerSource,
        canonicalGameId,
        sourceScore.reliability,
        rawData ? JSON.stringify(rawData) : null
      );
    
    return canonicalGameId;
  }
  
  /**
   * 正規ゲームIDを生成
   */
  private generateCanonicalGameId(meta: GameMeta): string {
    const date = meta.dateISO.slice(0, 10).replace(/-/g, '');
    const homeCode = this.getTeamCode(meta.home.name);
    const awayCode = this.getTeamCode(meta.away.name);
    
    // 同日の同カードの試合番号を取得
    const existingCount = this.db
      .prepare(`
        SELECT COUNT(*) as count FROM game_registry 
        WHERE date_iso = ? AND home_team = ? AND away_team = ?
      `)
      .get(meta.dateISO.slice(0, 10), meta.home.name, meta.away.name) as { count: number };
    
    const gameNumber = String(existingCount.count + 1).padStart(2, '0');
    
    return `${date}_${awayCode}-${homeCode}_${gameNumber}`;
  }
  
  /**
   * チーム名からコードを取得
   */
  private getTeamCode(teamName: string): string {
    // 簡易的にチーム名の最初の1-2文字を使用
    const codeMap: { [key: string]: string } = {
      '巨人': 'G', 'ヤクルト': 'S', '阪神': 'T', '広島': 'C', 'DeNA': 'DB', '中日': 'D',
      'ソフトバンク': 'H', '日本ハム': 'F', '西武': 'L', 'ロッテ': 'M', 'オリックス': 'B', '楽天': 'E'
    };
    
    return codeMap[teamName] || teamName.slice(0, 2).toUpperCase();
  }
  
  /**
   * 正規ゲームIDからプロバイダーゲームIDを取得
   */
  getProviderGameIds(canonicalGameId: string): Array<{
    providerGameId: string;
    providerSource: string;
    confidence: number;
  }> {
    const results = this.db
      .prepare(`
        SELECT provider_game_id, provider_source, confidence_score
        FROM provider_games
        WHERE canonical_game_id = ?
        ORDER BY confidence_score DESC
      `)
      .all(canonicalGameId) as Array<{
        provider_game_id: string;
        provider_source: string;
        confidence_score: number;
      }>;
      
    return results.map(r => ({
      providerGameId: r.provider_game_id,
      providerSource: r.provider_source,
      confidence: r.confidence_score
    }));
  }
  
  /**
   * 品質問題を記録
   */
  logQualityIssue(
    canonicalGameId: string,
    issueType: 'conflict' | 'missing' | 'invalid',
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    this.db
      .prepare(`
        INSERT INTO quality_issues (
          canonical_game_id, issue_type, description, severity
        ) VALUES (?, ?, ?, ?)
      `)
      .run(canonicalGameId, issueType, description, severity);
  }
  
  /**
   * 低品質なゲームを取得
   */
  getLowQualityGames(threshold: number = 70): Array<{
    canonicalGameId: string;
    qualityScore: number;
    issues: number;
  }> {
    return this.db
      .prepare(`
        SELECT 
          gr.canonical_game_id,
          gr.quality_score,
          COUNT(qi.id) as issue_count
        FROM game_registry gr
        LEFT JOIN quality_issues qi ON gr.canonical_game_id = qi.canonical_game_id
        WHERE gr.quality_score < ?
        GROUP BY gr.canonical_game_id, gr.quality_score
        ORDER BY gr.quality_score ASC
      `)
      .all(threshold)
      .map(row => ({
        canonicalGameId: (row as any).canonical_game_id,
        qualityScore: (row as any).quality_score,
        issues: (row as any).issue_count
      }));
  }
  
  /**
   * 統計情報を取得
   */
  getStats(): {
    totalGames: number;
    totalProviders: number;
    averageQuality: number;
    duplicateRate: number;
  } {
    const totalGames = (this.db
      .prepare('SELECT COUNT(*) as count FROM game_registry')
      .get() as { count: number }).count;
      
    const totalProviderRecords = (this.db
      .prepare('SELECT COUNT(*) as count FROM provider_games')
      .get() as { count: number }).count;
      
    const avgQuality = (this.db
      .prepare('SELECT AVG(quality_score) as avg FROM game_registry')
      .get() as { avg: number }).avg;
      
    const duplicateRate = totalGames > 0 ? 
      ((totalProviderRecords - totalGames) / totalProviderRecords) * 100 : 0;
    
    return {
      totalGames,
      totalProviders: totalProviderRecords,
      averageQuality: Math.round(avgQuality * 100) / 100,
      duplicateRate: Math.round(duplicateRate * 100) / 100
    };
  }
  
  /**
   * 期間内のゲーム一覧を取得
   */
  getGamesByDateRange(startDate: string, endDate: string): Array<{
    canonicalGameId: string;
    dateISO: string;
    homeTeam: string;
    awayTeam: string;
    venue: string;
    qualityScore: number;
    sourceCount: number;
  }> {
    return this.db
      .prepare(`
        SELECT 
          canonical_game_id,
          date_iso,
          home_team,
          away_team,
          venue,
          quality_score,
          source_count
        FROM game_registry
        WHERE date_iso BETWEEN ? AND ?
        ORDER BY date_iso DESC, canonical_game_id
      `)
      .all(startDate, endDate)
      .map(row => ({
        canonicalGameId: (row as any).canonical_game_id,
        dateISO: (row as any).date_iso,
        homeTeam: (row as any).home_team,
        awayTeam: (row as any).away_team,
        venue: (row as any).venue,
        qualityScore: (row as any).quality_score,
        sourceCount: (row as any).source_count
      }));
  }
  
  /**
   * データベースを閉じる
   */
  close() {
    this.db.close();
  }
}