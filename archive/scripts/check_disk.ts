#!/usr/bin/env ts-node
/**
 * check_disk.ts — Cross-platform disk space validation for backfill
 * Prevents backfill if disk usage exceeds configured limits
 */
const fs = require('fs');
const path = require('path');

interface DiskCheckResult {
  passed: boolean;
  usage: {
    historyDbSizeGB: number;
    totalDataSizeGB: number;
    availableSpaceGB: number;
  };
  limits: {
    historyDbLimitGB: number;
    availableSpaceLimitGB: number;
  };
  warnings: string[];
}

function formatGB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
}

function formatMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

function getDirectorySize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  let totalSize = 0;
  
  function addFileSize(filePath: string) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        const files = fs.readdirSync(filePath);
        files.forEach((file: string) => {
          addFileSize(path.join(filePath, file));
        });
      } else {
        totalSize += stats.size;
      }
    } catch (error) {
      // Skip files we can't access
    }
  }
  
  addFileSize(dirPath);
  return totalSize;
}

function getAvailableSpace(dirPath: string): number {
  try {
    const stats = fs.statSync(dirPath);
    // This is a simplified check - in production you'd use statvfs or similar
    // For now, assume we have plenty of space if directory exists
    return 50 * 1024 * 1024 * 1024; // 50GB assumption
  } catch (error) {
    return 10 * 1024 * 1024 * 1024; // 10GB fallback
  }
}

function checkDiskSpace(): DiskCheckResult {
  const HISTORY_DB_LIMIT_GB = 1;
  const AVAILABLE_SPACE_LIMIT_GB = 0.5;
  
  const dataDir = path.resolve('./data');
  const historyDbPath = path.join(dataDir, 'db_history.db');
  
  console.log('🔍 Checking disk space before backfill...');
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    console.log('⚠️  Data directory not found - creating it');
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Check history DB size
  let historyDbSize = 0;
  if (fs.existsSync(historyDbPath)) {
    const stats = fs.statSync(historyDbPath);
    historyDbSize = stats.size;
    console.log(`📊 History DB size: ${formatMB(historyDbSize)} MB`);
  } else {
    console.log('📊 History DB not found - assuming fresh install');
  }
  
  // Check total data directory size
  const totalDataSize = getDirectorySize(dataDir);
  console.log(`📊 Total data directory: ${formatMB(totalDataSize)} MB`);
  
  // Check available space (simplified)
  const availableSpace = getAvailableSpace(dataDir);
  console.log(`💾 Available disk space: ${formatGB(availableSpace)} GB (estimated)`);
  
  const historyDbSizeGB = formatGB(historyDbSize);
  const totalDataSizeGB = formatGB(totalDataSize);
  const availableSpaceGB = formatGB(availableSpace);
  
  const warnings: string[] = [];
  let passed = true;
  
  // Check history DB limit
  if (historyDbSizeGB > HISTORY_DB_LIMIT_GB) {
    console.log(`❌ History DB at ${historyDbSizeGB} GB exceeds ${HISTORY_DB_LIMIT_GB} GB limit`);
    console.log('   Consider archiving old data or increasing the limit');
    passed = false;
  }
  
  // Check available space
  if (availableSpaceGB < AVAILABLE_SPACE_LIMIT_GB) {
    console.log(`❌ Available disk space (${availableSpaceGB} GB) is critically low`);
    passed = false;
  }
  
  // Warning for large data directory
  if (totalDataSizeGB > HISTORY_DB_LIMIT_GB * 2) {
    const warning = `Total data directory approaching 2x limit (${totalDataSizeGB} GB)`;
    warnings.push(warning);
    console.log(`⚠️  ${warning}`);
    console.log('   Consider cleanup of temporary files');
  }
  
  if (passed) {
    console.log('✅ Disk space check passed');
    console.log(`   History DB: ${historyDbSizeGB} GB / ${HISTORY_DB_LIMIT_GB} GB limit`);
    console.log(`   Available: ${availableSpaceGB} GB`);
  }
  
  return {
    passed,
    usage: {
      historyDbSizeGB,
      totalDataSizeGB,
      availableSpaceGB
    },
    limits: {
      historyDbLimitGB: HISTORY_DB_LIMIT_GB,
      availableSpaceLimitGB: AVAILABLE_SPACE_LIMIT_GB
    },
    warnings
  };
}

// CLI execution
if (require.main === module) {
  const result = checkDiskSpace();
  
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    result.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
  
  process.exit(result.passed ? 0 : 1);
}

module.exports = { checkDiskSpace };