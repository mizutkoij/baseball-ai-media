import { MetadataRoute } from 'next'
import fs from 'fs'
import path from 'path'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://baseball-ai-media.vercel.app'
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
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
  ]

  // Dynamic player pages
  let playerPages: MetadataRoute.Sitemap = []
  
  try {
    // Get player index for dynamic routes
    const playersIndexPath = path.join(process.cwd(), 'public', 'data', 'players', 'players_index.json')
    
    if (fs.existsSync(playersIndexPath)) {
      const playersData = JSON.parse(fs.readFileSync(playersIndexPath, 'utf8'))
      
      playerPages = playersData.map((player: any) => ({
        url: `${baseUrl}/players/${player.player_id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }))
    }
  } catch (error) {
    console.warn('Failed to generate player sitemap entries:', error)
  }

  return [...staticPages, ...playerPages]
}