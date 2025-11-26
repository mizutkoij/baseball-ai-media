#!/usr/bin/env npx tsx
/**
 * モデル・設定世代管理システム
 * models/nextpitch/current -> vYYYYMMDD_HHMM へのシンボリックリンク管理
 * config/live-params.json -> versions/... への設定バージョン管理
 */

import fs from "fs/promises";
import path from "path";
import { logger } from "../lib/logger";

const log = logger.child({ component: "version-manager" });

interface VersionInfo {
  version: string;
  timestamp: string;
  modelPath?: string;
  configPath?: string;
  description?: string;
  performance?: {
    accuracy: number;
    logloss: number;
    calibration: number;
  };
}

/**
 * 新しいバージョンタイムスタンプ生成
 */
function generateVersion(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  
  return `v${year}${month}${day}_${hour}${minute}`;
}

/**
 * モデルの新バージョンをコミット
 */
export async function commitModelVersion(
  modelSourcePath: string, 
  description?: string,
  performance?: { accuracy: number; logloss: number; calibration: number }
): Promise<string> {
  const version = generateVersion();
  const versionDir = path.join("models", "nextpitch", "versions", version);
  
  try {
    log.info({ version, modelSourcePath }, "Committing new model version");
    
    // バージョンディレクトリ作成
    await fs.mkdir(versionDir, { recursive: true });
    
    // モデルファイルコピー
    const modelFiles = await fs.readdir(modelSourcePath);
    for (const file of modelFiles) {
      if (file.endsWith('.onnx') || file.endsWith('.json')) {
        const srcPath = path.join(modelSourcePath, file);
        const destPath = path.join(versionDir, file);
        await fs.copyFile(srcPath, destPath);
      }
    }
    
    // バージョン情報作成
    const versionInfo: VersionInfo = {
      version,
      timestamp: new Date().toISOString(),
      modelPath: versionDir,
      description: description || `Model version ${version}`,
      performance
    };
    
    await fs.writeFile(
      path.join(versionDir, "version.json"),
      JSON.stringify(versionInfo, null, 2)
    );
    
    log.info({ version, versionDir }, "Model version committed successfully");
    return version;
    
  } catch (error) {
    log.error({ version, error: error.message }, "Failed to commit model version");
    throw error;
  }
}

/**
 * 設定ファイルの新バージョンをコミット
 */
export async function commitConfigVersion(
  configData: any,
  description?: string
): Promise<string> {
  const version = generateVersion();
  const configPath = path.join("config", "versions", `live-params.${version}.json`);
  
  try {
    log.info({ version }, "Committing new config version");
    
    // バージョン設定ファイル作成
    const versionedConfig = {
      version,
      timestamp: new Date().toISOString(),
      description: description || `Config version ${version}`,
      config: configData
    };
    
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(versionedConfig, null, 2));
    
    log.info({ version, configPath }, "Config version committed successfully");
    return version;
    
  } catch (error) {
    log.error({ version, error: error.message }, "Failed to commit config version");
    throw error;
  }
}

/**
 * モデルバージョンをアクティブに切り替え
 */
export async function switchModelVersion(version: string): Promise<void> {
  const versionDir = path.join("models", "nextpitch", "versions", version);
  const currentLink = path.join("models", "nextpitch", "current");
  
  try {
    // バージョンディレクトリ存在確認
    await fs.access(versionDir);
    
    log.info({ version, versionDir }, "Switching to model version");
    
    // 既存のシンボリックリンク削除
    try {
      await fs.unlink(currentLink);
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
    
    // 新しいシンボリックリンク作成
    await fs.symlink(path.resolve(versionDir), currentLink, 'dir');
    
    log.info({ version, currentLink }, "Model version switched successfully");
    
  } catch (error) {
    log.error({ version, error: error.message }, "Failed to switch model version");
    throw error;
  }
}

/**
 * 設定バージョンをアクティブに切り替え
 */
export async function switchConfigVersion(version: string): Promise<void> {
  const versionConfigPath = path.join("config", "versions", `live-params.${version}.json`);
  const currentConfigPath = path.join("config", "live-params.json");
  
  try {
    // バージョン設定ファイル存在確認
    await fs.access(versionConfigPath);
    
    log.info({ version, versionConfigPath }, "Switching to config version");
    
    // バージョン設定読み込み
    const versionedConfigContent = await fs.readFile(versionConfigPath, 'utf-8');
    const versionedConfig = JSON.parse(versionedConfigContent);
    
    // 現在の設定として保存（config部分のみ）
    await fs.writeFile(
      currentConfigPath, 
      JSON.stringify(versionedConfig.config, null, 2)
    );
    
    log.info({ version, currentConfigPath }, "Config version switched successfully");
    
  } catch (error) {
    log.error({ version, error: error.message }, "Failed to switch config version");
    throw error;
  }
}

/**
 * 利用可能なバージョン一覧取得
 */
export async function listVersions(): Promise<{
  models: string[];
  configs: string[];
  current: { model?: string; config?: string };
}> {
  try {
    // モデルバージョン一覧
    const modelVersionsDir = path.join("models", "nextpitch", "versions");
    let modelVersions: string[] = [];
    try {
      const entries = await fs.readdir(modelVersionsDir, { withFileTypes: true });
      modelVersions = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort().reverse(); // 新しい順
    } catch (error) {
      // ディレクトリが存在しない場合
    }
    
    // 設定バージョン一覧
    const configVersionsDir = path.join("config", "versions");
    let configVersions: string[] = [];
    try {
      const files = await fs.readdir(configVersionsDir);
      configVersions = files
        .filter(file => file.startsWith('live-params.v') && file.endsWith('.json'))
        .map(file => file.match(/live-params\.(v\d{8}_\d{4})\.json/)?.[1])
        .filter(Boolean) as string[]
        .sort().reverse(); // 新しい順
    } catch (error) {
      // ディレクトリが存在しない場合
    }
    
    // 現在のバージョン確認
    let currentModel: string | undefined;
    let currentConfig: string | undefined;
    
    try {
      const currentModelLink = path.join("models", "nextpitch", "current");
      const modelStats = await fs.lstat(currentModelLink);
      if (modelStats.isSymbolicLink()) {
        const target = await fs.readlink(currentModelLink);
        currentModel = path.basename(target);
      }
    } catch (error) {
      // シンボリックリンクが存在しない場合
    }
    
    // 設定バージョンは現在のconfig/live-params.jsonから判定
    // (実装簡略化のため、最新のconfigバージョンを使用とみなす)
    if (configVersions.length > 0) {
      currentConfig = configVersions[0];
    }
    
    return {
      models: modelVersions,
      configs: configVersions,
      current: { model: currentModel, config: currentConfig }
    };
    
  } catch (error) {
    log.error({ error: error.message }, "Failed to list versions");
    throw error;
  }
}

/**
 * 古いバージョンのクリーンアップ（最新10個を保持）
 */
export async function cleanupOldVersions(keepCount: number = 10): Promise<void> {
  try {
    log.info({ keepCount }, "Cleaning up old versions");
    
    const versions = await listVersions();
    
    // 古いモデルバージョン削除
    const oldModels = versions.models.slice(keepCount);
    for (const version of oldModels) {
      const versionDir = path.join("models", "nextpitch", "versions", version);
      await fs.rm(versionDir, { recursive: true, force: true });
      log.info({ version }, "Removed old model version");
    }
    
    // 古い設定バージョン削除
    const oldConfigs = versions.configs.slice(keepCount);
    for (const version of oldConfigs) {
      const configPath = path.join("config", "versions", `live-params.${version}.json`);
      await fs.unlink(configPath);
      log.info({ version }, "Removed old config version");
    }
    
    log.info({ 
      removedModels: oldModels.length, 
      removedConfigs: oldConfigs.length 
    }, "Version cleanup completed");
    
  } catch (error) {
    log.error({ error: error.message }, "Failed to cleanup old versions");
    throw error;
  }
}

// CLI実行部分
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'commit-model':
        const modelPath = args[1];
        const modelDesc = args[2];
        if (!modelPath) {
          console.error("Usage: commit-model <model-path> [description]");
          process.exit(1);
        }
        const modelVersion = await commitModelVersion(modelPath, modelDesc);
        console.log(`Model version committed: ${modelVersion}`);
        break;
        
      case 'commit-config':
        const configDesc = args[1];
        const currentConfig = JSON.parse(await fs.readFile("config/live-params.json", 'utf-8'));
        const configVersion = await commitConfigVersion(currentConfig, configDesc);
        console.log(`Config version committed: ${configVersion}`);
        break;
        
      case 'switch-model':
        const switchModelVer = args[1];
        if (!switchModelVer) {
          console.error("Usage: switch-model <version>");
          process.exit(1);
        }
        await switchModelVersion(switchModelVer);
        console.log(`Switched to model version: ${switchModelVer}`);
        break;
        
      case 'switch-config':
        const switchConfigVer = args[1];
        if (!switchConfigVer) {
          console.error("Usage: switch-config <version>");
          process.exit(1);
        }
        await switchConfigVersion(switchConfigVer);
        console.log(`Switched to config version: ${switchConfigVer}`);
        break;
        
      case 'list':
        const versions = await listVersions();
        console.log(JSON.stringify(versions, null, 2));
        break;
        
      case 'cleanup':
        const keepCount = parseInt(args[1]) || 10;
        await cleanupOldVersions(keepCount);
        break;
        
      default:
        console.log(`Usage: ${process.argv[1]} <command> [args]`);
        console.log("Commands:");
        console.log("  commit-model <path> [desc]  - Commit new model version");
        console.log("  commit-config [desc]        - Commit current config version");
        console.log("  switch-model <version>      - Switch to model version");
        console.log("  switch-config <version>     - Switch to config version");
        console.log("  list                        - List available versions");
        console.log("  cleanup [keep-count]        - Cleanup old versions");
        break;
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
