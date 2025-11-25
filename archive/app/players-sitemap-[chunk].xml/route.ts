import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

// Prevent static generation during build
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ chunk: string }> | { chunk: string } }
) {
  const baseUrl = 'https://baseball-ai-media.vercel.app'
  
  // Handle both Promise and non-Promise params safely
  let resolvedParams: { chunk: string };
  try {
    resolvedParams = await Promise.resolve(context.params);
  } catch (error) {
    console.error('Error resolving params:', error);
    return new Response('Invalid parameters', { status: 400 });
  }
  
  if (!resolvedParams || !resolvedParams.chunk) {
    return new Response('Chunk parameter missing', { status: 400 });
  }
  
  const chunkNumber = parseInt(resolvedParams.chunk)
  
  if (isNaN(chunkNumber) || chunkNumber < 1) {
    return new Response('Invalid chunk number', { status: 400 })
  }
  
  try {
    // Get player index for dynamic routes
    const playersIndexPath = path.join(process.cwd(), 'public', 'data', 'players', 'players_index.json')
    
    if (!fs.existsSync(playersIndexPath)) {
      return new Response('Player index not found', { status: 404 })
    }
    
    const playersData = JSON.parse(fs.readFileSync(playersIndexPath, 'utf8'))
    
    // Split into chunks of 1000 players per sitemap
    const chunkSize = 1000
    const startIndex = (chunkNumber - 1) * chunkSize
    const endIndex = startIndex + chunkSize
    const chunk = playersData.slice(startIndex, endIndex)
    
    if (chunk.length === 0) {
      return new Response('Chunk not found', { status: 404 })
    }
    
    // Generate sitemap XML for this chunk
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunk.map((player: any) => `  <url>
    <loc>${baseUrl}/players/${player.player_id}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`).join('\n')}
</urlset>`
    
    return new Response(sitemapXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400'
      }
    })
    
  } catch (error) {
    console.error('Error generating players sitemap chunk:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}