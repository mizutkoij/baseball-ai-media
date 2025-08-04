import { NextResponse } from 'next/server';

interface BackfillReport {
  summary: {
    startTime: string;
    endTime: string;
    totalDurationMs: number;
    dryRun: boolean;
    yearRange: string;
    months: string[];
  };
  results: Array<{
    year: number;
    totalInserted: number;
    totalDuplicates: number;
    delta: number;
  }>;
}

interface BackfillStatus {
  lastRunTime?: string;
  insertedRows: number;
  deltaPct: number;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  diskUsage: {
    usedGB: number;
    totalGB: number;
    availableGB: number;
  };
}

async function getLatestBackfillReport(): Promise<BackfillReport | null> {
  try {
    // Dynamic imports to prevent build-time issues
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const reportsDir = path.join(process.cwd(), 'data', 'reports');
    
    // Check if reports directory exists
    try {
      await fs.access(reportsDir);
    } catch {
      // Try root data directory for reports
      const dataDir = path.join(process.cwd(), 'data');
      const files = await fs.readdir(dataDir);
      const reportFiles = files.filter(f => f.startsWith('backfill_report_') && f.endsWith('.json'));
      
      if (reportFiles.length === 0) return null;
      
      // Get most recent report
      const latestReport = reportFiles.sort().pop()!;
      const reportPath = path.join(dataDir, latestReport);
      const content = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(content);
    }
    
    const files = await fs.readdir(reportsDir);
    const reportFiles = files.filter(f => f.startsWith('monthly_') && f.endsWith('.json'));
    
    if (reportFiles.length === 0) return null;
    
    // Get most recent report
    const latestReport = reportFiles.sort().pop()!;
    const reportPath = path.join(reportsDir, latestReport);
    const content = await fs.readFile(reportPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading backfill report:', error);
    return null;
  }
}

async function getDiskUsage() {
  try {
    // Dynamic imports to prevent build-time issues
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const dataDir = path.join(process.cwd(), 'data');
    const historyDbPath = path.join(dataDir, 'db_history.db');
    
    let usedBytes = 0;
    try {
      const stats = await fs.stat(historyDbPath);
      usedBytes = stats.size;
    } catch {
      // DB doesn't exist yet
    }
    
    // Simplified disk usage calculation
    const usedGB = usedBytes / (1024 * 1024 * 1024);
    const totalGB = 10; // 10GB assumed limit
    const availableGB = totalGB - usedGB;
    
    return {
      usedGB: Math.round(usedGB * 100) / 100,
      totalGB,
      availableGB: Math.round(availableGB * 100) / 100
    };
  } catch (error) {
    console.error('Error getting disk usage:', error);
    return {
      usedGB: 0,
      totalGB: 10,
      availableGB: 10
    };
  }
}

export async function GET() {
  try {
    const [report, diskUsage] = await Promise.all([
      getLatestBackfillReport(),
      getDiskUsage()
    ]);
    
    let status: BackfillStatus['status'] = 'unknown';
    let lastRunTime: string | undefined;
    let insertedRows = 0;
    let deltaPct = 0;
    
    if (report) {
      lastRunTime = report.summary.endTime;
      
      // Calculate totals from results
      insertedRows = report.results.reduce((sum, r) => sum + r.totalInserted, 0);
      
      // Get latest delta
      if (report.results.length > 0) {
        deltaPct = report.results[report.results.length - 1].delta * 100;
      }
      
      // Determine status
      const timeSinceRun = Date.now() - new Date(lastRunTime).getTime();
      const hoursSinceRun = timeSinceRun / (1000 * 60 * 60);
      
      if (Math.abs(deltaPct) > 7) {
        status = 'error';
      } else if (hoursSinceRun > 24 * 32 || Math.abs(deltaPct) > 2) { // Over a month old or delta > 2%
        status = 'warning';
      } else {
        status = 'healthy';
      }
    }
    
    const response: BackfillStatus = {
      lastRunTime,
      insertedRows,
      deltaPct,
      status,
      diskUsage
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting backfill status:', error);
    return NextResponse.json(
      { error: 'Failed to get backfill status' },
      { status: 500 }
    );
  }
}