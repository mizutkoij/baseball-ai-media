import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://baseball-ai-media.vercel.app'
  
  // Generate seasons entries (2019-2025)
  const years = Array.from({length: 7}, (_, i) => 2019 + i);
  const seasons = years.map(year => ({
    url: `${baseUrl}/seasons/${year}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));
  
  // Generate team entries for each year
  const teams = ['T', 'S', 'C', 'YS', 'D', 'G', 'H', 'L', 'E', 'M', 'F', 'B']; // All NPB teams
  const teamPages = years.flatMap(year => 
    teams.map(team => ({
      url: `${baseUrl}/teams/${year}/${team}`,
      lastModified: new Date(),
      changeFrequency: year === new Date().getFullYear() ? 'daily' as const : 'monthly' as const,
      priority: year === new Date().getFullYear() ? 0.6 : 0.4,
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