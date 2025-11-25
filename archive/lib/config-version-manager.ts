import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

const log = logger.child({ job: "config-version" });

export interface VersionedConfig {
  version: string;
  timestamp: string;
  config: any;
  rollback_safe: boolean;
}

/**
 * 設定の世代管理
 */
export class ConfigVersionManager {
  private configName: string;
  private versionsDir: string;
  private currentPath: string;

  constructor(configName: string, baseDir = "config") {
    this.configName = configName;
    this.versionsDir = path.join(baseDir, "versions");
    this.currentPath = path.join(baseDir, `${configName}.json`);
  }

  /**
   * 新しい設定バージョンを保存
   */
  async saveVersion(config: any, markAsSafe = false): Promise<string> {
    const now = new Date();
    const version = now.toISOString()
      .replace(/[:-]/g, "")
      .replace(/\..+$/, "")
      .replace("T", "_");

    const versionedConfig: VersionedConfig = {
      version,
      timestamp: now.toISOString(),
      config,
      rollback_safe: markAsSafe
    };

    await fs.mkdir(this.versionsDir, { recursive: true });
    
    const versionPath = path.join(this.versionsDir, `${this.configName}.v${version}.json`);
    await fs.writeFile(versionPath, JSON.stringify(versionedConfig, null, 2));
    
    // 現在の設定ファイルも更新
    await fs.writeFile(this.currentPath, JSON.stringify(config, null, 2));
    
    log.info({ 
      config: this.configName, 
      version, 
      safe: markAsSafe 
    }, "Config version saved");

    return version;
  }

  /**
   * 安全なバージョンのリストを取得
   */
  async getSafeVersions(): Promise<VersionedConfig[]> {
    try {
      const files = await fs.readdir(this.versionsDir);
      const configFiles = files.filter(f => 
        f.startsWith(`${this.configName}.v`) && f.endsWith('.json')
      );

      const versions: VersionedConfig[] = [];
      
      for (const file of configFiles) {
        try {
          const content = await fs.readFile(path.join(this.versionsDir, file), "utf-8");
          const versionedConfig: VersionedConfig = JSON.parse(content);
          
          if (versionedConfig.rollback_safe) {
            versions.push(versionedConfig);
          }
        } catch (error) {
          log.warn({ file, error: error.message }, "Failed to read version file");
        }
      }

      // 新しい順にソート
      versions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return versions;
    } catch (error) {
      log.error({ error: error.message }, "Failed to get safe versions");
      return [];
    }
  }

  /**
   * 指定バージョンにロールバック
   */
  async rollbackToVersion(version: string): Promise<boolean> {
    try {
      const versionPath = path.join(this.versionsDir, `${this.configName}.v${version}.json`);
      const content = await fs.readFile(versionPath, "utf-8");
      const versionedConfig: VersionedConfig = JSON.parse(content);

      if (!versionedConfig.rollback_safe) {
        throw new Error(`Version ${version} is not marked as rollback safe`);
      }

      await fs.writeFile(this.currentPath, JSON.stringify(versionedConfig.config, null, 2));
      
      log.info({ 
        config: this.configName, 
        version, 
        timestamp: versionedConfig.timestamp 
      }, "Config rolled back successfully");

      return true;
    } catch (error) {
      log.error({ 
        config: this.configName, 
        version, 
        error: error.message 
      }, "Rollback failed");
      
      return false;
    }
  }

  /**
   * 最新の安全なバージョンにロールバック
   */
  async rollbackToSafe(): Promise<string | null> {
    const safeVersions = await this.getSafeVersions();
    
    if (safeVersions.length === 0) {
      log.warn({ config: this.configName }, "No safe versions available for rollback");
      return null;
    }

    const latestSafe = safeVersions[0];
    const success = await this.rollbackToVersion(latestSafe.version);
    
    return success ? latestSafe.version : null;
  }

  /**
   * 古いバージョンをクリーンアップ（直近10個を保持）
   */
  async cleanup(keepCount = 10): Promise<void> {
    try {
      const files = await fs.readdir(this.versionsDir);
      const configFiles = files
        .filter(f => f.startsWith(`${this.configName}.v`) && f.endsWith('.json'))
        .sort()
        .reverse(); // 新しい順

      if (configFiles.length <= keepCount) return;

      const filesToDelete = configFiles.slice(keepCount);
      
      for (const file of filesToDelete) {
        await fs.unlink(path.join(this.versionsDir, file));
      }

      log.info({ 
        config: this.configName, 
        deleted: filesToDelete.length,
        kept: keepCount 
      }, "Old config versions cleaned up");

    } catch (error) {
      log.warn({ 
        config: this.configName, 
        error: error.message 
      }, "Config cleanup failed");
    }
  }
}