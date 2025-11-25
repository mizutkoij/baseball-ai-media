import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';

/**
 * 管理用HTTPエンドポイント
 * 遠隔でのシステム制御・ステータス確認
 */

interface SystemStatus {
  isRunning: boolean;
  yahooStop: boolean;
  lastActivity: string;
  processCount: number;
  uptime: string;
  metrics?: {
    totalPitches: number;
    dataQuality: number;
    lastUpdate: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'status') {
      const status = await getSystemStatus();
      return NextResponse.json({ success: true, status });
      
    } else if (action === 'metrics') {
      const metrics = await getQuickMetrics();
      return NextResponse.json({ success: true, metrics });
      
    } else {
      return NextResponse.json({ 
        success: true, 
        actions: ['status', 'metrics'],
        endpoints: {
          status: '/api/admin?action=status',
          metrics: '/api/admin?action=metrics',
          stop: 'POST /api/admin/stop',
          restart: 'POST /api/admin/restart'
        }
      });
    }
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const body = await request.json().catch(() => ({}));
    
    if (action === 'stop') {
      // 緊急停止フラグ設定
      process.env.YAHOO_STOP = 'true';
      
      // 停止理由をログ出力
      const reason = body.reason || 'HTTP管理画面から停止';
      console.log(`🛑 システム停止要求: ${reason}`);
      
      // Discord通知（環境があれば）
      try {
        const { execSync } = require('child_process');
        execSync(`npx tsx scripts/notify-discord.ts --stop "${reason}"`);
      } catch (e) {
        console.warn('Discord通知失敗:', e);
      }
      
      return NextResponse.json({
        success: true,
        message: 'システム停止フラグを設定しました',
        action: 'YAHOO_STOP=true',
        reason
      });
      
    } else if (action === 'restart') {
      // 停止フラグ解除
      process.env.YAHOO_STOP = '';
      delete process.env.YAHOO_STOP;
      
      console.log('🔄 システム再開許可');
      
      return NextResponse.json({
        success: true,
        message: 'システム再開可能になりました',
        action: 'YAHOO_STOP=""',
        note: '収集プロセスは手動で再起動が必要です'
      });
      
    } else {
      return NextResponse.json(
        { success: false, error: 'Unknown action' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

async function getSystemStatus(): Promise<SystemStatus> {
  const status: SystemStatus = {
    isRunning: false,
    yahooStop: process.env.YAHOO_STOP === 'true',
    lastActivity: 'unknown',
    processCount: 0,
    uptime: 'unknown'
  };
  
  try {
    // プロセス確認（簡易版）
    const { execSync } = require('child_process');
    const ps = execSync('ps aux | grep -c "yahoo\\|db:sync" || echo 0').toString().trim();
    status.processCount = parseInt(ps) || 0;
    status.isRunning = status.processCount > 0 && !status.yahooStop;
    
    // 最新データ確認
    if (await fileExists('data/timeline')) {
      const files = await fs.readdir('data/timeline', { recursive: true });
      const timelineFiles = files.filter(f => f.toString().endsWith('_timeline.jsonl'));
      
      if (timelineFiles.length > 0) {
        const latestFile = timelineFiles[timelineFiles.length - 1];
        const stat = await fs.stat(`data/timeline/${latestFile}`);
        status.lastActivity = stat.mtime.toISOString();
      }
    }
    
    // アップタイム（プロセス開始からの時間）
    if (status.isRunning) {
      const startTime = process.env.SYSTEM_START_TIME || Date.now();
      const uptimeMs = Date.now() - parseInt(startTime.toString());
      const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
      const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
      status.uptime = `${uptimeHours}h ${uptimeMinutes}m`;
    }
    
  } catch (error) {
    console.warn('System status check error:', error);
  }
  
  return status;
}

async function getQuickMetrics(): Promise<any> {
  const metrics = {
    timestamp: new Date().toISOString(),
    dataDirectories: {
      timeline: 0,
      cache: 0
    },
    recentFiles: [] as string[]
  };
  
  try {
    // データディレクトリサイズ確認
    if (await fileExists('data/timeline')) {
      const files = await fs.readdir('data/timeline', { recursive: true });
      metrics.dataDirectories.timeline = files.length;
      
      // 直近ファイル
      const timelineFiles = files.filter(f => f.toString().endsWith('.jsonl'));
      metrics.recentFiles = timelineFiles.slice(-5).map(f => f.toString());
    }
    
    if (await fileExists('data/cache')) {
      const files = await fs.readdir('data/cache', { recursive: true });
      metrics.dataDirectories.cache = files.length;
    }
    
  } catch (error) {
    console.warn('Metrics check error:', error);
  }
  
  return metrics;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}