#!/usr/bin/env npx tsx
/**
 * データベースメンテナンス自動化
 * VACUUM ANALYZE、パーティション管理、インデックス最適化
 */

import { Client } from 'pg';

export class DatabaseMaintenanceManager {
  private client: Client;

  constructor(pgUrl: string = process.env.PGURL || '') {
    if (!pgUrl) {
      throw new Error('PGURL environment variable required');
    }
    this.client = new Client({ connectionString: pgUrl });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  /**
   * 日次メンテナンス：VACUUM ANALYZE
   */
  async dailyMaintenance(): Promise<void> {
    console.log('🧹 Starting daily maintenance...');

    try {
      await this.connect();

      // 主要テーブルのVACUUM ANALYZE
      const tables = ['pitches', 'plate_appearances', 'games', 'players', 'teams'];
      
      for (const table of tables) {
        console.log(`  📊 VACUUM ANALYZE ${table}...`);
        await this.client.query(`VACUUM ANALYZE ${table}`);
      }

      // 統計情報更新
      console.log('  📈 Updating table statistics...');
      await this.client.query('ANALYZE');

      // インデックス使用状況チェック
      await this.checkIndexUsage();

      console.log('✅ Daily maintenance complete');

    } catch (error) {
      console.error('❌ Daily maintenance failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * 週次メンテナンス：パーティション管理
   */
  async weeklyMaintenance(): Promise<void> {
    console.log('🗓️ Starting weekly maintenance...');

    try {
      await this.connect();

      // 古いパーティション削除（3ヶ月以上前）
      await this.cleanupOldPartitions();

      // 新しいパーティション作成（来月分）
      await this.createFuturePartitions();

      // データ圧縮（1週間以上古いデータ）
      await this.compressOldData();

      console.log('✅ Weekly maintenance complete');

    } catch (error) {
      console.error('❌ Weekly maintenance failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  private async checkIndexUsage(): Promise<void> {
    console.log('  🔍 Checking index usage...');
    
    const query = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        CASE WHEN idx_tup_read > 0 
             THEN round((idx_tup_fetch::numeric / idx_tup_read) * 100, 2)
             ELSE 0 
        END as usage_ratio
      FROM pg_stat_user_indexes 
      WHERE idx_tup_read > 1000
      ORDER BY usage_ratio DESC;
    `;

    const result = await this.client.query(query);
    
    for (const row of result.rows) {
      if (row.usage_ratio < 10) {
        console.warn(`  ⚠️ Low usage index: ${row.indexname} (${row.usage_ratio}%)`);
      }
    }
  }

  private async cleanupOldPartitions(): Promise<void> {
    console.log('  🗑️ Cleaning up old partitions...');
    
    // 3ヶ月以上前のパーティション削除
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    const cutoffStr = cutoffDate.toISOString().slice(0, 7); // YYYY-MM

    const query = `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename LIKE 'pitches_%'
        AND tablename < 'pitches_${cutoffStr.replace('-', '_')}'
    `;

    const result = await this.client.query(query);
    
    for (const row of result.rows) {
      console.log(`    Dropping partition: ${row.tablename}`);
      await this.client.query(`DROP TABLE IF EXISTS ${row.tablename}`);
    }
  }

  private async createFuturePartitions(): Promise<void> {
    console.log('  📅 Creating future partitions...');
    
    // 来月のパーティション作成
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    const monthStr = futureDate.toISOString().slice(0, 7).replace('-', '_');

    const partitionQueries = [
      `CREATE TABLE IF NOT EXISTS pitches_${monthStr} PARTITION OF pitches
       FOR VALUES FROM ('${futureDate.getFullYear()}-${(futureDate.getMonth()+1).toString().padStart(2, '0')}-01') 
       TO ('${futureDate.getFullYear()}-${(futureDate.getMonth()+2).toString().padStart(2, '0')}-01')`,
      
      `CREATE TABLE IF NOT EXISTS plate_appearances_${monthStr} PARTITION OF plate_appearances
       FOR VALUES FROM ('${futureDate.getFullYear()}-${(futureDate.getMonth()+1).toString().padStart(2, '0')}-01')
       TO ('${futureDate.getFullYear()}-${(futureDate.getMonth()+2).toString().padStart(2, '0')}-01')`
    ];

    for (const query of partitionQueries) {
      try {
        await this.client.query(query);
      } catch (error) {
        console.warn(`    Warning: ${error}`);
      }
    }
  }

  private async compressOldData(): Promise<void> {
    console.log('  🗜️ Compressing old data...');
    
    // 1週間以上古いデータを圧縮
    const compressQuery = `
      UPDATE pitches 
      SET compressed = TRUE 
      WHERE game_date < NOW() - INTERVAL '7 days'
        AND compressed IS NOT TRUE
    `;

    const result = await this.client.query(compressQuery);
    console.log(`    Compressed ${result.rowCount} pitch records`);
  }

  /**
   * パフォーマンス監視
   */
  async performanceReport(): Promise<void> {
    console.log('📊 Generating performance report...');

    try {
      await this.connect();

      // テーブルサイズ
      const sizeQuery = `
        SELECT 
          tablename,
          pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size,
          n_tup_ins + n_tup_upd + n_tup_del as total_activity
        FROM pg_tables t
        JOIN pg_stat_user_tables s ON t.tablename = s.relname
        WHERE t.schemaname = 'public'
        ORDER BY pg_total_relation_size(tablename::regclass) DESC
      `;

      const sizeResult = await this.client.query(sizeQuery);
      console.log('  📏 Table sizes:');
      for (const row of sizeResult.rows) {
        console.log(`    ${row.tablename}: ${row.size} (activity: ${row.total_activity})`);
      }

      // スロークエリ
      const slowQuery = `
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        ORDER BY mean_time DESC 
        LIMIT 5
      `;

      try {
        const slowResult = await this.client.query(slowQuery);
        console.log('  🐌 Slowest queries:');
        for (const row of slowResult.rows) {
          console.log(`    ${row.mean_time.toFixed(2)}ms: ${row.query.slice(0, 60)}...`);
        }
      } catch (error) {
        console.log('  ℹ️ pg_stat_statements not available');
      }

    } finally {
      await this.disconnect();
    }
  }
}

// CLI実行
async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'daily';

  const manager = new DatabaseMaintenanceManager();

  try {
    switch (action) {
      case 'daily':
        await manager.dailyMaintenance();
        break;
      case 'weekly':
        await manager.weeklyMaintenance();
        break;
      case 'report':
        await manager.performanceReport();
        break;
      default:
        console.log('Usage: npx tsx scripts/db-maintenance.ts [daily|weekly|report]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Maintenance failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export default DatabaseMaintenanceManager;