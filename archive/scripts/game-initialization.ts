#!/usr/bin/env npx tsx
/**
 * 試合開始時の初期遅延削減システム
 * 空雛形生成、mesテーブルUPSERT、timeline準備
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { Client } from 'pg';

interface GameInitConfig {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  scheduledStart: string;
  venue: string;
  league: 'NPB1' | 'NPB2';
}

export class GameInitializationManager {
  private dataDir: string;
  private pgClient?: Client;

  constructor(dataDir: string = './data', pgUrl?: string) {
    this.dataDir = dataDir;
    if (pgUrl) {
      this.pgClient = new Client({ connectionString: pgUrl });
    }
  }

  async initializeGame(config: GameInitConfig): Promise<void> {
    console.log(`🚀 Initializing game ${config.gameId} (${config.homeTeam} vs ${config.awayTeam})`);

    // 1. Timeline ディレクトリ作成
    await this.createTimelineDirs(config);

    // 2. 空雛形ファイル生成
    await this.createEmptyTemplates(config);

    // 3. mes テーブル UPSERT (DB接続時のみ)
    if (this.pgClient) {
      await this.upsertMesRecord(config);
    }

    console.log(`✅ Game ${config.gameId} initialization complete`);
  }

  private async createTimelineDirs(config: GameInitConfig): Promise<void> {
    const gameDir = path.join(
      this.dataDir, 
      'timeline', 
      config.league.toLowerCase(), 
      config.gameId
    );

    const dirs = [
      gameDir,
      path.join(gameDir, 'pitches'),
      path.join(gameDir, 'plate_appearances'),
      path.join(gameDir, 'lineups'),
      path.join(gameDir, 'game_state')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    console.log(`📁 Created timeline directories: ${gameDir}`);
  }

  private async createEmptyTemplates(config: GameInitConfig): Promise<void> {
    const gameDir = path.join(
      this.dataDir, 
      'timeline', 
      config.league.toLowerCase(), 
      config.gameId
    );

    // 空雛形データ
    const templates = {
      'pitches/latest.json': {
        gameId: config.gameId,
        timestamp: new Date().toISOString(),
        confidence: 'high',
        rows: []
      },
      'plate_appearances/latest.json': {
        gameId: config.gameId,
        timestamp: new Date().toISOString(),
        confidence: 'high', 
        rows: []
      },
      'lineups/latest.json': {
        gameId: config.gameId,
        homeTeam: config.homeTeam,
        awayTeam: config.awayTeam,
        homeLineup: [],
        awayLineup: [],
        timestamp: new Date().toISOString()
      },
      'game_state/latest.json': {
        gameId: config.gameId,
        status: 'scheduled',
        inning: 1,
        topBottom: 'top',
        outs: 0,
        balls: 0,
        strikes: 0,
        homeScore: 0,
        awayScore: 0,
        lastUpdate: new Date().toISOString()
      }
    };

    for (const [filePath, data] of Object.entries(templates)) {
      const fullPath = path.join(gameDir, filePath);
      await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
    }

    console.log(`📄 Created empty templates for game ${config.gameId}`);
  }

  private async upsertMesRecord(config: GameInitConfig): Promise<void> {
    if (!this.pgClient) return;

    try {
      await this.pgClient.connect();

      const query = `
        INSERT INTO mes (
          game_id, 
          home_team, 
          away_team, 
          scheduled_start, 
          venue,
          league,
          status,
          created_at,
          updated_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', NOW(), NOW())
        ON CONFLICT (game_id) 
        DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = NOW()
      `;

      await this.pgClient.query(query, [
        config.gameId,
        config.homeTeam,
        config.awayTeam,
        config.scheduledStart,
        config.venue,
        config.league
      ]);

      console.log(`💾 Upserted mes record for game ${config.gameId}`);

    } catch (error) {
      console.error(`Failed to upsert mes record:`, error);
    } finally {
      await this.pgClient.end();
    }
  }

  /**
   * 複数試合の一括初期化
   */
  async initializeBatch(games: GameInitConfig[]): Promise<void> {
    console.log(`🎯 Batch initializing ${games.length} games`);

    const promises = games.map(game => this.initializeGame(game));
    await Promise.allSettled(promises);

    console.log(`✅ Batch initialization complete`);
  }
}

// CLI使用時のメイン関数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/game-initialization.ts --game-id <id> --home <team> --away <team> --start <datetime> --venue <venue> --league <NPB1|NPB2>');
    process.exit(1);
  }

  const config: Partial<GameInitConfig> = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    
    switch (key) {
      case '--game-id':
        config.gameId = value;
        break;
      case '--home':
        config.homeTeam = value;
        break;
      case '--away':
        config.awayTeam = value;
        break;
      case '--start':
        config.scheduledStart = value;
        break;
      case '--venue':
        config.venue = value;
        break;
      case '--league':
        config.league = value as 'NPB1' | 'NPB2';
        break;
    }
  }

  if (!config.gameId || !config.homeTeam || !config.awayTeam) {
    console.error('Missing required parameters: game-id, home, away');
    process.exit(1);
  }

  const manager = new GameInitializationManager(
    process.env.DATA_DIR || './data',
    process.env.PGURL
  );

  await manager.initializeGame(config as GameInitConfig);
}

if (require.main === module) {
  main().catch(console.error);
}

export default GameInitializationManager;