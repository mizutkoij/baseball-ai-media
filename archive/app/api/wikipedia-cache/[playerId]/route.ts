import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface WikipediaData {
  found: boolean;
  data?: {
    title: string;
    extract: string;
    description?: string;
    url: string;
    thumbnail?: string;
    birth_date?: string | null;
    career_highlights?: string[];
    search_results?: Array<{
      title: string;
      description: string;
      url: string;
    }>;
  };
  searchUrl?: string;
  message?: string;
  lastUpdated: string;
}

interface PlayerWikipediaCache {
  [playerId: string]: WikipediaData;
}

// キャッシュされたWikipedia情報を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const playerId = params.playerId;
    console.log('Wikipedia cache API called for player ID:', playerId);

    // キャッシュファイルのパス
    const cacheFilePath = path.join(process.cwd(), 'data', 'wikipedia_cache.json');
    
    if (!fs.existsSync(cacheFilePath)) {
      return NextResponse.json({
        found: false,
        message: 'Wikipediaキャッシュが見つかりません',
        suggestion: 'バッチ処理を実行してください'
      });
    }

    try {
      const cacheData = fs.readFileSync(cacheFilePath, 'utf8');
      const cache: PlayerWikipediaCache = JSON.parse(cacheData);
      
      const playerWikiData = cache[playerId];
      
      if (!playerWikiData) {
        return NextResponse.json({
          found: false,
          message: 'この選手のWikipedia情報が見つかりません',
          searchUrl: `https://ja.wikipedia.org/wiki/Special:Search/${encodeURIComponent(playerId)}`
        });
      }

      // キャッシュの更新日時をチェック
      const cachedDate = new Date(playerWikiData.lastUpdated);
      const now = new Date();
      const daysSinceUpdate = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      return NextResponse.json({
        ...playerWikiData,
        cache_info: {
          last_updated: playerWikiData.lastUpdated,
          days_since_update: Math.floor(daysSinceUpdate * 10) / 10,
          is_fresh: daysSinceUpdate < 7
        }
      });

    } catch (parseError) {
      console.error('Error parsing cache file:', parseError);
      return NextResponse.json({
        found: false,
        message: 'キャッシュファイルの読み取りエラー'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Wikipedia cache API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// 統計情報を取得するエンドポイント
export async function HEAD(request: NextRequest) {
  try {
    const cacheFilePath = path.join(process.cwd(), 'data', 'wikipedia_cache.json');
    const statsFilePath = path.join(process.cwd(), 'data', 'wikipedia_stats.json');
    
    if (fs.existsSync(statsFilePath)) {
      const statsData = fs.readFileSync(statsFilePath, 'utf8');
      const stats = JSON.parse(statsData);
      
      return new NextResponse(null, {
        status: 200,
        headers: {
          'X-Total-Players': stats.total_players.toString(),
          'X-Cached-Entries': stats.cached_entries.toString(),
          'X-Found-Count': stats.found_count.toString(),
          'X-Not-Found-Count': stats.not_found_count.toString(),
          'X-Last-Updated': stats.last_updated
        }
      });
    }

    return new NextResponse(null, { status: 404 });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}