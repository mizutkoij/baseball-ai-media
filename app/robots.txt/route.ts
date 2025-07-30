export function GET() {
  const robotsTxt = `User-agent: *
Allow: /

# Main sitemap for static pages
Sitemap: https://baseball-ai-media.vercel.app/sitemap.xml

# Players sitemap index (7000+ player pages split into chunks)
Sitemap: https://baseball-ai-media.vercel.app/players-sitemap.xml

# Crawl-delay for being respectful
Crawl-delay: 1`

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400'
    }
  })
}