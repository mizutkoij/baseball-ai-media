import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  const baseUrl = 'https://baseball-ai-media.vercel.app'
  
  try {
    // Get player index for dynamic routes
    const playersIndexPath = path.join(process.cwd(), 'public', 'data', 'players', 'players_index.json')
    
    if (!fs.existsSync(playersIndexPath)) {
      return new Response('Player index not found', { status: 404 })
    }
    
    const playersData = JSON.parse(fs.readFileSync(playersIndexPath, 'utf8'))
    
    // Split into chunks of 1000 players per sitemap
    const chunkSize = 1000
    const chunks = []
    
    for (let i = 0; i < playersData.length; i += chunkSize) {
      chunks.push(playersData.slice(i, i + chunkSize))
    }
    
    // Generate sitemap index XML
    const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunks.map((_, index) => `  <sitemap>
    <loc>${baseUrl}/players-sitemap-${index + 1}.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`
    
    return new Response(sitemapIndexXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400'
      }
    })
    
  } catch (error) {
    console.error('Error generating players sitemap index:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}