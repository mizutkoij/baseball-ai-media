import { NextRequest, NextResponse } from 'next/server';
import YahooDataIntegrator from '@/lib/yahoo-integration';

export async function POST(request: NextRequest) {
  try {
    const integrator = new YahooDataIntegrator();
    
    // 同期進捗を追跡
    const progress: any[] = [];
    
    const result = await integrator.syncAllData({
      onProgress: (progressData) => {
        progress.push({
          timestamp: new Date().toISOString(),
          game: `${progressData.game.date} ${progressData.game.home_team} vs ${progressData.game.away_team}`,
          pitches: progressData.pitches,
          current: progressData.current,
          total: progressData.total
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: 'データ同期が完了しました',
      synced_games: result.synced_games,
      synced_pitches: result.synced_pitches,
      total_games: result.total_games,
      progress: progress.slice(-10) // 最新10件の進捗のみ返す
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'データ同期中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const integrator = new YahooDataIntegrator();
    const stats = await integrator.getSyncStats();

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Sync stats error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '同期統計の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}