import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://baseball-ai-media.vercel.app'
  
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
  
  // Static pages + seasons
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
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
      url: `${baseUrl}/columns`,
      lastModified: new Date(),
      changeFrequency: 'daily',
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