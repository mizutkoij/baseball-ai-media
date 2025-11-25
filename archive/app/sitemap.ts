import { MetadataRoute } from 'next'
import { q } from './lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://baseball-ai-media.vercel.app'
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24*60*60*1000)
  const futureRange = new Date(today.getTime() + 7*24*60*60*1000)

  let gameRoutes: MetadataRoute.Sitemap = []
  
  try {
    // 直近1週間の試合データを取得
    const rows = await q<{ game_id: string, date: string }>(`
      select game_id, to_char(date,'YYYY-MM-DD') as date
      from games where date between $1 and $2
      union
      select game_id, to_char(date,'YYYY-MM-DD') as date  
      from schedules where date between $1 and $2
      order by date desc
      limit 100
    `, [yesterday.toISOString().slice(0,10), futureRange.toISOString().slice(0,10)])

    gameRoutes = [
      // 今日の試合一覧（最重要）
      {
        url: `${baseUrl}/games?level=NPB2&date=${today.toISOString().slice(0,10)}`,
        lastModified: new Date(),
        changeFrequency: 'hourly',
        priority: 0.9,
      },
      {
        url: `${baseUrl}/games?level=NPB1&date=${today.toISOString().slice(0,10)}`,
        lastModified: new Date(),
        changeFrequency: 'hourly',
        priority: 0.9,
      },
      // 試合詳細ページ
      ...rows.map(row => ({
        url: `${baseUrl}/game/${row.game_id}`,
        lastModified: new Date(),
        changeFrequency: 'hourly' as const,
        priority: 0.8,
      })),
    ]
  } catch (error) {
    console.warn('Failed to generate game routes for sitemap:', error)
  }
  
  // Generate seasons entries (2016-2025) - 10 years for maximum SEO coverage
  const YEARS = Array.from({ length: 2025 - 2016 + 1 }, (_, i) => 2016 + i);
  const seasons = YEARS.map(year => ({
    url: `${baseUrl}/seasons/${year}`,
    lastModified: new Date(),
    changeFrequency: year >= 2019 ? 'weekly' as const : 'yearly' as const,
    priority: year >= 2019 ? 0.7 : 0.5,
  }));
  
  // Generate team entries for each year - 10 years × 12 teams = 120 URLs
  const TEAMS = ['T', 'S', 'C', 'YS', 'D', 'G', 'H', 'L', 'E', 'M', 'F', 'B']; // All NPB teams
  const currentYear = new Date().getFullYear();
  const teamPages = YEARS.flatMap(year => 
    TEAMS.map(team => ({
      url: `${baseUrl}/teams/${year}/${team}`,
      lastModified: new Date(),
      changeFrequency: year === currentYear ? 'daily' as const : 
                       year >= 2019 ? 'monthly' as const : 'yearly' as const,
      priority: year === currentYear ? 0.6 : 
                year >= 2019 ? 0.4 : 0.3,
    }))
  );
  
  // Static pages + games + seasons
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/games`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.95,
    },
    ...gameRoutes,
    {
      url: `${baseUrl}/players`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/teams`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/standings`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/rankings`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/matchups`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/column`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/column/re24-winning-lines`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/column/opsplus-vs-wrcplus`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/records`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // Add seasons and team routes
    ...seasons,
    ...teamPages
  ]
}