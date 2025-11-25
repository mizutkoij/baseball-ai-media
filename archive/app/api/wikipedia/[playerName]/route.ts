import { NextRequest, NextResponse } from 'next/server';

// Wikipedia APIから選手情報を取得
export async function GET(
  request: NextRequest,
  { params }: { params: { playerName: string } }
) {
  try {
    const playerName = decodeURIComponent(params.playerName);
    console.log('Wikipedia API called for:', playerName);

    // 選手名をクリーンアップ
    const cleanName = playerName
      .replace(/[　\s]+/g, '')
      .replace(/[（）()]/g, '')
      .trim();

    // Wikipedia日本語版APIで検索
    const searchUrl = `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanName)}`;
    
    try {
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
            // 最初の検索結果の詳細を取得
            const firstTitle = titles[0];
            const detailResponse = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`, {
              headers: {
                'User-Agent': 'Baseball-AI-Media/1.0 (https://baseball-ai-media.vercel.app) Node.js'
              }
            });

            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              return NextResponse.json({
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
                }
              });
            }
          }
        }

        return NextResponse.json({
          found: false,
          searchUrl: `https://ja.wikipedia.org/wiki/Special:Search/${encodeURIComponent(cleanName)}`,
          message: 'ページが見つかりませんでした'
        });
      }

      const data = await response.json();
      
      return NextResponse.json({
        found: true,
        data: {
          title: data.title,
          extract: data.extract,
          description: data.description,
          url: data.content_urls?.desktop?.page,
          thumbnail: data.thumbnail?.source,
          birth_date: extractBirthDate(data.extract),
          career_highlights: extractCareerHighlights(data.extract)
        }
      });

    } catch (fetchError) {
      console.error('Wikipedia fetch error:', fetchError);
      return NextResponse.json({
        found: false,
        searchUrl: `https://ja.wikipedia.org/wiki/Special:Search/${encodeURIComponent(cleanName)}`,
        message: 'Wikipedia情報の取得に失敗しました'
      });
    }

  } catch (error) {
    console.error('Wikipedia API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// 生年月日を抽出する関数
function extractBirthDate(text: string): string | null {
  if (!text) return null;
  
  // 日本語の日付パターンを検索
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
  
  // 野球関連のキーワードを含む文を抽出
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
  
  return highlights.slice(0, 3); // 最大3つまで
}