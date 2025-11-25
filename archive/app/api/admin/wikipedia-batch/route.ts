import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// バッチ処理の統計情報を取得
export async function GET(request: NextRequest) {
  try {
    const statsFilePath = path.join(process.cwd(), 'data', 'wikipedia_stats.json');
    const cacheFilePath = path.join(process.cwd(), 'data', 'wikipedia_cache.json');
    
    let stats = null;
    let cacheSize = 0;
    let cacheExists = false;
    
    if (fs.existsSync(statsFilePath)) {
      const statsData = fs.readFileSync(statsFilePath, 'utf8');
      stats = JSON.parse(statsData);
    }
    
    if (fs.existsSync(cacheFilePath)) {
      cacheExists = true;
      const cacheData = fs.readFileSync(cacheFilePath, 'utf8');
      const cache = JSON.parse(cacheData);
      cacheSize = Object.keys(cache).length;
    }
    
    return NextResponse.json({
      cache_exists: cacheExists,
      cache_size: cacheSize,
      stats: stats,
      last_check: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin Wikipedia batch API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// バッチ処理のトリガー（開発用）
export async function POST(request: NextRequest) {
  try {
    // セキュリティ: 本番環境では適切な認証が必要
    const { action } = await request.json();
    
    if (action === 'trigger_batch') {
      // 実際の実装では、バックグラウンドジョブをトリガーする
      return NextResponse.json({
        message: 'バッチ処理がトリガーされました',
        note: 'サーバーでnpm run wikipedia:batchを実行してください',
        timestamp: new Date().toISOString()
      });
    }
    
    if (action === 'clear_cache') {
      const cacheFilePath = path.join(process.cwd(), 'data', 'wikipedia_cache.json');
      if (fs.existsSync(cacheFilePath)) {
        fs.unlinkSync(cacheFilePath);
        return NextResponse.json({
          message: 'キャッシュが削除されました',
          timestamp: new Date().toISOString()
        });
      } else {
        return NextResponse.json({
          message: 'キャッシュファイルが見つかりませんでした',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return NextResponse.json({
      error: 'Invalid action'
    }, { status: 400 });
    
  } catch (error) {
    console.error('Admin Wikipedia batch POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}