/**
 * HTML スナップショット保存システム - 解析失敗時の保険
 * 
 * 機能:
 * - 解析失敗時のHTMLを自動保存
 * - 日付別フォルダーでの整理
 * - 自動ローテーション（7〜30日）
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { LogEntry } from '../types/npb';

export interface SnapshotOptions {
  baseDir?: string;
  maxAgeDays?: number;
  enableCleanup?: boolean;
}

export class HtmlSnapshots {
  private baseDir: string;
  private maxAgeDays: number;
  private logger: (entry: LogEntry) => void;

  constructor(
    options: SnapshotOptions = {},
    logger?: (entry: LogEntry) => void
  ) {
    this.baseDir = options.baseDir || './data/snapshots';
    this.maxAgeDays = options.maxAgeDays || 7;
    this.logger = logger || (() => {});

    if (options.enableCleanup !== false) {
      // 初回クリーンアップを非同期実行
      this.cleanup().catch(error => {
        this.logger({
          timestamp: new Date().toISOString(),
          level: 'warn',
          component: 'html-snapshots',
          message: 'Initial cleanup failed',
          error: { name: 'CleanupError', message: String(error) }
        });
      });
    }
  }

  async saveSnapshot(
    url: string,
    html: string,
    context: {
      error: Error;
      timestamp?: Date;
      scraper?: string;
    }
  ): Promise<string> {
    try {
      const timestamp = context.timestamp || new Date();
      const dateDir = this.formatDate(timestamp);
      const snapshotDir = path.join(this.baseDir, dateDir);
      
      // ディレクトリ作成
      await fs.mkdir(snapshotDir, { recursive: true });
      
      // ファイル名生成（URL→安全な文字列）
      const slug = this.urlToSlug(url);
      const timeStr = timestamp.toISOString().slice(11, 19).replace(/:/g, '');
      const filename = `${slug}_${timeStr}.html`;
      const filepath = path.join(snapshotDir, filename);
      
      // HTMLとメタデータを保存
      const metadata = {
        url,
        timestamp: timestamp.toISOString(),
        error: {
          name: context.error.name,
          message: context.error.message,
          stack: context.error.stack?.split('\n').slice(0, 10), // 10行に制限
        },
        scraper: context.scraper || 'unknown',
        userAgent: 'NPB-Scraper/1.0',
      };
      
      const fullContent = `<!--
SNAPSHOT METADATA:
${JSON.stringify(metadata, null, 2)}
-->
${html}`;
      
      await fs.writeFile(filepath, fullContent, 'utf-8');
      
      this.logger({
        timestamp: timestamp.toISOString(),
        level: 'info',
        component: 'html-snapshots',
        message: 'HTML snapshot saved',
        data: {
          url,
          filepath,
          htmlLength: html.length,
          error: context.error.message,
        }
      });
      
      return filepath;
    } catch (saveError) {
      this.logger({
        timestamp: new Date().toISOString(),
        level: 'error',
        component: 'html-snapshots',
        message: 'Failed to save HTML snapshot',
        data: { url, htmlLength: html.length },
        error: {
          name: saveError instanceof Error ? saveError.name : 'SaveError',
          message: saveError instanceof Error ? saveError.message : String(saveError),
        }
      });
      
      throw saveError;
    }
  }

  async cleanup(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.maxAgeDays);
      
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const directories = entries.filter(entry => entry.isDirectory());
      
      let removedDirs = 0;
      let removedFiles = 0;
      
      for (const dir of directories) {
        const dirDate = this.parseDateDir(dir.name);
        if (dirDate && dirDate < cutoffDate) {
          const dirPath = path.join(this.baseDir, dir.name);
          
          try {
            // ディレクトリ内のファイル数をカウント
            const files = await fs.readdir(dirPath);
            removedFiles += files.length;
            
            // ディレクトリごと削除
            await fs.rm(dirPath, { recursive: true });
            removedDirs++;
          } catch (rmError) {
            this.logger({
              timestamp: new Date().toISOString(),
              level: 'warn',
              component: 'html-snapshots',
              message: `Failed to remove snapshot directory: ${dir.name}`,
              error: {
                name: rmError instanceof Error ? rmError.name : 'RmError',
                message: rmError instanceof Error ? rmError.message : String(rmError),
              }
            });
          }
        }
      }
      
      if (removedDirs > 0) {
        this.logger({
          timestamp: new Date().toISOString(),
          level: 'info',
          component: 'html-snapshots',
          message: 'Snapshot cleanup completed',
          data: {
            removedDirectories: removedDirs,
            removedFiles,
            maxAgeDays: this.maxAgeDays,
          }
        });
      }
    } catch (cleanupError) {
      this.logger({
        timestamp: new Date().toISOString(),
        level: 'error',
        component: 'html-snapshots',
        message: 'Snapshot cleanup failed',
        error: {
          name: cleanupError instanceof Error ? cleanupError.name : 'CleanupError',
          message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        }
      });
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private parseDateDir(dirname: string): Date | null {
    const match = dirname.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return null;
  }

  private urlToSlug(url: string): string {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/[^\w\-\.]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 100); // 長すぎるファイル名を防ぐ
  }

  async getStats(): Promise<{
    totalDirectories: number;
    totalFiles: number;
    oldestSnapshot: Date | null;
    newestSnapshot: Date | null;
    diskUsageBytes: number;
  }> {
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const directories = entries.filter(entry => entry.isDirectory());
      
      let totalFiles = 0;
      let diskUsage = 0;
      const dates: Date[] = [];
      
      for (const dir of directories) {
        const dirDate = this.parseDateDir(dir.name);
        if (dirDate) dates.push(dirDate);
        
        const dirPath = path.join(this.baseDir, dir.name);
        const files = await fs.readdir(dirPath);
        totalFiles += files.length;
        
        // ディスクサイズ計算
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stat = await fs.stat(filePath);
          diskUsage += stat.size;
        }
      }
      
      return {
        totalDirectories: directories.length,
        totalFiles,
        oldestSnapshot: dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null,
        newestSnapshot: dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null,
        diskUsageBytes: diskUsage,
      };
    } catch {
      return {
        totalDirectories: 0,
        totalFiles: 0,
        oldestSnapshot: null,
        newestSnapshot: null,
        diskUsageBytes: 0,
      };
    }
  }
}

// グローバルインスタンス
export const htmlSnapshots = new HtmlSnapshots();