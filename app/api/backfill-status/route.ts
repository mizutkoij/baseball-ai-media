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
  // Return mock data for Vercel compatibility - no filesystem access
  console.warn('Backfill reports disabled for Vercel compatibility');
  return null;
}

async function getDiskUsage() {
  // Return mock disk usage for Vercel compatibility
  console.warn('Disk usage calculation disabled for Vercel compatibility');
  return {
    usedGB: 0,
    totalGB: 10,
    availableGB: 10
  };
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