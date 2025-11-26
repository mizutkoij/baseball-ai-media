/**
 * 試合リプレイ API - NDJSON ストリーミング対応
 * Live外時間の滞在時間↑・広告在庫↑・SNS拡散↑
 */

import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';

interface ReplayEvent {
  id: number;
  timestamp: string;
  type: 'update' | 'matchup' | 'nextpitch' | 'score' | 'inning';
  data: any;
}

export async function GET(
  request: NextRequest, 
  { params }: { params: { gameId: string } }
) {
  const { searchParams } = new URL(request.url);
  const speed = parseInt(searchParams.get('speed') || '1', 10); // 1-4x速度
  const fromFrame = parseInt(searchParams.get('from') || '0', 10);
  const gameId = params.gameId;

  try {
    // データファイルパスの構築
    const gameDate = gameId.slice(0, 8); // YYYYMMDD
    const formattedDate = `${gameDate.slice(0,4)}-${gameDate.slice(4,6)}-${gameDate.slice(6,8)}`;
    
    const timelineFile = join(
      process.cwd(), 
      'data', 
      'predictions', 
      'live',
      `date=${formattedDate}`,
      gameId,
      'timeline.jsonl'
    );

    // ファイル存在チェック
    if (!existsSync(timelineFile)) {
      return NextResponse.json(
        { error: 'Replay data not available', gameId },
        { status: 404 }
      );
    }

    // ストリーミングレスポンス生成
    const encoder = new TextEncoder();
    const stream = createReadStream(timelineFile, { encoding: 'utf8' });
    const rl = createInterface({ input: stream });

    let frameId = 0;
    const baseDelay = Math.max(50, 500 / speed); // 速度に応じた遅延

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // リプレイヘッダー送信
          const header = {
            type: 'replay_start',
            gameId,
            speed,
            timestamp: new Date().toISOString()
          };
          controller.enqueue(encoder.encode(JSON.stringify(header) + '\n'));

          // タイムラインイベントを順次送信
          for await (const line of rl) {
            if (!line.trim()) continue;

            try {
              const event = JSON.parse(line) as ReplayEvent;
              frameId++;

              // フレームスキップ処理
              if (frameId <= fromFrame) continue;

              // フレームIDを追加
              const replayEvent = {
                ...event,
                frameId,
                replaySpeed: speed
              };

              controller.enqueue(encoder.encode(JSON.stringify(replayEvent) + '\n'));

              // 速度調整された遅延
              if (speed < 4) { // 4x速度時は遅延なし
                await new Promise(resolve => setTimeout(resolve, baseDelay));
              }

            } catch (parseError) {
              console.error('Parse error for line:', line, parseError);
            }
          }

          // リプレイ終了マーカー
          const endMarker = {
            type: 'replay_end',
            gameId,
            totalFrames: frameId,
            timestamp: new Date().toISOString()
          };
          controller.enqueue(encoder.encode(JSON.stringify(endMarker) + '\n'));

        } catch (error) {
          console.error('Replay streaming error:', error);
          const errorEvent = {
            type: 'error',
            message: 'Stream error occurred',
            timestamp: new Date().toISOString()
          };
          controller.enqueue(encoder.encode(JSON.stringify(errorEvent) + '\n'));
        } finally {
          controller.close();
        }
      },

      cancel() {
        rl.close();
        stream.destroy();
      }
    });

    // キャッシュヘッダー設定（試合状況に応じて）
    const gameStatus = await getGameStatus(gameId);
    const cacheHeaders = getCacheHeaders(gameStatus);

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no', // nginx用
        'Cache-Control': cacheHeaders,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'X-Replay-Speed': speed.toString(),
        'X-Frame-Start': fromFrame.toString()
      }
    });

  } catch (error) {
    console.error('Replay API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to load replay data',
        gameId,
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// ゲーム状況取得（既存APIを活用）
async function getGameStatus(gameId: string): Promise<'LIVE' | 'FINISHED' | 'SCHEDULED'> {
  try {
    const LIVE_API = process.env.NEXT_PUBLIC_LIVE_API_BASE || "http://127.0.0.1:8787";
    const response = await fetch(`${LIVE_API}/live/${gameId}?stale=5`, { 
      cache: 'no-store',
      signal: AbortSignal.timeout(3000) // 3秒タイムアウト
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.status || 'FINISHED';
    }
  } catch (error) {
    console.error('Failed to get game status:', error);
  }
  return 'FINISHED'; // デフォルト
}

// キャッシュ戦略
function getCacheHeaders(status: string): string {
  switch (status) {
    case 'FINISHED':
      // 終了試合: ISR 24時間
      return 's-maxage=86400, stale-while-revalidate=172800';
    case 'LIVE':
      // 進行中: キャッシュしない（Liveページへ誘導）
      return 'no-store, no-cache, must-revalidate';
    default:
      // その他: 短期キャッシュ
      return 's-maxage=300, stale-while-revalidate=600';
  }
}

// OPTIONS対応（CORS）
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}