/**
 * Data Lifecycle Management - データライフサイクル管理
 * 
 * 機能:
 * - データ保持ポリシーの実行
 * - 段階的アーカイブ化（JSON → Parquet → Cold Storage）
 * - ログローテーション
 * - バックアップ＆復元
 */

import { logger } from '../lib/logger';
import { incrementCounter, recordHistogram } from '../lib/prometheus-metrics';
import * as fs from 'fs/promises';
import * as path from 'path';

interface RetentionPolicy {
  pattern: string;
  hotDays: number;    // ホットストレージ期間（高速アクセス）
  warmDays: number;   // ウォームストレージ期間（圧縮保存）
  coldDays: number;   // コールドストレージ期間（外部保存）
  deleteDays: number; // 完全削除
}

interface ArchiveJob {
  id: string;
  type: 'compress' | 'parquet' | 'upload' | 'delete';
  source: string;
  target?: string;
  age: number; // days
  size: number; // bytes
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export class DataLifecycleManager {
  private policies: RetentionPolicy[] = [];
  private activeJobs = new Map<string, ArchiveJob>();
  private dataDir: string;
  private archiveDir: string;
  private logDir: string;

  constructor(
    dataDir: string = './data',
    archiveDir: string = './archive',
    logDir: string = './logs'
  ) {
    this.dataDir = dataDir;
    this.archiveDir = archiveDir;
    this.logDir = logDir;
    this.initializePolicies();
  }

  private initializePolicies() {
    this.policies = [
      // 📊 NPBデータの保持ポリシー
      {
        pattern: 'data/*/date=*/*.json',
        hotDays: 7,      // 1週間は高速アクセス
        warmDays: 30,    // 1ヶ月はJSONで保持
        coldDays: 365,   // 1年はParquet化して保持
        deleteDays: 1095 // 3年で削除
      },
      {
        pattern: 'data/starters/date=*/*.json',
        hotDays: 14,     // 先発投手データは2週間ホット
        warmDays: 90,    // 3ヶ月ウォーム
        coldDays: 1095,  // 3年コールド
        deleteDays: 2190 // 6年で削除
      },
      // 📝 ログの保持ポリシー
      {
        pattern: 'logs/*.jsonl',
        hotDays: 7,      // 1週間は検索可能
        warmDays: 30,    // 1ヶ月は圧縮保存
        coldDays: 90,    // 3ヶ月はアーカイブ
        deleteDays: 365  // 1年で削除
      },
      // 🚨 デバッグデータの保持ポリシー
      {
        pattern: 'data/snapshots/debug_*',
        hotDays: 1,      // デバッグは1日で圧縮
        warmDays: 7,     // 1週間保持
        coldDays: 30,    // 1ヶ月アーカイブ
        deleteDays: 90   // 3ヶ月で削除
      }
    ];
  }

  /**
   * データライフサイクル管理の実行
   */
  async executeLifecycle(): Promise<void> {
    const correlationId = `lifecycle-${Date.now()}`;
    
    logger.info('Starting data lifecycle management', { correlationId });

    const startTime = Date.now();
    let totalProcessed = 0;
    let totalFreed = 0;

    try {
      for (const policy of this.policies) {
        logger.info('Processing retention policy', {
          correlationId,
          pattern: policy.pattern,
          policy
        });

        const jobs = await this.createJobsForPolicy(policy);
        const results = await this.executeJobs(jobs);
        
        totalProcessed += results.processed;
        totalFreed += results.freedBytes;

        logger.info('Policy processing completed', {
          correlationId,
          pattern: policy.pattern,
          processed: results.processed,
          freed: results.freedBytes,
          errors: results.errors
        });
      }

      const duration = Date.now() - startTime;
      
      recordHistogram('data_lifecycle_duration_seconds', duration / 1000, {
        result: 'success'
      });

      incrementCounter('data_lifecycle_executions_total', { result: 'success' });

      logger.info('Data lifecycle management completed', {
        correlationId,
        totalProcessed,
        totalFreed,
        duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Data lifecycle management failed', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      incrementCounter('data_lifecycle_executions_total', { result: 'error' });
      throw error;
    }
  }

  /**
   * ポリシーに基づくジョブ作成
   */
  private async createJobsForPolicy(policy: RetentionPolicy): Promise<ArchiveJob[]> {
    const jobs: ArchiveJob[] = [];
    const files = await this.findMatchingFiles(policy.pattern);
    
    for (const filePath of files) {
      const stats = await fs.stat(filePath);
      const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      
      let jobType: ArchiveJob['type'] | null = null;
      let target: string | undefined;

      if (ageInDays > policy.deleteDays) {
        jobType = 'delete';
      } else if (ageInDays > policy.coldDays) {
        jobType = 'upload';
        target = this.getColdStoragePath(filePath);
      } else if (ageInDays > policy.warmDays) {
        if (filePath.endsWith('.json')) {
          jobType = 'parquet';
          target = filePath.replace('.json', '.parquet');
        } else {
          jobType = 'compress';
          target = filePath + '.gz';
        }
      } else if (ageInDays > policy.hotDays && !filePath.endsWith('.gz')) {
        jobType = 'compress';
        target = filePath + '.gz';
      }

      if (jobType) {
        jobs.push({
          id: `${jobType}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: jobType,
          source: filePath,
          target,
          age: ageInDays,
          size: stats.size,
          status: 'pending'
        });
      }
    }

    return jobs;
  }

  /**
   * ジョブの並列実行
   */
  private async executeJobs(jobs: ArchiveJob[]): Promise<{
    processed: number;
    freedBytes: number;
    errors: number;
  }> {
    let processed = 0;
    let freedBytes = 0;
    let errors = 0;

    // 並列実行数を制限（ディスクI/Oを考慮）
    const concurrency = 3;
    const chunks = this.chunkArray(jobs, concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map(job => this.executeJob(job));
      const results = await Promise.allSettled(promises);
      
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const job = chunk[i];

        if (result.status === 'fulfilled') {
          processed++;
          freedBytes += result.value.freedBytes;
          
          incrementCounter('data_lifecycle_jobs_total', {
            type: job.type,
            result: 'success'
          });
        } else {
          errors++;
          logger.error('Job execution failed', {
            jobId: job.id,
            jobType: job.type,
            source: job.source,
            error: result.reason
          });

          incrementCounter('data_lifecycle_jobs_total', {
            type: job.type,
            result: 'error'
          });
        }
      }
    }

    return { processed, freedBytes, errors };
  }

  /**
   * 個別ジョブの実行
   */
  private async executeJob(job: ArchiveJob): Promise<{ freedBytes: number }> {
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    this.activeJobs.set(job.id, job);

    const startTime = Date.now();

    try {
      let freedBytes = 0;

      switch (job.type) {
        case 'compress':
          freedBytes = await this.compressFile(job.source, job.target!);
          break;
        
        case 'parquet':
          freedBytes = await this.convertToParquet(job.source, job.target!);
          break;
        
        case 'upload':
          freedBytes = await this.uploadToColdStorage(job.source, job.target!);
          break;
        
        case 'delete':
          freedBytes = job.size;
          await fs.unlink(job.source);
          logger.info('File deleted', {
            jobId: job.id,
            source: job.source,
            size: job.size
          });
          break;
      }

      const duration = Date.now() - startTime;
      
      job.status = 'completed';
      job.completedAt = new Date().toISOString();

      recordHistogram('data_lifecycle_job_duration_seconds', duration / 1000, {
        type: job.type
      });

      logger.debug('Job completed', {
        jobId: job.id,
        type: job.type,
        source: job.source,
        target: job.target,
        freedBytes,
        duration
      });

      return { freedBytes };

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date().toISOString();
      
      throw error;
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * ファイル圧縮
   */
  private async compressFile(source: string, target: string): Promise<number> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const originalSize = (await fs.stat(source)).size;
    
    await execAsync(`gzip -c "${source}" > "${target}"`);
    await fs.unlink(source);
    
    const compressedSize = (await fs.stat(target)).size;
    const freedBytes = originalSize - compressedSize;

    logger.info('File compressed', {
      source,
      target,
      originalSize,
      compressedSize,
      compressionRatio: ((originalSize - compressedSize) / originalSize * 100).toFixed(1) + '%'
    });

    return freedBytes;
  }

  /**
   * JSON → Parquet 変換
   */
  private async convertToParquet(source: string, target: string): Promise<number> {
    const originalSize = (await fs.stat(source)).size;
    
    try {
      // JSONファイルを読み込み
      const jsonContent = await fs.readFile(source, 'utf-8');
      const data = JSON.parse(jsonContent);
      
      // Parquet変換（簡略実装 - 本格運用時はparquetjsライブラリを使用）
      const parquetData = JSON.stringify(data, null, 0); // 圧縮JSON as pseudo-parquet
      await fs.writeFile(target, parquetData);
      
      // 元ファイル削除
      await fs.unlink(source);
      
      const parquetSize = (await fs.stat(target)).size;
      const freedBytes = originalSize - parquetSize;

      logger.info('JSON converted to Parquet', {
        source,
        target,
        originalSize,
        parquetSize,
        records: Array.isArray(data) ? data.length : 1
      });

      return freedBytes;

    } catch (error) {
      logger.error('Parquet conversion failed', {
        source,
        target,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // フォールバック: 通常の圧縮
      return await this.compressFile(source, source + '.gz');
    }
  }

  /**
   * コールドストレージへのアップロード
   */
  private async uploadToColdStorage(source: string, target: string): Promise<number> {
    // 実際の実装では S3, Google Cloud Storage, Azure Blob 等を使用
    const archiveDir = path.join(this.archiveDir, 'cold');
    await fs.mkdir(archiveDir, { recursive: true });
    
    const archivePath = path.join(archiveDir, path.basename(target));
    
    // ファイル移動（実際にはクラウドストレージAPI使用）
    await fs.rename(source, archivePath);
    
    const fileSize = (await fs.stat(archivePath)).size;

    logger.info('File archived to cold storage', {
      source,
      archive: archivePath,
      size: fileSize
    });

    return fileSize; // 元の場所からは削除されたのでサイズ分が節約
  }

  /**
   * ファイルパターンマッチング
   */
  private async findMatchingFiles(pattern: string): Promise<string[]> {
    const { glob } = await import('glob');
    return await glob(pattern, { nodir: true });
  }

  /**
   * コールドストレージパスの生成
   */
  private getColdStoragePath(filePath: string): string {
    const relativePath = path.relative('.', filePath);
    const dateMatch = relativePath.match(/date=(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
    
    return `cold-archive/${date}/${path.basename(filePath)}`;
  }

  /**
   * 配列のチャンク分割
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * バックアップ作成
   */
  async createBackup(targetPath: string, backupName?: string): Promise<string> {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupFileName = backupName || `backup-${timestamp}.tar.gz`;
    const backupPath = path.join(this.archiveDir, 'backups', backupFileName);
    
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const cmd = `tar -czf "${backupPath}" -C "${path.dirname(targetPath)}" "${path.basename(targetPath)}"`;
    await execAsync(cmd);
    
    const backupSize = (await fs.stat(backupPath)).size;
    
    logger.info('Backup created', {
      source: targetPath,
      backup: backupPath,
      size: backupSize
    });

    incrementCounter('data_backup_created_total', { 
      type: 'manual',
      target: path.basename(targetPath)
    });

    return backupPath;
  }

  /**
   * バックアップから復元
   */
  async restoreFromBackup(backupPath: string, targetPath: string): Promise<void> {
    if (!(await this.fileExists(backupPath))) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const cmd = `tar -xzf "${backupPath}" -C "${path.dirname(targetPath)}"`;
    await execAsync(cmd);
    
    logger.info('Restored from backup', {
      backup: backupPath,
      target: targetPath
    });

    incrementCounter('data_backup_restored_total', {
      backup: path.basename(backupPath)
    });
  }

  /**
   * アクティブジョブのステータス取得
   */
  getActiveJobs(): ArchiveJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * 保持ポリシーの設定
   */
  setRetentionPolicy(pattern: string, policy: Omit<RetentionPolicy, 'pattern'>): void {
    const existingIndex = this.policies.findIndex(p => p.pattern === pattern);
    const newPolicy = { pattern, ...policy };
    
    if (existingIndex >= 0) {
      this.policies[existingIndex] = newPolicy;
    } else {
      this.policies.push(newPolicy);
    }

    logger.info('Retention policy updated', { pattern, policy });
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// CLI実行用のエントリーポイント
if (require.main === module) {
  const manager = new DataLifecycleManager();
  
  const command = process.argv[2];
  
  async function main() {
    switch (command) {
      case 'run':
        await manager.executeLifecycle();
        break;
      
      case 'backup':
        const target = process.argv[3];
        if (!target) {
          console.error('Usage: npx tsx scripts/data-lifecycle.ts backup <target-path>');
          process.exit(1);
        }
        const backupPath = await manager.createBackup(target);
        console.log(`Backup created: ${backupPath}`);
        break;
      
      case 'restore':
        const backup = process.argv[3];
        const restoreTarget = process.argv[4];
        if (!backup || !restoreTarget) {
          console.error('Usage: npx tsx scripts/data-lifecycle.ts restore <backup-path> <target-path>');
          process.exit(1);
        }
        await manager.restoreFromBackup(backup, restoreTarget);
        console.log(`Restored to: ${restoreTarget}`);
        break;
      
      case 'status':
        const jobs = manager.getActiveJobs();
        console.log(`Active jobs: ${jobs.length}`);
        jobs.forEach(job => {
          console.log(`  ${job.id}: ${job.type} - ${job.status}`);
        });
        break;
      
      default:
        console.error('Usage: npx tsx scripts/data-lifecycle.ts <run|backup|restore|status>');
        process.exit(1);
    }
  }

  main().catch(error => {
    console.error('Data lifecycle error:', error);
    process.exit(1);
  });
}