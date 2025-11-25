import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

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

// Wikipedia APIから情報を取得する関数
async function fetchWikipediaInfo(playerName: string): Promise<WikipediaData> {
  try {
    console.log(`Fetching Wikipedia info for: ${playerName}`);
    
    const cleanName = playerName
      .replace(/[　\s]+/g, '')
      .replace(/[（）()]/g, '')
      .trim();

    // Wikipedia日本語版APIで検索
    const searchUrl = `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Baseball-AI-Media/1.0 (https://baseball-ai-media.vercel.app) Node.js'
      }
    });

    if (!response.ok) {
      // ページが見つからない場合は検索APIを試す
      const searchApiUrl = `https://ja.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanName)}&limit=5&namespace=0&format=json&origin=*`;
      
      const searchResponse = await fetch(searchApiUrl, {
        headers: {
          'User-Agent': 'Baseball-AI-Media/1.0 (https://baseball-ai-media.vercel.app) Node.js'
        }
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const [query, titles, descriptions, urls] = searchData;
        
        if (titles && titles.length > 0) {
          const firstTitle = titles[0];
          const detailResponse = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`, {
            headers: {
              'User-Agent': 'Baseball-AI-Media/1.0 (https://baseball-ai-media.vercel.app) Node.js'
            }
          });

          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            return {
              found: true,
              data: {
                title: detailData.title,
                extract: detailData.extract,
                description: detailData.description,
                url: detailData.content_urls?.desktop?.page || urls[0],
                thumbnail: detailData.thumbnail?.source,
                birth_date: extractBirthDate(detailData.extract),
                career_highlights: extractCareerHighlights(detailData.extract),
                search_results: titles.slice(0, 3).map((title: string, index: number) => ({
                  title,
                  description: descriptions[index] || '',
                  url: urls[index] || ''
                }))
              },
              lastUpdated: new Date().toISOString()
            };
          }
        }
      }

      return {
        found: false,
        searchUrl: `https://ja.wikipedia.org/wiki/Special:Search/${encodeURIComponent(cleanName)}`,
        message: 'ページが見つかりませんでした',
        lastUpdated: new Date().toISOString()
      };
    }

    const data = await response.json();
    
    return {
      found: true,
      data: {
        title: data.title,
        extract: data.extract,
        description: data.description,
        url: data.content_urls?.desktop?.page,
        thumbnail: data.thumbnail?.source,
        birth_date: extractBirthDate(data.extract),
        career_highlights: extractCareerHighlights(data.extract)
      },
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Wikipedia fetch error for ${playerName}:`, error);
    return {
      found: false,
      message: 'Wikipedia情報の取得に失敗しました',
      lastUpdated: new Date().toISOString()
    };
  }
}

// 生年月日を抽出する関数
function extractBirthDate(text: string): string | null {
  if (!text) return null;
  
  const patterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    /(\d{4})年(\d{1,2})月(\d{1,2})日生まれ/,
    /生年月日[：:\s]*(\d{4})年(\d{1,2})月(\d{1,2})日/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const [, year, month, day] = match;
      return `${year}年${month}月${day}日`;
    }
  }

  return null;
}

// 経歴ハイライトを抽出する関数
function extractCareerHighlights(text: string): string[] {
  if (!text) return [];
  
  const highlights: string[] = [];
  const sentences = text.split(/[。！？]/).filter(s => s.trim().length > 10);
  
  const baseballKeywords = [
    'プロ野球', '野球選手', '投手', '内野手', '外野手', '捕手',
    'ドラフト', '新人王', 'MVP', '首位打者', '本塁打王', '打点王',
    '最優秀防御率', '最多勝', '最多奪三振', 'セーブ王',
    '日本シリーズ', 'オールスター', 'ゴールデングラブ賞',
    'WBC', '代表', '国際大会', 'メジャーリーグ', 'MLB'
  ];
  
  sentences.forEach(sentence => {
    if (baseballKeywords.some(keyword => sentence.includes(keyword))) {
      highlights.push(sentence.trim() + '。');
    }
  });
  
  return highlights.slice(0, 3);
}

// 遅延処理（API制限対応）
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('Starting bulk Wikipedia fetch for all players...');
  
  // データベースから全選手を取得
  const dbPath = path.join(process.cwd(), 'data', 'db_current.db');
  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    return;
  }

  const db = new Database(dbPath, { readonly: true });
  
  try {
    // 全選手を取得
    const players = db.prepare(`
      SELECT player_id, name, name_english, team 
      FROM players 
      ORDER BY name
    `).all() as Array<{
      player_id: string;
      name: string;
      name_english: string | null;
      team: string;
    }>;

    console.log(`Found ${players.length} players in database`);

    // キャッシュファイルのパス
    const cacheFilePath = path.join(process.cwd(), 'data', 'wikipedia_cache.json');
    
    // 既存のキャッシュを読み込み
    let cache: PlayerWikipediaCache = {};
    if (fs.existsSync(cacheFilePath)) {
      try {
        const cacheData = fs.readFileSync(cacheFilePath, 'utf8');
        cache = JSON.parse(cacheData);
        console.log(`Loaded existing cache with ${Object.keys(cache).length} entries`);
      } catch (error) {
        console.error('Error reading cache file:', error);
      }
    }

    let processedCount = 0;
    let newFetches = 0;
    let errors = 0;

    // 各選手についてWikipedia情報を取得
    for (const player of players) {
      processedCount++;
      
      // 既にキャッシュにある場合はスキップ（7日以内の場合）
      if (cache[player.player_id]) {
        const cachedDate = new Date(cache[player.player_id].lastUpdated);
        const now = new Date();
        const daysDiff = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff < 7) {
          console.log(`${processedCount}/${players.length}: ${player.name} (${player.player_id}) - Using cached data (${daysDiff.toFixed(1)} days old)`);
          continue;
        }
      }

      try {
        console.log(`${processedCount}/${players.length}: Fetching ${player.name} (${player.player_id})...`);
        
        const wikipediaData = await fetchWikipediaInfo(player.name);
        cache[player.player_id] = wikipediaData;
        newFetches++;
        
        // 進捗を表示
        if (wikipediaData.found) {
          console.log(`✅ Found: ${wikipediaData.data?.title} - ${wikipediaData.data?.description || 'No description'}`);
        } else {
          console.log(`❌ Not found: ${player.name}`);
        }
        
        // APIレート制限対応：1秒待機
        await delay(1000);
        
        // 10件ごとにキャッシュを保存
        if (newFetches % 10 === 0) {
          fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2));
          console.log(`💾 Cache saved (${newFetches} new entries)`);
        }
        
      } catch (error) {
        console.error(`Error processing ${player.name}:`, error);
        errors++;
        
        // エラーの場合も記録
        cache[player.player_id] = {
          found: false,
          message: 'エラーが発生しました',
          lastUpdated: new Date().toISOString()
        };
      }
    }

    // 最終的なキャッシュを保存
    fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2));
    
    console.log('\n=== Batch Wikipedia Fetch Complete ===');
    console.log(`Total players: ${players.length}`);
    console.log(`New fetches: ${newFetches}`);
    console.log(`Errors: ${errors}`);
    console.log(`Cache entries: ${Object.keys(cache).length}`);
    console.log(`Found data: ${Object.values(cache).filter(c => c.found).length}`);
    
    // 統計情報を生成
    const stats = {
      total_players: players.length,
      cached_entries: Object.keys(cache).length,
      found_count: Object.values(cache).filter(c => c.found).length,
      not_found_count: Object.values(cache).filter(c => !c.found).length,
      last_updated: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(process.cwd(), 'data', 'wikipedia_stats.json'), 
      JSON.stringify(stats, null, 2)
    );
    
    console.log('Stats saved to wikipedia_stats.json');
    
  } finally {
    db.close();
  }
}

// スクリプト実行
if (require.main === module) {
  main().catch(console.error);
}

export { fetchWikipediaInfo };